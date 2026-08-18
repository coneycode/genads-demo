// data/scenarios.ts —— 预设典型 query（规格书 §9.1）

import type { Category, IntentLayer } from "../engine/types";

export interface Scenario {
  text: string;
  strength: number;
  category: Category;
  reason: string;
}

function layerOf(strength: number): IntentLayer {
  if (strength >= 0.7) return "strong";
  if (strength >= 0.3) return "weak";
  return "none";
}

export const SCENARIOS: Scenario[] = [
  // 强商业 · 手机
  {
    text: "推荐个3000块能打游戏的手机",
    strength: 0.87,
    category: "phone",
    reason: "明确预算+明确用途，强购买意图",
  },
  {
    text: "iPhone 和安卓旗舰怎么选",
    strength: 0.72,
    category: "phone",
    reason: "处于选购决策期，强商业意图",
  },
  // 弱商业 · 手机
  {
    text: "手机屏幕总是自动变暗怎么回事",
    strength: 0.35,
    category: "phone",
    reason: "使用问题咨询，隐含潜在换机可能，弱意图",
  },
  // 强商业 · 装修
  {
    text: "我家90平想做全屋装修，预算15万够吗",
    strength: 0.85,
    category: "renovation",
    reason: "明确面积+预算，高客单强意图，适合导购式Agent",
  },
  {
    text: "找装修公司还是找独立设计师好",
    strength: 0.7,
    category: "renovation",
    reason: "装修决策期，强商业意图",
  },
  // 弱商业 · 装修
  {
    text: "小户型怎么显得空间大一点",
    strength: 0.4,
    category: "renovation",
    reason: "家居知识咨询，隐含装修需求，弱意图",
  },
  // 纯信息 / 情感
  {
    text: "我今天好emo，想找人聊聊",
    strength: 0.06,
    category: "none",
    reason: "纯情感陪伴诉求，触发商业化将严重损害信任",
  },
  {
    text: "帮我写一封辞职信",
    strength: 0.08,
    category: "none",
    reason: "纯工具性任务，无商业意图",
  },
  {
    text: "光合作用的原理是什么",
    strength: 0.05,
    category: "none",
    reason: "纯知识问答，无商业意图",
  },
];

export function exactScenario(text: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.text === text.trim());
}

export function layerFromStrength(strength: number): IntentLayer {
  return layerOf(strength);
}
