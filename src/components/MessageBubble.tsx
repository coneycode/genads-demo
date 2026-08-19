import { Lightbulb } from "lucide-react";
import type { Turn } from "../engine/types";
import ProductCard from "./ProductCard";

export default function MessageBubble({
  role,
  text,
  turn,
}: {
  role: "user" | "ai";
  text: string;
  turn?: Turn;
}) {
  const isUser = role === "user";
  // "判断回复"(用户嫌贵/否定上一条推荐 → LLM 判定本轮不出卡)用独立样式:
  // 虚线琥珀底 + 小标签头,看起来像一条旁注/判断,区别于正面回答。
  const judgment = !isUser && turn?.judgment;

  if (judgment) {
    return (
      <div className="flex justify-start mb-3">
        <div className="max-w-[85%] rounded-xl border border-dashed border-amber-300 bg-amber-50/70 px-3.5 py-2 text-sm rounded-bl-sm">
          <div className="flex items-center gap-1.5 mb-1 text-[11px] font-medium text-amber-600">
            <Lightbulb size={12} /> AI 判断 · 本轮不出卡
          </div>
          <div className="whitespace-pre-wrap leading-relaxed text-amber-900">{text}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
          isUser
            ? "bg-blue-600 text-white rounded-br-sm"
            : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm"
        }`}
      >
        <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
        {!isUser && turn?.showCard && turn.winner && (
          <ProductCard
            product={turn.winner.product}
            hard={turn.winner.copyStyle === "hard"}
            adText={turn.winner.adText}
          />
        )}
      </div>
    </div>
  );
}
