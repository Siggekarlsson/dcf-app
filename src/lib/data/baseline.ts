import { type Assumptions, type CompanyFundamentals, type YearDrivers, FORECAST_YEARS, validateAssumptions } from "@/lib/dcf";
import type { Point, Series, SeriesType } from "./yahoo";

/** Bolaget går inte att värdera med modellen (t.ex. bank eller saknad data). */
export class NotValuableError extends Error {}

export const DEFAULTS = {
  /** Svensk bolagsskatt. */
  taxRate: 0.206,
  nwcPct: 0.1,
  daPct: 0.04,
  terminalGrowth: 0.02,
  /** Tillväxt som prognosen konvergerar mot år 5. */
  longRunGrowth: 0.02,
  waccMain: 0.09,
  waccSmall: 0.105,
};

const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const round4 = (x: number) => Math.round(x * 1e4) / 1e4;
const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

function byDate(points: Point[] | undefined): Map<string, Point> {
  return new Map((points ?? []).map((p) => [p.date, p]));
}

function first(series: Series, ...types: SeriesType[]): Point[] | undefined {
  for (const t of types) if (series[t]?.length) return series[t];
  return undefined;
}

export interface BuildInput {
  series: Series;
  /** Aktiekurs i SEK. */
  price: number;
  /** Växelkurs från rapportvaluta till SEK. */
  fxToSek: number;
  /** "Nasdaq Stockholm" eller "First North". */
  market: string;
}

export interface BuildResult {
  fundamentals: CompanyFundamentals;
  assumptions: Assumptions;
  /** Senaste räkenskapsårets slutdatum. */
  asOf: string;
  reportingCurrency: string;
}

/**
 * Bygger nyckeltal (i MSEK) och ett neutralt grundscenario ur historiska årsdata.
 * Principer: tillväxten utgår från historisk CAGR och klingar av mot 2 %, marginaler och
 * kapitalintensitet är snitt av de senaste tre åren, WACC sätts schablonmässigt per lista.
 */
export function buildFromSeries({ series, price, fxToSek, market }: BuildInput): BuildResult {
  const revenue = (series.annualTotalRevenue ?? []).filter((p) => p.value > 0);
  if (revenue.length === 0) throw new NotValuableError("Omsättning saknas i den finansiella datan.");
  const ebitPoints = first(series, "annualEBIT", "annualOperatingIncome");
  if (!ebitPoints) {
    throw new NotValuableError("Rörelseresultat (EBIT) saknas. Det är vanligt för banker, försäkrings- och investmentbolag.");
  }
  const sharesPoints = first(series, "annualOrdinarySharesNumber", "annualShareIssued");
  const shares = sharesPoints?.at(-1)?.value;
  if (!shares || shares <= 0) throw new NotValuableError("Antal aktier saknas.");
  if (!(price > 0) || !(fxToSek > 0)) throw new NotValuableError("Aktiekurs saknas.");

  const latest = revenue.at(-1)!;
  const toMsek = (x: number) => (x * fxToSek) / 1e6;

  // Tillväxt: CAGR över tillgängliga år (max 3 år bakåt).
  const window = revenue.slice(-4);
  const years = window.length - 1;
  const cagr = years >= 1 ? Math.pow(latest.value / window[0].value, 1 / years) - 1 : DEFAULTS.longRunGrowth;
  const g0 = clamp(Number.isFinite(cagr) ? cagr : DEFAULTS.longRunGrowth, -0.05, 0.15);

  // Snitt över de senaste tre åren där både omsättning och posten finns.
  const recent = revenue.slice(-3);
  const ratio = (points: Point[] | undefined, transform: (v: number) => number = (v) => v) => {
    const m = byDate(points);
    const rs = recent.filter((r) => m.has(r.date)).map((r) => transform(m.get(r.date)!.value) / r.value);
    return rs.length ? avg(rs) : null;
  };

  const ebitMargin = clamp(ratio(ebitPoints) ?? 0, -0.3, 0.6);
  const daPct = clamp(ratio(series.annualReconciledDepreciation, Math.abs) ?? DEFAULTS.daPct, 0, 0.3);
  const capexPct = clamp(ratio(series.annualCapitalExpenditure, Math.abs) ?? daPct, 0, 0.3);
  const taxRaw = series.annualTaxRateForCalcs?.at(-1)?.value;
  const taxRate = taxRaw !== undefined && taxRaw > 0.05 && taxRaw < 0.5 ? clamp(taxRaw, 0.1, 0.35) : DEFAULTS.taxRate;

  const yearsDrivers: YearDrivers[] = Array.from({ length: FORECAST_YEARS }, (_, i) => ({
    revenueGrowth: round4(g0 + ((DEFAULTS.longRunGrowth - g0) * i) / (FORECAST_YEARS - 1)),
    ebitMargin: round4(ebitMargin),
    taxRate: round4(taxRate),
    daPct: round4(daPct),
    capexPct: round4(capexPct),
    nwcPct: DEFAULTS.nwcPct,
  }));

  const debt = series.annualTotalDebt?.at(-1)?.value ?? 0;
  const cash = first(series, "annualCashCashEquivalentsAndShortTermInvestments", "annualCashAndCashEquivalents")?.at(-1)?.value ?? 0;

  const assumptions: Assumptions = {
    years: yearsDrivers,
    wacc: market === "First North" ? DEFAULTS.waccSmall : DEFAULTS.waccMain,
    terminalGrowth: DEFAULTS.terminalGrowth,
  };
  const errors = validateAssumptions(assumptions);
  if (errors.length) throw new NotValuableError(`Kunde inte skapa ett giltigt grundscenario: ${errors[0]}`);

  return {
    fundamentals: {
      baseYear: Number(latest.date.slice(0, 4)),
      baseRevenue: toMsek(latest.value),
      netDebt: toMsek(debt - cash),
      sharesOutstanding: shares / 1e6,
      price,
    },
    assumptions,
    asOf: latest.date,
    reportingCurrency: latest.currency ?? "SEK",
  };
}
