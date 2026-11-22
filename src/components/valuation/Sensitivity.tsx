import type { SensitivityTable } from "@/lib/dcf";
import { fmtPct, fmtSek } from "@/lib/format";

export function Sensitivity({ table, price }: { table: SensitivityTable; price: number }) {
  const mid = Math.floor(table.waccValues.length / 2);
  return (
    <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <table className="num w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="py-2 pr-4 text-left text-xs font-normal text-neutral-400">
              WACC <span className="text-neutral-300">↓</span> g <span className="text-neutral-300">→</span>
            </th>
            {table.growthValues.map((g, j) => (
              <th key={g} className={`py-2 pl-3 text-right font-normal ${j === mid ? "text-neutral-900" : "text-neutral-400"}`}>
                {fmtPct(g)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.waccValues.map((w, i) => (
            <tr key={w} className="border-t border-neutral-100">
              <th scope="row" className={`py-2.5 pr-4 text-left font-normal ${i === mid ? "text-neutral-900" : "text-neutral-400"}`}>
                {fmtPct(w)}
              </th>
              {table.cells[i].map((v, j) => {
                const base = i === mid && j === mid;
                const above = v !== null && v >= price;
                return (
                  <td
                    key={j}
                    className={
                      "py-2.5 pl-3 text-right " +
                      (base ? "font-semibold text-accent" : above ? "text-neutral-900" : "text-neutral-400")
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
      <p className="mt-3 text-xs text-neutral-400">Mörkare värden ligger över aktuell kurs.</p>
    </div>
  );
}
