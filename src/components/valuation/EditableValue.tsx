"use client";

import { useState } from "react";
import { fmtPct, parsePercentInput } from "@/lib/format";
import { Flash } from "./Flash";

/**
 * Procentsats som går att klicka på och ändra. `onSubmit` får ett decimalvärde
 * och returnerar ett felmeddelande eller null. All validering sker i DCF-modulen.
 */
export function EditableValue({
  value,
  flashKey,
  label,
  onSubmit,
  className = "",
}: {
  value: number;
  flashKey: string;
  label: string;
  onSubmit?: (value: number) => string | null;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!onSubmit) return <Flash flashKey={flashKey}>{fmtPct(value)}</Flash>;

  function start() {
    setError(null);
    setDraft(String(Math.round(value * 1e5) / 1e3).replace(".", ","));
  }

  function save() {
    if (draft === null) return;
    const parsed = parsePercentInput(draft);
    const err = parsed === null ? "Skriv ett tal, t.ex. 8,5" : onSubmit!(parsed);
    if (err) {
      setError(err);
      return;
    }
    setDraft(null);
    setError(null);
  }

  if (draft !== null) {
    return (
      <span className="relative inline-block">
        <input
          autoFocus
          inputMode="decimal"
          aria-label={label}
          aria-invalid={!!error}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onFocus={(e) => e.target.select()}
          onBlur={() => (error ? setDraft(null) : save())}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setDraft(null);
              setError(null);
            }
          }}
          className={
            "num w-[4.5em] rounded-sm bg-white px-1 text-right text-ink outline-none ring-1 " +
            (error ? "ring-ink" : "ring-accent") +
            " " +
            className
          }
        />
        {error && (
          <span
            role="alert"
            className="absolute top-full right-0 z-10 mt-1 w-max max-w-[220px] rounded-sm bg-ink px-2 py-1 text-left text-xs whitespace-normal text-white"
          >
            {error}
          </span>
        )}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label={`${label}: ${fmtPct(value)}. Klicka för att ändra.`}
      className="num cursor-text rounded-sm decoration-faint decoration-dotted underline-offset-4 hover:text-ink hover:underline"
    >
      <Flash flashKey={flashKey} className={className}>
        {fmtPct(value)}
      </Flash>
    </button>
  );
}
