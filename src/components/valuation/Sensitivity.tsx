import type { SensitivityTable } from "@/lib/dcf";
import { fmtPct, fmtSek } from "@/lib/format";

export function Sensitivity({ table, price }: { table: SensitivityTable; price: number }) {
  const mid = Math.floor(table.waccValues.length / 2);
  return (
    <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <table className="num w-full min-w-[440px] border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-ink">
            <th className="pb-3 pr-4 text-left text-[12px] font-normal text-muted">
              WACC ↓ &nbsp;g →
            </th>
            {table.growthValues.map((g, j) => (
              <th key={g} className={`pb-3 pl-3 text-right text-[12px] font-normal ${j === mid ? "text-ink" : "text-muted"}`}>
                {fmtPct(g)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.waccValues.map((w, i) => (
            <tr key={w} className="border-b border-line">
              <th scope="row" className={`py-3 pr-4 text-left text-[12px] font-normal ${i === mid ? "text-ink" : "text-muted"}`}>
                {fmtPct(w)}
              </th>
              {table.cells[i].map((v, j) => {
                const base = i === mid && j === mid;
                const above = v !== null && v >= price;
                return (
                  <td
                    key={j}
                    className={
                      "py-3 pl-3 text-right " +
                      (base ? "font-semibold text-accent" : above ? "text-ink" : "text-faint")
                    }
                  >
                    {v === null ? "–" : fmtSek(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-[12px] text-muted">Svarta värden ligger över aktuell kurs, grå under.</p>
    </div>
  );
}
