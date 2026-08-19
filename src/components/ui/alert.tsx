import { clsx } from "@/lib/utils";

const toneClasses = {
  error: "bg-red-50 text-red-800 border-red-200",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  info: "bg-blue-50 text-blue-800 border-blue-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
} as const;

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: keyof typeof toneClasses;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={clsx("rounded-md border px-3 py-2 text-sm", toneClasses[tone], className)}
    >
      {children}
    </div>
  );
}
