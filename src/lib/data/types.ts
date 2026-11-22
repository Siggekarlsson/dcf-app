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
});

export type Company = z.infer<typeof companySchema>;

export interface CompanySummary {
  ticker: string;
  name: string;
  exchange: string;
}

/**
 * Gränssnitt för bolagsdata. Byt implementation (JSON → riktigt API) utan att röra UI eller DCF-modulen.
 */
export interface CompanyDataProvider {
  search(query: string, limit?: number): Promise<CompanySummary[]>;
  getCompany(ticker: string): Promise<Company | null>;
  listTickers(): Promise<string[]>;
}
