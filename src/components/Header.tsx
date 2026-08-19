import { Gauge, RotateCcw, Play } from "lucide-react";
import { useStore } from "../store/useStore";
import { thresholdFromAggressiveness } from "../engine/trustModel";

export default function Header() {
  const { aggressiveness, setAggressiveness, reset, startTour } = useStore();
  const threshold = thresholdFromAggressiveness(aggressiveness);

  return (
    <header data-tour="header-slider" className="bg-white border-b border-slate-200 px-4 py-2.5">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">
          <Gauge size={18} className="text-blue-600" />
          生成式广告 · Chat 原生变现沙盘
        </div>

        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <span className="text-xs text-slate-500">变现激进度</span>
          <span className="text-[10px] text-slate-400">克制</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={aggressiveness}
            onChange={(e) => setAggressiveness(Number(e.target.value))}
            className="flex-1 h-1.5 accent-blue-600"
          />
          <span className="text-[10px] text-slate-400">激进</span>
          <span className="text-xs font-mono text-slate-700 w-24 text-right">
            阈值 <b className="text-red-600">{threshold.toFixed(2)}</b>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={startTour}
            className="text-xs px-2.5 py-1.5 rounded border border-blue-200 bg-blue-50 text-blue-600 flex items-center gap-1"
          >
            <Play size={13} /> 引导演示
          </button>

          <button
            onClick={reset}
            className="text-xs px-2 py-1.5 rounded border border-slate-200 text-slate-600 flex items-center gap-1"
          >
            <RotateCcw size={13} /> 重置
          </button>
        </div>
      </div>
    </header>
  );
}
