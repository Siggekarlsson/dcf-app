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

// ---------------------------------------------------------------------------
// Session: Yahoo kräver ofta en cookie (från fc.yahoo.com) och en "crumb" för att inte svara 429/401.
// ---------------------------------------------------------------------------

interface Session {
  cookie: string;
  crumb: string;
  expires: number;
}

let session: Session | null = null;
let sessionPromise: Promise<Session | null> | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function createSession(): Promise<Session | null> {
  try {
    const res = await fetch("https://fc.yahoo.com/", {
      headers: { "user-agent": UA },
      redirect: "manual",
      cache: "no-store",
    });
    const cookie = res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");
    if (!cookie) return null;
    for (const host of ["query2", "query1"]) {
      const r = await fetch(`https://${host}.finance.yahoo.com/v1/test/getcrumb`, {
        headers: { "user-agent": UA, cookie },
        cache: "no-store",
      });
      const crumb = (await r.text()).trim();
      if (r.ok && crumb && !crumb.includes("<") && crumb.length < 64) {
        return { cookie, crumb, expires: Date.now() + 30 * 60_000 };
      }
    }
  } catch {
    /* utan session försöker vi ändå */
  }
  return null;
}

async function getSession(force = false): Promise<Session | null> {
  if (!force && session && session.expires > Date.now()) return session;
  sessionPromise ??= createSession().finally(() => {
    sessionPromise = null;
  });
  session = await sessionPromise;
  return session;
}

/** Diagnostik: returnerar status för varje steg utan att avslöja cookie eller crumb. */
export async function diagnose(symbol: string) {
  const steps: { step: string; status: number | string; ms: number; body?: string }[] = [];
  const time = async (step: string, fn: () => Promise<Response>) => {
    const t = Date.now();
    try {
      const r = await fn();
      const body = (await r.text()).slice(0, 140);
      steps.push({ step, status: r.status, ms: Date.now() - t, body: step === "crumb" ? `${body.length} tecken` : body });
      return r;
    } catch (e) {
      steps.push({ step, status: e instanceof Error ? e.message : "fel", ms: Date.now() - t });
      return null;
    }
  };
  await time("chart utan session", () =>
    fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`, {
      headers: { "user-agent": UA },
      cache: "no-store",
    }),
  );
  const s = await getSession(true);
  steps.push({ step: "session", status: s ? "ok" : "saknas", ms: 0 });
  if (s) {
    await time("chart med session", () =>
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d&crumb=${s.crumb}`, {
        headers: { "user-agent": UA, cookie: s.cookie },
        cache: "no-store",
      }),
    );
    await time("timeseries med session", () =>
      fetch(
        `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${symbol}?type=annualTotalRevenue&period1=1600000000&period2=${Math.floor(Date.now() / 1000)}&crumb=${s.crumb}`,
        { headers: { "user-agent": UA, cookie: s.cookie }, cache: "no-store" },
      ),
    );
  }
  return steps;
}

/**
 * Hämtar JSON med session (cookie + crumb) och upp till tre försök.
 * Vid 401/403/429 förnyas sessionen och värden växlas mellan query1 och query2.
 */
async function getJson(url: string): Promise<unknown> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const s = await getSession(attempt > 0 && lastStatus !== 0);
    const u = new URL(url);
    if (attempt % 2 === 1) u.hostname = u.hostname.startsWith("query1") ? "query2.finance.yahoo.com" : "query1.finance.yahoo.com";
    if (s) u.searchParams.set("crumb", s.crumb);

    let res: Response;
    try {
      res = await fetch(u, {
        headers: { "user-agent": UA, accept: "application/json", ...(s ? { cookie: s.cookie } : {}) },
        cache: "no-store",
      });
    } catch {
      lastStatus = 0;
      await sleep(300 * (attempt + 1));
      continue;
    }
    if (res.ok) {
      return res.json().catch(() => {
        throw new YahooError("Ogiltigt svar från Yahoo Finance", true);
      });
    }
    if (res.status === 404) throw new YahooError("Bolaget finns inte hos Yahoo Finance", false);
    lastStatus = res.status;
    if (![401, 403, 429].includes(res.status) && res.status < 500) break;
    await sleep(400 * (attempt + 1));
  }
  throw new YahooError(lastStatus ? `Yahoo Finance svarade ${lastStatus}` : "Kunde inte nå Yahoo Finance", true);
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
