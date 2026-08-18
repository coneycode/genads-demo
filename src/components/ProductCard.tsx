import type { ProductInfo } from "../engine/types";

export default function ProductCard({
  product,
  hard,
  adText,
}: {
  product: ProductInfo;
  hard?: boolean;
  adText?: string;
}) {
  return (
    <div
      className={`mt-2 rounded-lg border overflow-hidden ${
        hard
          ? "border-red-400 bg-red-50 animate-pulse-red"
          : "border-slate-200 bg-white"
      }`}
    >
      {hard && (
        <div className="bg-red-500 text-white text-xs font-bold px-3 py-1 text-center tracking-wide">
          🔥 限时秒杀 · 错过等一年
        </div>
      )}
      <div className="flex gap-3 p-3">
        <div className="text-4xl leading-none flex items-center">{product.imageEmoji}</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 truncate">{product.title}</div>
          <div className="text-xs text-slate-500 truncate">{product.subtitle}</div>
          <div className="text-sm font-bold text-blue-600 mt-1">{product.price}</div>
          <div className="flex gap-1 mt-1 flex-wrap">
            {product.tags.map((t) => (
              <span
                key={t}
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
      {adText && (
        <div className="px-3 pb-2 text-xs text-slate-500 border-t border-slate-100 pt-1">
          {adText}
        </div>
      )}
    </div>
  );
}
