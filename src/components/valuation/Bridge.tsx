import type { Assumptions, CompanyFundamentals, DcfResult } from "@/lib/dcf";
import { fmtMsek, fmtPct, fmtSek } from "@/lib/format";
import { Flash } from "./Flash";

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between py-2 ${strong ? "font-semibold text-neutral-900" : "text-neutral-600"}`}>
      <dt>{label}</dt>
      <dd className="num">{children}</dd>
    </div>
  );
}

export function Assumptions({ assumptions }: { assumptions: Assumptions }) {
  return (
    <dl className="grid grid-cols-2 gap-6">
      <div>
        <dt className="text-sm text-neutral-500">WACC</dt>
        <dd className="num mt-1 text-2xl font-medium">
          <Flash flashKey="wacc">{fmtPct(assumptions.wacc)}</Flash>
        </dd>
      </div>
      <div>
        <dt className="text-sm text-neutral-500">Terminal tillväxt</dt>
        <dd className="num mt-1 text-2xl font-medium">
          <Flash flashKey="terminalGrowth">{fmtPct(assumptions.terminalGrowth)}</Flash>
        </dd>
      </div>
    </dl>
  );
}

export function Bridge({ result, fundamentals }: { result: DcfResult; fundamentals: CompanyFundamentals }) {
  const tvShare = result.pvTerminalValue / result.enterpriseValue;
  return (
    <dl className="text-sm">
      <Row label="Summa nuvärde FCF">
        <Flash flashKey="sumPvFcf">{fmtMsek(result.sumPvFcf)}</Flash>
      </Row>
      <Row label={`Nuvärde terminalvärde (${fmtPct(tvShare, 0)} av EV)`}>
        <Flash flashKey="pvTerminalValue">{fmtMsek(result.pvTerminalValue)}</Flash>
      </Row>
      <Row label="Enterprise value" strong>
        <Flash flashKey="enterpriseValue">{fmtMsek(result.enterpriseValue)}</Flash>
      </Row>
      <Row label={fundamentals.netDebt >= 0 ? "Nettoskuld" : "Nettokassa"}>
        {fundamentals.netDebt >= 0 ? "−" : "+"}
        {fmtMsek(Math.abs(fundamentals.netDebt))}
      </Row>
      <Row label="Eget kapital" strong>
        <Flash flashKey="equityValue">{fmtMsek(result.equityValue)}</Flash>
      </Row>
      <Row label="Antal aktier, miljoner">{fmtMsek(fundamentals.sharesOutstanding)}</Row>
      <Row label="Värde per aktie, kr" strong>
        <Flash flashKey="valuePerShare">{fmtSek(result.valuePerShare)}</Flash>
      </Row>
    </dl>
  );
}
