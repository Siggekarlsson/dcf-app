import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  type Assumptions,
  type CompanyFundamentals,
  applyAssumptionUpdate,
  computeDcf,
  FIELD_BOUNDS,
  GLOBAL_FIELDS,
  YEAR_FIELDS,
} from "@/lib/dcf";
import type { AppliedChange } from "./types";

const ALL_FIELDS = [...YEAR_FIELDS, ...GLOBAL_FIELDS] as const;

/** Det enda verktyget AI:n har. Värden anges i procent för att minska risken för enhetsfel. */
export const updateAssumptionTool: Anthropic.Beta.BetaTool = {
  name: "update_assumption",
  description:
    "Ändrar ett antagande i DCF-modellen. Detta är det ENDA sättet att ändra modellen. " +
    "Anropa en gång per fält och år (flera anrop i samma svar är okej). " +
    "Verktyget räknar om modellen och returnerar nytt värde per aktie. " +
    "Fält per år: revenueGrowth (omsättningstillväxt), ebitMargin (EBIT-marginal), taxRate (skattesats), " +
    "daPct (D&A i % av omsättning), capexPct (CapEx i % av omsättning), nwcPct (ΔNWC i % av omsättningsförändringen). " +
    "Globala fält: wacc, terminalGrowth (terminal tillväxt) – för dessa ska year vara null.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      field: { type: "string", enum: [...ALL_FIELDS] },
      year: {
        type: ["integer", "null"],
        description: "Prognosår 1–5 (1 = första prognosåret). null = alla år, eller för wacc/terminalGrowth.",
      },
      value: {
        type: "number",
        description: "Nytt värde i PROCENT, t.ex. 8.5 för 8,5 %. Negativa värden är tillåtna där det är rimligt.",
      },
    },
    required: ["field", "year", "value"],
  },
  strict: true,
};

const inputSchema = z.object({
  field: z.enum(ALL_FIELDS),
  year: z.number().int().nullable(),
  value: z.number(),
});

export type ToolOutcome =
  | { ok: true; assumptions: Assumptions; change: AppliedChange; content: string }
  | { ok: false; content: string };

/** Validerar och utför ett verktygsanrop. All beräkning sker i DCF-modulen. */
export function executeUpdateAssumption(
  assumptions: Assumptions,
  fundamentals: CompanyFundamentals,
  rawInput: unknown,
): ToolOutcome {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, content: `Ogiltiga parametrar: ${parsed.error.issues.map((i) => i.message).join("; ")}` };
  }
  const { field, year, value } = parsed.data;
  const decimal = Math.round(value * 1e4) / 1e6; // procent → decimal, avrundat för att slippa flyttalsbrus
  const result = applyAssumptionUpdate(assumptions, { field, year, value: decimal });
  if (!result.ok) {
    const { min, max } = FIELD_BOUNDS[field];
    return { ok: false, content: `${result.error} (fält ${field}, tillåtet ${min * 100} till ${max * 100} procent)` };
  }
  const dcf = computeDcf(result.assumptions, fundamentals);
  return {
    ok: true,
    assumptions: result.assumptions,
    change: { field, year, value: decimal },
    content: JSON.stringify({
      ok: true,
      ändrat: { field, year, value_procent: decimal * 100 },
      nytt_värde_per_aktie_kr: round(dcf.valuePerShare, 1),
      uppsida_procent: round(dcf.upside * 100, 1),
    }),
  };
}

function round(x: number, d: number) {
  const p = 10 ** d;
  return Math.round(x * p) / p;
}

/** Beskriver aktuellt läge för systemprompten. Alla tal kommer från DCF-modulen. */
export function describeState(name: string, a: Assumptions, f: CompanyFundamentals): string {
  const dcf = computeDcf(a, f);
  const p = (x: number) => `${round(x * 100, 2)}`;
  const header = `| fält | ${dcf.rows.map((r) => `år ${r.index} (${r.year})`).join(" | ")} |`;
  const sep = `|---|${dcf.rows.map(() => "---").join("|")}|`;
  const lines = YEAR_FIELDS.map((field) => `| ${field} | ${a.years.map((y) => p(y[field])).join(" | ")} |`);
  return [
    `Bolag: ${name}. Basår ${f.baseYear}, omsättning basår ${Math.round(f.baseRevenue)} MSEK.`,
    "Antaganden per år, i procent:",
    header,
    sep,
    ...lines,
    `wacc: ${p(a.wacc)} %, terminalGrowth: ${p(a.terminalGrowth)} %`,
    `Nuvarande resultat: värde per aktie ${round(dcf.valuePerShare, 1)} kr, kurs ${f.price} kr, uppsida ${round(dcf.upside * 100, 1)} %.`,
  ].join("\n");
}
