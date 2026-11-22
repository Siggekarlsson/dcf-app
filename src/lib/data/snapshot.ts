import type { Point, Series, SeriesType } from "./yahoo";

/**
 * Kompakt lagringsformat för finansiell data som hämtas av ett schemalagt jobb
 * (scripts/fetch-fundamentals.ts) och sparas i src/data/fundamentals.json.
 * Appen anropar aldrig Yahoo vid sidvisning.
 */
export interface SnapshotEntry {
  /** Rapportvaluta, t.ex. "SEK" eller "EUR". */
  c: string;
  /** Serier som [datum, värde]-par, äldst först. */
  s: Partial<Record<SeriesType, [string, number][]>>;
}

export interface Snapshot {
  fetchedAt: string | null;
  /** Växelkurser till SEK, t.ex. { EUR: 11.2 }. */
  fx: Record<string, number>;
  companies: Record<string, SnapshotEntry>;
}

export function toEntry(series: Series): SnapshotEntry | null {
  const currency = series.annualTotalRevenue?.at(-1)?.currency ?? "SEK";
  const s: SnapshotEntry["s"] = {};
  let any = false;
  for (const [type, points] of Object.entries(series) as [SeriesType, Point[]][]) {
    if (!points?.length) continue;
    // Behåll högst fem år per serie för att hålla filen liten.
    s[type] = points.slice(-5).map((p) => [p.date, p.value]);
    any = true;
  }
  return any ? { c: currency, s } : null;
}

export function fromEntry(e: SnapshotEntry): Series {
  const out: Series = {};
  for (const [type, pairs] of Object.entries(e.s) as [SeriesType, [string, number][]][]) {
    out[type] = pairs.map(([date, value]) => ({ date, value, currency: e.c }));
  }
  return out;
}
