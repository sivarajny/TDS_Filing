import { Alert } from "@/components/ui/alert";

export function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  return (
    <Alert tone="warning">
      {compact ? (
        <>Not tax advice — figures are a calculation aid. This tool does not file on your behalf.</>
      ) : (
        <>
          <strong>This is a compliance tracker, not tax advice.</strong> TDS figures are
          calculated from a configurable rules table for guidance only — verify them with a
          qualified CA before filing. This tool never files, logs in, or submits anything on the
          Income Tax e-filing portal; it prepares the numbers so you can file it yourself.
        </>
      )}
    </Alert>
  );
}
