// Hämtar alla aktier på Nasdaq Stockholm (huvudlistan + First North) och skriver src/data/listings.json.
// Kör: node scripts/fetch-listings.mjs
import { writeFileSync } from "node:fs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const MARKETS = [
  ["MAIN_MARKET", "Nasdaq Stockholm"],
  ["FIRST_NORTH", "First North"],
];

const SECTORS = {
  "Basic Materials": "Råvaror",
  "Consumer Discretionary": "Sällanköpsvaror",
  "Consumer Staples": "Dagligvaror",
  Energy: "Energi",
  Financials: "Finans",
  "Health Care": "Hälsovård",
  Industrials: "Industri",
  "Real Estate": "Fastigheter",
  Technology: "Teknik",
  Telecommunications: "Telekom",
  Utilities: "Kraftförsörjning",
};

const num = (s) => {
  const n = Number(String(s ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const out = [];
for (const [category, market] of MARKETS) {
  const res = await fetch(
    `https://api.nasdaq.com/api/nordic/screener/shares?category=${category}&tableonly=false&market=STO`,
    { headers: { "user-agent": UA, accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`${category}: HTTP ${res.status}`);
  const rows = (await res.json()).data.instrumentListing.rows;
  for (const r of rows) {
    if (!r.symbol || !r.fullName) continue;
    const ticker = r.symbol.trim().replace(/\s+/g, "-").toUpperCase();
    out.push({
      ticker,
      symbol: r.symbol.trim(),
      yahoo: `${ticker}.ST`,
      name: r.fullName.trim(),
      isin: r.isin || null,
      market,
      sector: SECTORS[r.sector] ?? r.sector ?? "",
      currency: r.currency || "SEK",
      price: num(r.lastSalePrice),
      turnover: num(r.turnover),
    });
  }
  console.log(`${market}: ${rows.length}`);
}

const unique = [...new Map(out.map((c) => [c.ticker, c])).values()].sort((a, b) => a.name.localeCompare(b.name, "sv"));
writeFileSync(
  new URL("../src/data/listings.json", import.meta.url),
  JSON.stringify({ source: "Nasdaq Nordic", fetchedAt: new Date().toISOString().slice(0, 10), companies: unique }, null, 1) + "\n",
);
console.log(`Totalt ${unique.length} bolag`);
