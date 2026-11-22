import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Label } from "@/components/site/Label";
import { TopBar } from "@/components/site/TopBar";
import { ValuationView } from "@/components/valuation/ValuationView";
import { companyData } from "@/lib/data";
import { getListing } from "@/lib/data/listings";
import { fmtSek } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/bolag/[ticker]">): Promise<Metadata> {
  const { ticker } = await props.params;
  const listing = getListing(decodeURIComponent(ticker));
  return { title: listing ? listing.name : "Bolaget hittades inte" };
}

export default function CompanyPage(props: PageProps<"/bolag/[ticker]">) {
  return (
    <Suspense fallback={<Loading />}>
      <CompanyContent params={props.params} />
    </Suspense>
  );
}

async function CompanyContent({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const lookup = await companyData.getCompany(decodeURIComponent(ticker));
  if (lookup.status === "not_found") notFound();

  if (lookup.status === "unavailable") {
    const s = lookup.summary;
    return (
      <div className="min-h-dvh">
        <TopBar />
        <main className="grid grid-cols-1 gap-y-10 px-5 pt-14 pb-24 sm:grid-cols-12 sm:px-8 sm:pt-24">
          <div className="sm:col-span-3">
            <Label>
              {s.exchange}
              {s.sector ? ` · ${s.sector}` : ""}
            </Label>
          </div>
          <div className="sm:col-span-9">
            <h1 className="text-display font-medium">{s.name}</h1>
            {s.price ? (
              <p className="num mt-8 text-2xl tracking-[-0.03em]">
                {fmtSek(s.price)} <span className="text-faint">kr</span>
              </p>
            ) : null}
            <p className="mt-12 max-w-lg text-lg leading-relaxed text-muted">
              {lookup.temporary ? "" : "Det här bolaget går inte att värdera med Valeurs kassaflödesmodell. "}
              {lookup.reason}
            </p>
            <Link href="/" className="mt-10 inline-block border-b border-ink pb-1 text-[15px]">
              Sök ett annat bolag →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const chatEnabled = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  return <ValuationView key={lookup.company.ticker} company={lookup.company} chatEnabled={chatEnabled} />;
}

function Loading() {
  return (
    <div className="min-h-dvh">
      <TopBar />
      <main className="grid grid-cols-1 gap-y-10 px-5 pt-14 sm:grid-cols-12 sm:px-8 sm:pt-24" aria-busy>
        <div className="sm:col-span-3">
          <p className="text-[13px] text-muted">Hämtar bolagets siffror…</p>
        </div>
        <div className="space-y-6 sm:col-span-9">
          <div className="h-[0.9em] w-2/3 animate-pulse rounded bg-line text-display" />
          <div className="h-[0.9em] w-1/3 animate-pulse rounded bg-line text-display" />
        </div>
      </main>
    </div>
  );
}
