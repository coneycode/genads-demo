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
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400">Provider（点选切换）</span>
            <div className="flex flex-wrap gap-1">
              {PROVIDERS.map((p) => {
                const active = llmBaseURL === p.baseURL;
                return (
                  <button
                    key={p.name}
                    onClick={() => setLlmConfig({ baseURL: p.baseURL, model: p.model })}
                    className={`text-[11px] px-2 py-0.5 rounded border ${
                      active
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label={`Model（当前：${llmModel}）`}>
            <input
              value={llmModel}
              onChange={(e) => setLlmConfig({ model: e.target.value })}
              className="w-48 px-2 py-1 rounded border border-slate-200"
            />
          </Field>
          <Field label="Base URL">
            <input
              value={llmBaseURL}
              onChange={(e) => setLlmConfig({ baseURL: e.target.value })}
              className="w-56 px-2 py-1 rounded border border-slate-200"
            />
          </Field>
          <Field label={`API Key${llmApiKey ? "（已配置·隐藏）" : ""}`}>
            <input
              type="password"
              value={llmApiKey}
              onChange={(e) => setLlmConfig({ apiKey: e.target.value })}
              className="w-56 px-2 py-1 rounded border border-slate-200"
              placeholder={llmApiKey ? "••••••••（如需更换直接输入新 key）" : "粘贴你的 Key（仅存内存，不进代码/不持久化）"}
            />
          </Field>
          <span className="text-[10px] text-slate-400">
            默认预填 DeepSeek / deepseek-v4-flash。Key 不内置——请粘贴你自己的（静态前端藏不住密钥，内置=公开）。可点上方切换 Provider。
          </span>
          {engineMode === "llm" && (
            <span
              className={`text-[11px] px-2 py-1 rounded ${
                llmError
                  ? "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {llmError
                ? `LLM 调用失败，已回退预设：${llmError}`
                : llmApiKey
                ? `LLM 已接通 · ${llmModel}（你的 key 直连）`
                : `LLM 走服务器代理 · ${llmModel}（key 在服务器，不进浏览器）`}
            </span>
          )}
        </div>
      )}
    </header>
  );
}

const PROVIDERS = [
  { name: "DeepSeek", baseURL: "https://api.deepseek.com", model: "deepseek-v4-flash" },
  { name: "OpenAI", baseURL: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { name: "火山方舟", baseURL: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-1-5-lite-32k" },
  { name: "通义", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-turbo" },
  { name: "智谱", baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-400">{label}</span>
      {children}
    </label>
  );
}
