"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import type { ChatMessage, ChatResponse } from "@/lib/chat/types";
import {
  type Assumptions as A,
  type AssumptionField,
  applyAssumptionUpdate,
  computeDcf,
  computeSensitivity,
  diffAssumptions,
  diffResults,
} from "@/lib/dcf";
import type { Company } from "@/lib/data/types";
import { getSessionId } from "@/lib/session";
import { Assumptions, Bridge } from "./Bridge";
import { DcfTable } from "./DcfTable";
import { FlashProvider } from "./Flash";
import { Headline } from "./Headline";
import { Sensitivity } from "./Sensitivity";

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mt-16">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium text-neutral-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ValuationView({ company, chatEnabled }: { company: Company; chatEnabled: boolean }) {
  const base = company.assumptions as A;
  const f = company.fundamentals;

  const [assumptions, setAssumptions] = useState<A>(base);
  const [flash, setFlash] = useState<{ keys: ReadonlySet<string>; id: number }>({ keys: new Set(), id: 0 });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const sessionId = useRef<string | null>(null);

  const result = useMemo(() => computeDcf(assumptions, f), [assumptions, f]);
  const sensitivity = useMemo(() => computeSensitivity(assumptions, f), [assumptions, f]);
  const isBase = useMemo(() => diffAssumptions(base, assumptions).length === 0, [base, assumptions]);

  // Ladda sparat scenario och chatthistorik (om Supabase är konfigurerat).
  useEffect(() => {
    const id = getSessionId();
    sessionId.current = id;
    let cancelled = false;
    fetch(`/api/scenario?sessionId=${id}&ticker=${encodeURIComponent(company.ticker)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { assumptions: A | null; messages: ChatMessage[] } | null) => {
        if (cancelled || !data) return;
        if (data.assumptions) setAssumptions(data.assumptions);
        if (data.messages?.length) setMessages(data.messages);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [company.ticker]);

  /** Byter antaganden och markerar alla celler som ändrats. Alla tal kommer från DCF-modulen. */
  const commit = useCallback(
    (next: A) => {
      const prev = computeDcf(assumptions, f);
      const after = computeDcf(next, f);
      const keys = new Set([...diffAssumptions(assumptions, next), ...diffResults(prev, after)]);
      setAssumptions(next);
      setFlash((s) => ({ keys, id: s.id + 1 }));
      return { before: prev.valuePerShare, after: after.valuePerShare };
    },
    [assumptions, f],
  );

  /** Direktredigering i tabellen. Validering och omräkning sker i DCF-modulen. */
  const edit = useCallback(
    (field: AssumptionField, year: number | null, value: number): string | null => {
      const r = applyAssumptionUpdate(assumptions, { field, year, value });
      if (!r.ok) return r.error;
      if (r.changedKeys.length === 0) return null;
      commit(r.assumptions);
      if (sessionId.current) {
        fetch("/api/scenario", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: sessionId.current, ticker: company.ticker, assumptions: r.assumptions }),
        }).catch(() => {});
      }
      return null;
    },
    [assumptions, commit, company.ticker],
  );

  const reset = useCallback(() => {
    commit(base);
    if (chatEnabled) setMessages((m) => [...m, { role: "assistant", content: "Återställt till grundscenariot." }]);
    if (sessionId.current) {
      fetch("/api/scenario", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, ticker: company.ticker }),
      }).catch(() => {});
    }
  }, [base, commit, company.ticker, chatEnabled]);

  const send = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = { role: "user", content: text };
      const history = [...messages, userMsg];
      setMessages(history);
      setPending(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionId.current,
            ticker: company.ticker,
            assumptions,
            messages: history.slice(-20).map(({ role, content }) => ({ role, content })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Något gick fel.");
        const { reply, assumptions: next, applied } = data as ChatResponse;
        const delta = applied.length ? commit(next) : {};
        setMessages((m) => [...m, { role: "assistant", content: reply, applied, ...delta }]);
      } catch (e) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: e instanceof Error ? e.message : "Något gick fel.", error: true },
        ]);
      } finally {
        setPending(false);
      }
    },
    [messages, assumptions, commit, company.ticker],
  );

  return (
    <FlashProvider value={flash}>
      <div
        className={
          chatEnabled ? "mx-auto max-w-[1280px] lg:grid lg:grid-cols-[minmax(0,1fr)_380px]" : "mx-auto max-w-[1040px]"
        }
      >
        <main className="px-6 pt-6 pb-16 sm:px-10 lg:pr-14">
          <nav className="flex items-center justify-between">
            <Link href="/" className="text-sm text-neutral-400 transition hover:text-neutral-900">
              ← Sök
            </Link>
            <button
              type="button"
              onClick={reset}
              disabled={isBase}
              className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:pointer-events-none disabled:opacity-0"
            >
              Återställ till grundscenario
            </button>
          </nav>

          <header className="mt-12 mb-10">
            <p className="text-sm text-neutral-400">
              {company.ticker} · {company.sector}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{company.name}</h1>
            <p className="mt-2 max-w-lg text-neutral-500">{company.description}</p>
          </header>

          <Headline result={result} />

          <Section title="Kassaflödesprognos">
            <DcfTable result={result} assumptions={assumptions} fundamentals={f} onEdit={edit} />
            <p className="mt-4 text-xs text-neutral-400">Klicka på en procentsats för att ändra den.</p>
          </Section>

          <div className="grid gap-x-14 sm:grid-cols-2">
            <Section title="Antaganden">
              <Assumptions assumptions={assumptions} onEdit={edit} />
            </Section>
            <Section title="Från EV till värde per aktie">
              <Bridge result={result} fundamentals={f} />
            </Section>
          </div>

          <Section title="Känslighet, värde per aktie i kr">
            <Sensitivity table={sensitivity} price={result.price} />
          </Section>

          <p className="mt-16 text-xs text-neutral-400">
            Mockdata. Belopp i MSEK. Diskontering vid årets slut, Gordons tillväxtmodell för terminalvärdet. Inte
            investeringsråd.
          </p>
        </main>

        {chatEnabled && (
          <aside className="border-t border-neutral-100 lg:sticky lg:top-0 lg:h-dvh lg:border-t-0 lg:border-l">
            <ChatPanel messages={messages} pending={pending} onSend={send} companyName={company.name} />
          </aside>
        )}
      </div>
    </FlashProvider>
  );
}
