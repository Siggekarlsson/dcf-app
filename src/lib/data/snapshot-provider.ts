import raw from "@/data/fundamentals.json";
import { buildFromSeries, NotValuableError } from "./baseline";
import { getExampleCompany } from "./json-provider";
import { getListing, type Listing, listings, popularListings, searchListings, toSummary } from "./listings";
import { fromEntry, type Snapshot } from "./snapshot";
import type { Company, CompanyDataProvider, CompanyLookup } from "./types";

/**
 * Läser finansiell data från en ögonblicksbild som uppdateras dagligen av GitHub Actions
 * (scripts/fetch-fundamentals.ts). Inga externa anrop vid sidvisning.
 */
export function createSnapshotProvider(snapshot: Snapshot = raw as Snapshot): CompanyDataProvider {
  function toCompany(l: Listing, b: ReturnType<typeof buildFromSeries>): Company {
    return {
      ticker: l.ticker,
      name: l.name,
      aliases: [],
      exchange: l.market,
      currency: "SEK",
      sector: l.sector,
      description: "",
      fundamentals: b.fundamentals,
      assumptions: b.assumptions,
      source: "yahoo",
      asOf: b.asOf,
      reportingCurrency: b.reportingCurrency,
    };
  }

  return {
    async search(query, limit = 8) {
      return searchListings(query, limit);
    },
    async getCompany(ticker): Promise<CompanyLookup> {
      const listing = getListing(ticker);
      if (!listing) return { status: "not_found" };
      const entry = snapshot.companies[listing.ticker];

      if (!entry) {
        const example = getExampleCompany(listing.ticker);
        if (example) return { status: "ok", company: example };
        return {
          status: "unavailable",
          summary: toSummary(listing),
          reason: snapshot.fetchedAt
            ? "Det finns ingen finansiell data för bolaget hos vår datakälla."
            : "Finansiell data har inte hämtats ännu. Försök igen senare i dag.",
          temporary: !snapshot.fetchedAt,
        };
      }

      const fxToSek = snapshot.fx[entry.c];
      const priceFx = snapshot.fx[listing.currency];
      if (!fxToSek || !priceFx || !listing.price) {
        return {
          status: "unavailable",
          summary: toSummary(listing),
          reason: "Kurs eller växelkurs saknas för bolaget.",
          temporary: true,
        };
      }
      try {
        const built = buildFromSeries({
          series: fromEntry(entry),
          price: listing.price * priceFx,
          fxToSek,
          market: listing.market,
        });
        return { status: "ok", company: toCompany(listing, built) };
      } catch (e) {
        if (!(e instanceof NotValuableError)) throw e;
        return { status: "unavailable", summary: toSummary(listing), reason: e.message, temporary: false };
      }
    },
    async popular(limit = 6) {
      return popularListings(limit);
    },
    async count() {
      return listings.length;
    },
  };
}
