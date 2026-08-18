import type { IntentResult } from "../engine/types";
import type { TourTarget } from "../data/tour";

const LAYER_STYLE: Record<
  IntentResult["layer"],
  { label: string; cls: string; bar: string }
> = {
  strong: { label: "强商业", cls: "bg-green-100 text-green-700 border-green-300", bar: "bg-green-500" },
  weak: { label: "弱商业", cls: "bg-amber-100 text-amber-700 border-amber-300", bar: "bg-amber-500" },
  none: { label: "纯信息/情感", cls: "bg-slate-100 text-slate-500 border-slate-300", bar: "bg-slate-400" },
};

export default function IntentStage({ intent }: { intent: IntentResult | null }) {
  const dataTour = "intent-stage" as unknown as TourTarget;
  if (!intent) {
    return (
      <div data-tour={dataTour} className="rounded-lg border border-slate-200 p-3 bg-white">
        <Empty />
      </div>
    );
  }
  const ls = LAYER_STYLE[intent.layer];
  return (
    <div data-tour={dataTour} className="rounded-lg border border-slate-200 p-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500">① 意图识别</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ls.cls}`}>
          {ls.label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded bg-slate-100 overflow-hidden">
          <div
            className={`h-full ${ls.bar} transition-all`}
            style={{ width: `${intent.strength * 100}%` }}
          />
        </div>
        <span className="text-xs font-mono text-slate-700 w-10 text-right">
          {intent.strength.toFixed(2)}
        </span>
      </div>
      <div className="text-[11px] text-slate-500 mt-2">
        品类：{intent.category === "phone" ? "手机" : intent.category === "renovation" ? "装修" : "无"} · {intent.reason}
      </div>
    </div>
  );
}

function Empty() {
  return <div className="text-xs text-slate-400">发一条消息后，这里展示识别出的意图强度与层级。</div>;
}
