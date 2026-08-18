import type { GateDecision, IntentResult } from "../engine/types";
import { useStore } from "../store/useStore";
import { thresholdFromAggressiveness } from "../engine/trustModel";

const GATE_STYLE: Record<GateDecision, { label: string; cls: string }> = {
  trigger: { label: "触发露出", cls: "bg-red-100 text-red-700 border-red-300" },
  soft: { label: "软引导", cls: "bg-amber-100 text-amber-700 border-amber-300" },
  none: { label: "克制·不触发", cls: "bg-slate-100 text-slate-500 border-slate-300" },
};

export default function GateStage({ intent }: { intent: IntentResult | null }) {
  const aggressiveness = useStore((s) => s.aggressiveness);
  const threshold = thresholdFromAggressiveness(aggressiveness);

  let gate: GateDecision = "none";
  if (intent) {
    if (intent.strength >= threshold) gate = "trigger";
    else if (intent.strength >= threshold - 0.2) gate = "soft";
  }
  const gs = GATE_STYLE[gate];

  const strength = intent?.strength ?? 0;
  const softLine = Math.max(0, threshold - 0.2);

  return (
    <div data-tour="gate-stage" className="rounded-lg border border-slate-200 p-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500">② 触发闸门</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${gs.cls}`}>
          {gs.label}
        </span>
      </div>

      <div className="relative h-10 mb-1">
        {/* 数轴 */}
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-200 rounded -translate-y-1/2" />
        {/* 软引导临界区 */}
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 bg-amber-200 rounded"
          style={{ left: `${softLine * 100}%`, width: `${(threshold - softLine) * 100}%` }}
        />
        {/* 触发阈值竖线 */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500"
          style={{ left: `${threshold * 100}%` }}
          title={`阈值 ${threshold.toFixed(2)}`}
        />
        {/* 软引导线 */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-amber-400"
          style={{ left: `${softLine * 100}%` }}
        />
        {/* 当前意图点 */}
        {intent && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -ml-2 w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow"
            style={{ left: `${strength * 100}%` }}
            title={`意图 ${strength.toFixed(2)}`}
          />
        )}
        <div className="absolute -bottom-0.5 left-0 text-[9px] text-slate-400">0</div>
        <div className="absolute -bottom-0.5 right-0 text-[9px] text-slate-400">1</div>
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 mt-2">
        <span>阈值线 <b className="text-red-600">{threshold.toFixed(2)}</b></span>
        <span>当前意图 <b className="text-blue-600">{strength.toFixed(2)}</b></span>
      </div>
    </div>
  );
}
