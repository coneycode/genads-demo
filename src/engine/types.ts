// engine/types.ts —— 全部 TS 类型（规格书 §3）

export type IntentLayer = "strong" | "weak" | "none";
export type Category = "phone" | "renovation" | "none";

export interface IntentResult {
  strength: number; // 0~1
  layer: IntentLayer;
  category: Category;
  reason: string;
  inScope?: boolean; // LLM 显式判定:是否真属本 demo 支持域(手机选购/装修/情感陪伴)。电脑/平板/相机/家电/汽车等→false
  shouldRecommend?: boolean; // LLM 判定:这一轮是否应推荐广告。用户否定/嫌贵上一条且池中无更合适选项→false(此时 reason 写判断说明)
}

export interface ProductInfo {
  title: string;
  subtitle: string;
  price: string;
  tags: string[];
  imageEmoji: string;
}

export interface Advertiser {
  id: string;
  name: string;
  category: Category;
  matchKeywords: string[];
  baseMatch: number;
  bid: number;
  experience: number;
  copyStyle: "natural" | "hard";
  adText: string;
  product: ProductInfo;
}

export interface BidCandidate {
  advertiser: Advertiser;
  matchScore: number;
  bid: number;
  experience: number;
  finalScore: number;
  won: boolean;
}

export type GateDecision = "trigger" | "soft" | "none";

export interface EvalScore {
  relevance: number; // 1~5
  usefulness: number; // 1~5
  appropriateness: number; // 1~5
  trustHarm: "low" | "mid" | "high";
  verdict: string;
}

export interface Metrics {
  exposureRate: number;
  clickRate: number;
  revenue: number;
  retention: number;
  negativeFeedback: number;
  activeClose: number;
}

export interface Turn {
  userText: string;
  intent: IntentResult;
  gate: GateDecision;
  candidates: BidCandidate[];
  winner: Advertiser | null;
  aiText: string;
  showCard: boolean;
  judgment?: boolean; // LLM 判定"本轮不应出卡"的判断回复(用户嫌贵/否定上一条推荐)——前端用独立样式渲染,区别于普通回答
  trustCost: number;
  eval: EvalScore;
  matchMap: Record<string, number>; // 语义匹配度缓存(id→0~1)，发送时算一次，回溯重算复用
}
