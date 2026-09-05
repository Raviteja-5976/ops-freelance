"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export interface EmailSuggestion {
  email: string;
  name?: string | null;
  /** Shown as a small tag, e.g. the person's role. */
  tag?: string | null;
  /** Already attached to this record — offered, but flagged and not selectable. */
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Scores how well a suggestion matches what has been typed.
 *
 * Ranked so the most predictable match wins: an exact address first, then
 * addresses starting with the query, then the local part or the person's name,
 * and finally anything merely containing it. Returns -1 for no match.
 */
function score(suggestion: EmailSuggestion, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const email = suggestion.email.toLowerCase();
  const local = email.split("@")[0];
  const domain = email.split("@")[1] || "";
  const name = (suggestion.name || "").toLowerCase();

  if (email === q) return 100;
  if (email.startsWith(q)) return 90;
  if (local.startsWith(q)) return 80;
  if (name.startsWith(q)) return 70;
  // Match a domain only once enough has been typed to be meaningful.
  if (q.length >= 2 && domain.startsWith(q)) return 60;
  if (name.includes(q)) return 50;
  if (email.includes(q)) return 40;
  return -1;
}

/**
 * Email field with type-ahead over people who already have an account.
 *
 * Free text is always allowed — the whole point of the field is that you can
 * also add somebody who has never signed in.
 */
export function EmailCombobox({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  helperText,
  required,
  emptyHint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: EmailSuggestion[];
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    return suggestions
      .map((s) => ({ s, rank: score(s, value) }))
      .filter((m) => m.rank >= 0)
      // Rank first, then alphabetically so the order never jitters between
      // keystrokes for equally good matches.
      .sort((a, b) => b.rank - a.rank || a.s.email.localeCompare(b.s.email))
      .slice(0, 8)
      .map((m) => m.s);
  }, [suggestions, value]);

  useEffect(() => setHighlight(0), [value]);

  // Close when focus or a click lands outside the field.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const selectable = matches.filter((m) => !m.disabled);

  const commit = (s: EmailSuggestion) => {
    if (s.disabled) return;
    onChange(s.email);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || matches.length === 0) {
      if (e.key === "ArrowDown") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      // Only intercept Enter when a usable suggestion is highlighted, so the
      // form still submits normally for a freshly typed address.
      const target = matches[highlight];
      if (target && !target.disabled) {
        e.preventDefault();
        commit(target);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const inputId = `combo-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="flex flex-col gap-1 w-full relative" ref={wrapRef}>
      <label
        htmlFor={inputId}
        className="text-[13px] font-medium text-ink-600 font-sans select-none"
      >
        {label}
      </label>

      <input
        id={inputId}
        type="email"
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${inputId}-list`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-[38px] px-3 bg-surface border border-ink-200 rounded-sm text-[14px] text-ink-950 placeholder:text-ink-400 font-sans transition-colors focus-visible:outline-none focus-visible:border-river-500 focus-visible:ring-1 focus-visible:ring-river-500"
      />

      {open && (matches.length > 0 || (value.trim() && suggestions.length > 0)) && (
        <div
          id={`${inputId}-list`}
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 z-30 bg-surface border border-ink-200 rounded-sm shadow-overlay max-h-56 overflow-y-auto py-1"
        >
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-[13px] text-ink-500">
              No existing account matches &ldquo;{value.trim()}&rdquo;.{" "}
              {emptyHint || "They will be invited by email."}
            </p>
          ) : (
            matches.map((s, i) => (
              <button
                key={s.email}
                type="button"
                role="option"
                aria-selected={i === highlight}
                aria-disabled={s.disabled || undefined}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => commit(s)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 ${
                  s.disabled
                    ? "opacity-55 cursor-not-allowed"
                    : i === highlight
                    ? "bg-ink-50"
                    : "hover:bg-ink-50"
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-[13px] text-ink-950 truncate">{s.email}</span>
                  {s.name && (
                    <span className="block text-[12px] text-ink-500 truncate">{s.name}</span>
                  )}
                </span>
                {(s.disabled || s.tag) && (
                  <span
                    className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-sans ${
                      s.disabled
                        ? "bg-ink-100 text-ink-500"
                        : "bg-river-50 text-river-800"
                    }`}
                  >
                    {s.disabled ? s.disabledReason || "Already added" : s.tag}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {helperText && (
        <p className="text-[12px] text-ink-500 font-sans mt-0.5">{helperText}</p>
      )}
    </div>
  );
}
