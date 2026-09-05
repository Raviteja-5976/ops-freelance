import React from "react";

export type PillStatus =
  | "paid"
  | "completed"
  | "confirmed"
  | "in_progress"
  | "current"
  | "development"
  | "scheduled"
  | "upcoming"
  | "due"
  | "pending"
  | "reschedule_proposed"
  | "overdue"
  | "declined"
  | "failed"
  | "draft"
  | "archived"
  | "void";

interface StatusPillProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusPill({ status, label, className = "" }: StatusPillProps) {
  const norm = status.toLowerCase().replace(/\s+/g, "_");

  let colorClasses = "bg-ink-50 text-ink-600";
  let hasDot = false;
  let defaultLabel = label || status;

  if (["paid", "completed", "confirmed"].includes(norm)) {
    colorClasses = "bg-river-50 text-river-800";
  } else if (["in_progress", "current", "development"].includes(norm)) {
    colorClasses = "bg-river-100 text-river-950";
    hasDot = true;
    if (!label) defaultLabel = norm === "development" ? "In development" : "In progress";
  } else if (["scheduled", "upcoming"].includes(norm)) {
    colorClasses = "bg-ink-50 text-ink-600";
  } else if (["due", "pending", "reschedule_proposed"].includes(norm)) {
    colorClasses = "bg-amber-100 text-amber-800";
    if (!label && norm === "reschedule_proposed") defaultLabel = "New time proposed";
  } else if (["overdue", "declined", "failed"].includes(norm)) {
    colorClasses = "bg-brick-100 text-brick-800";
  } else if (["draft", "archived", "void"].includes(norm)) {
    colorClasses = "bg-transparent border border-ink-200 text-ink-500";
  }

  // Capitalize properly if no custom label provided
  if (!label) {
    defaultLabel = defaultLabel
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full text-[12px] font-medium leading-none whitespace-nowrap ${colorClasses} ${className}`}
    >
      {hasDot && (
        <span className="w-[5px] h-[5px] rounded-full bg-river-500 inline-block animate-pulse" />
      )}
      <span>{defaultLabel}</span>
    </span>
  );
}
