// engine/evaluator.ts —— eval 四维打分（规格书 §7）

import type { EvalScore, GateDecision, IntentResult } from "./types";
import { STRONG_BASELINE } from "./trustModel";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function mismatchOf(strength: number): number {
  return clamp((STRONG_BASELINE - strength) / STRONG_BASELINE, 0, 1);
}

export function evaluate(
  intent: IntentResult,
  gate: GateDecision,
  matchScore: number | null,
  trustCost: number
): EvalScore {
  const mismatch = mismatchOf(intent.strength);
  const relevance = Math.round(1 + 4 * (matchScore ?? 0));
  const usefulness =
    gate === "none" ? 5 : Math.round(3 + 2 * (matchScore ?? 0) - 2 * mismatch);
  const appropriateness = clamp(Math.round(5 - 5 * mismatch), 1, 5);
  const trustHarm: EvalScore["trustHarm"] =
    trustCost < 0.1 ? "low" : trustCost < 0.4 ? "mid" : "high";

  const verdict = pickVerdict(intent.layer, gate, trustHarm);
  return {
    relevance: clamp(relevance, 1, 5),
    usefulness: clamp(usefulness, 1, 5),
    appropriateness,
    trustHarm,
    verdict,
  };
}

function pickVerdict(
  layer: IntentResult["layer"],
  gate: GateDecision,
  harm: EvalScore["trustHarm"]
): string {
  if (gate === "none") {
    return "本轮未触发商业化，AI 回归纯服务，信任无损。";
  }
  if (layer === "strong" && gate === "trigger") {
    return "用户有明确购买意图，露出相关商品/服务卡，相关且有用，信任无损。";
  }
  if (layer === "weak" && gate === "soft") {
    return "用户有潜在需求，以非侵入方式软引导，权衡得当。";
  }
  if (layer === "weak" && gate === "trigger") {
    return "弱商业意图下直接出卡，略偏激进，需关注打扰度。";
  }
  if (layer === "none") {
    return "用户为纯信息/情感诉求，此处插入商业露出属错配触发，严重损害信任，建议不予露出。";
  }
  if (harm === "high") return "信任伤害偏高，策略过于激进，建议回调激进度。";
  return "本轮商业化策略基本合理，可继续观察护栏指标。";
}
