"use client";

import { useActionState, useRef, useState } from "react";
import type { Database, DocumentType } from "@/types/database.types";
import { createClient } from "@/lib/supabase/client";
import { recordDocument, deleteDocument } from "@/lib/documents/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type MilestoneRow = Database["public"]["Views"]["v_milestones_with_status"]["Row"];
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

/**
 * Keeps the storage object key predictable. RLS scopes access by the
 * transactionId path segment we control, not by this filename, so this
 * isn't itself an access-control boundary — it just avoids '/' in a raw
 * filename creating confusing nested "folders" under the transaction, and
 * caps length.
 */
function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return cleaned.slice(-100);
}

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  challan_receipt: "Challan receipt",
  form16b_or_141: "Form 16B / 141",
  pan_card: "PAN card",
  id_proof: "ID proof",
  lower_deduction_certificate: "Lower deduction certificate",
  agreement: "Agreement",
  other: "Other",
};

export function DocumentsPanel({
  transactionId,
  milestones,
  documents,
}: {
  transactionId: string;
  milestones: MilestoneRow[];
  documents: DocumentRow[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Document vault</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Challan receipts, Form 16B/141, and ID proofs — stored privately, visible only to this
        transaction&apos;s buyer and org admins.
      </p>

      <UploadForm transactionId={transactionId} milestones={milestones} />

      <ul className="mt-4 divide-y divide-slate-100">
        {documents.length === 0 ? (
          <li className="py-3 text-sm text-slate-500">No documents uploaded yet.</li>
        ) : (
          documents.map((doc) => (
            <DocumentItem key={doc.id} document={doc} transactionId={transactionId} />
          ))
        )}
      </ul>
    </div>
  );
}

function UploadForm({
  transactionId,
  milestones,
}: {
  transactionId: string;
  milestones: MilestoneRow[];
}) {
  const [state, formAction] = useActionState(recordDocument, null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocumentType>("challan_receipt");
  const [milestoneId, setMilestoneId] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadError(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError("Choose a file first");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const storagePath = `${transactionId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, { contentType: file.type || undefined });
      if (uploadErr) {
        setUploadError(uploadErr.message);
        return;
      }

      const formData = new FormData();
      formData.set("transactionId", transactionId);
      if (milestoneId) formData.set("milestoneId", milestoneId);
      formData.set("docType", docType);
      formData.set("storagePath", storagePath);
      formData.set("fileName", file.name);
      formData.set("mimeType", file.type);
      formData.set("sizeBytes", String(file.size));
      formAction(formData);

      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-2">
      {state?.error ? (
        <Alert tone="error" className="w-full">
          {state.error}
        </Alert>
      ) : null}
      {uploadError ? (
        <Alert tone="error" className="w-full">
          {uploadError}
        </Alert>
      ) : null}

      <div>
        <label className="block text-xs text-slate-500">Document type</label>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value as DocumentType)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {milestones.length > 0 ? (
        <div>
          <label className="block text-xs text-slate-500">Milestone (optional)</label>
          <select
            value={milestoneId}
            onChange={(e) => setMilestoneId(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Transaction-level</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.sequence_no}. {m.description}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className="block text-xs text-slate-500">File</label>
        <input
          ref={fileInputRef}
          type="file"
          className="text-sm text-slate-700 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
        />
      </div>

      <Button type="submit" disabled={uploading}>
        {uploading ? "Uploading…" : "Upload"}
      </Button>
    </form>
  );
}

function DocumentItem({
  document,
  transactionId,
}: {
  document: DocumentRow;
  transactionId: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [, deleteAction, deleting] = useActionState(deleteDocument, null);

  async function handleView() {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(document.storage_path, 60);
    if (data?.signedUrl) setUrl(data.signedUrl);
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <div>
        <p className="font-medium text-slate-900">{document.file_name}</p>
        <p className="text-xs text-slate-500">{DOC_TYPE_LABELS[document.doc_type]}</p>
      </div>
      <div className="flex items-center gap-2">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
          >
            Open
          </a>
        ) : (
          <Button type="button" variant="ghost" onClick={handleView} className="text-xs">
            View
          </Button>
        )}
        <form action={deleteAction}>
          <input type="hidden" name="documentId" value={document.id} />
          <input type="hidden" name="transactionId" value={transactionId} />
          <Button type="submit" variant="ghost" disabled={deleting} className="text-xs text-red-600 hover:bg-red-50">
            Delete
          </Button>
        </form>
      </div>
    </li>
  );
}
