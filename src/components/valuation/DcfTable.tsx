import type { Assumptions, CompanyFundamentals, DcfResult, ProjectionRow, YearField } from "@/lib/dcf";
import { fmtMsek } from "@/lib/format";
import { FIELD_LABELS } from "@/lib/labels";
import type { EditHandler } from "./Bridge";
import { EditableValue } from "./EditableValue";
import { Flash } from "./Flash";

type Line =
  | { kind: "value"; label: string; metric: keyof ProjectionRow & string; sign?: -1 | 1; strong?: boolean; base?: number }
  | { kind: "driver"; label: string; field: YearField }
  | { kind: "factor"; label: string };

export function DcfTable({
  result,
  assumptions,
  fundamentals,
  onEdit,
}: {
  result: DcfResult;
  assumptions: Assumptions;
  fundamentals: CompanyFundamentals;
  onEdit?: EditHandler;
}) {
  const lines: Line[] = [
    { kind: "value", label: "Omsättning", metric: "revenue", base: fundamentals.baseRevenue },
    { kind: "driver", label: "Tillväxt", field: "revenueGrowth" },
    { kind: "value", label: "EBIT", metric: "ebit" },
    { kind: "driver", label: "EBIT-marginal", field: "ebitMargin" },
    { kind: "value", label: "Skatt", metric: "tax", sign: -1 },
    { kind: "driver", label: "Skattesats", field: "taxRate" },
    { kind: "value", label: "D&A", metric: "da" },
    { kind: "driver", label: "% av omsättning", field: "daPct" },
    { kind: "value", label: "CapEx", metric: "capex", sign: -1 },
    { kind: "driver", label: "% av omsättning", field: "capexPct" },
    { kind: "value", label: "ΔNWC", metric: "deltaNwc", sign: -1 },
    { kind: "driver", label: "% av Δomsättning", field: "nwcPct" },
    { kind: "value", label: "Fritt kassaflöde", metric: "fcf", strong: true },
    { kind: "factor", label: "Diskonteringsfaktor" },
    { kind: "value", label: "Nuvärde FCF", metric: "pvFcf" },
  ];

  return (
    <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <table className="num w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="text-neutral-400">
            <th className="sticky left-0 bg-white py-2 pr-4 text-left font-normal">MSEK</th>
            <th className="py-2 pl-3 text-right font-normal">{fundamentals.baseYear}A</th>
            {result.rows.map((r) => (
              <th key={r.index} className="py-2 pl-3 text-right font-normal">
                {r.year}E
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, li) => {
            const isDriver = line.kind === "driver" || line.kind === "factor";
            const strong = line.kind === "value" && line.strong;
            return (
              <tr
                key={li}
                className={
                  (isDriver ? "text-xs text-neutral-400" : "text-neutral-900") +
                  (strong ? " border-t border-neutral-200 font-semibold" : "") +
                  (line.kind === "value" && li > 0 && !strong ? " border-t border-neutral-100" : "")
                }
              >
                <th
                  scope="row"
                  className={
                    "sticky left-0 bg-white pr-4 text-left font-normal whitespace-nowrap " +
                    (isDriver ? "pb-2.5 pl-3" : "pt-2.5 pb-0.5") +
                    (strong ? " font-semibold" : "")
                  }
                >
                  {line.label}
                </th>
                <td className={`pl-3 text-right ${isDriver ? "pb-2.5" : "pt-2.5 pb-0.5"} text-neutral-400`}>
                  {line.kind === "value" && line.base !== undefined ? fmtMsek(line.base) : ""}
                </td>
                {result.rows.map((r) => (
                  <td key={r.index} className={`pl-3 text-right whitespace-nowrap ${isDriver ? "pb-2.5" : "pt-2.5 pb-0.5"}`}>
                    {line.kind === "value" && (
                      <Flash flashKey={`${line.metric}:${r.index}`}>
                        {fmtMsek((line.sign ?? 1) * (r[line.metric] as number))}
                      </Flash>
                    )}
                    {line.kind === "driver" && (
                      <EditableValue
                        value={assumptions.years[r.index - 1][line.field]}
                        flashKey={`${line.field}:${r.index}`}
                        label={`${FIELD_LABELS[line.field]} ${r.year}`}
                        onSubmit={onEdit && ((v) => onEdit(line.field, r.index, v))}
                      />
                    )}
                    {line.kind === "factor" && r.discountFactor.toFixed(3).replace(".", ",")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
