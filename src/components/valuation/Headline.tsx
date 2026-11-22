import type { DcfResult } from "@/lib/dcf";
import { fmtSek, fmtSignedPct } from "@/lib/format";
import { Flash } from "./Flash";

export function Headline({ result }: { result: DcfResult }) {
  const up = result.upside >= 0;
  return (
    <section className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
      <div className="col-span-2 sm:col-span-1">
        <p className="text-sm text-neutral-500">Motiverat värde per aktie</p>
        <p className="num mt-1 text-5xl font-semibold tracking-tight text-neutral-900">
          <Flash flashKey="valuePerShare">
            {fmtSek(result.valuePerShare)}
            <span className="ml-1.5 text-2xl font-normal text-neutral-400">kr</span>
          </Flash>
        </p>
      </div>
      <div>
        <p className="text-sm text-neutral-500">Aktuell kurs</p>
        <p className="num mt-1 text-2xl font-medium text-neutral-900 sm:mt-3">
          {fmtSek(result.price)}
          <span className="ml-1 text-base font-normal text-neutral-400">kr</span>
        </p>
      </div>
      <div>
        <p className="text-sm text-neutral-500">{up ? "Uppsida" : "Nedsida"}</p>
        <p className={`num mt-1 text-2xl font-medium sm:mt-3 ${up ? "text-accent" : "text-neutral-900"}`}>
          <Flash flashKey="upside">{fmtSignedPct(result.upside)}</Flash>
        </p>
      </div>
    </section>
  );
}
