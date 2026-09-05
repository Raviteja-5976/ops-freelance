import React from "react";

interface PanelProps {
  title?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padding?: "normal" | "dense" | "none";
}

export function Panel({
  title,
  action,
  footer,
  children,
  className = "",
  padding = "normal",
}: PanelProps) {
  const paddingClasses = {
    normal: "p-6", // 24px
    dense: "p-4", // 16px
    none: "p-0",
  }[padding];

  return (
    <div className={`bg-surface border border-ink-100 rounded-md ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
          {title && (
            <h3 className="text-[17px] font-semibold text-ink-950 font-sans tracking-tight">
              {title}
            </h3>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={paddingClasses}>{children}</div>
      {footer && (
        <div className="px-6 py-3.5 bg-ink-50/50 border-t border-ink-100 rounded-b-md flex items-center justify-between text-[13px] text-ink-600">
          {footer}
        </div>
      )}
    </div>
  );
}
