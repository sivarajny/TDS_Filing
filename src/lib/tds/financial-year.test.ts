import { describe, expect, it } from "vitest";
import { getFinancialYear } from "./financial-year";

describe("getFinancialYear", () => {
  it("places an April date in the FY that starts that month", () => {
    expect(getFinancialYear("2026-04-01")).toEqual({ fy: "2026-27", ay: "2027-28" });
  });

  it("places a March date in the FY that started the previous April", () => {
    expect(getFinancialYear("2026-03-31")).toEqual({ fy: "2025-26", ay: "2026-27" });
  });

  it("places a January date in the FY that started the previous April", () => {
    expect(getFinancialYear("2026-01-10")).toEqual({ fy: "2025-26", ay: "2026-27" });
  });

  it("places a December date in the FY that started that same year's April", () => {
    expect(getFinancialYear("2026-12-25")).toEqual({ fy: "2026-27", ay: "2027-28" });
  });
});
