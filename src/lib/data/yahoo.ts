/**
 * Hämtning och tolkning av Yahoo Finance-data.
 * Inofficiellt API: alla svar valideras och allt som saknas hanteras explicit.
 * Tolkningsfunktionerna är rena och testas med fixtures; nätverksdelen är tunn.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

export const TIMESERIES_TYPES = [
  "annualTotalRevenue",
  "annualEBIT",
  "annualOperatingIncome",
  "annualReconciledDepreciation",
  "annualCapitalExpenditure",
  "annualTotalDebt",
  "annualCashCashEquivalentsAndShortTermInvestments",
  "annualCashAndCashEquivalents",
  "annualOrdinarySharesNumber",
  "annualShareIssued",
  "annualTaxRateForCalcs",
] as const;

export type SeriesType = (typeof TIMESERIES_TYPES)[number];

export interface Point {
  /** ISO-datum för periodens slut, t.ex. "2024-12-31". */
  date: string;
  value: number;
  currency: string | null;
}

export type Series = Partial<Record<SeriesType, Point[]>>;

export class YahooError extends Error {
  constructor(
    message: string,
    /** true = försök igen senare (nätverk, 429, 5xx). */
    readonly transient: boolean,
  ) {
    super(message);
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/** Tolkar svaret från /ws/fundamentals-timeseries. Sorterar varje serie äldst först. */
export function parseTimeseries(json: unknown): Series {
  const results = isRecord(json) && isRecord(json.timeseries) ? json.timeseries.result : null;
  if (!Array.isArray(results)) throw new YahooError("Oväntat format på finansiell data", false);

  const out: Series = {};
  for (const r of results) {
    if (!isRecord(r) || !isRecord(r.meta) || !Array.isArray(r.meta.type)) continue;
    const type = r.meta.type[0] as SeriesType;
    if (!TIMESERIES_TYPES.includes(type)) continue;
    const raw = r[type];
    if (!Array.isArray(raw)) continue;
    const points: Point[] = [];
    for (const p of raw) {
      if (!isRecord(p) || typeof p.asOfDate !== "string" || !isRecord(p.reportedValue)) continue;
      const value = p.reportedValue.raw;
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      points.push({ date: p.asOfDate, value, currency: typeof p.currencyCode === "string" ? p.currencyCode : null });
    }
    if (points.length) out[type] = points.sort((a, b) => a.date.localeCompare(b.date));
  }
  return out;
}

export interface Quote {
  price: number;
  currency: string;
}

/** Tolkar svaret från /v8/finance/chart. */
export function parseChart(json: unknown): Quote {
  const result = isRecord(json) && isRecord(json.chart) && Array.isArray(json.chart.result) ? json.chart.result[0] : null;
  const meta = isRecord(result) && isRecord(result.meta) ? result.meta : null;
  const price = meta?.regularMarketPrice;
  if (typeof price !== "number" || !(price > 0)) throw new YahooError("Kurs saknas", false);
  return { price, currency: typeof meta?.currency === "string" ? meta.currency : "SEK" };
}

async function getJson(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, cache: "no-store" });
  } catch {
    throw new YahooError("Kunde inte nå Yahoo Finance", true);
  }
  if (res.status === 404) throw new YahooError("Bolaget finns inte hos Yahoo Finance", false);
  if (!res.ok) throw new YahooError(`Yahoo Finance svarade ${res.status}`, res.status === 429 || res.status >= 500);
  return res.json().catch(() => {
    throw new YahooError("Ogiltigt svar från Yahoo Finance", true);
  });
}

export async function fetchQuote(symbol: string): Promise<Quote> {
  return parseChart(
    await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`),
  );
}

export async function fetchSeries(symbol: string): Promise<Series> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 6 * 365 * 24 * 3600;
  const url =
    `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}` +
    `?type=${TIMESERIES_TYPES.join(",")}&period1=${from}&period2=${now}`;
  return parseTimeseries(await getJson(url));
}

/** Växelkurs from → to, t.ex. EUR → SEK. */
export async function fetchFxRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  return (await fetchQuote(`${from}${to}=X`)).price;
}
