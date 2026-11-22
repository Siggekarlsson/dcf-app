import Link from "next/link";
import { Clock } from "./Clock";

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-semibold tracking-[-0.04em] ${className}`}>valeur</span>;
}

/** Övre list: ordmärke, kort beskrivning och klocka. `right` ersätter klockan på smala skärmar. */
export function TopBar({ right, tagline = "Värdering av svenska börsbolag" }: { right?: React.ReactNode; tagline?: string }) {
  return (
    <header className="grid h-14 grid-cols-2 items-center border-b border-line px-5 text-[13px] sm:grid-cols-12 sm:px-8">
      <Link href="/" className="text-[19px] leading-none sm:col-span-3" aria-label="Valeur, till startsidan">
        <Wordmark />
      </Link>
      <p className="hidden text-muted sm:col-span-5 sm:block">{tagline}</p>
      <div className="flex items-center justify-end gap-6 sm:col-span-4">
        {right}
        <p className="hidden text-muted sm:block">
          Stockholm <Clock />
        </p>
      </div>
    </header>
  );
}
