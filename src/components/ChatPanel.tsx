import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useStore } from "../store/useStore";
import { SCENARIOS } from "../data/scenarios";
import MessageBubble from "./MessageBubble";

export default function ChatPanel() {
  const { messages, sendMessage, thinking } = useStore();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, thinking]);

  const send = async (text: string) => {
    if (!text.trim() || thinking) return;
    await sendMessage(text.trim());
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 font-semibold text-slate-700 text-sm">
        聊天窗口 · 用户视角
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="text-xs text-slate-400 text-center mt-8">
            试试下面的快捷问题，或在底部输入框发任意消息。
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} text={m.text} turn={m.turn} />
        ))}
        {thinking && <TypingBubble />}
        <div ref={endRef} />
      </div>

      <div className="px-3 pt-2 border-t border-slate-100">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {SCENARIOS.map((s) => {
            const tag =
              s.category === "phone"
                ? s.strength >= 0.7
                  ? "phone-strong"
                  : "phone-weak"
                : s.category === "renovation"
                ? s.strength >= 0.7
                  ? "reno-strong"
                  : "reno-weak"
                : "none";
            const dataKey =
              s.strength >= 0.7 && s.category === "phone"
                ? "chip-strong-phone"
                : s.category === "none"
                ? "chip-emo"
                : s.strength >= 0.7 && s.category === "renovation"
                ? "chip-reno"
                : undefined;
            return (
              <button
                key={s.text}
                data-tour={dataKey}
                onClick={() => send(s.text)}
                disabled={thinking}
                className="text-[11px] px-2 py-1 rounded-full border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-slate-600 disabled:opacity-50"
              >
                <span className="mr-1 text-slate-400">#{tag}</span>
                {s.text.length > 12 ? s.text.slice(0, 12) + "…" : s.text}
              </button>
            );
          })}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
            setInput("");
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="发一句消息…"
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-blue-400"
          />
          <button
            type="submit"
            disabled={thinking}
            className="px-3 rounded-lg bg-blue-600 text-white disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1">
        <span className="text-[10px] text-slate-400 mr-1">AI 思考中</span>
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
      </div>
    </div>
  );
}
