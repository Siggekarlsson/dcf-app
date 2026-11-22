import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import { Label } from "@/components/site/Label";
import { TopBar, Wordmark } from "@/components/site/TopBar";
import { companyData } from "@/lib/data";
import { fmtSek } from "@/lib/format";

const STEPS = [
  ["01", "Sök", "Alla aktier på Nasdaq Stockholm och First North. Sök på namn eller ticker."],
  ["02", "Se värdet", "En DCF-modell byggd på bolagets egna siffror ger ett motiverat värde per aktie."],
  ["03", "Ändra", "Tror du mer eller mindre på bolaget? Klicka i tabellen och skriv in dina egna antaganden."],
] as const;

export default async function Home() {
  const [count, popular] = await Promise.all([companyData.count(), companyData.popular(6)]);

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <TopBar />

      <main className="flex-1">
        <section className="grid grid-cols-1 gap-y-10 px-5 pt-16 pb-20 sm:grid-cols-12 sm:px-8 sm:pt-28 sm:pb-28">
          <div className="sm:col-span-3">
            <Label>Valeur</Label>
            <p className="mt-3 max-w-[15rem] text-[13px] leading-snug text-muted">
              {count} bolag. Ett motiverat värde för vart och ett.
            </p>
          </div>
          <div className="sm:col-span-9">
            <h1 className="animate-rise text-display font-medium">
              Vad är bolaget
              <br />
              <span className="text-faint">egentligen</span> värt?
            </h1>
            <div className="mt-14 max-w-3xl animate-rise [animation-delay:120ms] sm:mt-20">
              <SearchBox autoFocus placeholder="Sök bolag eller ticker" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 border-t border-line sm:grid-cols-3">
          {STEPS.map(([n, title, text], i) => (
            <div
              key={n}
              className={`px-5 py-8 sm:min-h-56 sm:px-8 sm:py-10 ${i > 0 ? "border-t border-line sm:border-t-0 sm:border-l" : ""}`}
            >
              <p className="num text-[13px] text-faint">{n}</p>
              <h2 className="mt-6 text-2xl font-medium tracking-[-0.03em]">{title}</h2>
              <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-y-6 border-t border-line px-5 py-12 sm:grid-cols-12 sm:px-8 sm:py-16">
          <div className="sm:col-span-3">
            <Label>Mest omsatta</Label>
          </div>
          <ul className="sm:col-span-9">
            {popular.map((c) => (
              <li key={c.ticker}>
                <Link
                  href={`/bolag/${encodeURIComponent(c.ticker)}`}
                  className="group grid grid-cols-[1fr_auto] items-baseline gap-4 border-b border-line py-4 transition-[padding] hover:pl-2 sm:grid-cols-[1fr_12rem_7rem_1.5rem]"
                >
                  <span className="text-xl tracking-[-0.025em] sm:text-2xl">{c.name}</span>
                  <span className="hidden text-[13px] text-muted sm:block">{c.sector}</span>
                  <span className="num text-right text-[13px] text-muted">{c.price ? `${fmtSek(c.price)} kr` : c.ticker}</span>
                  <span aria-hidden className="hidden text-right transition-transform group-hover:translate-x-1 sm:block">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="grid grid-cols-2 gap-y-2 px-5 py-5 text-[12px] text-muted sm:grid-cols-12 sm:px-8">
          <p className="sm:col-span-3">© Valeur</p>
          <p className="sm:col-span-5">Data: Nasdaq Nordic, Yahoo Finance</p>
          <p className="col-span-2 sm:col-span-4 sm:text-right">Inte investeringsråd.</p>
        </div>
        <p aria-hidden className="-mb-[0.2em] px-3 text-[37vw] leading-[0.9] tracking-[-0.07em] whitespace-nowrap text-ink select-none sm:px-5">
          <Wordmark className="font-medium" />
        </p>
      </footer>
    </div>
  );
}
