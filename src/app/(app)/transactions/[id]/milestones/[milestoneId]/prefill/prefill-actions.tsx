"use client";

import { Button } from "@/components/ui/button";

export type PrefillSection = { section: string; rows: Array<{ label: string; value: string }> };

export function PrefillActions({
  sections,
  fileNamePrefix,
}: {
  sections: PrefillSection[];
  fileNamePrefix: string;
}) {
  function downloadCsv() {
    const lines = ["Section,Field,Value"];
    for (const s of sections) {
      for (const row of s.rows) {
        lines.push([s.section, row.label, row.value].map(csvEscape).join(","));
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileNamePrefix}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="no-print flex flex-wrap gap-2">
      <Button onClick={() => window.print()}>Print / Save as PDF</Button>
      <Button variant="secondary" onClick={downloadCsv}>
        Download CSV
      </Button>
    </div>
  );
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
