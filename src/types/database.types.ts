// Hand-written to match supabase/migrations/*.sql. Once the project is
// linked to a live Supabase instance, regenerate with:
//   npx supabase gen types typescript --linked > src/types/database.types.ts
// and reconcile any drift against this file.

import type { TdsRules } from "@/lib/tds/rules-schema";

export type UserRole = "buyer" | "developer_admin" | "ca";
export type ResidentialStatus = "resident" | "nri";
export type FilingFormType = "26QB" | "141";
export type LowerDeductionStatus =
  | "not_applicable"
  | "applied"
  | "approved"
  | "rejected"
  | "expired";
export type DocumentType =
  | "challan_receipt"
  | "form16b_or_141"
  | "pan_card"
  | "id_proof"
  | "lower_deduction_certificate"
  | "agreement"
  | "other";
export type ReminderType = "t_minus_14" | "t_minus_7" | "t_minus_1" | "overdue";
export type ReminderStatus = "sent" | "failed";
export type ComplianceStatus = "upcoming" | "due_soon" | "overdue" | "filed";

export interface Database {
  public: {
    Tables: {
      orgs: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orgs"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          org_id: string | null;
          role: UserRole;
          full_name: string | null;
          email: string;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          org_id?: string | null;
          role?: UserRole;
          full_name?: string | null;
          email: string;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          address?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
        Relationships: [];
      };
      tds_rules_versions: {
        Row: {
          id: string;
          version_label: string;
          form_type: FilingFormType;
          effective_from: string;
          effective_to: string | null;
          rules: TdsRulesJson;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          version_label: string;
          form_type: FilingFormType;
          effective_from: string;
          effective_to?: string | null;
          rules: TdsRulesJson;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tds_rules_versions"]["Insert"]>;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          org_id: string | null;
          project_id: string | null;
          buyer_id: string;
          created_by: string;
          property_address: string;
          property_value: number;
          unit_number: string | null;
          buyer_pan: string;
          buyer_name: string;
          buyer_address: string | null;
          seller_name: string;
          seller_pan: string | null;
          seller_residential_status: ResidentialStatus;
          seller_address: string | null;
          status: "active" | "closed" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id?: string | null;
          project_id?: string | null;
          buyer_id: string;
          created_by: string;
          property_address: string;
          property_value: number;
          unit_number?: string | null;
          buyer_pan: string;
          buyer_name: string;
          buyer_address?: string | null;
          seller_name: string;
          seller_pan?: string | null;
          seller_residential_status?: ResidentialStatus;
          seller_address?: string | null;
          status?: "active" | "closed" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
        Relationships: [];
      };
      lower_deduction_certificates: {
        Row: {
          id: string;
          transaction_id: string;
          status: LowerDeductionStatus;
          certificate_number: string | null;
          certified_rate: number | null;
          valid_from: string | null;
          valid_to: string | null;
          document_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          status?: LowerDeductionStatus;
          certificate_number?: string | null;
          certified_rate?: number | null;
          valid_from?: string | null;
          valid_to?: string | null;
          document_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["lower_deduction_certificates"]["Insert"]
        >;
        Relationships: [];
      };
      milestones: {
        Row: {
          id: string;
          transaction_id: string;
          sequence_no: number;
          description: string;
          amount: number;
          due_date: string;
          payment_date: string | null;
          rules_version_id: string | null;
          tds_rate: number | null;
          tds_amount: number | null;
          calculation: MilestoneCalculation | null;
          filing_deadline: string | null;
          filed_at: string | null;
          challan_number: string | null;
          acknowledgment_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          sequence_no: number;
          description: string;
          amount: number;
          due_date: string;
          payment_date?: string | null;
          rules_version_id?: string | null;
          tds_rate?: number | null;
          tds_amount?: number | null;
          calculation?: MilestoneCalculation | null;
          filed_at?: string | null;
          challan_number?: string | null;
          acknowledgment_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["milestones"]["Insert"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          transaction_id: string;
          milestone_id: string | null;
          uploaded_by: string;
          doc_type: DocumentType;
          storage_path: string;
          file_name: string;
          mime_type: string | null;
          size_bytes: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          milestone_id?: string | null;
          uploaded_by: string;
          doc_type: DocumentType;
          storage_path: string;
          file_name: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [];
      };
      reminders_log: {
        Row: {
          id: string;
          milestone_id: string;
          reminder_type: ReminderType;
          recipient_email: string;
          status: ReminderStatus;
          error_message: string | null;
          sent_at: string;
        };
        Insert: {
          id?: string;
          milestone_id: string;
          reminder_type: ReminderType;
          recipient_email: string;
          status: ReminderStatus;
          error_message?: string | null;
          sent_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reminders_log"]["Insert"]>;
        Relationships: [];
      };
      advisor_links: {
        Row: {
          id: string;
          buyer_id: string;
          advisor_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          buyer_id: string;
          advisor_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["advisor_links"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      v_milestones_with_status: {
        Row: Database["public"]["Tables"]["milestones"]["Row"] & {
          compliance_status: ComplianceStatus;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
}

/**
 * Structured shape of tds_rules_versions.rules, read by
 * src/lib/tds/calculator.ts. Defined via zod in src/lib/tds/rules-schema.ts
 * (the single source of truth) so a malformed DB row fails loudly instead
 * of producing silent NaNs; re-exported here under the historical name.
 */
export type TdsRulesJson = TdsRules;

/** Structured shape of milestones.calculation — the audit trail behind tds_amount. */
export interface MilestoneCalculation {
  rulesVersionLabel: string;
  sellerResidentialStatus: ResidentialStatus;
  baseRatePercent: number;
  surchargePercent: number;
  cessPercent: number;
  effectiveRatePercent: number;
  usedLowerDeductionCertificate: boolean;
  sellerHasPan: boolean;
  notes: string[];
}
