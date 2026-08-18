// engine/intentEngine.ts —— 意图引擎接口 + Preset + LLM（规格书 §8）

import type { Advertiser, Category, GateDecision, IntentResult } from "./types";
import { SCENARIOS, exactScenario } from "../data/scenarios";
import { keywordMatchScore } from "./bidding";

export const SWITCH_MSG =
  "预设模式未接入真实大模型，暂无法回答您的问题，请切换到真实 LLM 再对话。";

export interface IntentEngine {
  name: string;
  analyze(query: string): Promise<IntentResult>;
  // 对给定商家逐个算与 query 的语义匹配度(0~1)，返回 {id: score}。
  // 预设=关键词匹配；LLM=语义匹配(办公≈商务)。
  scoreMatches(
    query: string,
    intent: IntentResult,
    advertisers: Advertiser[]
  ): Promise<Record<string, number>>;
  // 生成 AI 回复正文。预设=罐头/切换提示；LLM=模型自然回答。
  reply(
    query: string,
    intent: IntentResult,
    winner: Advertiser | null,
    gate: GateDecision
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
  async analyze(query: string): Promise<IntentResult> {
    const exact = exactScenario(query);
    if (exact) {
      return {
        strength: exact.strength,
        layer: layerOf(exact.strength),
        category: exact.category,
        reason: exact.reason,
      };
    }
    return keywordFallback(query);
  }
  async scoreMatches(
    query: string,
    intent: IntentResult,
    advertisers: Advertiser[]
  ): Promise<Record<string, number>> {
    const map: Record<string, number> = {};
    for (const ad of advertisers) {
      map[ad.id] = keywordMatchScore(ad, intent, query);
    }
    return map;
  }
  async reply(
    query: string,
    intent: IntentResult,
    winner: Advertiser | null,
    gate: GateDecision
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

  async analyze(query: string): Promise<IntentResult> {
    const { model } = this.opts;
    const sys = `你是一个意图识别器。对用户在AI对话助手里发的一句话，判断其商业意图强度。
只输出一个 JSON，不要任何解释或代码块：{"strength": 0~1浮点, "category": "phone"|"renovation"|"none", "reason": "一句话中文解释"}
规则：
- 强(>=0.7)：任何明确的购买/推荐/选购请求——只要用户想买东西或要推荐（含"推荐""买""想换""预算""型号对比"等），即便没给具体预算或型号，也算强。
- 弱(0.3~0.7)：泛使用咨询（如"手机屏幕变暗怎么回事""小户型怎么显大"），不是要买，是问用法/知识。
- none(<0.3)：纯情感/纯知识/纯工具任务（emo、光合作用、写辞职信等）。`;
    const data = await this.call({
      model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: query },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content);
    const strength = clampNum(Number(parsed.strength));
    const cat = parsed.category;
    const category: Category =
      cat != null && ["phone", "renovation", "none"].includes(cat)
        ? (cat as Category)
        : "none";
    return {
      strength,
      layer: layerOf(strength),
      category,
      reason: String(parsed.reason ?? "LLM 分析"),
    };
  }

  // 语义匹配：一次调用让模型对每个商家打 0~1 分。失败抛错，由上层回退关键词。
  async scoreMatches(
    query: string,
    intent: IntentResult,
    advertisers: Advertiser[]
  ): Promise<Record<string, number>> {
    const { model } = this.opts;
    if (advertisers.length === 0) return {};
    const list = advertisers
      .map((a) => `- id="${a.id}" 名称:${a.name} 文案:${a.adText} 关键词:${a.matchKeywords.join("/")}`)
      .join("\n");
    const sys = `你是广告匹配器。给定用户的一句话和若干商家，对每个商家判断其与用户意图的语义匹配度(0~1)。要按语义而非字面词(如"办公"≈"商务"、"拍照"、"续航")。只输出一个 JSON：{"matches":[{"id":"商家id","score":0.0~1.0},...]}，包含全部商家。`;
    const data = await this.call({
      model,
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `用户原话：${query}\n意图：品类=${intent.category} 强度=${intent.strength}\n商家：\n${list}`,
        },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = extractMatches(content);
    const map: Record<string, number> = {};
    for (const ad of advertisers) {
      const s = parsed[ad.id];
      map[ad.id] = s != null ? clampNum(Number(s)) : keywordMatchScore(ad, intent, query);
    }
    return map;
  }

  // 真实对话回复：让模型自然回答用户那句话。失败抛错由上层回退。
  async reply(
    query: string,
    intent: IntentResult,
    winner: Advertiser | null,
    gate: GateDecision
  ): Promise<string> {
    const { model } = this.opts;
    const sys =
      "你是 AI 对话助手。用一两句中文自然回答用户。若用户在选购，可顺带引出最贴合的选项，但别堆砌。不要复读商家文案原文。";
    let user = `用户说：${query}`;
    // 仅 trigger（出卡）时才让回复模型知道中选产品并点名；soft 不出卡，
    // 不透露具体商家，避免"文字点了名却没有卡片"的错位
    if (winner && gate === "trigger") {
      user += `\n（系统已为你匹配选项：${winner.name}——${winner.adText}。可自然地引出，但用自己的话。）`;
    }
    const data = await this.call({
      model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    return text.trim() || genCannedReply(intent, gate, winner);
  }
}

// 容错提取 matches 数组 → {id: score}
function extractMatches(content: string): Record<string, number> {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : content).trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return {};
  let obj: { matches?: { id?: string; score?: number }[] } = {};
  try {
    obj = JSON.parse(raw.slice(first, last + 1));
  } catch {
    return {};
  }
  const out: Record<string, number> = {};
  for (const m of obj.matches ?? []) {
    if (m.id != null && m.score != null) out[String(m.id)] = Number(m.score);
  }
  return out;
}

// 容错 JSON 提取：剥 ```json 代码块、从混杂文本里抠第一个 {...}
function extractJson(content: string): { strength?: number; category?: string; reason?: string } {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : content).trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return {};
  try {
    return JSON.parse(raw.slice(first, last + 1));
  } catch {
    return {};
  }
}

function clampNum(v: number): number {
  if (Number.isNaN(v)) return 0.2;
  return Math.max(0, Math.min(1, v));
}

export { SCENARIOS };
