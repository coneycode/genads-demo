import type { Turn } from "../engine/types";
import { useStore } from "../store/useStore";

export default function BiddingStage({ turn }: { turn: Turn | null }) {
  const setBid = useStore((s) => s.setBid);

  if (!turn || turn.gate === "none" || turn.candidates.length === 0) {
    return (
      <div data-tour="bidding-stage" className="rounded-lg border border-slate-200 p-3 bg-white">
        <div className="text-xs font-semibold text-slate-500 mb-1">③ 语义竞价</div>
        <div className="text-xs text-slate-400">
          {turn ? "本轮未触发竞价（克制或软引导）。" : "触发后，这里展示候选广告主在意图空间的竞价排序。"}
        </div>
      </div>
    );
  }

  return (
    <div data-tour="bidding-stage" className="rounded-lg border border-slate-200 p-3 bg-white">
      <div className="text-xs font-semibold text-slate-500 mb-2">
        ③ 语义竞价 · 最终得分 = 匹配 × 出价 × 体验分
      </div>
      <div className="space-y-1.5">
        {turn.candidates.map((c) => (
          <div
            key={c.advertiser.id}
            className={`rounded border p-2 ${
              c.won
                ? "border-blue-400 bg-blue-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-700 truncate">
                {c.won && <span className="text-blue-600 mr-1">✓</span>}
                {c.advertiser.name}
                {c.advertiser.copyStyle === "hard" && (
                  <span className="ml-1 text-[9px] px-1 rounded bg-red-100 text-red-600">硬广</span>
                )}
              </span>
              <span className="text-xs font-mono text-slate-800">
                {c.finalScore.toFixed(2)}
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 mb-1.5">
              {c.matchScore.toFixed(2)} × {c.bid} × {c.experience.toFixed(2)} ={" "}
              <b className="text-slate-700">{c.finalScore.toFixed(2)}</b>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 w-10">出价</span>
              <input
                type="range"
                min={1}
                max={c.advertiser.category === "phone" ? 20 : 40}
                step={1}
                value={c.bid}
                onChange={(e) => setBid(c.advertiser.id, Number(e.target.value))}
                className="flex-1 h-1 accent-blue-600"
              />
              <span className="text-[10px] font-mono text-slate-600 w-6 text-right">{c.bid}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
