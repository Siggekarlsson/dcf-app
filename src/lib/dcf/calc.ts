import {
  type AssumptionField,
  type Assumptions,
  type CompanyFundamentals,
  type DcfResult,
  type GlobalField,
  type ProjectionRow,
  type SensitivityTable,
  type YearField,
  GLOBAL_FIELDS,
  YEAR_FIELDS,
} from "./types";
import { FIELD_LABELS } from "./labels";

export const FORECAST_YEARS = 5;

/** Tillåtna intervall per fält (decimaler). Skyddar mot orimliga värden från UI eller AI. */
export const FIELD_BOUNDS: Record<AssumptionField, { min: number; max: number }> = {
  revenueGrowth: { min: -0.5, max: 1 },
  ebitMargin: { min: -0.5, max: 0.9 },
  taxRate: { min: 0, max: 0.6 },
  daPct: { min: 0, max: 0.5 },
  capexPct: { min: 0, max: 0.5 },
  nwcPct: { min: -1, max: 1 },
  wacc: { min: 0.01, max: 0.3 },
  terminalGrowth: { min: -0.05, max: 0.08 },
};

export class DcfError extends Error {}

export function isYearField(field: string): field is YearField {
  return (YEAR_FIELDS as readonly string[]).includes(field);
}

export function isGlobalField(field: string): field is GlobalField {
  return (GLOBAL_FIELDS as readonly string[]).includes(field);
}

/** Returnerar en lista med fel; tom lista = giltiga antaganden. */
export function validateAssumptions(a: Assumptions): string[] {
  const errors: string[] = [];
  if (a.years.length !== FORECAST_YEARS) {
    errors.push(`Antagandena måste innehålla exakt ${FORECAST_YEARS} år.`);
  }
  a.years.forEach((y, i) => {
    for (const field of YEAR_FIELDS) {
      const v = y[field];
      const { min, max } = FIELD_BOUNDS[field];
      if (!Number.isFinite(v)) errors.push(`${field} år ${i + 1} är inte ett tal.`);
      else if (v < min || v > max) errors.push(`${field} år ${i + 1} ligger utanför ${min}–${max}.`);
    }
  });
  for (const field of GLOBAL_FIELDS) {
    const v = a[field];
    const { min, max } = FIELD_BOUNDS[field];
    if (!Number.isFinite(v)) errors.push(`${field} är inte ett tal.`);
    else if (v < min || v > max) errors.push(`${field} ligger utanför ${min}–${max}.`);
  }
  if (a.wacc <= a.terminalGrowth) {
    errors.push("WACC måste vara högre än den terminala tillväxten.");
  }
  return errors;
}

/** Bygger prognosraderna. Antar diskontering vid årets slut. */
export function projectCashFlows(
  a: Assumptions,
  f: CompanyFundamentals,
  wacc: number = a.wacc,
): ProjectionRow[] {
  const rows: ProjectionRow[] = [];
  let prevRevenue = f.baseRevenue;
  a.years.forEach((d, i) => {
    const t = i + 1;
    const revenue = prevRevenue * (1 + d.revenueGrowth);
    const ebit = revenue * d.ebitMargin;
    // Ingen skatt på negativ EBIT (förenkling: inga underskottsavdrag).
    const tax = Math.max(ebit, 0) * d.taxRate;
    const nopat = ebit - tax;
    const da = revenue * d.daPct;
    const capex = revenue * d.capexPct;
    const deltaNwc = (revenue - prevRevenue) * d.nwcPct;
    const fcf = nopat + da - capex - deltaNwc;
    const discountFactor = 1 / Math.pow(1 + wacc, t);
    rows.push({
      index: t,
      year: f.baseYear + t,
      revenue,
      ebit,
      tax,
      nopat,
      da,
      capex,
      deltaNwc,
      fcf,
      discountFactor,
      pvFcf: fcf * discountFactor,
    });
    prevRevenue = revenue;
  });
  return rows;
}

function valueFromRows(
  rows: ProjectionRow[],
  wacc: number,
  g: number,
  f: CompanyFundamentals,
) {
  if (wacc <= g) throw new DcfError("WACC måste vara högre än den terminala tillväxten.");
  const last = rows[rows.length - 1];
  const sumPvFcf = rows.reduce((s, r) => s + r.pvFcf, 0);
  const terminalValue = (last.fcf * (1 + g)) / (wacc - g);
  const pvTerminalValue = terminalValue * last.discountFactor;
  const enterpriseValue = sumPvFcf + pvTerminalValue;
  const equityValue = enterpriseValue - f.netDebt;
  const valuePerShare = equityValue / f.sharesOutstanding;
  return { sumPvFcf, terminalValue, pvTerminalValue, enterpriseValue, equityValue, valuePerShare };
}

export function computeDcf(a: Assumptions, f: CompanyFundamentals): DcfResult {
  const errors = validateAssumptions(a);
  if (errors.length) throw new DcfError(errors.join(" "));
  if (f.sharesOutstanding <= 0) throw new DcfError("Antal aktier måste vara positivt.");

  const rows = projectCashFlows(a, f);
  const v = valueFromRows(rows, a.wacc, a.terminalGrowth, f);
  return {
    rows,
    ...v,
    price: f.price,
    upside: f.price > 0 ? v.valuePerShare / f.price - 1 : NaN,
  };
}

/** Steg och antal steg åt varje håll för känslighetstabellen. */
export interface SensitivityOptions {
  waccStep?: number;
  growthStep?: number;
  stepsEachSide?: number;
}

export function computeSensitivity(
  a: Assumptions,
  f: CompanyFundamentals,
  { waccStep = 0.005, growthStep = 0.005, stepsEachSide = 2 }: SensitivityOptions = {},
): SensitivityTable {
  const offsets = Array.from({ length: stepsEachSide * 2 + 1 }, (_, i) => i - stepsEachSide);
  const round = (x: number) => Math.round(x * 1e6) / 1e6;
  const waccValues = offsets.map((o) => round(a.wacc + o * waccStep));
  const growthValues = offsets.map((o) => round(a.terminalGrowth + o * growthStep));

  const cells = waccValues.map((w) => {
    if (w <= 0) return growthValues.map(() => null);
    const rows = projectCashFlows(a, f, w);
    return growthValues.map((g) =>
      w <= g ? null : valueFromRows(rows, w, g, f).valuePerShare,
    );
  });
  return { waccValues, growthValues, cells };
}

// ---------------------------------------------------------------------------
// Ändringar av antaganden (används av både UI och AI-verktyget)
// ---------------------------------------------------------------------------

export interface AssumptionUpdate {
  field: AssumptionField;
  /** 1..5 för årsfält; utelämnad/null = alla år. Måste utelämnas för WACC/terminal growth. */
  year?: number | null;
  /** Nytt värde som decimal (0.08 = 8 %). */
  value: number;
}

export type UpdateOutcome =
  | { ok: true; assumptions: Assumptions; changedKeys: string[] }
  | { ok: false; error: string };

/** Nyckel för en antagandecell, används för markering i UI. */
export function assumptionKey(field: AssumptionField, year?: number): string {
  return year === undefined ? field : `${field}:${year}`;
}

/**
 * Applicerar en ändring immutabelt och validerar resultatet.
 * Returnerar fel i stället för att kasta, så att AI:n kan få tillbaka ett begripligt felmeddelande.
 */
export function applyAssumptionUpdate(a: Assumptions, u: AssumptionUpdate): UpdateOutcome {
  const { field, value } = u;
  const year = u.year ?? undefined;

  if (!Number.isFinite(value)) return { ok: false, error: "Värdet måste vara ett tal." };
  if (!isYearField(field) && !isGlobalField(field)) {
    return { ok: false, error: `Okänt fält: ${String(field)}.` };
  }
  const { min, max } = FIELD_BOUNDS[field];
  if (value < min || value > max) {
    return { ok: false, error: `${FIELD_LABELS[field]} måste ligga mellan ${pct(min)} och ${pct(max)}.` };
  }

  let next: Assumptions;
  let changedKeys: string[];

  if (isGlobalField(field)) {
    if (year !== undefined) {
      return { ok: false, error: `${FIELD_LABELS[field]} gäller alla år och tar inget år.` };
    }
    next = { ...a, years: a.years.map((y) => ({ ...y })), [field]: value };
    changedKeys = a[field] === value ? [] : [assumptionKey(field)];
  } else {
    if (year !== undefined && (!Number.isInteger(year) || year < 1 || year > a.years.length)) {
      return { ok: false, error: `År måste vara ett heltal mellan 1 och ${a.years.length}.` };
    }
    changedKeys = [];
    next = {
      ...a,
      years: a.years.map((y, i) => {
        const idx = i + 1;
        if (year !== undefined && idx !== year) return { ...y };
        if (y[field] !== value) changedKeys.push(assumptionKey(field, idx));
        return { ...y, [field]: value };
      }),
    };
  }

  if (next.wacc <= next.terminalGrowth) {
    return {
      ok: false,
      error: `WACC (${pct(next.wacc)}) måste vara högre än terminal growth (${pct(next.terminalGrowth)}).`,
    };
  }
  return { ok: true, assumptions: next, changedKeys };
}

/** Applicerar flera ändringar i följd; avbryter vid första fel. */
export function applyAssumptionUpdates(a: Assumptions, updates: AssumptionUpdate[]): UpdateOutcome {
  let current = a;
  const keys = new Set<string>();
  for (const u of updates) {
    const r = applyAssumptionUpdate(current, u);
    if (!r.ok) return r;
    current = r.assumptions;
    r.changedKeys.forEach((k) => keys.add(k));
  }
  return { ok: true, assumptions: current, changedKeys: [...keys] };
}

// ---------------------------------------------------------------------------
// Diff för att markera ändrade celler efter omräkning
// ---------------------------------------------------------------------------

export const ROW_METRICS = ["revenue", "ebit", "tax", "da", "capex", "deltaNwc", "fcf", "pvFcf"] as const;
export type RowMetric = (typeof ROW_METRICS)[number];

export const SUMMARY_METRICS = [
  "sumPvFcf",
  "enterpriseValue",
  "equityValue",
  "valuePerShare",
  "upside",
  "terminalValue",
  "pvTerminalValue",
] as const;

function differs(x: number, y: number): boolean {
  const scale = Math.max(1, Math.abs(x), Math.abs(y));
  return Math.abs(x - y) / scale > 1e-9;
}

/** Nycklar (`metric:index` resp. `metric`) för alla beräknade celler som ändrats. */
export function diffResults(prev: DcfResult, next: DcfResult): string[] {
  const keys: string[] = [];
  next.rows.forEach((row, i) => {
    const old = prev.rows[i];
    for (const m of ROW_METRICS) {
      if (!old || differs(old[m], row[m])) keys.push(`${m}:${row.index}`);
    }
  });
  for (const m of SUMMARY_METRICS) {
    if (differs(prev[m], next[m])) keys.push(m);
  }
  return keys;
}

/** Nycklar för alla antagandeceller som skiljer sig. */
export function diffAssumptions(prev: Assumptions, next: Assumptions): string[] {
  const keys: string[] = [];
  next.years.forEach((y, i) => {
    for (const f of YEAR_FIELDS) {
      if (prev.years[i]?.[f] !== y[f]) keys.push(assumptionKey(f, i + 1));
    }
  });
  for (const f of GLOBAL_FIELDS) if (prev[f] !== next[f]) keys.push(assumptionKey(f));
  return keys;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1).replace(".", ",").replace("-", "−")} %`;
}
