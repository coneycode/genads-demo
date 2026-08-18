import { useEffect, useLayoutEffect, useState } from "react";
import {
  X,
  ArrowRight,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { TOUR_STEPS } from "../data/tour";

const TARGET_LABEL: Record<string, string> = {
  "chip-strong-phone": "左栏快捷问题区",
  "chip-emo": "左栏快捷问题区",
  "header-slider": "顶部「变现激进度」滑块",
  "metrics-panel": "右栏指标仪表盘",
  "chip-reno": "左栏快捷问题区",
  "bidding-stage": "中栏③竞价区",
  "engine-panel": "中栏「引擎透视」",
  "intent-stage": "中栏①意图识别",
  "gate-stage": "中栏②触发闸门",
  "eval-stage": "中栏⑥eval 裁决",
};

const TIP_W = 288;
const TIP_H = 230;

type Rect = { top: number; left: number; width: number; height: number };

export default function TourOverlay() {
  const {
    tourActive,
    tourStep,
    nextTourStep,
    prevTourStep,
    endTour,
    sendMessage,
    setAggressiveness,
    setBid,
  } = useStore();
  const [rect, setRect] = useState<Rect | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [running, setRunning] = useState(false);

  const step = TOUR_STEPS[tourStep];

  const measure = () => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  };

  useLayoutEffect(() => {
    if (!tourActive) {
      setRect(null);
      return;
    }
    measure();
    const onR = () => measure();
    window.addEventListener("resize", onR);
    window.addEventListener("scroll", onR, true);
    const poll = window.setInterval(measure, 400);
    return () => {
      window.removeEventListener("resize", onR);
      window.removeEventListener("scroll", onR, true);
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourActive, tourStep, step?.target, collapsed]);

  useEffect(() => {
    if (tourActive && !step) endTour();
  }, [tourActive, step, endTour]);

  if (!tourActive || !step) return null;
  const isLast = tourStep === TOUR_STEPS.length - 1;

  // 点"下一步"：用本组件的 store 执行该步 action，再推进
  const runAction = async () => {
    switch (step.action) {
      case "send-phone":
        await sendMessage("推荐个3000块能打游戏的手机");
        break;
      case "send-emo":
        await sendMessage("我今天好emo，想找人聊聊");
        break;
      case "send-reno":
        await sendMessage("我家90平想做全屋装修，预算15万够吗");
        break;
      case "aggr-max-emo":
        setAggressiveness(1.0);
        await sendMessage("我今天好emo，想找人聊聊");
        break;
      case "bid-renohard-max":
        setBid("reno_hard", 40);
        break;
    }
  };

  const onNext = async () => {
    if (running) return;
    setRunning(true);
    try {
      if (step.action) await runAction();
    } finally {
      setRunning(false);
      if (isLast) endTour();
      else nextTourStep();
    }
  };

  // —— 计算展开态浮条位置 ——
  let tipTop = 0;
  let tipLeft = 0;
  if (rect) {
    const belowFits = rect.top + rect.height + 12 + TIP_H < window.innerHeight;
    tipTop = belowFits
      ? rect.top + rect.height + 12
      : Math.max(8, rect.top - 12 - TIP_H);
    tipLeft = Math.max(8, Math.min(rect.left, window.innerWidth - TIP_W - 8));
  }
  const tipStyle: React.CSSProperties = rect
    ? { position: "fixed", top: tipTop, left: tipLeft, width: TIP_W, zIndex: 60 }
    : { position: "fixed", top: 16, right: 16, width: TIP_W, zIndex: 60 };

  // —— 收起态：停在原地（与展开同位置），无聚光灯，蓝色呼吸药丸，醒目 ——
  if (collapsed) {
    return (
      <div
        style={{ ...tipStyle, width: "auto" }}
        className="animate-pulse-blue bg-blue-600 rounded-full shadow-2xl px-3 py-1.5 flex items-center gap-2 pointer-events-auto"
      >
        <ChevronDown size={16} className="text-white" />
        <span className="text-[11px] text-white font-medium whitespace-nowrap">
          引导已收起 · 第{step.act}幕 {tourStep + 1}/{TOUR_STEPS.length} · 点击展开
        </span>
        <button
          onClick={() => setCollapsed(false)}
          className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-white"
          title="展开引导"
        >
          展开
        </button>
        <button
          onClick={endTour}
          className="p-0.5 rounded-full hover:bg-white/20 text-white/80"
          title="跳过引导"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <>
      {/* 聚光灯：全屏遮罩 pointer-events-none，目标用 box-shadow 压暗其余区域，目标本身仍可点 */}
      {rect && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div
            className="absolute rounded-lg border-2 border-blue-400 transition-all duration-200"
            style={{
              top: rect.top - 4,
              left: rect.left - 4,
              width: rect.width + 8,
              height: rect.height + 8,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
            }}
          />
        </div>
      )}

      {/* 跟随浮条 */}
      <div
        style={tipStyle}
        className="bg-white rounded-xl shadow-2xl border border-slate-200 p-4 pointer-events-auto"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
            第 {step.act} 幕 · {tourStep + 1}/{TOUR_STEPS.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(true)}
              className="text-slate-400 hover:text-slate-600 p-0.5"
              title="收起引导"
            >
              <ChevronUp size={15} />
            </button>
            <button onClick={endTour} className="text-slate-400 hover:text-slate-600 p-0.5" title="跳过引导">
              <X size={15} />
            </button>
          </div>
        </div>
        <h3 className="font-semibold text-slate-800 text-sm mb-1.5">{step.title}</h3>
        <p className="text-xs text-slate-600 leading-relaxed mb-2">{step.body}</p>
        <div className="text-[10px] text-slate-400 bg-slate-50 rounded px-2 py-1 mb-3">
          操作位置：{TARGET_LABEL[step.target] ?? step.target}
          {!rect && "（未找到目标，浮在右上角）"}
        </div>
        <div className="flex justify-between items-center">
          <button
            onClick={prevTourStep}
            disabled={tourStep === 0}
            className="text-xs text-slate-500 flex items-center gap-1 disabled:opacity-30"
          >
            <ArrowLeft size={13} /> 上一步
          </button>
          <button
            onClick={onNext}
            disabled={running}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white flex items-center gap-1 disabled:opacity-60"
          >
            {running ? "执行中…" : step.cta}
            {!isLast && !running && <ArrowRight size={13} />}
          </button>
        </div>
      </div>
    </>
  );
}
