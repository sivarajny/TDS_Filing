import type {
  LowerDeductionStatus,
  MilestoneCalculation,
  ResidentialStatus,
} from "@/types/database.types";
import type { TdsRules } from "@/lib/tds/rules-schema";

export interface LowerDeductionCertificateInput {
  status: LowerDeductionStatus;
  certifiedRate: number | null;
  validFrom: string | null;
  validTo: string | null;
}

export interface CalculateTdsInput {
  /** Amount being paid at this milestone — the base the TDS rate is applied to. */
  milestoneAmount: number;
  /** Total sale consideration for the transaction — drives the resident threshold check and the NRI surcharge slab lookup. */
  propertyValue: number;
  sellerResidentialStatus: ResidentialStatus;
  sellerHasPan: boolean;
  /** The date the milestone is/would be paid — used to check LDC validity. Pass null if not yet paid; the LDC is still considered if it has no date bounds. */
  paymentDate: string | null;
  lowerDeductionCertificate?: LowerDeductionCertificateInput | null;
  rules: TdsRules;
  rulesVersionLabel: string;
}

export interface CalculateTdsResult {
  /** Effective TDS rate applied to milestoneAmount, in percent. */
  tdsRatePercent: number;
  /** TDS amount in rupees, rounded to the nearest rupee (standard rounding for tax computation). */
  tdsAmount: number;
  calculation: MilestoneCalculation;
}

function findSurchargeRate(slabs: TdsRules["surchargeSlabs"], amount: number): number {
  const slab = slabs.find(
    (s) => amount >= s.minAmount && (s.maxAmount === null || amount < s.maxAmount),
  );
  return slab?.rate ?? 0;
}

function isLdcActiveOn(ldc: LowerDeductionCertificateInput, paymentDate: string | null): boolean {
  if (ldc.status !== "approved" || ldc.certifiedRate === null) return false;
  if (!paymentDate) return true; // not yet paid — treat as applicable pending an actual date
  if (ldc.validFrom && paymentDate < ldc.validFrom) return false;
  if (ldc.validTo && paymentDate > ldc.validTo) return false;
  return true;
}

export function calculateTds(input: CalculateTdsInput): CalculateTdsResult {
  const {
    milestoneAmount,
    propertyValue,
    sellerResidentialStatus,
    sellerHasPan,
    paymentDate,
    lowerDeductionCertificate,
    rules,
    rulesVersionLabel,
  } = input;

  const notes: string[] = [];

  if (sellerResidentialStatus === "resident") {
    if (propertyValue < rules.residentThreshold) {
      notes.push(
        `Total consideration is below the Sec 194-IA threshold (₹${rules.residentThreshold.toLocaleString("en-IN")}) — no TDS applies.`,
      );
      return buildResult(0, {
        rulesVersionLabel,
        sellerResidentialStatus,
        baseRatePercent: 0,
        surchargePercent: 0,
        cessPercent: 0,
        usedLowerDeductionCertificate: false,
        sellerHasPan,
        notes,
      }, milestoneAmount);
    }

    const rate = sellerHasPan ? rules.residentRate : rules.residentNoPanRate;
    if (!sellerHasPan) {
      notes.push("Seller has no PAN — Sec 206AA applies a flat higher rate instead of 1%.");
    }
    notes.push("Sec 194-IA rate is flat — no surcharge or cess added.");

    return buildResult(rate, {
      rulesVersionLabel,
      sellerResidentialStatus,
      baseRatePercent: rate,
      surchargePercent: 0,
      cessPercent: 0,
      usedLowerDeductionCertificate: false,
      sellerHasPan,
      notes,
    }, milestoneAmount);
  }

  // NRI seller
  if (lowerDeductionCertificate && isLdcActiveOn(lowerDeductionCertificate, paymentDate)) {
    const rate = lowerDeductionCertificate.certifiedRate!;
    notes.push(
      `Using the certified rate (${rate}%) from an approved Form 13 Lower/Nil Deduction Certificate — overrides the standard NRI computation.`,
    );
    return buildResult(rate, {
      rulesVersionLabel,
      sellerResidentialStatus,
      baseRatePercent: rate,
      surchargePercent: 0,
      cessPercent: 0,
      usedLowerDeductionCertificate: true,
      sellerHasPan,
      notes,
    }, milestoneAmount);
  }

  const baseRate = sellerHasPan ? rules.nriDefaultBaseRate : rules.nriNoPanRate;
  if (!sellerHasPan) {
    notes.push("Seller has no PAN — Sec 206AA floor rate applied.");
  }
  const surchargePercent = findSurchargeRate(rules.surchargeSlabs, propertyValue);
  const cessPercent = rules.cessRate;
  const effectiveRate = baseRate * (1 + surchargePercent / 100) * (1 + cessPercent / 100);

  notes.push(
    `Simplified NRI computation: ${baseRate}% base rate, +${surchargePercent}% surcharge (based on total consideration), +${cessPercent}% health & education cess. This is a configurable default, not a substitute for a fact-specific Sec 195 assessment — verify with a CA, especially if a Form 13 certificate is in progress.`,
  );

  return buildResult(
    effectiveRate,
    {
      rulesVersionLabel,
      sellerResidentialStatus,
      baseRatePercent: baseRate,
      surchargePercent,
      cessPercent,
      usedLowerDeductionCertificate: false,
      sellerHasPan,
      notes,
    },
    milestoneAmount,
  );
}

function buildResult(
  effectiveRatePercent: number,
  calc: Omit<MilestoneCalculation, "effectiveRatePercent">,
  milestoneAmount: number,
): CalculateTdsResult {
  const roundedRate = Math.round(effectiveRatePercent * 1000) / 1000;
  const tdsAmount = Math.round((milestoneAmount * roundedRate) / 100);
  return {
    tdsRatePercent: roundedRate,
    tdsAmount,
    calculation: { ...calc, effectiveRatePercent: roundedRate },
  };
}
