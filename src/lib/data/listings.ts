import raw from "@/data/listings.json";
import { rank } from "./search";
import type { CompanySummary } from "./types";

export interface Listing {
  ticker: string;
  symbol: string;
  yahoo: string;
  name: string;
  isin: string | null;
  market: string;
  sector: string;
  currency: string;
  price: number | null;
  turnover: number | null;
}

/** Alla aktier på Nasdaq Stockholm och First North. Uppdateras med `npm run listings`. */
export const listings: Listing[] = raw.companies as Listing[];
export const listingsFetchedAt: string = raw.fetchedAt;

const byTicker = new Map(listings.map((l) => [l.ticker, l]));

export function getListing(ticker: string): Listing | null {
  return byTicker.get(ticker.toUpperCase()) ?? null;
}

export function toSummary(l: Listing): CompanySummary {
  return { ticker: l.ticker, name: l.name, exchange: l.market, sector: l.sector, price: l.price };
}

export function searchListings(query: string, limit = 8): CompanySummary[] {
  return rank(listings, query, limit).map(toSummary);
}

export function popularListings(limit = 6): CompanySummary[] {
  return [...listings]
    .filter((l) => l.market === "Nasdaq Stockholm")
    .sort((a, b) => (b.turnover ?? 0) - (a.turnover ?? 0))
    .slice(0, limit)
    .map(toSummary);
}
