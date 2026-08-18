import IntentStage from "./IntentStage";
import GateStage from "./GateStage";
import BiddingStage from "./BiddingStage";
import EvalStage from "./EvalStage";
import type { Turn } from "../engine/types";

export default function EnginePanel({ turn }: { turn: Turn | null }) {
  return (
    <div data-tour="engine-panel" className="flex flex-col h-full bg-slate-50 rounded-xl border border-slate-200 p-3 gap-2.5 overflow-y-auto">
      <div className="text-xs font-semibold text-slate-600 px-1">
        引擎透视 · 你的认知视角
      </div>
      <IntentStage intent={turn?.intent ?? null} />
      <GateStage intent={turn?.intent ?? null} gate={turn?.gate ?? "none"} />
      <BiddingStage turn={turn} />
      <EvalStage evalScore={turn?.eval ?? null} />
    </div>
  );
}
