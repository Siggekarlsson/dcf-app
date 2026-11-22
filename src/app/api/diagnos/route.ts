import { getListing } from "@/lib/data/listings";
import { diagnose } from "@/lib/data/yahoo";

/** Visar hur Yahoo Finance svarar från servern. Avslöjar inga hemligheter. */
export async function GET(request: Request) {
  const ticker = new URL(request.url).searchParams.get("ticker") ?? "VOLV-B";
  const listing = getListing(ticker);
  if (!listing) return Response.json({ error: "Okänd ticker" }, { status: 400 });
  return Response.json({ symbol: listing.yahoo, steps: await diagnose(listing.yahoo) });
}
