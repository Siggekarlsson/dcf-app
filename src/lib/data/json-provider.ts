import raw from "@/data/companies.json";
import { z } from "zod";
import { rank } from "./search";
import { type Company, type CompanyDataProvider, type CompanySummary, companySchema } from "./types";

/** Mockdata för fem bolag. Används för tester, utveckling (DATA_SOURCE=mock) och som reserv. */
export const exampleCompanies: Company[] = z.array(companySchema).parse(raw.companies);

const summarize = (c: Company): CompanySummary => ({
  ticker: c.ticker,
  name: c.name,
  exchange: c.exchange,
  sector: c.sector,
  price: c.fundamentals.price,
});

export function getExampleCompany(ticker: string): Company | null {
  return exampleCompanies.find((c) => c.ticker === ticker.toUpperCase()) ?? null;
}

export function createJsonProvider(data: Company[] = exampleCompanies): CompanyDataProvider {
  return {
    async search(query, limit = 8) {
      return rank(data, query, limit).map(summarize);
    },
    async getCompany(ticker) {
      const c = data.find((x) => x.ticker === ticker.toUpperCase());
      return c ? { status: "ok", company: c } : { status: "not_found" };
    },
    async popular(limit = 6) {
      return data.slice(0, limit).map(summarize);
    },
    async count() {
      return data.length;
    },
  };
}
