/**
 * Hämtar årsdata från Yahoo Finance för alla bolag i src/data/listings.json
 * och skriver src/data/fundamentals.json. Körs dagligen av GitHub Actions.
 *
 * Kör lokalt: npm run fundamentals
 * Valfritt: LIMIT=20 för att bara hämta de 20 första (test).
 *
 * Skyddsräcken: bolag som misslyckas behåller tidigare data, och om de flesta
 * anrop misslyckas (t.ex. blockering) skrivs ingenting och skriptet avslutas med fel.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { type Snapshot, toEntry } from "../src/lib/data/snapshot.ts";
import { fetchFxRate, fetchSeries } from "../src/lib/data/yahoo.ts";

const ROOT = new URL("../", import.meta.url);
const listings: { ticker: string; yahoo: string; currency: string }[] = JSON.parse(
  readFileSync(new URL("src/data/listings.json", ROOT), "utf8"),
).companies;
const outFile = new URL("src/data/fundamentals.json", ROOT);
const previous: Snapshot = JSON.parse(readFileSync(outFile, "utf8"));

const limit = Number(process.env.LIMIT) || listings.length;
const todo = listings.slice(0, limit);
const CONCURRENCY = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const companies: Snapshot["companies"] = { ...previous.companies };
let ok = 0;
let empty = 0;
let failed = 0;
const errors = new Map<string, number>();

let next = 0;
async function worker() {
  while (next < todo.length) {
    const l = todo[next++];
    try {
      const entry = toEntry(await fetchSeries(l.yahoo));
      if (entry) {
        companies[l.ticker] = entry;
        ok++;
      } else {
        empty++;
      }
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      errors.set(msg, (errors.get(msg) ?? 0) + 1);
    }
    await sleep(150);
  }
}

const started = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`Klart på ${Math.round((Date.now() - started) / 1000)} s: ${ok} ok, ${empty} utan data, ${failed} fel.`);
for (const [msg, n] of errors) console.log(`  ${n} × ${msg}`);

if (ok < todo.length * 0.3) {
  console.error("För få lyckade hämtningar. Behåller tidigare data och avbryter.");
  process.exit(1);
}

// Växelkurser till SEK för alla rapport- och handelsvalutor.
const currencies = new Set([
  ...Object.values(companies).map((c) => c.c),
  ...listings.map((l) => l.currency),
]);
const fx: Record<string, number> = { ...previous.fx, SEK: 1 };
for (const cur of currencies) {
  if (cur === "SEK") continue;
  try {
    fx[cur] = await fetchFxRate(cur, "SEK");
  } catch (e) {
    console.warn(`Växelkurs ${cur}/SEK saknas: ${e instanceof Error ? e.message : e}`);
  }
}

const snapshot: Snapshot = { fetchedAt: new Date().toISOString().slice(0, 10), fx, companies };
writeFileSync(outFile, JSON.stringify(snapshot) + "\n");
console.log(`Skrev ${Object.keys(companies).length} bolag och ${Object.keys(fx).length} valutor.`);
