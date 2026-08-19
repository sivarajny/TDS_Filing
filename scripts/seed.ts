/**
 * Seeds a demo dataset: one developer org with two buyers (a resident-seller
 * transaction spanning the 26QB -> Form 141 handover, and an NRI-seller
 * transaction with an approved Lower Deduction Certificate) plus one
 * standalone buyer transaction with no org, so both entry paths in the app
 * are demoable end to end.
 *
 * Requires a real Supabase project: run against NEXT_PUBLIC_SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY with the migrations in supabase/migrations/
 * already applied.
 *
 *   npm run seed
 */
import "dotenv/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeMilestoneTds } from "@/lib/tds/apply";
import type { Database, ResidentialStatus } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEMO_PASSWORD = "DemoPass123!";

async function getOrCreateUser(
  admin: SupabaseClient<Database>,
  params: {
    email: string;
    fullName: string;
    role: "buyer" | "developer_admin";
    orgId?: string;
  },
): Promise<string> {
  // role/org_id are not trusted from signup metadata (see the trigger and
  // src/lib/auth/actions.ts) — every new profile starts as a plain buyer,
  // so promote it explicitly via the service-role client afterward.
  const { data, error } = await admin.auth.admin.createUser({
    email: params.email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: params.fullName },
  });

  let userId: string;
  if (!error && data.user) {
    console.log(`  created user ${params.email}`);
    userId = data.user.id;
  } else {
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", params.email)
      .maybeSingle();
    if (!existing) throw new Error(`Could not create or find user ${params.email}: ${error?.message}`);
    console.log(`  reusing existing user ${params.email}`);
    userId = existing.id;
  }

  const { error: promoteError } = await admin
    .from("profiles")
    .update({ role: params.role, org_id: params.orgId ?? null })
    .eq("id", userId);
  if (promoteError) throw new Error(`Could not set role/org for ${params.email}: ${promoteError.message}`);

  return userId;
}

async function getOrCreateOrg(admin: SupabaseClient<Database>, name: string): Promise<string> {
  const { data: existing } = await admin.from("orgs").select("id").eq("name", name).maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await admin.from("orgs").insert({ name }).select("id").single();
  if (error || !data) throw new Error(`Could not create org ${name}: ${error?.message}`);
  return data.id;
}

async function getOrCreateProject(
  admin: SupabaseClient<Database>,
  orgId: string,
  name: string,
  address: string,
): Promise<string> {
  const { data: existing } = await admin
    .from("projects")
    .select("id")
    .eq("org_id", orgId)
    .eq("name", name)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await admin
    .from("projects")
    .insert({ org_id: orgId, name, address })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not create project ${name}: ${error?.message}`);
  return data.id;
}

interface MilestoneSeed {
  description: string;
  amount: number;
  dueDate: string;
  paymentDate: string | null;
  filed: boolean;
  challanNumber?: string;
  acknowledgmentNumber?: string;
  uploadChallanText?: string;
}

interface TransactionSeed {
  orgId: string | null;
  projectId: string | null;
  buyerId: string;
  createdBy: string;
  propertyAddress: string;
  unitNumber?: string;
  propertyValue: number;
  buyerName: string;
  buyerPan: string;
  buyerAddress?: string;
  sellerName: string;
  sellerPan: string | null;
  sellerResidentialStatus: ResidentialStatus;
  sellerAddress?: string;
  ldc?: {
    status: "approved";
    certificateNumber: string;
    certifiedRate: number;
    validFrom: string;
    validTo: string;
    notes?: string;
  };
  milestones: MilestoneSeed[];
}

async function seedTransaction(admin: SupabaseClient<Database>, seed: TransactionSeed) {
  const { data: transaction, error: txError } = await admin
    .from("transactions")
    .insert({
      org_id: seed.orgId,
      project_id: seed.projectId,
      buyer_id: seed.buyerId,
      created_by: seed.createdBy,
      property_address: seed.propertyAddress,
      unit_number: seed.unitNumber ?? null,
      property_value: seed.propertyValue,
      buyer_pan: seed.buyerPan,
      buyer_name: seed.buyerName,
      buyer_address: seed.buyerAddress ?? null,
      seller_name: seed.sellerName,
      seller_pan: seed.sellerPan,
      seller_residential_status: seed.sellerResidentialStatus,
      seller_address: seed.sellerAddress ?? null,
    })
    .select("id")
    .single();
  if (txError || !transaction) throw new Error(`Transaction insert failed: ${txError?.message}`);
  console.log(`  transaction ${seed.propertyAddress} -> ${transaction.id}`);

  const { error: ldcError } = await admin.from("lower_deduction_certificates").insert({
    transaction_id: transaction.id,
    status: seed.ldc?.status ?? "not_applicable",
    certificate_number: seed.ldc?.certificateNumber ?? null,
    certified_rate: seed.ldc?.certifiedRate ?? null,
    valid_from: seed.ldc?.validFrom ?? null,
    valid_to: seed.ldc?.validTo ?? null,
    notes: seed.ldc?.notes ?? null,
  });
  if (ldcError) throw new Error(`LDC insert failed: ${ldcError.message}`);

  const ldcForCalc = seed.ldc
    ? {
        status: seed.ldc.status,
        certifiedRate: seed.ldc.certifiedRate,
        validFrom: seed.ldc.validFrom,
        validTo: seed.ldc.validTo,
      }
    : null;

  for (const [index, m] of seed.milestones.entries()) {
    const calc = await computeMilestoneTds(admin, {
      milestoneAmount: m.amount,
      propertyValue: seed.propertyValue,
      sellerResidentialStatus: seed.sellerResidentialStatus,
      sellerHasPan: Boolean(seed.sellerPan),
      paymentDate: m.paymentDate,
      lowerDeductionCertificate: ldcForCalc,
    });

    const { data: milestone, error: msError } = await admin
      .from("milestones")
      .insert({
        transaction_id: transaction.id,
        sequence_no: index + 1,
        description: m.description,
        amount: m.amount,
        due_date: m.dueDate,
        payment_date: m.paymentDate,
        rules_version_id: calc.rulesVersionId,
        tds_rate: calc.tdsRatePercent,
        tds_amount: calc.tdsAmount,
        calculation: calc.calculation,
        filed_at: m.filed ? new Date().toISOString() : null,
        challan_number: m.filed ? (m.challanNumber ?? null) : null,
        acknowledgment_number: m.filed ? (m.acknowledgmentNumber ?? null) : null,
      })
      .select("id")
      .single();
    if (msError || !milestone) throw new Error(`Milestone insert failed: ${msError?.message}`);
    console.log(
      `    milestone "${m.description}" -> rate ${calc.tdsRatePercent}%, TDS ${calc.tdsAmount}`,
    );

    if (m.uploadChallanText) {
      const storagePath = `${transaction.id}/demo-challan-${index + 1}.txt`;
      const { error: uploadError } = await admin.storage
        .from("documents")
        .upload(storagePath, new Blob([m.uploadChallanText], { type: "text/plain" }), {
          contentType: "text/plain",
          upsert: true,
        });
      if (uploadError) {
        console.warn(`    (skipping document upload: ${uploadError.message})`);
      } else {
        await admin.from("documents").insert({
          transaction_id: transaction.id,
          milestone_id: milestone.id,
          uploaded_by: seed.buyerId,
          doc_type: "challan_receipt",
          storage_path: storagePath,
          file_name: `demo-challan-${index + 1}.txt`,
          mime_type: "text/plain",
          size_bytes: m.uploadChallanText.length,
        });
        console.log(`    uploaded demo document for "${m.description}"`);
      }
    }
  }

  return transaction.id;
}

async function main() {
  const admin = createAdminClient();

  console.log("Creating org + project...");
  const orgId = await getOrCreateOrg(admin, "Skyline Developers");
  const projectId = await getOrCreateProject(
    admin,
    orgId,
    "Skyline Heights",
    "Plot 42, Whitefield Main Road, Bengaluru",
  );

  console.log("Creating users...");
  const developerId = await getOrCreateUser(admin, {
    email: "demo.developer@example.com",
    fullName: "Demo Developer",
    role: "developer_admin",
    orgId,
  });
  const buyer1Id = await getOrCreateUser(admin, {
    email: "demo.buyer1@example.com",
    fullName: "Anita Sharma",
    role: "buyer",
  });
  const buyer2Id = await getOrCreateUser(admin, {
    email: "demo.buyer2@example.com",
    fullName: "Rohan Mehta",
    role: "buyer",
    orgId,
  });
  const buyer3Id = await getOrCreateUser(admin, {
    email: "demo.buyer3@example.com",
    fullName: "Priya Nair",
    role: "buyer",
    orgId,
  });

  console.log("Seeding transaction 1 (standalone buyer, resident seller, 26QB -> 141 span)...");
  await seedTransaction(admin, {
    orgId: null,
    projectId: null,
    buyerId: buyer1Id,
    createdBy: buyer1Id,
    propertyAddress: "14B, Palm Meadows, Sarjapur Road, Bengaluru",
    unitNumber: "B-1402",
    propertyValue: 6_500_000,
    buyerName: "Anita Sharma",
    buyerPan: "ANSPS1234K",
    buyerAddress: "22, Residency Road, Bengaluru",
    sellerName: "Mahesh Kumar",
    sellerPan: "MAHPK5678L",
    sellerResidentialStatus: "resident",
    sellerAddress: "9, Lavelle Road, Bengaluru",
    milestones: [
      {
        description: "Booking amount",
        amount: 650_000,
        dueDate: "2025-11-01",
        paymentDate: "2025-10-28",
        filed: true,
        challanNumber: "CH26QB-000123",
        acknowledgmentNumber: "AKQB0098765432",
        uploadChallanText:
          "Demo challan receipt — Form 26QB, booking amount installment. Not a real government document.",
      },
      {
        description: "Agreement value — 20%",
        amount: 1_300_000,
        dueDate: "2026-07-05",
        paymentDate: "2026-07-10",
        filed: false, // deliberately unfiled past its deadline -> demonstrates "overdue"
      },
      {
        description: "Possession payment",
        amount: 4_550_000,
        dueDate: "2026-11-15",
        paymentDate: null, // unpaid -> "upcoming"
        filed: false,
      },
    ],
  });

  console.log("Seeding transaction 2 (org buyer, resident seller, 26QB -> 141 span)...");
  await seedTransaction(admin, {
    orgId,
    projectId,
    buyerId: buyer2Id,
    createdBy: developerId,
    propertyAddress: "Skyline Heights, Tower 3, Whitefield, Bengaluru",
    unitNumber: "T3-0805",
    propertyValue: 9_500_000,
    buyerName: "Rohan Mehta",
    buyerPan: "ROMPM2345N",
    sellerName: "Deepak Verma",
    sellerPan: "DEEPV6789M",
    sellerResidentialStatus: "resident",
    sellerAddress: "5, MG Road, Bengaluru",
    milestones: [
      {
        description: "Booking amount",
        amount: 950_000,
        dueDate: "2025-12-01",
        paymentDate: "2025-11-28",
        filed: true,
        challanNumber: "CH26QB-000456",
        acknowledgmentNumber: "AKQB0011223344",
        uploadChallanText:
          "Demo challan receipt — Form 26QB, booking amount installment. Not a real government document.",
      },
      {
        description: "Construction linked — slab 1",
        amount: 2_850_000,
        dueDate: "2026-07-20",
        paymentDate: "2026-07-25", // -> filing deadline lands within a week of "today" -> "due soon"
        filed: false,
      },
      {
        description: "Final installment",
        amount: 5_700_000,
        dueDate: "2026-10-01",
        paymentDate: null,
        filed: false,
      },
    ],
  });

  console.log("Seeding transaction 3 (org buyer, NRI seller with approved Form 13 LDC)...");
  await seedTransaction(admin, {
    orgId,
    projectId,
    buyerId: buyer3Id,
    createdBy: developerId,
    propertyAddress: "Skyline Heights, Tower 1, Whitefield, Bengaluru",
    unitNumber: "T1-1201",
    propertyValue: 18_000_000,
    buyerName: "Priya Nair",
    buyerPan: "PRINN3456O",
    buyerAddress: "Flat 4, 12 Baker Street, London, UK",
    sellerName: "Arjun Iyer",
    sellerPan: "ARJIY7890N",
    sellerResidentialStatus: "nri",
    sellerAddress: "88 Orchard Towers, Singapore",
    ldc: {
      status: "approved",
      certificateNumber: "LDC/2026/00789",
      certifiedRate: 10,
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      notes: "Approved by AO for FY 2026-27 — certified rate overrides standard NRI computation.",
    },
    milestones: [
      {
        description: "Booking amount",
        amount: 1_800_000,
        dueDate: "2026-06-01",
        paymentDate: "2026-06-05",
        filed: true,
        challanNumber: "CH141-000789",
        acknowledgmentNumber: "AK1410055667",
        uploadChallanText:
          "Demo challan receipt — Form 141, booking amount installment (NRI seller, LDC-certified rate). Not a real government document.",
      },
      {
        description: "Remaining balance",
        amount: 16_200_000,
        dueDate: "2026-12-01",
        paymentDate: null,
        filed: false,
      },
    ],
  });

  console.log("\nDone. Demo logins (password for all: " + DEMO_PASSWORD + "):");
  console.log("  developer_admin: demo.developer@example.com");
  console.log("  buyer (standalone): demo.buyer1@example.com");
  console.log("  buyer (org, resident seller): demo.buyer2@example.com");
  console.log("  buyer (org, NRI seller + LDC): demo.buyer3@example.com");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
