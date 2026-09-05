import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-sans font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-river-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed";

  const sizeClasses = {
    sm: "h-[30px] px-3 text-[13px] rounded-xs",
    md: "h-[38px] px-4 text-[14px] rounded-sm",
    lg: "h-[44px] px-5 text-[15px] rounded-sm",
  }[size];

  let variantClasses = "";
  if (disabled) {
    variantClasses = "bg-ink-100 text-ink-300 border border-transparent";
  } else {
    switch (variant) {
      case "primary":
        variantClasses = "bg-river-700 text-white hover:bg-river-800 active:bg-river-950";
        break;
      case "secondary":
        variantClasses = "bg-surface border border-ink-200 text-ink-950 hover:bg-ink-50 active:bg-ink-100";
        break;
      case "quiet":
        variantClasses = "bg-transparent text-ink-600 hover:bg-ink-50 hover:text-ink-950";
        break;
      case "danger":
        variantClasses = "bg-surface border border-brick-600 text-brick-800 hover:bg-brick-100 active:bg-brick-100";
        break;
    }
  }

  return (
    <button
      disabled={disabled || loading}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-current"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
