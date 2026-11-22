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
        <p className="max-w-[85%] rounded-2xl bg-neutral-100 px-4 py-2.5 whitespace-pre-wrap text-neutral-900">{m.content}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className={`whitespace-pre-wrap ${m.error ? "text-neutral-400" : "text-neutral-700"}`}>{m.content}</p>
      {m.applied && m.applied.length > 0 && (
        <div className="space-y-1 text-xs text-neutral-400">
          {m.applied.map((c, i) => (
            <p key={i}>{describe(c)}</p>
          ))}
          {m.before !== undefined && m.after !== undefined && (
            <p className="num pt-1 text-neutral-900">
              Värde per aktie {fmtSek(m.before)} → <span className="text-accent">{fmtSek(m.after)} kr</span>
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
}: {
  messages: ChatMessage[];
  pending: boolean;
  onSend: (text: string) => void;
  companyName: string;
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
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  function submit(value = text) {
    const v = value.trim();
    if (!v || pending) return;
    onSend(v);
    setText("");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-10 pb-4 sm:px-10 lg:px-6 lg:pt-6">
        <h2 className="text-sm font-medium text-neutral-900">Justera med AI</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Beskriv hur du ser på {companyName}. AI:n ändrar bara antagandena. Alla beräkningar görs av modellen.
        </p>
      </div>

      <div
        ref={scroller}
        className="min-h-[120px] flex-1 space-y-5 overflow-y-auto px-6 py-2 text-sm leading-relaxed sm:px-10 lg:px-6"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-900"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <Message key={i} m={m} />
        ))}
        {pending && <p className="animate-pulse text-neutral-400">Räknar om…</p>}
      </div>

      <form
        className="px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-10 lg:px-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex items-end gap-2 rounded-xl bg-neutral-100 p-1.5 pl-4 transition focus-within:bg-white focus-within:ring-1 focus-within:ring-neutral-300">
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
            className="max-h-40 flex-1 resize-none bg-transparent py-2 text-base outline-none placeholder:text-neutral-400 sm:text-sm"
          />
          <button
            type="submit"
            disabled={pending || !text.trim()}
            className="h-9 rounded-lg bg-neutral-900 px-3.5 text-sm text-white transition disabled:bg-neutral-300"
          >
            Skicka
          </button>
        </div>
      </form>
    </div>
  );
}
