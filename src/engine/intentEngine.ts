// engine/intentEngine.ts —— 意图引擎接口 + Preset + LLM（规格书 §8）

import type { Advertiser, Category, GateDecision, IntentResult } from "./types";
import { SCENARIOS, exactScenario } from "../data/scenarios";
import { keywordMatchScore } from "./bidding";

export const SWITCH_MSG =
  "预设模式未接入真实大模型，暂无法回答您的问题，请切换到真实 LLM 再对话。";

export interface IntentEngine {
  name: string;
  // 一次返回意图 + 各商家语义匹配度。history=近期对话(多轮上下文),让模型理解追问(如"还是有点贵"=要更便宜)。
  // 预设=关键词(即时,忽略 history)；LLM=单次调用(意图+匹配合并,省一次往返)。
  analyzeAndMatch(
    query: string,
    advertisers: Advertiser[],
    history?: { role: "user" | "assistant"; content: string }[]
  ): Promise<{ intent: IntentResult; matchMap: Record<string, number> }>;
  // 生成 AI 回复正文。history 让回复贴合上下文。
  reply(
    query: string,
    intent: IntentResult,
    winner: Advertiser | null,
    gate: GateDecision,
    history?: { role: "user" | "assistant"; content: string }[]
  ): Promise<string>;
}

// 预设模式对"命中的预设场景"用的罐头回复（tour 依赖）
function genCannedReply(
  intent: IntentResult,
  gate: GateDecision,
  winner: Advertiser | null
): string {
  if (intent.category === "none") {
    if (intent.strength < 0.1) {
      return "我在。先深呼吸——你想聊什么我都陪你，慢慢说。";
    }
    return "好，我帮你处理这件事，先把需求说细一点。";
  }
  if (intent.category === "phone") {
    const base =
      "从你的需求看，性能/性价比是主要考量。这个价位段有几条思路：看重游戏帧率选偏电竞调校的，看重影像选旗舰级——";
    const soft = winner ? `顺带一提，${winner.adText}` : "";
    if (gate === "trigger") return base + (winner ? winner.adText : "");
    if (gate === "soft") return base + soft;
    return base;
  }
  if (intent.category === "renovation") {
    const base =
      "装修这种高客单决策，建议先明确预算、面积和风格优先级，再决定走整装公司还是独立设计师——";
    const soft = winner ? `顺带一提，${winner.adText}` : "";
    if (gate === "trigger") return base + (winner ? winner.adText : "");
    if (gate === "soft") return base + soft;
    return base;
  }
  return "好的，我理解你的需求了。";
}

function layerOf(strength: number): IntentResult["layer"] {
  if (strength >= 0.7) return "strong";
  if (strength >= 0.3) return "weak";
  return "none";
}

// 关键词兜底（未命中精确场景时）
const PHONE_KW = ["手机", "iphone", "安卓", "旗舰", "游戏", "续航", "拍照", "电池", "屏幕"];
const RENO_KW = ["装修", "全屋", "整装", "设计师", "装修公司", "小户型", "空间", "预算"];
const EMO_KW = ["emo", "难过", "不开心", "心情不好", "郁闷", "烦", "烦死", "陪我", "聊聊", "心情", "分手", "累", "孤独", "哭", "想哭", "崩溃", "焦虑", "压力"];

function keywordFallback(query: string): IntentResult {
  const q = query.toLowerCase();
  if (EMO_KW.some((k) => q.includes(k))) {
    return { strength: 0.05, layer: "none", category: "none", reason: "命中情感词，纯情感/陪伴诉求" };
  }
  if (PHONE_KW.some((k) => q.includes(k.toLowerCase()))) {
    return { strength: 0.45, layer: "weak", category: "phone", reason: "命中手机相关词，弱-中商业意图" };
  }
  if (RENO_KW.some((k) => q.includes(k))) {
    return { strength: 0.45, layer: "weak", category: "renovation", reason: "命中装修相关词，弱-中商业意图" };
  }
  return { strength: 0.2, layer: "none", category: "none", reason: "未识别明确商业信号，按纯信息处理" };
}

// —— PresetEngine：精确匹配场景，否则关键词兜底 ——
export class PresetEngine implements IntentEngine {
  name = "preset";
  async analyzeAndMatch(
    query: string,
    advertisers: Advertiser[],
    _history?: { role: "user" | "assistant"; content: string }[]
  ): Promise<{ intent: IntentResult; matchMap: Record<string, number> }> {
    const exact = exactScenario(query);
    const intent: IntentResult = exact
      ? {
          strength: exact.strength,
          layer: layerOf(exact.strength),
          category: exact.category,
          reason: exact.reason,
        }
      : keywordFallback(query);
    const matchMap: Record<string, number> = {};
    for (const ad of advertisers) {
      matchMap[ad.id] = keywordMatchScore(ad, intent, query);
    }
    return { intent, matchMap };
  }
  async reply(
    query: string,
    intent: IntentResult,
    winner: Advertiser | null,
    gate: GateDecision,
    _history?: { role: "user" | "assistant"; content: string }[]
  ): Promise<string> {
    // 命中预设场景 → 罐头回复（tour 依赖）；否则老实提示切到 LLM
    if (exactScenario(query)) return genCannedReply(intent, gate, winner);
    return SWITCH_MSG;
  }
}

// —— LLMEngine：OpenAI 兼容 ——
// 有用户粘贴的 key → 直连 DeepSeek(浏览器侧)。
// 无 key → 走同源 /api/llm 代理(服务器侧注入 key,密钥不进浏览器)。
export class LLMEngine implements IntentEngine {
  name = "llm";
  private opts: { baseURL: string; apiKey: string; model: string };
  constructor(opts: { baseURL: string; apiKey: string; model: string }) {
    this.opts = opts;
  }

  // 统一 chat/completions 调用。payload 不含 baseURL/key(由本方法决定走哪条路)。
  private async call(payload: Record<string, unknown>): Promise<any> {
    const { baseURL, apiKey } = this.opts;
    // DeepSeek 默认开 thinking(思考模式),思考过程有随机性,会让意图判定/匹配度抖动。
    // 关掉 thinking + temp 0 → 确定性,同一句每次结果一致。仅 DeepSeek 带 thinking 参数(其它 provider 不带,避免 400)。
    if (/deepseek\.com/.test(baseURL)) payload.thinking = { type: "disabled" };
    if (apiKey) {
      // 直连(用户自带 key)
      const res = await fetch(baseURL.replace(/\/$/, "") + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`http ${res.status}`);
      return res.json();
    }
    // 走服务器代理(无 key,密钥在服务器)
    const res = await fetch("/api/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseURL, ...payload }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error ? `proxy ${res.status}: ${e.error}` : `proxy http ${res.status}`);
    }
    return res.json();
  }

  // 一次调用同时判定意图 + 对各商家打语义匹配分（省一次往返）。history 提供多轮上下文。
  async analyzeAndMatch(
    query: string,
    advertisers: Advertiser[],
    history?: { role: "user" | "assistant"; content: string }[]
  ): Promise<{ intent: IntentResult; matchMap: Record<string, number> }> {
    const { model } = this.opts;
    const list = advertisers
      .map((a) => `- id="${a.id}" 品类:${a.category} 名称:${a.name} 文案:${a.adText} 关键词:${a.matchKeywords.join("/")}`)
      .join("\n");
    const sys = `你是意图识别+广告匹配器。结合对话上下文,对用户【最新一条】消息同时做两件事:
1) 判断其商业意图: strength(0~1浮点)、category("phone"|"renovation"|"none")、reason(一句中文)
2) 对下列每个商家,判断其与用户意图的语义匹配度 score(0~1)
只输出一个 JSON,不要解释或代码块: {"strength":0~1,"category":"...","reason":"...","matches":[{"id":"商家id","score":0~1},...]}
规则:
- 强(>=0.7):任何明确的购买/推荐/选购请求(含"推荐""买""想换""预算""型号对比""还是有点贵/能不能便宜点"等追问),即便没给具体预算或型号。
- 弱(0.3~0.7):泛使用咨询(如"屏幕变暗怎么回事"),不是要买,是问用法/知识。
- none(<0.3):纯情感/纯知识/纯工具(emo、光合作用、写辞职信等)。
- 匹配按语义而非字面词(如"办公"≈"商务"、"拍照"、"续航")。matches 须含全部商家。`;
    const msgs: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: sys },
    ];
    // 注入近期对话历史,让模型理解追问(如"还是有点贵"=要更便宜的)
    if (history && history.length) {
      for (const h of history.slice(-6)) {
        msgs.push({ role: h.role, content: h.content });
      }
    }
    msgs.push({ role: "user", content: `【最新一条消息】${query}\n商家：\n${list}` });
    const data = await this.call({
      model,
      messages: msgs,
      temperature: 0,
      response_format: { type: "json_object" },
    });
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = extractIntentAndMatches(content);
    const strength = clampNum(Number(parsed.strength));
    const cat = parsed.category;
    const category: Category =
      cat != null && ["phone", "renovation", "none"].includes(cat)
        ? (cat as Category)
        : "none";
    const intent: IntentResult = {
      strength,
      layer: layerOf(strength),
      category,
      reason: String(parsed.reason ?? "LLM 分析"),
    };
    const matchMap: Record<string, number> = {};
    for (const ad of advertisers) {
      const s = parsed.matches?.[ad.id];
      matchMap[ad.id] = s != null ? clampNum(Number(s)) : keywordMatchScore(ad, intent, query);
    }
    return { intent, matchMap };
  }

  // 真实对话回复：让模型自然回答用户那句话。失败抛错由上层回退。
  async reply(
    query: string,
    intent: IntentResult,
    winner: Advertiser | null,
    gate: GateDecision,
    history?: { role: "user" | "assistant"; content: string }[]
  ): Promise<string> {
    const { model } = this.opts;
    const sys =
      "你是 AI 对话助手。结合对话上下文，用一两句中文自然回答用户【最新一条】消息。若用户在选购，可顺带引出最贴合的选项，但别堆砌。不要复读商家文案原文。";
    const msgs: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: sys },
    ];
    if (history && history.length) {
      for (const h of history.slice(-6)) {
        msgs.push({ role: h.role, content: h.content });
      }
    }
    let user = `【最新一条消息】${query}`;
    // 仅 trigger（出卡）时才让回复模型知道中选产品并点名；soft 不出卡，
    // 不透露具体商家，避免"文字点了名却没有卡片"的错位
    if (winner && gate === "trigger") {
      user += `\n\n【系统已为你匹配的唯一推荐选项】：${winner.name}——${winner.adText}。
要求：你只能围绕这个匹配选项来回应用户，用一两句自然的话引出它的卖点/适合场景。
严禁推荐或提及其他任何品牌、型号（如红米/真我/iPhone/小米等池外产品）——只能讲"${winner.name}"。
若用户嫌贵/想要更便宜，可说明这个选项的性价比或定位，但不要承诺不存在的东西。`;
    }
    msgs.push({ role: "user", content: user });
    const data = await this.call({
      model,
      messages: msgs,
      temperature: 0.7,
      max_tokens: 200,
    });
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    return text.trim() || genCannedReply(intent, gate, winner);
  }
}

// 容错提取 {strength,category,reason,matches[]}
function extractIntentAndMatches(content: string): {
  strength?: number;
  category?: string;
  reason?: string;
  matches?: Record<string, number>;
} {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : content).trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return {};
  let obj: { strength?: number; category?: string; reason?: string; matches?: { id?: string; score?: number }[] } = {};
  try {
    obj = JSON.parse(raw.slice(first, last + 1));
  } catch {
    return {};
  }
  const m: Record<string, number> = {};
  for (const x of obj.matches ?? []) {
    if (x.id != null && x.score != null) m[String(x.id)] = Number(x.score);
  }
  return { strength: obj.strength as number | undefined, category: obj.category, reason: obj.reason, matches: m };
}

function clampNum(v: number): number {
  if (Number.isNaN(v)) return 0.2;
  return Math.max(0, Math.min(1, v));
}

export { SCENARIOS };
