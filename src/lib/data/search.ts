export interface Searchable {
  ticker: string;
  name: string;
  aliases?: string[];
  /** Används som tiebreaker: mer omsatta bolag först. */
  turnover?: number | null;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9&]/g, "");
}

function score(c: Searchable, q: string): number {
  const ticker = normalize(c.ticker);
  const names = [c.name, ...(c.aliases ?? [])].map(normalize);
  if (ticker === q) return 100;
  if (names.some((n) => n === q)) return 90;
  if (ticker.startsWith(q)) return 80;
  if (names.some((n) => n.startsWith(q))) return 60;
  // Ordstart i namnet, t.ex. "mauritz" i "Hennes & Mauritz"
  const words = [c.name, ...(c.aliases ?? [])].flatMap((n) => n.split(/\s+/)).map(normalize);
  if (words.some((w) => w.startsWith(q))) return 50;
  if (names.some((n) => n.includes(q)) || ticker.includes(q)) return 30;
  return 0;
}

export function rank<T extends Searchable>(items: T[], query: string, limit: number): T[] {
  const q = normalize(query);
  if (!q) return [];
  return items
    .map((c) => ({ c, s: score(c, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || (b.c.turnover ?? 0) - (a.c.turnover ?? 0) || a.c.name.localeCompare(b.c.name, "sv"))
    .slice(0, limit)
    .map((x) => x.c);
}
