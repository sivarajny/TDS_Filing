import { z } from "zod";

/**
 * Validates the jsonb `rules` column on tds_rules_versions before the
 * calculator trusts it. Keeping this separate from database.types.ts means
 * a malformed row fails loudly (calculateTds throws) instead of silently
 * producing NaN/undefined math.
 */
export const surchargeSlabSchema = z.object({
  minAmount: z.number().nonnegative(),
  maxAmount: z.number().positive().nullable(),
  rate: z.number().min(0).max(100),
});

export const tdsRulesSchema = z.object({
  residentRate: z.number().min(0).max(100),
  residentThreshold: z.number().nonnegative(),
  residentNoPanRate: z.number().min(0).max(100),
  nriDefaultBaseRate: z.number().min(0).max(100),
  nriNoPanRate: z.number().min(0).max(100),
  surchargeSlabs: z.array(surchargeSlabSchema).min(1),
  cessRate: z.number().min(0).max(100),
});

export type TdsRules = z.infer<typeof tdsRulesSchema>;
