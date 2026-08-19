import { NextResponse, type NextRequest } from "next/server";
import { differenceInCalendarDays } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { buildReminderEmail } from "@/lib/email/reminder-template";
import { todayIsoDate } from "@/lib/tds/rules";
import type { ReminderType } from "@/types/database.types";

export const dynamic = "force-dynamic";

function determineReminderType(filingDeadline: string, today: string): ReminderType | null {
  const days = differenceInCalendarDays(new Date(filingDeadline), new Date(today));
  if (days === 14) return "t_minus_14";
  if (days === 7) return "t_minus_7";
  if (days === 1) return "t_minus_1";
  if (days < 0) return "overdue";
  return null;
}

/**
 * Daily job (see vercel.json) that emails T-14/T-7/T-1 reminders and one
 * overdue notice per unfiled, paid milestone. reminders_log's unique
 * (milestone_id, reminder_type) constraint is the source of truth for
 * "already sent" — we check it before emailing (to avoid firing duplicate
 * emails) and it also guards against a concurrent/duplicate run.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = todayIsoDate();

  const { data: milestones, error: milestonesError } = await supabase
    .from("v_milestones_with_status")
    .select("*")
    .is("filed_at", null)
    .not("payment_date", "is", null);
  if (milestonesError) {
    return NextResponse.json({ error: milestonesError.message }, { status: 500 });
  }

  const candidates = (milestones ?? [])
    .filter((m) => m.filing_deadline)
    .map((m) => ({
      milestone: m,
      reminderType: determineReminderType(m.filing_deadline as string, today),
    }))
    .filter((c): c is { milestone: (typeof milestones)[number]; reminderType: ReminderType } =>
      c.reminderType !== null,
    );

  if (candidates.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, failed: 0, skipped: 0 });
  }

  const { data: alreadySent } = await supabase
    .from("reminders_log")
    .select("milestone_id, reminder_type")
    .in(
      "milestone_id",
      candidates.map((c) => c.milestone.id),
    );
  const sentKeys = new Set((alreadySent ?? []).map((r) => `${r.milestone_id}:${r.reminder_type}`));

  const pending = candidates.filter(
    (c) => !sentKeys.has(`${c.milestone.id}:${c.reminderType}`),
  );

  let sent = 0;
  let failed = 0;

  for (const { milestone, reminderType } of pending) {
    const { data: transaction } = await supabase
      .from("transactions")
      .select("buyer_id, buyer_name, property_address")
      .eq("id", milestone.transaction_id)
      .maybeSingle();
    if (!transaction) continue;

    const { data: buyer } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", transaction.buyer_id)
      .maybeSingle();
    if (!buyer) continue;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const { subject, html } = buildReminderEmail({
      reminderType,
      buyerName: transaction.buyer_name,
      propertyAddress: transaction.property_address,
      milestoneDescription: milestone.description,
      tdsAmount: milestone.tds_amount,
      filingDeadline: milestone.filing_deadline as string,
      prefillUrl: `${appUrl}/transactions/${milestone.transaction_id}/milestones/${milestone.id}/prefill`,
    });

    try {
      await sendEmail({ to: buyer.email, subject, html });
      await supabase.from("reminders_log").insert({
        milestone_id: milestone.id,
        reminder_type: reminderType,
        recipient_email: buyer.email,
        status: "sent",
      });
      sent += 1;
    } catch (err) {
      await supabase.from("reminders_log").insert({
        milestone_id: milestone.id,
        reminder_type: reminderType,
        recipient_email: buyer.email,
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      });
      failed += 1;
    }
  }

  return NextResponse.json({
    processed: candidates.length,
    sent,
    failed,
    skipped: candidates.length - pending.length,
  });
}
