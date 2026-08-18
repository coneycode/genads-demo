// engine/trustModel.ts —— 信任损耗模型 + 指标演化（规格书 §5）

import type { GateDecision, Metrics, Turn } from "./types";

export const STRONG_BASELINE = 0.8;

export function thresholdFromAggressiveness(aggressiveness: number): number {
  // aggr=0 → 0.85（强商业0.87 仍触发，弱/情感不触发）
  // aggr=1 → 0.05（连纯情感0.06 也触发）
  return 0.85 - aggressiveness * 0.8;
}

export function decideGate(strength: number, threshold: number): GateDecision {
  if (strength >= threshold) return "trigger";
  if (strength >= threshold - 0.2) return "soft";
  return "none";
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// 单轮信任损耗（§5.3）。none 时返回 0。
export function computeTrustCost(gate: GateDecision, strength: number): number {
  if (gate === "none") return 0;
  const triggerIntensity = gate === "trigger" ? 1.0 : 0.5;
  const mismatch = clamp((STRONG_BASELINE - strength) / STRONG_BASELINE, 0, 1);
  return triggerIntensity * mismatch * mismatch; // 平方项 = 非线性/非对称
}

export interface RedLines {
  retention: number; // 破线：< 60
  negativeFeedback: number; // 破线：> 8
  activeClose: number; // 破线：> 5
}

export const RED_LINES: RedLines = {
  retention: 60,
  negativeFeedback: 8,
  activeClose: 5,
};

export function isBreached(m: Pick<Metrics, "retention" | "negativeFeedback" | "activeClose">): boolean {
  return (
    m.retention < RED_LINES.retention ||
    m.negativeFeedback > RED_LINES.negativeFeedback ||
    m.activeClose > RED_LINES.activeClose
  );
}

// 由全部历史 turn 统一重算指标（§5.4）—— 单一事实来源，
// sendMessage / setAggressiveness / setBid 三处共用，避免指标与状态不一致。
export function computeMetricsFromTurns(turns: Turn[]): {
  metrics: Metrics;
  cumulativeTrustCost: number;
  adShownCount: number;
  turnCount: number;
  revenueSeries: number[]; // 每轮累计收入，供右栏迷你折线（§10.5）
  retentionSeries: number[]; // 每轮留存，供护栏趋势
} {
  let cum = 0;
  let adShown = 0;
  let triggerCount = 0;
  let softCount = 0;
  let revenue = 0;
  let clickUnits = 0;
  const revenueSeries: number[] = [];
  const retentionSeries: number[] = [];

  for (const t of turns) {
    cum += t.trustCost;
    if (t.gate === "trigger") triggerCount++;
    else if (t.gate === "soft") softCount++;
    if (t.showCard) adShown++;
    if (t.winner) {
      const ms = t.candidates[0]?.matchScore ?? 0;
      revenue += t.winner.bid * (0.6 + 0.4 * ms);
    }
    revenueSeries.push(Math.round(revenue));
    retentionSeries.push(clamp(68 - 6.0 * cum, 40, 68));
  }
  clickUnits = triggerCount * 8 + softCount * 3;

  const turnCount = turns.length;
  const exposures = triggerCount + softCount;
  const exposureRate = turnCount > 0 ? (exposures / turnCount) * 100 : 0;
  const clickRate = exposures > 0 ? clickUnits / exposures : 0;

  const metrics: Metrics = {
    exposureRate: clamp(exposureRate, 0, 100),
    clickRate: clamp(clickRate, 0, 100),
    revenue,
    retention: clamp(68 - 6.0 * cum, 40, 68),
    negativeFeedback: clamp(2 + 6.0 * cum, 2, 30),
    activeClose: clamp(1 + 5.0 * cum, 1, 25),
  };
  return { metrics, cumulativeTrustCost: cum, adShownCount: adShown, turnCount, revenueSeries, retentionSeries };
}

