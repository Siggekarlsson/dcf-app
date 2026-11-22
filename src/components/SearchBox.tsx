"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { CompanySummary } from "@/lib/data/types";

interface Props {
  autoFocus?: boolean;
  size?: "lg" | "sm";
}

export function SearchBox({ autoFocus, size = "lg" }: Props) {
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
    }, 120);
    return () => clearTimeout(t);
  }, [query]);

  function go(c: CompanySummary | undefined) {
    if (!c) return;
    setOpen(false);
    router.push(`/bolag/${encodeURIComponent(c.ticker)}`);
  }

  const showList = open && query.trim().length > 0;
  const lg = size === "lg";

  return (
    <div className="relative w-full">
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
        placeholder="Sök bolag eller ticker"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
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
        className={
          "w-full appearance-none rounded-xl bg-neutral-100 text-neutral-900 outline-none transition " +
          "placeholder:text-neutral-400 focus:bg-white focus:ring-1 focus:ring-neutral-300 focus:shadow-[0_1px_12px_rgba(0,0,0,0.06)] " +
          (lg ? "h-14 px-5 text-lg" : "h-10 px-4 text-sm")
        }
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl bg-white py-1 shadow-[0_4px_24px_rgba(0,0,0,0.08)] ring-1 ring-neutral-200"
        >
          {results.length === 0 ? (
            <li className="px-5 py-3 text-sm text-neutral-400">Inga träffar</li>
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
                  "flex cursor-pointer items-baseline justify-between gap-4 px-5 py-3 " +
                  (i === active ? "bg-neutral-50" : "")
                }
              >
                <span className="text-neutral-900">{c.name}</span>
                <span className="num text-xs tracking-wide text-neutral-400">{c.ticker}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
