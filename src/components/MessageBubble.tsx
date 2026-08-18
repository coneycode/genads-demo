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
