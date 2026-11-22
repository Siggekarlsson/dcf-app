import { cacheLife } from "next/cache";
import { buildFromSeries, NotValuableError } from "./baseline";
import { getExampleCompany } from "./json-provider";
import { getListing, type Listing, listings, popularListings, searchListings, toSummary } from "./listings";
import type { Company, CompanyDataProvider, CompanyLookup } from "./types";
import { fetchFxRate, fetchQuote, fetchSeries, YahooError } from "./yahoo";

type Cached = { status: "ok"; company: Company } | { status: "unavailable"; reason: string };

/**
 * Hämtar och bygger ett bolag från Yahoo Finance. Cachas i timmar.
 * Tillfälliga fel kastas (och cachas därför inte); permanenta fel returneras och cachas.
 */
async function loadFromYahoo(ticker: string): Promise<Cached> {
  "use cache";
  cacheLife("hours");

  const listing = getListing(ticker)!;
  try {
    const [series, quote] = await Promise.all([
      fetchSeries(listing.yahoo),
      // Reserv: senaste kurs från Nasdaq-listan om Yahoo-kursen inte går att hämta.
      fetchQuote(listing.yahoo).catch((e) => {
        if (listing.price) return { price: listing.price, currency: listing.currency };
        throw e;
      }),
    ]);
    const reportingCurrency = series.annualTotalRevenue?.at(-1)?.currency ?? quote.currency;
    const [fxToSek, priceFx] = await Promise.all([
      fetchFxRate(reportingCurrency, "SEK"),
      fetchFxRate(quote.currency, "SEK"),
    ]);
    const built = buildFromSeries({ series, price: quote.price * priceFx, fxToSek, market: listing.market });
    return { status: "ok", company: toCompany(listing, built) };
  } catch (e) {
    if (e instanceof NotValuableError) return { status: "unavailable", reason: e.message };
    if (e instanceof YahooError && !e.transient) return { status: "unavailable", reason: e.message };
    throw e;
  }
}

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

export function createYahooProvider(): CompanyDataProvider {
  return {
    async search(query, limit = 8) {
      return searchListings(query, limit);
    },
    async getCompany(ticker): Promise<CompanyLookup> {
      const listing = getListing(ticker);
      if (!listing) return { status: "not_found" };
      try {
        const r = await loadFromYahoo(listing.ticker);
        if (r.status === "ok") return r;
        return { status: "unavailable", summary: toSummary(listing), reason: r.reason, temporary: false };
      } catch (e) {
        console.error(`Yahoo ${listing.yahoo}:`, e instanceof Error ? e.message : e);
        // Reserv: exempeldata för de bolag som har sådan.
        const example = getExampleCompany(listing.ticker);
        if (example) return { status: "ok", company: example };
        return {
          status: "unavailable",
          summary: toSummary(listing),
          reason: "Finansiell data kunde inte hämtas just nu. Försök igen om en stund.",
          temporary: true,
        };
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
