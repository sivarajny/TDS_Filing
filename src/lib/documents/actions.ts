"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";

export type DocumentActionState = { error?: string } | null;

const recordDocumentSchema = z.object({
  transactionId: z.string().uuid(),
  milestoneId: z.string().uuid().optional(),
  docType: z.enum([
    "challan_receipt",
    "form16b_or_141",
    "pan_card",
    "id_proof",
    "lower_deduction_certificate",
    "agreement",
    "other",
  ]),
  storagePath: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.coerce.number().nonnegative().optional(),
});

/**
 * Records metadata for a file the browser already uploaded directly to
 * Supabase Storage (see documents-panel.tsx) — Server Actions have a small
 * body-size limit, so the upload itself bypasses this action entirely and
 * only the resulting path is recorded here.
 */
export async function recordDocument(
  _prevState: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const profile = await requireProfile();
  const parsed = recordDocumentSchema.safeParse({
    transactionId: formData.get("transactionId"),
    milestoneId: formData.get("milestoneId") || undefined,
    docType: formData.get("docType"),
    storagePath: formData.get("storagePath"),
    fileName: formData.get("fileName"),
    mimeType: formData.get("mimeType") || undefined,
    sizeBytes: formData.get("sizeBytes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { transactionId, milestoneId, docType, storagePath, fileName, mimeType, sizeBytes } =
    parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("documents").insert({
    transaction_id: transactionId,
    milestone_id: milestoneId ?? null,
    uploaded_by: profile.id,
    doc_type: docType,
    storage_path: storagePath,
    file_name: fileName,
    mime_type: mimeType ?? null,
    size_bytes: sizeBytes ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/transactions/${transactionId}`);
  return null;
}

const deleteDocumentSchema = z.object({
  documentId: z.string().uuid(),
  transactionId: z.string().uuid(),
  storagePath: z.string().min(1),
});

export async function deleteDocument(
  _prevState: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const parsed = deleteDocumentSchema.safeParse({
    documentId: formData.get("documentId"),
    transactionId: formData.get("transactionId"),
    storagePath: formData.get("storagePath"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { documentId, transactionId, storagePath } = parsed.data;

  const supabase = await createClient();
  const { error: storageError } = await supabase.storage.from("documents").remove([storagePath]);
  if (storageError) return { error: storageError.message };

  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (error) return { error: error.message };

  revalidatePath(`/transactions/${transactionId}`);
  return null;
}
