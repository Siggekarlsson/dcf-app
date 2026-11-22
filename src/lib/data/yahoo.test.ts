import { describe, expect, it } from "vitest";
import { computeDcf } from "@/lib/dcf";
import { buildFromSeries, DEFAULTS, NotValuableError } from "./baseline";
import { parseChart, parseTimeseries, type Point, type Series, YahooError } from "./yahoo";

function ts(type: string, values: [string, number][], currency = "SEK") {
  return {
    meta: { symbol: ["TEST.ST"], type: [type] },
    timestamp: values.map(() => 0),
    [type]: values.map(([asOfDate, raw]) => ({
      asOfDate,
      periodType: "12M",
      currencyCode: currency,
      reportedValue: { raw, fmt: String(raw) },
    })),
  };
}

const pts = (values: [string, number][], currency = "SEK"): Point[] =>
  values.map(([date, value]) => ({ date, value, currency }));

describe("parseTimeseries", () => {
  it("läser serier, sorterar äldst först och hoppar över trasiga punkter", () => {
    const json = {
      timeseries: {
        result: [
          ts("annualTotalRevenue", [
            ["2024-12-31", 300],
            ["2022-12-31", 100],
            ["2023-12-31", 200],
          ]),
          { meta: { type: ["annualEBIT"] }, annualEBIT: [null, { asOfDate: "2024-12-31", reportedValue: { raw: 30 } }] },
          { meta: { type: ["annualTotalDebt"] } },
          ts("unknownType", [["2024-12-31", 1]]),
        ],
      },
    };
    const s = parseTimeseries(json);
    expect(s.annualTotalRevenue?.map((p) => p.value)).toEqual([100, 200, 300]);
    expect(s.annualEBIT).toEqual([{ date: "2024-12-31", value: 30, currency: null }]);
    expect(s.annualTotalDebt).toBeUndefined();
    expect(Object.keys(s)).toHaveLength(2);
  });

  it("kastar vid helt fel format", () => {
    expect(() => parseTimeseries({ foo: 1 })).toThrow(YahooError);
    expect(() => parseTimeseries(null)).toThrow(YahooError);
  });
});

describe("parseChart", () => {
  it("läser kurs och valuta", () => {
    expect(parseChart({ chart: { result: [{ meta: { regularMarketPrice: 123.4, currency: "SEK" } }] } })).toEqual({
      price: 123.4,
      currency: "SEK",
    });
  });
  it("kastar när kurs saknas", () => {
    expect(() => parseChart({ chart: { result: [] } })).toThrow(YahooError);
    expect(() => parseChart({ chart: { result: [{ meta: { regularMarketPrice: 0 } }] } })).toThrow(YahooError);
  });
});

const industrial: Series = {
  annualTotalRevenue: pts([
    ["2021-12-31", 1000e6],
    ["2022-12-31", 1100e6],
    ["2023-12-31", 1210e6],
    ["2024-12-31", 1331e6],
  ]),
  annualEBIT: pts([
    ["2022-12-31", 110e6],
    ["2023-12-31", 121e6],
    ["2024-12-31", 133.1e6],
  ]),
  annualReconciledDepreciation: pts([["2024-12-31", 53.24e6]]),
  annualCapitalExpenditure: pts([["2024-12-31", -66.55e6]]),
  annualTotalDebt: pts([["2024-12-31", 300e6]]),
  annualCashCashEquivalentsAndShortTermInvestments: pts([["2024-12-31", 100e6]]),
  annualOrdinarySharesNumber: pts([["2024-12-31", 50e6]]),
  annualTaxRateForCalcs: pts([["2024-12-31", 0.21]]),
};

describe("buildFromSeries", () => {
  it("bygger nyckeltal i MSEK och ett giltigt grundscenario", () => {
    const r = buildFromSeries({ series: industrial, price: 40, fxToSek: 1, market: "Nasdaq Stockholm" });
    expect(r.fundamentals).toEqual({
      baseYear: 2024,
      baseRevenue: 1331,
      netDebt: 200,
      sharesOutstanding: 50,
      price: 40,
    });
    expect(r.asOf).toBe("2024-12-31");
    const y = r.assumptions.years;
    // CAGR 10 % som klingar av linjärt mot 2 %
    expect(y[0].revenueGrowth).toBeCloseTo(0.1, 4);
    expect(y[4].revenueGrowth).toBeCloseTo(0.02, 4);
    expect(y[2].revenueGrowth).toBeCloseTo(0.06, 4);
    expect(y[0].ebitMargin).toBeCloseTo(0.1, 4);
    expect(y[0].daPct).toBeCloseTo(0.04, 4);
    expect(y[0].capexPct).toBeCloseTo(0.05, 4);
    expect(y[0].taxRate).toBe(0.21);
    expect(r.assumptions.wacc).toBe(DEFAULTS.waccMain);
    expect(Number.isFinite(computeDcf(r.assumptions, r.fundamentals).valuePerShare)).toBe(true);
  });

  it("räknar om rapportvaluta till SEK", () => {
    const r = buildFromSeries({ series: industrial, price: 40, fxToSek: 11, market: "Nasdaq Stockholm" });
    expect(r.fundamentals.baseRevenue).toBeCloseTo(1331 * 11);
    expect(r.fundamentals.netDebt).toBeCloseTo(2200);
  });

  it("använder högre WACC för First North", () => {
    const r = buildFromSeries({ series: industrial, price: 40, fxToSek: 1, market: "First North" });
    expect(r.assumptions.wacc).toBe(DEFAULTS.waccSmall);
  });

  it("begränsar extrem tillväxt och använder standardvärden när poster saknas", () => {
    const r = buildFromSeries({
      series: {
        annualTotalRevenue: pts([
          ["2023-12-31", 10e6],
          ["2024-12-31", 100e6],
        ]),
        annualOperatingIncome: pts([["2024-12-31", -5e6]]),
        annualShareIssued: pts([["2024-12-31", 1e6]]),
      },
      price: 10,
      fxToSek: 1,
      market: "First North",
    });
    expect(r.assumptions.years[0].revenueGrowth).toBe(0.15);
    expect(r.assumptions.years[0].ebitMargin).toBeCloseTo(-0.05);
    expect(r.assumptions.years[0].taxRate).toBe(DEFAULTS.taxRate);
    expect(r.assumptions.years[0].daPct).toBe(DEFAULTS.daPct);
    expect(r.assumptions.years[0].capexPct).toBe(DEFAULTS.daPct);
    expect(r.fundamentals.netDebt).toBe(0);
  });

  it("avvisar bolag utan EBIT, omsättning eller aktier", () => {
    const base = { price: 10, fxToSek: 1, market: "Nasdaq Stockholm" };
    expect(() => buildFromSeries({ ...base, series: { ...industrial, annualEBIT: undefined } })).toThrow(NotValuableError);
    expect(() => buildFromSeries({ ...base, series: { ...industrial, annualTotalRevenue: [] } })).toThrow(NotValuableError);
    expect(() => buildFromSeries({ ...base, series: { ...industrial, annualOrdinarySharesNumber: undefined } })).toThrow(
      NotValuableError,
    );
    expect(() => buildFromSeries({ ...base, price: 0, series: industrial })).toThrow(NotValuableError);
  });
});
