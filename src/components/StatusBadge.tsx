import type { SubmissionStatus } from "@/lib/types";

const STYLES: Record<SubmissionStatus | "none", { label: string; className: string }> = {
  none: { label: "Not submitted", className: "bg-stone-200 text-stone-600" },
  pending: { label: "Pending review", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Try again", className: "bg-red-100 text-red-800" },
};

export function StatusBadge({ status }: { status: SubmissionStatus | "none" }) {
  const s = STYLES[status];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.className}`}>
      {s.label}
    </span>
  );
}
