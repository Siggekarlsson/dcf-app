const msek = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
const sek = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const sek1 = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 12345.6 → "12 346" */
export function fmtMsek(x: number): string {
  return msek.format(Math.round(x)).replace("-", "−");
}

/** Kurs/värde per aktie. Under 100 kr visas en decimal. */
export function fmtSek(x: number): string {
  return (Math.abs(x) < 100 ? sek1 : sek).format(x).replace("-", "−");
}

/** 0.0823 → "8,2 %" */
export function fmtPct(x: number, digits = 1): string {
  return `${new Intl.NumberFormat("sv-SE", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .format(x * 100)
    .replace("-", "−")} %`;
}

/** 0.12 → "+12,0 %" */
export function fmtSignedPct(x: number, digits = 1): string {
  return `${x > 0 ? "+" : ""}${fmtPct(x, digits)}`;
}

/** Tolkar användarinmatning i procent ("8,5", "8.5 %", "−2") → decimal (0.085). null om ogiltig. */
export function parsePercentInput(s: string): number | null {
  const cleaned = s.replace(/[−–]/g, "-").replace(",", ".").replace(/[%\s ]/g, "");
  if (!/^-?\d+(\.\d+)?$|^-?\.\d+$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 1e4) / 1e6;
}
