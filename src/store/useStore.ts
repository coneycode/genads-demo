// store/useStore.ts —— 全局状态 + sendMessage 流水线（规格书 §12）

import { create } from "zustand";
import type {
  Advertiser,
  BidCandidate,
  EvalScore,
  GateDecision,
  IntentResult,
  Metrics,
  Turn,
} from "../engine/types";
import { ADVERTISERS } from "../data/advertisers";
import { exactScenario } from "../data/scenarios";
import {
  PresetEngine,
  LLMEngine,
  SWITCH_MSG,
  type IntentEngine,
} from "../engine/intentEngine";
import { rankBids } from "../engine/bidding";
import {
  computeMetricsFromTurns,
  computeTrustCost,
  decideGate,
  thresholdFromAggressiveness,
} from "../engine/trustModel";
import { evaluate } from "../engine/evaluator";

type EngineMode = "preset" | "llm";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  turn?: Turn; // 仅 ai 消息附带
}

// 从消息列表抽出 turn 序列（ai 消息按对话顺序）
function turnsOf(msgs: ChatMessage[]): Turn[] {
  return msgs
    .filter((m) => m.role === "ai" && m.turn)
    .map((m) => m.turn!) as Turn[];
}

interface State {
  aggressiveness: number;
  engineMode: EngineMode;
  llmBaseURL: string;
  llmApiKey: string;
  llmModel: string;
  llmError: string | null; // 真实 LLM 调用失败原因（null=未用或成功）

  advertisers: Advertiser[]; // 含可变 bid
  messages: ChatMessage[];
  currentTurn: Turn | null;
  metrics: Metrics;
  cumulativeTrustCost: number;
  adShownCount: number;
  turnCount: number;
  revenueSeries: number[]; // 每轮累计收入（迷你折线 §10.5）
  retentionSeries: number[]; // 每轮留存趋势

  // tour
  tourActive: boolean;
  tourStep: number; // 三幕内子步的全局序号
  tourSeen: boolean; // 是否已经自动出现过

  sendMessage: (text: string) => Promise<void>;
  setAggressiveness: (v: number) => void;
  setBid: (advertiserId: string, bid: number) => void;
  setEngineMode: (m: EngineMode) => void;
  setLlmConfig: (k: { baseURL?: string; apiKey?: string; model?: string }) => void;
  reset: () => void;
  startTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  endTour: () => void;
}

const INITIAL_METRICS: Metrics = {
  exposureRate: 0,
  clickRate: 0,
  revenue: 0,
  retention: 68,
  negativeFeedback: 2,
  activeClose: 1,
};

let idc = 0;
const nid = () => `m${++idc}`;

function buildEngine(s: State): IntentEngine {
  if (s.engineMode === "llm" && s.llmApiKey) {
    return new LLMEngine({
      baseURL: s.llmBaseURL,
      apiKey: s.llmApiKey,
      model: s.llmModel,
    });
  }
  return new PresetEngine();
}

// 仅重排"当前 turn"的竞价（出价变化时用）。保留该 turn 的闸门/matchMap/回复正文，
// 只用新出价重算 candidates/winner/showCard/eval。不动历史、不动闸门——
// 策略(激进度)只影响未来消息，不回溯重写历史。
function recomputeCurrentTurn(
  msgs: ChatMessage[],
  advertisers: Advertiser[]
): { msgs: ChatMessage[]; currentTurn: Turn | null } {
  let currentTurn: Turn | null = null;
  const out = [...msgs];
  for (let i = out.length - 1; i >= 0; i--) {
    const m = out[i];
    if (m.role !== "ai" || !m.turn) continue;
    const prev = m.turn;
    if (prev.gate === "none") {
      currentTurn = prev;
      break;
    }
    const candidates = rankBids(prev.userText, prev.intent, advertisers, prev.matchMap);
    const winner = candidates[0]?.advertiser ?? null;
    const shown = prev.gate === "trigger" && !!winner;
    const evalScore = evaluate(
      prev.intent,
      prev.gate,
      winner ? candidates[0]?.matchScore ?? null : null,
      prev.trustCost
    );
    const newTurn: Turn = { ...prev, candidates, winner, showCard: shown, eval: evalScore };
    currentTurn = newTurn;
    out[i] = { ...m, turn: newTurn };
    break;
  }
  return { msgs: out, currentTurn };
}

export const useStore = create<State>((set, get) => ({
  aggressiveness: 0.25,
  engineMode: "preset",
  llmBaseURL: "https://api.deepseek.com",
  llmApiKey: import.meta.env.VITE_DEEPSEEK_KEY ?? "",
  llmModel: "deepseek-v4-flash",
  llmError: null,

  advertisers: ADVERTISERS.map((a) => ({ ...a })),
  messages: [],
  currentTurn: null,
  metrics: { ...INITIAL_METRICS },
  cumulativeTrustCost: 0,
  adShownCount: 0,
  turnCount: 0,
  revenueSeries: [],
  retentionSeries: [],

  tourActive: false,
  tourStep: 0,
  tourSeen: false,

  sendMessage: async (text: string) => {
    const state = get();
    const usingLlm = state.engineMode === "llm" && !!state.llmApiKey;

    // 1. 意图识别（LLM 失败 → 回退 preset，但把错误原因暴露到 llmError）
    let intent: IntentResult;
    let llmError: string | null = null;
    if (usingLlm) {
      try {
        const engine = buildEngine(state);
        intent = await engine.analyze(text);
      } catch (e) {
        llmError = e instanceof Error ? e.message : String(e);
        const fb = new PresetEngine();
        intent = await fb.analyze(text);
      }
    } else {
      if (state.engineMode === "llm") llmError = "未配置 API Key，已回退预设";
      const engine = buildEngine(state);
      intent = await engine.analyze(text);
    }
    set({ llmError });

    // 预设模式 + 非预设场景：预设处理不了任意输入，只回切换提示，不竞价/不出卡
    const presetUnmatched = state.engineMode === "preset" && !exactScenario(text);

    // 2-3. 闸门
    const threshold = thresholdFromAggressiveness(state.aggressiveness);
    const gate: GateDecision = presetUnmatched ? "none" : decideGate(intent.strength, threshold);

    // 3. 语义匹配度（发送时算一次，缓存在 turn；回溯重算复用，不重复调 LLM）
    const sameCategoryAds = state.advertisers.filter(
      (a) => a.category === intent.category
    );
    let matchMap: Record<string, number> = {};
    if (!presetUnmatched) {
      const fb = new PresetEngine();
      try {
        const engine = usingLlm ? buildEngine(state) : fb;
        matchMap = await engine.scoreMatches(text, intent, sameCategoryAds);
      } catch (e) {
        if (usingLlm)
          llmError = (llmError ? llmError + "；" : "") + `匹配度:${e instanceof Error ? e.message : e}`;
        matchMap = await fb.scoreMatches(text, intent, sameCategoryAds);
      }
      set({ llmError });
    }

    // 4. 竞价（仅同品类，gate !== none 才进入；用语义 matchMap）
    let candidates: BidCandidate[] = [];
    let winner: Advertiser | null = null;
    if (gate !== "none") {
      candidates = rankBids(text, intent, state.advertisers, matchMap);
      winner = candidates[0]?.advertiser ?? null;
    }

    // 5. 信任损耗
    const trustCost = computeTrustCost(gate, intent.strength);

    // 7-8. AI 回复正文 + 是否出卡。回复由引擎生成：预设=罐头/切换提示，LLM=模型自然回答。
    const shown = gate === "trigger" && !!winner;
    let aiText: string;
    if (presetUnmatched) {
      aiText = SWITCH_MSG;
    } else {
      const fb = new PresetEngine();
      try {
        const engine = usingLlm ? buildEngine(state) : fb;
        aiText = await engine.reply(text, intent, winner, gate);
      } catch (e) {
        if (usingLlm)
          llmError = (llmError ? llmError + "；" : "") + `回复:${e instanceof Error ? e.message : e}`;
        set({ llmError });
        aiText = await fb.reply(text, intent, winner, gate);
      }
    }
    const showCard = shown;

    // 9. eval
    const evalScore: EvalScore = evaluate(
      intent,
      gate,
      winner ? candidates[0]?.matchScore ?? null : null,
      trustCost
    );

    const turn: Turn = {
      userText: text,
      intent,
      gate,
      candidates,
      winner,
      aiText,
      showCard,
      trustCost,
      eval: evalScore,
      matchMap,
    };

    const userMsg: ChatMessage = { id: nid(), role: "user", text };
    const aiMsg: ChatMessage = { id: nid(), role: "ai", text: aiText, turn };

    const newMsgs = [...state.messages, userMsg, aiMsg];
    // 6. 指标：从全部历史 turn 统一重算
    const { metrics, cumulativeTrustCost, adShownCount, turnCount, revenueSeries, retentionSeries } =
      computeMetricsFromTurns(turnsOf(newMsgs));

    set({
      messages: newMsgs,
      currentTurn: turn,
      metrics,
      cumulativeTrustCost,
      adShownCount,
      turnCount,
      revenueSeries,
      retentionSeries,
    });
  },

  setAggressiveness: (v) => {
    // 非回溯：激进度只影响"之后"发的新消息，不改写历史。
    // 拖滑块仅更新阈值（GateStage 阈值线实时移动），要看新策略效果需发新消息。
    set({ aggressiveness: v });
  },

  setBid: (advertiserId, bid) => {
    const state = get();
    const advertisers = state.advertisers.map((a) =>
      a.id === advertiserId ? { ...a, bid } : a
    );
    // 仅重排当前 turn 的竞价（保留其闸门/matchMap/回复），看中选是否易主
    const { msgs, currentTurn } = recomputeCurrentTurn(state.messages, advertisers);
    const { metrics, cumulativeTrustCost, adShownCount, turnCount, revenueSeries, retentionSeries } =
      computeMetricsFromTurns(turnsOf(msgs));
    set({
      advertisers,
      messages: msgs,
      currentTurn: currentTurn ?? state.currentTurn,
      metrics,
      cumulativeTrustCost,
      adShownCount,
      turnCount,
      revenueSeries,
      retentionSeries,
    });
  },

  setEngineMode: (m) => set({ engineMode: m }),
  setLlmConfig: (k) =>
    set((s) => ({
      llmBaseURL: k.baseURL ?? s.llmBaseURL,
      llmApiKey: k.apiKey ?? s.llmApiKey,
      llmModel: k.model ?? s.llmModel,
    })),

  reset: () =>
    set({
      aggressiveness: 0.25,
      advertisers: ADVERTISERS.map((a) => ({ ...a })),
      messages: [],
      currentTurn: null,
      metrics: { ...INITIAL_METRICS },
      cumulativeTrustCost: 0,
      adShownCount: 0,
      turnCount: 0,
      revenueSeries: [],
      retentionSeries: [],
      llmError: null,
      tourActive: false,
      tourStep: 0,
    }),

  startTour: () => set({ tourActive: true, tourStep: 0, tourSeen: true }),
  nextTourStep: () => set((s) => ({ tourStep: s.tourStep + 1 })),
  prevTourStep: () => set((s) => ({ tourStep: Math.max(0, s.tourStep - 1) })),
  endTour: () => set({ tourActive: false }),
}));
