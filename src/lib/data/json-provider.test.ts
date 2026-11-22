import { describe, expect, it } from "vitest";
import { computeDcf, validateAssumptions } from "@/lib/dcf";
import { companyData } from ".";

describe("JSON-provider", () => {
  it("hittar på ticker, namn och alias, oavsett skiftläge", async () => {
    expect((await companyData.search("volv"))[0].ticker).toBe("VOLV-B");
    expect((await companyData.search("atlas"))[0].ticker).toBe("ATCO-A");
    expect((await companyData.search("hennes"))[0].ticker).toBe("HM-B");
    expect((await companyData.search("h&m"))[0].ticker).toBe("HM-B");
    expect((await companyData.search("ERIC"))[0].ticker).toBe("ERIC-B");
  });

  it("returnerar tomt för tom eller okänd sökning", async () => {
    expect(await companyData.search("")).toEqual([]);
    expect(await companyData.search("zzzz")).toEqual([]);
  });

  it("getCompany tar emot gemener och returnerar null för okänd ticker", async () => {
    expect((await companyData.getCompany("evo"))?.name).toBe("Evolution");
    expect(await companyData.getCompany("NOPE")).toBeNull();
  });

  it("alla bolag har giltiga grundantaganden som går att räkna på", async () => {
    for (const t of await companyData.listTickers()) {
      const c = (await companyData.getCompany(t))!;
      expect(validateAssumptions(c.assumptions)).toEqual([]);
      const r = computeDcf(c.assumptions, c.fundamentals);
      expect(Number.isFinite(r.valuePerShare)).toBe(true);
      expect(r.valuePerShare).toBeGreaterThan(0);
    }
  });
});
