import { describe, expect, it } from "vitest";
import { computeDcf, validateAssumptions } from "@/lib/dcf";
import { createJsonProvider, exampleCompanies, getExampleCompany } from "./json-provider";
import { getListing, listings, popularListings, searchListings } from "./listings";

const mock = createJsonProvider();

describe("JSON-provider (exempeldata)", () => {
  it("hittar på ticker, namn och alias", async () => {
    expect((await mock.search("volv"))[0].ticker).toBe("VOLV-B");
    expect((await mock.search("h&m"))[0].ticker).toBe("HM-B");
  });

  it("getCompany ger ok eller not_found", async () => {
    const r = await mock.getCompany("evo");
    expect(r.status === "ok" && r.company.name).toBe("Evolution");
    expect((await mock.getCompany("NOPE")).status).toBe("not_found");
  });

  it("alla exempelbolag har giltiga grundantaganden och källa 'exempel'", () => {
    for (const c of exampleCompanies) {
      expect(c.source).toBe("exempel");
      expect(validateAssumptions(c.assumptions)).toEqual([]);
      expect(computeDcf(c.assumptions, c.fundamentals).valuePerShare).toBeGreaterThan(0);
    }
    expect(getExampleCompany("volv-b")?.ticker).toBe("VOLV-B");
  });
});

describe("listings (alla svenska börsbolag)", () => {
  it("innehåller hundratals bolag med unika tickers och Yahoo-symboler", () => {
    expect(listings.length).toBeGreaterThan(500);
    expect(new Set(listings.map((l) => l.ticker)).size).toBe(listings.length);
    for (const l of listings) expect(l.yahoo).toBe(`${l.ticker}.ST`);
  });

  it("exempelbolagens tickers finns i listan", () => {
    for (const c of exampleCompanies) expect(getListing(c.ticker)).not.toBeNull();
  });

  it("söker på namn, ordstart och ticker", () => {
    expect(searchListings("volvo")[0].name).toMatch(/Volvo/);
    expect(searchListings("mauritz")[0].ticker).toBe("HM-B");
    expect(searchListings("ERIC-B")[0].ticker).toBe("ERIC-B");
    expect(searchListings("")).toEqual([]);
    expect(searchListings("qqqqzzzz")).toEqual([]);
  });

  it("populära bolag kommer från huvudlistan", () => {
    const p = popularListings(6);
    expect(p).toHaveLength(6);
    for (const c of p) expect(c.exchange).toBe("Nasdaq Stockholm");
  });
});
