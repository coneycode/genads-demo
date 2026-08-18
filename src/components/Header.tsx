import { useState } from "react";
import { Gauge, RotateCcw, Play, Bot, Cpu } from "lucide-react";
import { useStore } from "../store/useStore";
import { thresholdFromAggressiveness } from "../engine/trustModel";

export default function Header() {
  const {
    aggressiveness,
    setAggressiveness,
    engineMode,
    setEngineMode,
    llmBaseURL,
    llmApiKey,
    llmModel,
    llmError,
    setLlmConfig,
    reset,
    startTour,
  } = useStore();
  const [showCfg, setShowCfg] = useState(false);
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
          <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden text-xs">
            <button
              onClick={() => setEngineMode("preset")}
              className={`px-2.5 py-1.5 flex items-center gap-1 ${
                engineMode === "preset" ? "bg-blue-600 text-white" : "text-slate-600"
              }`}
            >
              <Cpu size={13} /> 预设
            </button>
            <button
              onClick={() => setEngineMode("llm")}
              className={`px-2.5 py-1.5 flex items-center gap-1 ${
                engineMode === "llm" ? "bg-blue-600 text-white" : "text-slate-600"
              }`}
            >
              <Bot size={13} /> 真实 LLM
            </button>
          </div>

          {engineMode === "llm" && (
            <button
              onClick={() => setShowCfg((v) => !v)}
              className="text-xs px-2 py-1.5 rounded border border-slate-200 text-slate-600"
            >
              配置
            </button>
          )}

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

      {showCfg && engineMode === "llm" && (
        <div className="mt-2 flex gap-2 items-end flex-wrap text-xs">
          <Field label="Base URL">
            <input
              value={llmBaseURL}
              onChange={(e) => setLlmConfig({ baseURL: e.target.value })}
              className="w-56 px-2 py-1 rounded border border-slate-200"
              placeholder="https://api.openai.com/v1"
            />
          </Field>
          <Field label="Model">
            <input
              value={llmModel}
              onChange={(e) => setLlmConfig({ model: e.target.value })}
              className="w-40 px-2 py-1 rounded border border-slate-200"
            />
          </Field>
          <Field label="API Key">
            <input
              type="password"
              value={llmApiKey}
              onChange={(e) => setLlmConfig({ apiKey: e.target.value })}
              className="w-56 px-2 py-1 rounded border border-slate-200"
              placeholder="sk-..."
            />
          </Field>
          <span className="text-[10px] text-slate-400">
            仅存内存、不持久化。默认预填 DeepSeek，填入你的 Key 即可用。
          </span>
          {engineMode === "llm" && (
            <span
              className={`text-[11px] px-2 py-1 rounded ${
                llmApiKey
                  ? llmError
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {!llmApiKey
                ? "未配置 Key（发消息会用预设引擎）"
                : llmError
                ? `LLM 调用失败，已回退预设：${llmError}`
                : "LLM 已接通（发任意消息走真实模型）"}
            </span>
          )}
        </div>
      )}
    </header>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-400">{label}</span>
      {children}
    </label>
  );
}
