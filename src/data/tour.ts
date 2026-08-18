// data/tour.ts —— 引导浮层三幕脚本（规格书 §11）
// 每步可挂一个 actionKey：点"下一步"时由 TourOverlay 用自身 store 执行，
// 用户只管连点"下一步"，整段演示自动演完。
// （用 key 而非函数，避免 data 层 import store 造成跨模块 store 实例歧义。）

export type TourTarget =
  | "chip-strong-phone"
  | "chip-emo"
  | "header-slider"
  | "metrics-panel"
  | "chip-reno"
  | "bidding-stage"
  | "engine-panel";

export type TourActionKey =
  | "send-phone"
  | "send-emo"
  | "send-reno"
  | "aggr-max"
  | "bid-renohard-max";

export interface TourStep {
  act: number;
  title: string;
  body: string;
  target: TourTarget;
  cta: string;
  action?: TourActionKey; // 点"下一步"时自动执行
}

export const TOUR_STEPS: TourStep[] = [
  // 第一幕
  {
    act: 1,
    title: "第一幕 · AI 是有分寸的",
    body: "点「下一步」自动发一句强商业问题，看 AI 怎么回应。中栏会显示「强商业 0.87 · 触发」。",
    target: "chip-strong-phone",
    cta: "下一步",
    action: "send-phone",
  },
  {
    act: 1,
    title: "第一幕 · AI 是有分寸的",
    body: "再点「下一步」自动发这句情感问题。注意中栏：意图变成「纯情感 0.06」，AI 克制住、不出广告。",
    target: "chip-emo",
    cta: "下一步",
    action: "send-emo",
  },
  {
    act: 1,
    title: "第一幕 · AI 是有分寸的",
    body: "同一个系统，一个推荐、一个忍住——这就是意图分层触发。它能区分用户是「想买」还是「想被陪伴」。",
    target: "engine-panel",
    cta: "进入第二幕",
  },
  // 第二幕
  {
    act: 2,
    title: "第二幕 · 贪婪是有代价的",
    body: "点「下一步」自动把「变现激进度」拖到最激进。看右栏：越过阈值后护栏指标接连破线、一票否决；之前的 emo 消息也会回溯长出鲜花卡。",
    target: "header-slider",
    cta: "下一步",
    action: "aggr-max",
  },
  {
    act: 2,
    title: "第二幕 · 贪婪是有代价的",
    body: "收入涨一点，信任崩一片。护栏指标破线就一票否决——这就是 chat 变现的红线。",
    target: "metrics-panel",
    cta: "进入第三幕",
  },
  // 第三幕
  {
    act: 3,
    title: "第三幕 · 背后一套可解释的机器",
    body: "点「下一步」自动发一句装修问题，看中栏的竞价过程。",
    target: "chip-reno",
    cta: "下一步",
    action: "send-reno",
  },
  {
    act: 3,
    title: "第三幕 · 背后一套可解释的机器",
    body: "点「完成演示」自动把「低价装修(硬广)」出价拉到最高。看：它出价最高却仍排不上——因为体验分(0.25)把它的总分压死了。",
    target: "bidding-stage",
    cta: "完成演示",
    action: "bid-renohard-max",
  },
];

