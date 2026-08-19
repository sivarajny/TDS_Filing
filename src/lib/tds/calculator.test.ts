import { describe, expect, it } from "vitest";
import { calculateTds } from "./calculator";
import type { TdsRules } from "./rules-schema";

const rules: TdsRules = {
  residentRate: 1.0,
  residentThreshold: 5_000_000,
  residentNoPanRate: 20.0,
  nriDefaultBaseRate: 20.0,
  nriNoPanRate: 20.0,
  surchargeSlabs: [
    { minAmount: 0, maxAmount: 5_000_000, rate: 0 },
    { minAmount: 5_000_000, maxAmount: 10_000_000, rate: 10 },
    { minAmount: 10_000_000, maxAmount: 20_000_000, rate: 15 },
    { minAmount: 20_000_000, maxAmount: null, rate: 25 },
  ],
  cessRate: 4.0,
};

const baseInput = {
  milestoneAmount: 800_000,
  propertyValue: 8_000_000,
  sellerResidentialStatus: "resident" as const,
  sellerHasPan: true,
  paymentDate: "2026-01-10",
  lowerDeductionCertificate: null,
  rules,
  rulesVersionLabel: "test",
};

describe("calculateTds — resident seller", () => {
  it("applies the flat 1% rate above the threshold with a PAN", () => {
    const r = calculateTds(baseInput);
    expect(r.tdsRatePercent).toBe(1);
    expect(r.tdsAmount).toBe(8_000);
    expect(r.calculation.usedLowerDeductionCertificate).toBe(false);
  });

  it("charges zero TDS below the Sec 194-IA threshold", () => {
    const r = calculateTds({
      ...baseInput,
      milestoneAmount: 400_000,
      propertyValue: 4_000_000,
    });
    expect(r.tdsAmount).toBe(0);
    expect(r.tdsRatePercent).toBe(0);
  });

  it("uses the boundary threshold amount as taxable (>=), not exempt", () => {
    const r = calculateTds({
      ...baseInput,
      milestoneAmount: 500_000,
      propertyValue: rules.residentThreshold,
    });
    expect(r.tdsAmount).toBe(5_000);
  });

  it("applies the Sec 206AA flat rate when the seller has no PAN", () => {
    const r = calculateTds({ ...baseInput, sellerHasPan: false });
    expect(r.tdsRatePercent).toBe(20);
    expect(r.tdsAmount).toBe(160_000);
  });

  it("never adds surcharge or cess on top of the 194-IA rate", () => {
    const r = calculateTds(baseInput);
    expect(r.calculation.surchargePercent).toBe(0);
    expect(r.calculation.cessPercent).toBe(0);
  });
});

describe("calculateTds — NRI seller", () => {
  it("compounds base rate, income-slab surcharge, and cess", () => {
    // 20% base * 1.10 surcharge * 1.04 cess = 22.88%
    const r = calculateTds({ ...baseInput, sellerResidentialStatus: "nri" });
    expect(r.tdsRatePercent).toBe(22.88);
    expect(r.tdsAmount).toBe(Math.round(800_000 * 0.2288));
  });

  it("picks the top surcharge slab for a large consideration", () => {
    // 20% * 1.25 * 1.04 = 26%
    const r = calculateTds({
      ...baseInput,
      sellerResidentialStatus: "nri",
      milestoneAmount: 5_000_000,
      propertyValue: 25_000_000,
    });
    expect(r.tdsRatePercent).toBe(26);
  });

  it("applies zero surcharge for a consideration under the first slab", () => {
    const r = calculateTds({
      ...baseInput,
      sellerResidentialStatus: "nri",
      milestoneAmount: 400_000,
      propertyValue: 4_000_000,
    });
    // 20% * 1.0 * 1.04 = 20.8%
    expect(r.tdsRatePercent).toBe(20.8);
  });

  it("uses the certified rate from an approved LDC valid on the payment date", () => {
    const r = calculateTds({
      ...baseInput,
      sellerResidentialStatus: "nri",
      lowerDeductionCertificate: {
        status: "approved",
        certifiedRate: 8,
        validFrom: "2025-04-01",
        validTo: "2026-03-31",
      },
    });
    expect(r.tdsRatePercent).toBe(8);
    expect(r.tdsAmount).toBe(64_000);
    expect(r.calculation.usedLowerDeductionCertificate).toBe(true);
  });

  it("falls back to the standard computation once the LDC has expired", () => {
    const r = calculateTds({
      ...baseInput,
      sellerResidentialStatus: "nri",
      paymentDate: "2026-06-10",
      lowerDeductionCertificate: {
        status: "approved",
        certifiedRate: 8,
        validFrom: "2025-04-01",
        validTo: "2026-03-31",
      },
    });
    expect(r.tdsRatePercent).toBe(22.88);
    expect(r.calculation.usedLowerDeductionCertificate).toBe(false);
  });

  it("ignores an LDC that is only 'applied', not yet 'approved'", () => {
    const r = calculateTds({
      ...baseInput,
      sellerResidentialStatus: "nri",
      lowerDeductionCertificate: {
        status: "applied",
        certifiedRate: null,
        validFrom: null,
        validTo: null,
      },
    });
    expect(r.tdsRatePercent).toBe(22.88);
  });

  it("applies the no-PAN floor rate when the seller has no PAN", () => {
    const r = calculateTds({
      ...baseInput,
      sellerResidentialStatus: "nri",
      sellerHasPan: false,
    });
    expect(r.calculation.baseRatePercent).toBe(rules.nriNoPanRate);
  });

  it("treats an unpaid milestone's LDC as applicable when it has no date bounds", () => {
    const r = calculateTds({
      ...baseInput,
      sellerResidentialStatus: "nri",
      paymentDate: null,
      lowerDeductionCertificate: {
        status: "approved",
        certifiedRate: 12,
        validFrom: null,
        validTo: null,
      },
    });
    expect(r.tdsRatePercent).toBe(12);
  });
});

describe("calculateTds — rounding", () => {
  it("rounds the TDS amount to the nearest rupee", () => {
    const r = calculateTds({ ...baseInput, milestoneAmount: 333_333 });
    expect(Number.isInteger(r.tdsAmount)).toBe(true);
  });

  it("keeps the effective rate to 3 decimal places", () => {
    const r = calculateTds({ ...baseInput, sellerResidentialStatus: "nri" });
    expect(r.tdsRatePercent.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(3);
  });
});
