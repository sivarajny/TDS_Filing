import type { ReminderType } from "@/types/database.types";
import { formatDate, formatInr } from "@/lib/format";

const COPY: Record<ReminderType, { subject: string; urgency: string }> = {
  t_minus_14: {
    subject: "TDS filing due in 14 days",
    urgency: "Your Section 194-IA TDS filing is due in 14 days.",
  },
  t_minus_7: {
    subject: "Reminder: TDS filing due in 7 days",
    urgency: "Your Section 194-IA TDS filing is due in 7 days.",
  },
  t_minus_1: {
    subject: "Urgent: TDS filing due tomorrow",
    urgency: "Your Section 194-IA TDS filing is due tomorrow.",
  },
  overdue: {
    subject: "Overdue: TDS filing deadline has passed",
    urgency: "The statutory 30-day deadline for this TDS filing has passed.",
  },
};

export function buildReminderEmail(params: {
  reminderType: ReminderType;
  buyerName: string;
  propertyAddress: string;
  milestoneDescription: string;
  tdsAmount: number | null;
  filingDeadline: string;
  prefillUrl: string;
}) {
  const copy = COPY[params.reminderType];
  const html = `
    <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
      <p>Hi ${escapeHtml(params.buyerName)},</p>
      <p>${copy.urgency}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 4px 0; color: #64748b;">Property</td><td style="padding: 4px 0; text-align: right; font-weight: 600;">${escapeHtml(params.propertyAddress)}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Milestone</td><td style="padding: 4px 0; text-align: right;">${escapeHtml(params.milestoneDescription)}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">TDS amount</td><td style="padding: 4px 0; text-align: right; font-weight: 600;">${params.tdsAmount !== null ? formatInr(params.tdsAmount) : "—"}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Filing deadline</td><td style="padding: 4px 0; text-align: right; font-weight: 600;">${formatDate(params.filingDeadline)}</td></tr>
      </table>
      <p>
        <a href="${params.prefillUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 10px 16px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Get portal pre-fill package
        </a>
      </p>
      <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
        This is a compliance reminder, not tax advice. This tool does not file anything on your
        behalf — use the pre-fill package to complete the filing yourself on the Income Tax
        e-filing portal.
      </p>
    </div>
  `.trim();

  return { subject: `${copy.subject} — ${params.propertyAddress}`, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
