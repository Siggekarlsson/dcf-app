import { describe, expect, it } from "vitest";
import {
  applyAssumptionUpdate,
  applyAssumptionUpdates,
  computeDcf,
  computeSensitivity,
  DcfError,
  diffAssumptions,
  diffResults,
  projectCashFlows,
  validateAssumptions,
} from "./calc";
import type { Assumptions, CompanyFundamentals, YearDrivers } from "./types";

const year: YearDrivers = {
  revenueGrowth: 0.1,
  ebitMargin: 0.2,
  taxRate: 0.2,
  daPct: 0.05,
  capexPct: 0.06,
  nwcPct: 0.1,
};

function makeAssumptions(overrides: Partial<Assumptions> = {}): Assumptions {
  return {
    years: Array.from({ length: 5 }, () => ({ ...year })),
    wacc: 0.1,
    terminalGrowth: 0.02,
    ...overrides,
  };
}

const fundamentals: CompanyFundamentals = {
  baseYear: 2025,
  baseRevenue: 1000,
  netDebt: 200,
  sharesOutstanding: 10,
  price: 100,
};

describe("projectCashFlows", () => {
  it("beräknar år 1 korrekt för hand", () => {
    const [r] = projectCashFlows(makeAssumptions(), fundamentals);
    // revenue = 1000 * 1.1
    expect(r.revenue).toBeCloseTo(1100);
    expect(r.ebit).toBeCloseTo(220);
    expect(r.tax).toBeCloseTo(44);
    expect(r.nopat).toBeCloseTo(176);
    expect(r.da).toBeCloseTo(55);
    expect(r.capex).toBeCloseTo(66);
    // ΔNWC = (1100 - 1000) * 0.1
    expect(r.deltaNwc).toBeCloseTo(10);
    // FCF = 176 + 55 - 66 - 10
    expect(r.fcf).toBeCloseTo(155);
    expect(r.discountFactor).toBeCloseTo(1 / 1.1);
    expect(r.pvFcf).toBeCloseTo(155 / 1.1);
    expect(r.year).toBe(2026);
    expect(r.index).toBe(1);
  });

  it("låter omsättningen växa kumulativt", () => {
    const rows = projectCashFlows(makeAssumptions(), fundamentals);
    expect(rows).toHaveLength(5);
    expect(rows[4].revenue).toBeCloseTo(1000 * 1.1 ** 5);
    expect(rows[4].year).toBe(2030);
    expect(rows[4].discountFactor).toBeCloseTo(1 / 1.1 ** 5);
  });

  it("tar ingen skatt på negativ EBIT", () => {
    const a = makeAssumptions();
    a.years[0] = { ...a.years[0], ebitMargin: -0.1 };
    const [r] = projectCashFlows(a, fundamentals);
    expect(r.ebit).toBeCloseTo(-110);
    expect(r.tax).toBe(0);
    expect(r.nopat).toBeCloseTo(-110);
  });

  it("ger negativ ΔNWC (frigjort kapital) när omsättningen krymper", () => {
    const a = makeAssumptions();
    a.years[0] = { ...a.years[0], revenueGrowth: -0.1 };
    const [r] = projectCashFlows(a, fundamentals);
    expect(r.deltaNwc).toBeCloseTo(-10);
  });
});

describe("computeDcf", () => {
  it("räknar ut EV, eget kapital och värde per aktie", () => {
    const a = makeAssumptions();
    const res = computeDcf(a, fundamentals);
    const rows = projectCashFlows(a, fundamentals);
    const sumPv = rows.reduce((s, r) => s + r.pvFcf, 0);
    const tv = (rows[4].fcf * 1.02) / (0.1 - 0.02);
    const pvTv = tv / 1.1 ** 5;

    expect(res.sumPvFcf).toBeCloseTo(sumPv);
    expect(res.terminalValue).toBeCloseTo(tv);
    expect(res.pvTerminalValue).toBeCloseTo(pvTv);
    expect(res.enterpriseValue).toBeCloseTo(sumPv + pvTv);
    expect(res.equityValue).toBeCloseTo(sumPv + pvTv - 200);
    expect(res.valuePerShare).toBeCloseTo((sumPv + pvTv - 200) / 10);
    expect(res.upside).toBeCloseTo(res.valuePerShare / 100 - 1);
  });

  it("matchar ett handräknat referensvärde", () => {
    // Noll tillväxt, inga investeringar utöver avskrivningar => FCF = NOPAT konstant.
    const flat: YearDrivers = {
      revenueGrowth: 0,
      ebitMargin: 0.1,
      taxRate: 0.25,
      daPct: 0.03,
      capexPct: 0.03,
      nwcPct: 0.2,
    };
    const a = makeAssumptions({ years: Array.from({ length: 5 }, () => ({ ...flat })), terminalGrowth: 0 });
    const res = computeDcf(a, { ...fundamentals, netDebt: 0 });
    // FCF = 1000 * 0.1 * 0.75 = 75 varje år. Evig ränta utan tillväxt => EV = 75 / 0.1 = 750.
    expect(res.enterpriseValue).toBeCloseTo(750, 6);
    expect(res.valuePerShare).toBeCloseTo(75, 6);
  });

  it("hanterar nettokassa (negativ nettoskuld)", () => {
    const a = makeAssumptions();
    const withDebt = computeDcf(a, fundamentals);
    const withCash = computeDcf(a, { ...fundamentals, netDebt: -200 });
    expect(withCash.equityValue - withDebt.equityValue).toBeCloseTo(400);
  });

  it("högre WACC ger lägre värde", () => {
    const low = computeDcf(makeAssumptions({ wacc: 0.08 }), fundamentals);
    const high = computeDcf(makeAssumptions({ wacc: 0.12 }), fundamentals);
    expect(high.valuePerShare).toBeLessThan(low.valuePerShare);
  });

  it("kastar om WACC ≤ terminal growth", () => {
    expect(() => computeDcf(makeAssumptions({ wacc: 0.02, terminalGrowth: 0.02 }), fundamentals)).toThrow(
      DcfError,
    );
  });

  it("kastar vid fel antal år", () => {
    const a = makeAssumptions();
    a.years.pop();
    expect(() => computeDcf(a, fundamentals)).toThrow(DcfError);
  });
});

describe("validateAssumptions", () => {
  it("godkänner rimliga antaganden", () => {
    expect(validateAssumptions(makeAssumptions())).toEqual([]);
  });

  it("flaggar värden utanför gränserna och NaN", () => {
    const a = makeAssumptions({ wacc: 0.5 });
    a.years[2] = { ...a.years[2], taxRate: Number.NaN };
    const errors = validateAssumptions(a);
    expect(errors.some((e) => e.includes("wacc"))).toBe(true);
    expect(errors.some((e) => e.includes("taxRate år 3"))).toBe(true);
  });
});

describe("computeSensitivity", () => {
  it("bygger ett 5×5-rutnät centrerat kring basfallet", () => {
    const a = makeAssumptions();
    const s = computeSensitivity(a, fundamentals);
    expect(s.waccValues).toEqual([0.09, 0.095, 0.1, 0.105, 0.11]);
    expect(s.growthValues).toEqual([0.01, 0.015, 0.02, 0.025, 0.03]);
    expect(s.cells).toHaveLength(5);
    expect(s.cells[2][2]).toBeCloseTo(computeDcf(a, fundamentals).valuePerShare);
  });

  it("är monoton: värdet sjunker med WACC och stiger med g", () => {
    const s = computeSensitivity(makeAssumptions(), fundamentals);
    for (let i = 1; i < 5; i++) {
      expect(s.cells[i][2]!).toBeLessThan(s.cells[i - 1][2]!);
      expect(s.cells[2][i]!).toBeGreaterThan(s.cells[2][i - 1]!);
    }
  });

  it("ger null där WACC ≤ g", () => {
    const s = computeSensitivity(makeAssumptions({ wacc: 0.04, terminalGrowth: 0.03 }), fundamentals, {
      waccStep: 0.01,
      growthStep: 0.01,
    });
    // wacc 0.02 vs g 0.05 osv.
    expect(s.cells[0][4]).toBeNull();
    expect(s.cells[4][0]).not.toBeNull();
  });
});

describe("applyAssumptionUpdate", () => {
  it("ändrar ett enskilt år utan att mutera originalet", () => {
    const a = makeAssumptions();
    const r = applyAssumptionUpdate(a, { field: "ebitMargin", year: 3, value: 0.25 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.assumptions.years[2].ebitMargin).toBe(0.25);
    expect(r.assumptions.years[1].ebitMargin).toBe(0.2);
    expect(a.years[2].ebitMargin).toBe(0.2);
    expect(r.changedKeys).toEqual(["ebitMargin:3"]);
  });

  it("ändrar alla år när år utelämnas", () => {
    const r = applyAssumptionUpdate(makeAssumptions(), { field: "revenueGrowth", value: 0.05 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.assumptions.years.every((y) => y.revenueGrowth === 0.05)).toBe(true);
    expect(r.changedKeys).toHaveLength(5);
  });

  it("behandlar year: null som alla år", () => {
    const r = applyAssumptionUpdate(makeAssumptions(), { field: "taxRate", year: null, value: 0.206 });
    expect(r.ok && r.changedKeys.length).toBe(5);
  });

  it("ändrar WACC", () => {
    const r = applyAssumptionUpdate(makeAssumptions(), { field: "wacc", value: 0.09 });
    expect(r.ok && r.assumptions.wacc).toBe(0.09);
    expect(r.ok && r.changedKeys).toEqual(["wacc"]);
  });

  it("rapporterar inga ändrade nycklar om värdet är oförändrat", () => {
    const r = applyAssumptionUpdate(makeAssumptions(), { field: "wacc", value: 0.1 });
    expect(r.ok && r.changedKeys).toEqual([]);
  });

  it("avvisar år för globala fält", () => {
    const r = applyAssumptionUpdate(makeAssumptions(), { field: "wacc", year: 2, value: 0.09 });
    expect(r.ok).toBe(false);
  });

  it("avvisar ogiltiga år", () => {
    for (const y of [0, 6, 2.5]) {
      expect(applyAssumptionUpdate(makeAssumptions(), { field: "daPct", year: y, value: 0.04 }).ok).toBe(false);
    }
  });

  it("avvisar värden utanför gränserna", () => {
    expect(applyAssumptionUpdate(makeAssumptions(), { field: "taxRate", value: 0.9 }).ok).toBe(false);
    expect(applyAssumptionUpdate(makeAssumptions(), { field: "wacc", value: Number.NaN }).ok).toBe(false);
  });

  it("avvisar okända fält", () => {
    // @ts-expect-error medvetet fel fält
    expect(applyAssumptionUpdate(makeAssumptions(), { field: "price", value: 1 }).ok).toBe(false);
  });

  it("avvisar terminal growth ≥ WACC", () => {
    const r = applyAssumptionUpdate(makeAssumptions(), { field: "terminalGrowth", value: 0.08 });
    expect(r.ok).toBe(true);
    const r2 = applyAssumptionUpdate(makeAssumptions({ wacc: 0.05 }), { field: "terminalGrowth", value: 0.06 });
    expect(r2.ok).toBe(false);
  });
});

describe("applyAssumptionUpdates", () => {
  it("applicerar i ordning och slår ihop ändrade nycklar", () => {
    const r = applyAssumptionUpdates(makeAssumptions(), [
      { field: "wacc", value: 0.09 },
      { field: "ebitMargin", year: 1, value: 0.22 },
      { field: "ebitMargin", year: 1, value: 0.23 },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.assumptions.years[0].ebitMargin).toBe(0.23);
    expect(r.changedKeys.sort()).toEqual(["ebitMargin:1", "wacc"]);
  });

  it("avbryter vid första fel", () => {
    const r = applyAssumptionUpdates(makeAssumptions(), [
      { field: "wacc", value: 0.09 },
      { field: "wacc", value: 5 },
    ]);
    expect(r.ok).toBe(false);
  });
});

describe("diff", () => {
  it("hittar bara de celler som påverkas av en ändring", () => {
    const a = makeAssumptions();
    const r = applyAssumptionUpdate(a, { field: "capexPct", year: 5, value: 0.08 });
    if (!r.ok) throw new Error(r.error);
    const keys = diffResults(computeDcf(a, fundamentals), computeDcf(r.assumptions, fundamentals));
    expect(keys).toContain("capex:5");
    expect(keys).toContain("fcf:5");
    expect(keys).toContain("valuePerShare");
    expect(keys).not.toContain("capex:4");
    expect(keys).not.toContain("revenue:5");
  });

  it("diffAssumptions listar ändrade antaganden", () => {
    const a = makeAssumptions();
    const b = makeAssumptions({ terminalGrowth: 0.025 });
    b.years[1] = { ...b.years[1], nwcPct: 0.2 };
    expect(diffAssumptions(a, b).sort()).toEqual(["nwcPct:2", "terminalGrowth"]);
  });
});
