import { describe, expect, it } from "vitest";
import { parsePercentInput } from "./format";

describe("parsePercentInput", () => {
  it("tolkar svenska och engelska format", () => {
    expect(parsePercentInput("8,5")).toBe(0.085);
    expect(parsePercentInput("8.5 %")).toBe(0.085);
    expect(parsePercentInput(" 12 ")).toBe(0.12);
    expect(parsePercentInput("−2")).toBe(-0.02);
    expect(parsePercentInput("-0,5%")).toBe(-0.005);
  });

  it("avvisar ogiltig inmatning", () => {
    for (const s of ["", "abc", "8,5,1", "1e3", "--2", "%"]) expect(parsePercentInput(s)).toBeNull();
  });
});
