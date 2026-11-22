"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Label } from "@/components/site/Label";
import { TopBar } from "@/components/site/TopBar";
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

  const [chatOpen, setChatOpen] = useState(false);
  const meta = [
    company.ticker,
    company.source === "yahoo" && company.asOf ? `Räkenskapsår ${company.asOf.slice(0, 4)}` : null,
    company.reportingCurrency && company.reportingCurrency !== "SEK" ? `Rapporterar i ${company.reportingCurrency}` : null,
  ].filter(Boolean);

  return (
    <FlashProvider value={flash}>
      <div className="min-h-dvh overflow-x-clip">
        <TopBar
          right={
            <button
              type="button"
              onClick={reset}
              disabled={isBase}
              className="text-[13px] text-ink underline-offset-4 transition hover:underline disabled:pointer-events-none disabled:opacity-0"
            >
              Återställ till grundscenario
            </button>
          }
        />

        <div className={chatEnabled ? "lg:grid lg:grid-cols-[minmax(0,1fr)_400px]" : ""}>
          <main className="min-w-0 pb-28 lg:pb-0">
            <section className="grid grid-cols-1 gap-y-8 px-5 pt-12 pb-14 sm:grid-cols-12 sm:px-8 sm:pt-20 sm:pb-20">
              <div className="sm:col-span-3">
                <Label>
                  {company.exchange}
                  {company.sector ? ` · ${company.sector}` : ""}
                </Label>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">{meta.join(" · ")}</p>
                {company.source === "exempel" && (
                  <p className="mt-3 max-w-[16rem] text-[13px] leading-relaxed text-accent">
                    Exempeldata. Aktuella siffror kunde inte hämtas just nu.
                  </p>
                )}
              </div>
              <h1 className="animate-rise text-display font-medium sm:col-span-9">{company.name}</h1>
            </section>

            <Headline result={result} />

            <Row label="Kassaflöde" note="MSEK. Klicka på en procentsats för att ändra den.">
              <DcfTable result={result} assumptions={assumptions} fundamentals={f} onEdit={edit} />
            </Row>

            <Row label="Antaganden" note="Avkastningskrav och tillväxt efter år fem.">
              <div className="grid gap-x-12 gap-y-12 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <Assumptions assumptions={assumptions} onEdit={edit} />
                <Bridge result={result} fundamentals={f} />
              </div>
            </Row>

            <Row label="Känslighet" note="Värde per aktie i kr för olika WACC och terminal tillväxt.">
              <Sensitivity table={sensitivity} price={result.price} />
            </Row>

            <Row label="Om modellen">
              <p className="max-w-2xl text-[15px] leading-relaxed text-muted">
                Fritt kassaflöde = EBIT efter skatt + avskrivningar − investeringar − ökning av rörelsekapital. Fem års
                prognos diskonteras vid årets slut, och terminalvärdet beräknas med Gordons tillväxtmodell.
                Grundscenariot utgår från bolagets senaste tre år: tillväxten klingar av mot 2 %, och marginaler och
                investeringar följer det historiska snittet.{" "}
                {company.source === "yahoo" ? "Data: Yahoo Finance och Nasdaq Nordic." : "Data: exempeldata."} Inte
                investeringsråd.
              </p>
            </Row>
          </main>

          {chatEnabled && (
            <>
              <aside
                className={
                  (chatOpen ? "fixed" : "hidden") +
                  " inset-x-2 top-[12dvh] bottom-2 z-40 lg:sticky lg:top-0 lg:block lg:h-dvh lg:p-3 lg:pl-0"
                }
              >
                <ChatPanel
                  messages={messages}
                  pending={pending}
                  onSend={send}
                  companyName={company.name}
                  onClose={() => setChatOpen(false)}
                />
              </aside>
              {!chatOpen && (
                <button
                  type="button"
                  onClick={() => setChatOpen(true)}
                  className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full bg-ink py-2 pr-2 pl-5 text-[14px] text-paper shadow-[0_12px_32px_-8px_rgba(21,23,27,0.5)] lg:hidden"
                >
                  Justera med AI
                  <span className="rounded-full bg-paper px-3 py-1 text-[13px] text-ink">Öppna</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </FlashProvider>
  );
}

function Row({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-y-6 border-t border-line px-5 py-10 sm:grid-cols-12 sm:px-8 sm:py-14">
      <div className="sm:col-span-3 sm:pr-6">
        <Label>{label}</Label>
        {note && <p className="mt-3 max-w-[15rem] text-[13px] leading-relaxed text-muted">{note}</p>}
      </div>
      <div className="min-w-0 sm:col-span-9">{children}</div>
    </section>
  );
}
