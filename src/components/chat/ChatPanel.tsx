"use client";

import { useEffect, useRef, useState } from "react";
import type { AppliedChange, ChatMessage } from "@/lib/chat/types";
import { fmtPct, fmtSek } from "@/lib/format";
import { FIELD_LABELS } from "@/lib/labels";

const SUGGESTIONS = [
  "Sänk WACC till 8 %",
  "EBIT-marginal 14 % från år 3",
  "Halvera tillväxten alla år",
];

function describe(c: AppliedChange): string {
  const when = c.year ? `år ${c.year}` : c.field === "wacc" || c.field === "terminalGrowth" ? "" : "alla år";
  return `${FIELD_LABELS[c.field]}${when ? ` ${when}` : ""} → ${fmtPct(c.value)}`;
}

function Message({ m }: { m: ChatMessage }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-white/10 px-4 py-2.5 whitespace-pre-wrap text-paper">{m.content}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className={`whitespace-pre-wrap ${m.error ? "text-white/45" : "text-white/85"}`}>{m.content}</p>
      {m.applied && m.applied.length > 0 && (
        <div className="space-y-1 border-l border-white/15 pl-3 text-[12px] text-white/50">
          {m.applied.map((c, i) => (
            <p key={i}>{describe(c)}</p>
          ))}
          {m.before !== undefined && m.after !== undefined && (
            <p className="num pt-1 text-paper">
              Värde per aktie {fmtSek(m.before)} → <span className="text-[#8fb0ff]">{fmtSek(m.after)} kr</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ChatPanel({
  messages,
  pending,
  onSend,
  companyName,
  onClose,
}: {
  messages: ChatMessage[];
  pending: boolean;
  onSend: (text: string) => void;
  companyName: string;
  /** Stänger panelen på mobil. */
  onClose?: () => void;
}) {
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    // Panelen kan vara dold (scrollHeight 0); behåll då standardhöjden.
    if (el.scrollHeight > 0) el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  function submit(value = text) {
    const v = value.trim();
    if (!v || pending) return;
    onSend(v);
    setText("");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-ink text-[14px] text-paper shadow-[0_24px_64px_-16px_rgba(21,23,27,0.55)] lg:shadow-none">
      <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
        <div>
          <p className="flex items-center gap-2 text-[13px] leading-none">
            <span aria-hidden className="size-[7px] rounded-full bg-[#8fb0ff]" />
            Justera med AI
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-white/50">
            Beskriv hur du ser på {companyName}. AI:n ändrar bara antagandena, och modellen räknar.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[13px] text-paper lg:hidden"
          >
            Stäng
          </button>
        )}
      </div>

      <div ref={scroller} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-3 leading-relaxed" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-white/70 transition hover:border-white/40 hover:text-paper"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <Message key={i} m={m} />
        ))}
        {pending && <p className="animate-pulse text-white/45">Räknar om…</p>}
      </div>

      <form
        className="p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex items-end gap-2 rounded-xl bg-white/[0.07] p-1.5 pl-4 transition focus-within:bg-white/[0.11]">
          <textarea
            ref={input}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="T.ex. marginal 13 % år 4–5"
            aria-label="Meddelande"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-base text-paper outline-none placeholder:text-white/35 sm:text-[14px]"
          />
          <button
            type="submit"
            disabled={pending || !text.trim()}
            aria-label="Skicka"
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-paper text-ink transition disabled:bg-white/15 disabled:text-white/40"
          >
            ↑
          </button>
        </div>
      </form>
    </div>
  );
}
