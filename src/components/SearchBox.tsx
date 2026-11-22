"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { CompanySummary } from "@/lib/data/types";

export function SearchBox({ autoFocus, placeholder = "Sök bolag eller ticker" }: { autoFocus?: boolean; placeholder?: string }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanySummary[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) return; // listan döljs ändå när fältet är tomt
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data: { results: CompanySummary[] } = await res.json();
        if (id === reqId.current) {
          setResults(data.results);
          setActive(0);
        }
      } catch {
        /* nätverksfel: behåll tidigare resultat */
      }
    }, 100);
    return () => clearTimeout(t);
  }, [query]);

  function go(c: CompanySummary | undefined) {
    if (!c) return;
    setOpen(false);
    router.push(`/bolag/${encodeURIComponent(c.ticker)}`);
  }

  const showList = open && query.trim().length > 0;

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-4 border-b border-ink pb-3 sm:pb-4">
        <input
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
          aria-label="Sök bolag eller ticker"
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(results[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="w-full min-w-0 appearance-none bg-transparent text-[26px] tracking-[-0.03em] text-ink outline-none placeholder:text-faint sm:text-4xl"
        />
        <span aria-hidden className="shrink-0 text-2xl text-ink sm:text-3xl">
          ↘
        </span>
      </div>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 max-h-[60dvh] overflow-y-auto bg-paper shadow-[0_24px_48px_-24px_rgba(21,23,27,0.25)]"
        >
          {results.length === 0 ? (
            <li className="border-b border-line py-4 text-muted">Inga träffar</li>
          ) : (
            results.map((c, i) => (
              <li
                key={c.ticker}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(c);
                }}
                onMouseEnter={() => setActive(i)}
                className={
                  "grid cursor-pointer grid-cols-[1fr_auto] items-baseline gap-4 border-b border-line py-3.5 transition-[padding] sm:grid-cols-[1fr_10rem_6rem_1rem] " +
                  (i === active ? "pl-2 text-ink" : "text-ink-soft")
                }
              >
                <span className="truncate text-lg tracking-[-0.02em]">{c.name}</span>
                <span className="hidden truncate text-[13px] text-muted sm:block">{c.sector}</span>
                <span className="num text-right text-[13px] text-muted">{c.ticker}</span>
                <span aria-hidden className={`hidden text-right sm:block ${i === active ? "opacity-100" : "opacity-0"}`}>
                  →
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
