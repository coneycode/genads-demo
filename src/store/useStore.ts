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
  OUT_OF_SCOPE_MSG,
  isOversizeOrInjection,
  isInDomain,
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
import { reportTurn } from "../lib/reporter";

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
  llmError: string | null; // 真实 LLM 调用/校验失败原因（null=未用或成功）
  thinking: boolean; // AI 正在生成回复（打字指示器）

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
  // LLM 模式即用 LLMEngine：有用户 key→直连；无 key→走 /api/llm 代理(密钥在服务器)
  if (s.engineMode === "llm") {
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
  llmApiKey: "",
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
  thinking: false,

  tourActive: false,
  tourStep: 0,
  tourSeen: false,

  sendMessage: async (text: string) => {
    const state = get();
    const usingLlm = state.engineMode === "llm";
    set({ thinking: true });

    // 近期对话历史(多轮上下文),让模型理解追问(如"还是有点贵"=要更便宜)
    const history = state.messages
      .slice(-6)
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })) as
      { role: "user" | "assistant"; content: string }[];

    let llmError: string | null = null;
    let fellBack = false; // 是否发生了 fail-closed 回退（埋点用）
    const fb = new PresetEngine();

    // 0. 入口硬拦(确定性,不调 LLM):超长 / 疑似注入 → 统一越界文案,不出卡
    const entryBlocked = usingLlm && isOversizeOrInjection(text);

    // 1. 意图 + 语义匹配。入口拦截时合成一个 none 意图；否则 LLM 模式调 LLMEngine(硬化提示词),失败→回退 PresetEngine 关键词
    let intent: IntentResult;
    let matchMap: Record<string, number> = {};
    if (entryBlocked) {
      intent = { strength: 0.2, layer: "none", category: "none", reason: "入口拦截:超长或疑似注入" };
    } else {
      try {
        const engine = usingLlm ? buildEngine(state) : fb;
        const r = await engine.analyzeAndMatch(text, state.advertisers, history);
        intent = r.intent;
        matchMap = r.matchMap;
      } catch (e) {
        llmError = e instanceof Error ? e.message : String(e);
        fellBack = true;
        const r = await fb.analyzeAndMatch(text, state.advertisers, history);
        intent = r.intent;
        matchMap = r.matchMap;
      }
    }

    // 2. 拦阻判定(被拦→不出卡):
    //    入口拦截 / LLM 模式域外(非 phone·reno·情感陪伴 且非预设) → 越界文案；
    //    预设模式非精确预设 → SWITCH_MSG
    let blocked = false;
    let blockedMsg = SWITCH_MSG;
    if (entryBlocked) {
      blocked = true;
      blockedMsg = OUT_OF_SCOPE_MSG;
    } else if (usingLlm) {
      if (!isInDomain(text, intent)) {
        blocked = true;
        blockedMsg = OUT_OF_SCOPE_MSG;
      }
    } else {
      if (!exactScenario(text)) {
        blocked = true;
        blockedMsg = SWITCH_MSG;
      }
    }

    // 2.5 抑制推荐(LLM 模式·域内但不应出卡):用户否定/嫌贵上一条且池中无更合适选项
    //     → 不出卡,用 LLM 的判断说明当回复(展示"收手"的判断过程)。省一次调用。
    const DEFAULT_SUPPRESS_MSG = "现有广告主中没有更合适的选项，因此本轮不再推荐。";
    const suppressAd = usingLlm && intent.shouldRecommend === false;

    // 3. 闸门（被拦/抑止推荐则 none）
    const threshold = thresholdFromAggressiveness(state.aggressiveness);
    const gate: GateDecision = blocked || suppressAd ? "none" : decideGate(intent.strength, threshold);

    // 4. 竞价（仅同品类，gate !== none 才进入；用语义 matchMap）
    let candidates: BidCandidate[] = [];
    let winner: Advertiser | null = null;
    if (gate !== "none") {
      candidates = rankBids(text, intent, state.advertisers, matchMap);
      winner = candidates[0]?.advertiser ?? null;
    }

    // 5. 信任损耗
    const trustCost = computeTrustCost(gate, intent.strength);

    // 7-8. AI 回复正文 + 是否出卡。
    //   被拦 → 拦阻文案；
    //   抑止推荐 → LLM 的判断说明(reason),空则兜底；不出卡
    //   预设模式 → PresetEngine.reply(罐头/切换提示)；
    //   LLM 模式域内 → 受控散文,调用/校验失败 → fail-closed 回退预设罐头
    const shown = gate === "trigger" && !!winner;
    let aiText: string;
    if (blocked) {
      aiText = blockedMsg;
    } else if (suppressAd) {
      // 抑止推荐:用 LLM 的判断说明作回复,空则兜底；不再走 reply 二次调用
      aiText = intent.reason?.trim() ? intent.reason.trim() : DEFAULT_SUPPRESS_MSG;
    } else if (!usingLlm) {
      aiText = await fb.reply(text, intent, winner, gate, history);
    } else {
      try {
        const engine = buildEngine(state);
        aiText = await engine.reply(text, intent, winner, gate, history);
      } catch (e) {
        // LLM 调用失败 或 品牌校验失败 → 静默回退预设罐头
        llmError = (llmError ? llmError + "；" : "") + `回复:${e instanceof Error ? e.message : e}`;
        fellBack = true;
        aiText = await fb.reply(text, intent, winner, gate, history);
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
      judgment: suppressAd || undefined, // 抑止推荐:标记为"判断回复",前端独立样式
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
      thinking: false,
      llmError,
    });

    // 对话埋点：fire-and-forget，后端挂了也不影响前台体验（reporter 内部吞掉一切错误）
    reportTurn({
      userText: text,
      aiText,
      gate,
      category: intent.category,
      strength: intent.strength,
      showCard,
      winnerId: winner?.id ?? null,
      aggressiveness: state.aggressiveness,
      engineMode: state.engineMode,
      fallback: fellBack,
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
      thinking: false,
      llmError: null,
      tourActive: false,
      tourStep: 0,
    }),

  startTour: () => set({ tourActive: true, tourStep: 0, tourSeen: true }),
  nextTourStep: () => set((s) => ({ tourStep: s.tourStep + 1 })),
  prevTourStep: () => set((s) => ({ tourStep: Math.max(0, s.tourStep - 1) })),
  endTour: () => set({ tourActive: false }),
}));
