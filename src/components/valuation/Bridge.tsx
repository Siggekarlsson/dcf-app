import type { AssumptionField, Assumptions, CompanyFundamentals, DcfResult } from "@/lib/dcf";
import { fmtMsek, fmtPct, fmtSek } from "@/lib/format";
import { EditableValue } from "./EditableValue";
import { Flash } from "./Flash";

export type EditHandler = (field: AssumptionField, year: number | null, value: number) => string | null;

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between border-b py-2.5 ${strong ? "border-ink font-medium text-ink" : "border-line text-muted"}`}
    >
      <dt>{label}</dt>
      <dd className="num">{children}</dd>
    </div>
  );
}

export function Assumptions({ assumptions, onEdit }: { assumptions: Assumptions; onEdit?: EditHandler }) {
  return (
    <dl className="grid grid-cols-2 gap-6">
      <div>
        <dt className="text-[13px] text-muted">WACC</dt>
        <dd className="num mt-4 text-[clamp(2.25rem,4vw,3.25rem)] leading-none font-medium tracking-[-0.05em]">
          <EditableValue
            value={assumptions.wacc}
            flashKey="wacc"
            label="WACC"
            onSubmit={onEdit && ((v) => onEdit("wacc", null, v))}
          />
        </dd>
      </div>
      <div>
        <dt className="text-[13px] text-muted">Terminal tillväxt</dt>
        <dd className="num mt-4 text-[clamp(2.25rem,4vw,3.25rem)] leading-none font-medium tracking-[-0.05em]">
          <EditableValue
            value={assumptions.terminalGrowth}
            flashKey="terminalGrowth"
            label="Terminal tillväxt"
            onSubmit={onEdit && ((v) => onEdit("terminalGrowth", null, v))}
          />
        </dd>
      </div>
    </dl>
  );
}

export function Bridge({ result, fundamentals }: { result: DcfResult; fundamentals: CompanyFundamentals }) {
  const tvShare = result.pvTerminalValue / result.enterpriseValue;
  return (
    <dl className="text-[14px]">
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
