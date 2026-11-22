import type { AssumptionField } from "@/lib/dcf";

export const FIELD_LABELS: Record<AssumptionField, string> = {
  revenueGrowth: "Omsättningstillväxt",
  ebitMargin: "EBIT-marginal",
  taxRate: "Skattesats",
  daPct: "D&A, % av omsättning",
  capexPct: "CapEx, % av omsättning",
  nwcPct: "ΔNWC, % av Δomsättning",
  wacc: "WACC",
  terminalGrowth: "Terminal tillväxt",
};
