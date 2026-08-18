// engine/bidding.ts —— 竞价排序（规格书 §6）

import type { Advertiser, BidCandidate, IntentResult } from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// 关键词匹配度（预设模式用）：baseMatch + 命中词加分，品类不匹配 ×0.3
export function keywordMatchScore(
  ad: Advertiser,
  intent: IntentResult,
  query: string
): number {
  let score = ad.baseMatch;
  const q = query.toLowerCase();
  for (const kw of ad.matchKeywords) {
    if (q.includes(kw.toLowerCase())) score += 0.05;
  }
  if (ad.category !== intent.category) score *= 0.3;
  return clamp(score, 0, 1);
}

// 竞价排序。matchMap 可选：若提供某商家 id 的语义匹配度则用之，否则回退关键词匹配。
export function rankBids(
  query: string,
  intent: IntentResult,
  advertisers: Advertiser[],
  matchMap?: Record<string, number>
): BidCandidate[] {
  const candidates: BidCandidate[] = advertisers
    .filter((a) => a.category === intent.category) // 只在同品类里竞价
    .map((ad) => {
      const matchScore =
        matchMap && matchMap[ad.id] != null
          ? clamp(matchMap[ad.id], 0, 1)
          : keywordMatchScore(ad, intent, query);
      const finalScore = matchScore * ad.bid * ad.experience; // 相乘 = 否决式
      return {
        advertiser: ad,
        matchScore,
        bid: ad.bid,
        experience: ad.experience,
        finalScore,
        won: false,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);

  if (candidates.length > 0) candidates[0].won = true;
  return candidates;
}
