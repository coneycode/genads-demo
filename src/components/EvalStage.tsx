import type { EvalScore } from "../engine/types";

function Stars({ n }: { n: number }) {
  return (
    <span className="text-[11px] tracking-tight">
      {"★".repeat(n)}
      <span className="text-slate-300">{"★".repeat(5 - n)}</span>
    </span>
  );
}

const HARM_STYLE: Record<EvalScore["trustHarm"], string> = {
  low: "bg-green-100 text-green-700",
  mid: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};
const HARM_LABEL: Record<EvalScore["trustHarm"], string> = {
  low: "低",
  mid: "中",
  high: "高",
};

export default function EvalStage({ evalScore }: { evalScore: EvalScore | null }) {
  if (!evalScore) {
    return (
      <div data-tour="eval-stage" className="rounded-lg border border-slate-200 p-3 bg-white">
        <div className="text-xs font-semibold text-slate-500 mb-1">⑥ eval 裁决</div>
        <div className="text-xs text-slate-400">每轮对话实时打分（相关性 / 有用性 / 露出恰当性 / 信任伤害）。</div>
      </div>
    );
  }
  return (
    <div data-tour="eval-stage" className="rounded-lg border border-slate-200 p-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500">⑥ eval 裁决</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${HARM_STYLE[evalScore.trustHarm]}`}>
          信任伤害 {HARM_LABEL[evalScore.trustHarm]}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Cell label="相关性"><Stars n={evalScore.relevance} /></Cell>
        <Cell label="有用性"><Stars n={evalScore.usefulness} /></Cell>
        <Cell label="露出恰当"><Stars n={evalScore.appropriateness} /></Cell>
      </div>
      <div className="text-[11px] text-slate-600 leading-relaxed border-t border-slate-100 pt-2">
        {evalScore.verdict}
      </div>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded bg-slate-50 px-2 py-1 text-center">
      <div className="text-[10px] text-slate-400 mb-0.5">{label}</div>
      <div className="text-amber-500">{children}</div>
    </div>
  );
}
