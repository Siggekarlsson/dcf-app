/**
 * Typer för DCF-modellen.
 *
 * Alla procentsatser lagras som decimaler (0.08 = 8 %).
 * Alla belopp är i miljoner (MSEK), antal aktier i miljoner, kurs i SEK.
 */

/** Drivare som kan variera per prognosår. */
export interface YearDrivers {
  /** Omsättningstillväxt mot föregående år. */
  revenueGrowth: number;
  /** EBIT i procent av omsättningen. */
  ebitMargin: number;
  /** Skattesats på EBIT. */
  taxRate: number;
  /** Avskrivningar (D&A) i procent av omsättningen. */
  daPct: number;
  /** Investeringar (CapEx) i procent av omsättningen. */
  capexPct: number;
  /** Förändring i rörelsekapital i procent av omsättningsförändringen. */
  nwcPct: number;
}

export const YEAR_FIELDS = [
  "revenueGrowth",
  "ebitMargin",
  "taxRate",
  "daPct",
  "capexPct",
  "nwcPct",
] as const satisfies readonly (keyof YearDrivers)[];

export type YearField = (typeof YEAR_FIELDS)[number];

export const GLOBAL_FIELDS = ["wacc", "terminalGrowth"] as const;
export type GlobalField = (typeof GLOBAL_FIELDS)[number];

export type AssumptionField = YearField | GlobalField;

export interface Assumptions {
  /** Exakt FORECAST_YEARS poster, år 1 först. */
  years: YearDrivers[];
  wacc: number;
  terminalGrowth: number;
}

/** Bolagsdata som inte är antaganden, utan utgångsläge. */
export interface CompanyFundamentals {
  /** Senaste rapporterade räkenskapsår, t.ex. 2025. */
  baseYear: number;
  /** Omsättning basåret, MSEK. */
  baseRevenue: number;
  /** Nettoskuld, MSEK (negativ = nettokassa). */
  netDebt: number;
  /** Antal utestående aktier, miljoner. */
  sharesOutstanding: number;
  /** Aktuell aktiekurs, SEK. */
  price: number;
}

export interface ProjectionRow {
  /** Index 1..N */
  index: number;
  /** Kalenderår, t.ex. 2026 */
  year: number;
  revenue: number;
  ebit: number;
  tax: number;
  nopat: number;
  da: number;
  capex: number;
  deltaNwc: number;
  fcf: number;
  discountFactor: number;
  pvFcf: number;
}

export interface DcfResult {
  rows: ProjectionRow[];
  sumPvFcf: number;
  terminalValue: number;
  pvTerminalValue: number;
  enterpriseValue: number;
  equityValue: number;
  valuePerShare: number;
  price: number;
  /** valuePerShare / price - 1 */
  upside: number;
}

export interface SensitivityTable {
  waccValues: number[];
  growthValues: number[];
  /** cells[i][j] = värde per aktie för waccValues[i] × growthValues[j]; null om ogiltigt (WACC ≤ g). */
  cells: (number | null)[][];
}
