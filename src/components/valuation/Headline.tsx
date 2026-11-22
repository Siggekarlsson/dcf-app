import type { DcfResult } from "@/lib/dcf";
import { fmtSek, fmtSignedPct } from "@/lib/format";
import { Flash } from "./Flash";

/** Tre nyckeltal i ett band med hårfina linjer. */
export function Headline({ result }: { result: DcfResult }) {
  const up = result.upside >= 0;
  return (
    <section className="grid grid-cols-2 border-t border-line sm:grid-cols-12">
      <div className="col-span-2 px-5 pt-8 pb-10 sm:col-span-6 sm:px-8 sm:pt-10 sm:pb-14">
        <p className="text-[13px] text-muted">Motiverat värde per aktie</p>
        <p className="num mt-8 text-[clamp(4.5rem,13vw,10.5rem)] leading-[0.85] font-medium tracking-[-0.06em] whitespace-nowrap">
          <Flash flashKey="valuePerShare" className="inline-block">{fmtSek(result.valuePerShare)}</Flash>
          <span className="ml-3 text-[0.28em] font-normal tracking-[-0.02em] text-faint">kr</span>
        </p>
      </div>
      <div className="border-t border-line px-5 pt-8 pb-10 sm:col-span-3 sm:border-t-0 sm:border-l sm:px-8 sm:pt-10">
        <p className="text-[13px] text-muted">Aktuell kurs</p>
        <p className="num mt-6 text-[clamp(2.25rem,3.8vw,3.5rem)] leading-none font-medium tracking-[-0.05em] whitespace-nowrap">
          {fmtSek(result.price)}
          <span className="ml-2 text-[0.4em] font-normal tracking-normal text-faint">kr</span>
        </p>
      </div>
      <div className="border-t border-l border-line px-5 pt-8 pb-10 sm:col-span-3 sm:border-t-0 sm:px-8 sm:pt-10">
        <p className="text-[13px] text-muted">{up ? "Uppsida" : "Nedsida"}</p>
        <p
          className={`num mt-6 text-[clamp(2.25rem,3.8vw,3.5rem)] leading-none font-medium tracking-[-0.05em] whitespace-nowrap ${up ? "text-accent" : "text-ink"}`}
        >
          <Flash flashKey="upside">{fmtSignedPct(result.upside)}</Flash>
        </p>
      </div>
    </section>
  );
}
