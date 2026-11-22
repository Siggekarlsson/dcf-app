import { describe, expect, it } from "vitest";
import { fromEntry, toEntry } from "./snapshot";
import { createSnapshotProvider } from "./snapshot-provider";
import type { Series } from "./yahoo";

describe("snapshot", () => {
  const series: Series = {
    annualTotalRevenue: [
      { date: "2019-12-31", value: 1, currency: "EUR" },
      { date: "2020-12-31", value: 2, currency: "EUR" },
      { date: "2021-12-31", value: 3, currency: "EUR" },
      { date: "2022-12-31", value: 4, currency: "EUR" },
      { date: "2023-12-31", value: 5, currency: "EUR" },
      { date: "2024-12-31", value: 6, currency: "EUR" },
    ],
    annualEBIT: [{ date: "2024-12-31", value: 1, currency: "EUR" }],
  };

  it("sparar rapportvaluta och högst fem år, och läser tillbaka samma data", () => {
    const e = toEntry(series)!;
    expect(e.c).toBe("EUR");
    expect(e.s.annualTotalRevenue).toHaveLength(5);
    const back = fromEntry(e);
    expect(back.annualTotalRevenue?.[0]).toEqual({ date: "2020-12-31", value: 2, currency: "EUR" });
    expect(back.annualEBIT).toEqual(series.annualEBIT);
  });

  it("returnerar null för tom data", () => {
    expect(toEntry({})).toBeNull();
  });
});


describe("snapshot-provider", () => {
  const entry = {
    c: "EUR",
    s: {
      annualTotalRevenue: [
        ["2023-12-31", 100e6],
        ["2024-12-31", 110e6],
      ] as [string, number][],
      annualEBIT: [["2024-12-31", 11e6]] as [string, number][],
      annualOrdinarySharesNumber: [["2024-12-31", 10e6]] as [string, number][],
    },
  };

  it("bygger ett bolag och räknar om rapportvaluta till SEK", async () => {
    const p = createSnapshotProvider({ fetchedAt: "2026-11-22", fx: { SEK: 1, EUR: 11 }, companies: { AAK: entry } });
    const r = await p.getCompany("aak");
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.company.name).toBe("AAK");
    expect(r.company.source).toBe("yahoo");
    expect(r.company.fundamentals.baseRevenue).toBeCloseTo(1210);
    expect(r.company.reportingCurrency).toBe("EUR");
  });

  it("använder exempeldata eller förklarar när data saknas", async () => {
    const empty = createSnapshotProvider({ fetchedAt: null, fx: { SEK: 1 }, companies: {} });
    const volvo = await empty.getCompany("VOLV-B");
    expect(volvo.status === "ok" && volvo.company.source).toBe("exempel");
    const aak = await empty.getCompany("AAK");
    expect(aak.status === "unavailable" && aak.temporary).toBe(true);
    expect((await empty.getCompany("FINNSINTE")).status).toBe("not_found");
  });

  it("markerar bolag utan EBIT som ej värderingsbara", async () => {
    const bank = { c: "SEK", s: { annualTotalRevenue: entry.s.annualTotalRevenue, annualOrdinarySharesNumber: entry.s.annualOrdinarySharesNumber } };
    const p = createSnapshotProvider({ fetchedAt: "2026-11-22", fx: { SEK: 1 }, companies: { AAK: bank } });
    const r = await p.getCompany("AAK");
    expect(r.status === "unavailable" && r.temporary).toBe(false);
  });
});
