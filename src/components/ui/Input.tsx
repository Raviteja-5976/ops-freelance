import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, id, className = "", ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium text-ink-600 font-sans select-none"
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`h-[38px] px-3 bg-surface border rounded-sm text-[14px] text-ink-950 placeholder:text-ink-400 font-sans transition-colors focus-visible:outline-none focus-visible:border-river-500 focus-visible:ring-1 focus-visible:ring-river-500 disabled:bg-ink-50 disabled:text-ink-400 ${
            error ? "border-brick-600 focus-visible:ring-brick-600" : "border-ink-200"
          } ${className}`}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-[12px] text-brick-800 font-sans mt-0.5">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-[12px] text-ink-500 font-sans mt-0.5">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helperText, error, id, className = "", ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium text-ink-600 font-sans select-none"
          >
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          className={`p-3 bg-surface border rounded-sm text-[14px] text-ink-950 placeholder:text-ink-400 font-sans transition-colors focus-visible:outline-none focus-visible:border-river-500 focus-visible:ring-1 focus-visible:ring-river-500 disabled:bg-ink-50 disabled:text-ink-400 min-h-[90px] ${
            error ? "border-brick-600 focus-visible:ring-brick-600" : "border-ink-200"
          } ${className}`}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-[12px] text-brick-800 font-sans mt-0.5">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-[12px] text-ink-500 font-sans mt-0.5">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
