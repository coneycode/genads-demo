import type { Metrics } from "../engine/types";
import { RED_LINES } from "../engine/trustModel";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

function Bar({
  label,
  value,
  unit,
  breach,
  redLineLabel,
  reverse,
}: {
  label: string;
  value: number;
  unit: string;
  breach: boolean;
  redLineLabel: string;
  reverse?: boolean;
}) {
  return (
    <div className={breach ? "animate-pulse-red rounded" : ""}>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-slate-500">{label}</span>
        <span className={`font-mono font-semibold ${breach ? "text-red-600" : "text-slate-700"}`}>
          {value.toFixed(1)}{unit}
        </span>
      </div>
      <div className="relative h-2 rounded bg-slate-100 overflow-hidden">
        <div
          className={`h-full ${breach ? "bg-red-500" : reverse ? "bg-green-500" : "bg-emerald-500"} transition-all`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <div className="text-[9px] text-slate-400 mt-0.5">{redLineLabel}</div>
    </div>
  );
}

export default function MetricsPanel({
  metrics,
  cumTrust,
  revenueSeries,
}: {
  metrics: Metrics;
  cumTrust: number;
  revenueSeries: number[];
}) {
  const bRet = metrics.retention < RED_LINES.retention;
  const bNeg = metrics.negativeFeedback > RED_LINES.negativeFeedback;
  const bClose = metrics.activeClose > RED_LINES.activeClose;
  const breached = bRet || bNeg || bClose;

  return (
    <div data-tour="metrics-panel" className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 font-semibold text-slate-700 text-sm">
        指标仪表盘 · 经营视角
      </div>

      {breached && (
        <div className="bg-red-600 text-white text-xs px-4 py-2 font-medium flex items-start gap-2">
          <span>⚠</span>
          <span>护栏指标破线 —— 按「一票否决」原则，此激进度下的策略不予上线。</span>
        </div>
      )}

      <div className="p-3 space-y-3 overflow-y-auto flex-1">
        <div>
          <div className="text-[11px] font-semibold text-slate-500 mb-1.5">收入侧</div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="露出率" value={`${metrics.exposureRate.toFixed(0)}%`} />
            <Stat label="点击率" value={`${metrics.clickRate.toFixed(1)}%`} />
            <Stat label="累计收入" value={`¥${metrics.revenue.toFixed(0)}`} accent />
          </div>
          {revenueSeries.length > 1 && (
            <div className="h-10 mt-1.5">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueSeries.map((v, i) => ({ i, v }))}>
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div>
          <div className="text-[11px] font-semibold text-slate-500 mb-1.5">护栏侧（信任）</div>
          <div className="space-y-2.5">
            <Bar
              label="次日留存"
              value={metrics.retention}
              unit="%"
              breach={bRet}
              reverse
              redLineLabel={`红线 < ${RED_LINES.retention}%`}
            />
            <Bar
              label="负反馈率"
              value={metrics.negativeFeedback}
              unit="%"
              breach={bNeg}
              redLineLabel={`红线 > ${RED_LINES.negativeFeedback}%`}
            />
            <Bar
              label="主动关闭商业化"
              value={metrics.activeClose}
              unit="%"
              breach={bClose}
              redLineLabel={`红线 > ${RED_LINES.activeClose}%`}
            />
          </div>
        </div>

        <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-2 leading-relaxed">
          累积信任损耗 = <b className="font-mono text-slate-600">{cumTrust.toFixed(2)}</b>
          <br />模型：损耗 = 触发强度 × 意图错配度²
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded bg-slate-50 px-2 py-1.5 text-center">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className={`text-sm font-mono font-semibold ${accent ? "text-blue-600" : "text-slate-700"}`}>
        {value}
      </div>
    </div>
  );
}
