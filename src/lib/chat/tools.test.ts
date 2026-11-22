import { describe, expect, it } from "vitest";
import { computeDcf } from "@/lib/dcf";
import { companyData } from "@/lib/data";
import { describeState, executeUpdateAssumption } from "./tools";

async function volvo() {
  return (await companyData.getCompany("VOLV-B"))!;
}

describe("executeUpdateAssumption", () => {
  it("konverterar procent till decimal och räknar om via DCF-modulen", async () => {
    const c = await volvo();
    const r = executeUpdateAssumption(c.assumptions, c.fundamentals, { field: "wacc", year: null, value: 8.5 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.assumptions.wacc).toBe(0.085);
    expect(r.change).toEqual({ field: "wacc", year: null, value: 0.085 });
    const payload = JSON.parse(r.content);
    const expected = computeDcf(r.assumptions, c.fundamentals).valuePerShare;
    expect(payload.nytt_värde_per_aktie_kr).toBeCloseTo(expected, 1);
  });

  it("ändrar ett enskilt år", async () => {
    const c = await volvo();
    const r = executeUpdateAssumption(c.assumptions, c.fundamentals, { field: "ebitMargin", year: 3, value: 14 });
    expect(r.ok && r.assumptions.years[2].ebitMargin).toBe(0.14);
    expect(r.ok && r.assumptions.years[1].ebitMargin).toBe(c.assumptions.years[1].ebitMargin);
  });

  it("returnerar fel för okända fält, fel typer och orimliga värden", async () => {
    const c = await volvo();
    const bad = [
      { field: "price", year: null, value: 10 },
      { field: "wacc", year: null, value: "8" },
      { field: "wacc", year: null, value: 80 },
      { field: "wacc", year: 2, value: 8 },
      { field: "ebitMargin", year: 7, value: 10 },
      { field: "terminalGrowth", year: null, value: 9.5 },
      null,
    ];
    for (const input of bad) {
      expect(executeUpdateAssumption(c.assumptions, c.fundamentals, input).ok).toBe(false);
    }
  });

  it("muterar inte indata", async () => {
    const c = await volvo();
    const before = JSON.stringify(c.assumptions);
    executeUpdateAssumption(c.assumptions, c.fundamentals, { field: "taxRate", year: null, value: 30 });
    expect(JSON.stringify(c.assumptions)).toBe(before);
  });
});

describe("describeState", () => {
  it("innehåller alla fält och aktuellt värde per aktie", async () => {
    const c = await volvo();
    const s = describeState(c.name, c.assumptions, c.fundamentals);
    for (const f of ["revenueGrowth", "ebitMargin", "taxRate", "daPct", "capexPct", "nwcPct", "wacc", "terminalGrowth"]) {
      expect(s).toContain(f);
    }
    expect(s).toContain("värde per aktie");
  });
});
