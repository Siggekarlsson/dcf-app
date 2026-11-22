import raw from "@/data/companies.json";
import { z } from "zod";
import { type Company, type CompanyDataProvider, type CompanySummary, companySchema } from "./types";

const companies: Company[] = z.array(companySchema).parse(raw.companies);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9&]/g, "");
}

function score(c: Company, q: string): number {
  const ticker = normalize(c.ticker);
  const names = [c.name, ...c.aliases].map(normalize);
  if (ticker === q) return 100;
  if (ticker.startsWith(q)) return 80;
  if (names.some((n) => n.startsWith(q))) return 60;
  if (names.some((n) => n.includes(q)) || ticker.includes(q)) return 40;
  return 0;
}

export function createJsonProvider(data: Company[] = companies): CompanyDataProvider {
  return {
    async search(query, limit = 6) {
      const q = normalize(query);
      if (!q) return [];
      return data
        .map((c) => ({ c, s: score(c, q) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name, "sv"))
        .slice(0, limit)
        .map(({ c }): CompanySummary => ({ ticker: c.ticker, name: c.name, exchange: c.exchange }));
    },
    async getCompany(ticker) {
      const t = ticker.toUpperCase();
      return data.find((c) => c.ticker === t) ?? null;
    },
    async listTickers() {
      return data.map((c) => c.ticker);
    },
  };
}
