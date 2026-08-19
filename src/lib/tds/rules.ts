import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { tdsRulesSchema } from "@/lib/tds/rules-schema";

/** Today's date in the shape the DB stores dates as ("YYYY-MM-DD"), no time component. */
export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Looks up whichever tds_rules_versions row covers `asOfDate` — the one
 * place that resolves "which rate table applies right now," including the
 * 26QB -> Form 141 handover on 1 Apr 2026. Callers should pass the
 * milestone's payment_date once known, or today's date while it's still
 * unpaid (rates get recalculated as the payment approaches).
 */
export async function getActiveTdsRulesVersion(
  supabase: SupabaseClient<Database>,
  asOfDate: string = todayIsoDate(),
) {
  const { data, error } = await supabase
    .from("tds_rules_versions")
    .select("*")
    .lte("effective_from", asOfDate)
    .or(`effective_to.is.null,effective_to.gte.${asOfDate}`)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(`No TDS rules version covers ${asOfDate}. Seed a rules row for this date.`);
  }

  const rules = tdsRulesSchema.parse(data.rules);
  return { ...data, rules };
}
