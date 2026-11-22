import { z } from "zod";

const yearDriversSchema = z.object({
  revenueGrowth: z.number(),
  ebitMargin: z.number(),
  taxRate: z.number(),
  daPct: z.number(),
  capexPct: z.number(),
  nwcPct: z.number(),
});

export const assumptionsSchema = z.object({
  wacc: z.number(),
  terminalGrowth: z.number(),
  years: z.array(yearDriversSchema).length(5),
});

export const companySchema = z.object({
  ticker: z.string(),
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  exchange: z.string(),
  currency: z.string(),
  sector: z.string(),
  description: z.string(),
  fundamentals: z.object({
    baseYear: z.number().int(),
    baseRevenue: z.number(),
    netDebt: z.number(),
    sharesOutstanding: z.number().positive(),
    price: z.number().nonnegative(),
  }),
  /** Grundscenario. */
  assumptions: assumptionsSchema,
  /** "yahoo" = live data, "exempel" = mockdata i JSON. */
  source: z.enum(["yahoo", "exempel"]).default("exempel"),
  /** Slutdatum för senaste räkenskapsår som datan bygger på. */
  asOf: z.string().optional(),
  reportingCurrency: z.string().optional(),
});

export type Company = z.infer<typeof companySchema>;

export interface CompanySummary {
  ticker: string;
  name: string;
  exchange: string;
  sector?: string;
  price?: number | null;
}

/** Resultat av en uppslagning: värderingsbart bolag, eller känt bolag som inte går att värdera just nu. */
export type CompanyLookup =
  | { status: "ok"; company: Company }
  | { status: "unavailable"; summary: CompanySummary; reason: string; temporary: boolean }
  | { status: "not_found" };

/**
 * Gränssnitt för bolagsdata. Byt implementation (JSON → riktigt API) utan att röra UI eller DCF-modulen.
 */
export interface CompanyDataProvider {
  search(query: string, limit?: number): Promise<CompanySummary[]>;
  getCompany(ticker: string): Promise<CompanyLookup>;
  /** Mest omsatta bolagen, för förslag på startsidan. */
  popular(limit?: number): Promise<CompanySummary[]>;
  count(): Promise<number>;
}
