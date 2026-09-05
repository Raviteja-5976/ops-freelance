"use client";

import React, { useEffect, useState } from "react";
import { Milestone } from "@/types/database";
import { formatDate } from "@/lib/formatters";

interface TheCurrentProps {
  milestones: Milestone[];
  compact?: boolean; // if true, shows only current + next (like on Overview)
  latestUpdate?: string;
  updateDate?: string;
}

export function TheCurrent({
  milestones,
  compact = false,
  latestUpdate,
  updateDate,
}: TheCurrentProps) {
  const [hasDrawn, setHasDrawn] = useState(true);

  useEffect(() => {
    // Animate once per session
    if (typeof window !== "undefined") {
      const drawn = sessionStorage.getItem("riverbed_rail_drawn");
      if (!drawn) {
        setHasDrawn(false);
        const timer = setTimeout(() => {
          setHasDrawn(true);
          sessionStorage.setItem("riverbed_rail_drawn", "true");
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // Sort by position
  const sorted = [...milestones].sort((a, b) => a.position - b.position);

  // If compact, identify current milestone and next milestone
  let displayMilestones = sorted;
  if (compact) {
    const currentIdx = sorted.findIndex((m) => m.status === "in_progress");
    if (currentIdx !== -1) {
      displayMilestones = sorted.slice(currentIdx, currentIdx + 2);
    } else {
      // If no in_progress, pick first upcoming or last completed
      const nextIdx = sorted.findIndex((m) => m.status === "upcoming");
      displayMilestones = nextIdx !== -1 ? sorted.slice(nextIdx, nextIdx + 2) : sorted.slice(0, 2);
    }
  }

  return (
    <div className="relative pl-7 my-6">
      <ol className="relative list-none m-0 p-0" role="list">
        {displayMilestones.map((m, idx) => {
          const isCompleted = m.status === "completed";
          const isCurrent = m.status === "in_progress";
          const isSkipped = m.status === "skipped";
          const isLast = idx === displayMilestones.length - 1;

          // Format date range
          let dateStr = "";
          if (m.start_date && m.end_date) {
            dateStr = `${formatDate(m.start_date, "short")} – ${formatDate(m.end_date, "short")}`;
          } else if (m.end_date) {
            dateStr = formatDate(m.end_date, "short");
          } else if (m.start_date) {
            dateStr = `From ${formatDate(m.start_date, "short")}`;
          }

          return (
            <li
              key={m.id}
              className={`relative ${!isLast ? "pb-8" : "pb-2"}`}
              aria-current={isCurrent ? "step" : undefined}
            >
              {/* The Vertical Rail */}
              {!isLast && (
                <div
                  className="absolute left-[-21px] top-3 bottom-0 w-[2px]"
                  style={{
                    backgroundColor: isCompleted ? "var(--river-700)" : "var(--ink-100)",
                    transition: hasDrawn ? "none" : "background-color 700ms var(--ease)",
                  }}
                />
              )}

              {/* The Node */}
              <div
                className="absolute left-[-28px] top-1 flex items-center justify-center"
                style={{ width: "16px", height: "16px" }}
              >
                {isCompleted && (
                  // Completed node ◉: 11px circle, river-700 fill, 3px surface inner ring
                  <div className="w-[11px] height-[11px] rounded-full bg-river-700 ring-[3px] ring-surface" />
                )}

                {isCurrent && (
                  // Current node ◈: 13px circle, river-500 fill, 6px river-100 halo, 2px surface ring
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-[25px] h-[25px] rounded-full bg-river-100/70 animate-pulse" />
                    <div className="w-[13px] h-[13px] rounded-full bg-river-500 ring-2 ring-surface z-10" />
                  </div>
                )}

                {!isCompleted && !isCurrent && !isSkipped && (
                  // Upcoming node ○: 10px circle, surface fill, 1.5px ink-300 border
                  <div className="w-[10px] h-[10px] rounded-full bg-surface border-[1.5px] border-ink-300" />
                )}

                {isSkipped && (
                  // Skipped: 10px circle, ink-100 fill, no border
                  <div className="w-[10px] h-[10px] rounded-full bg-ink-100" />
                )}
              </div>

              {/* Content */}
              <div className="flex flex-col">
                <div className="flex items-baseline justify-between gap-4">
                  <span
                    className={`text-[16px] leading-[1.3] font-sans ${
                      isCurrent
                        ? "font-semibold text-ink-950"
                        : isSkipped
                        ? "line-through text-ink-400"
                        : "text-ink-800"
                    }`}
                  >
                    {m.title}
                  </span>
                  {dateStr && (
                    <span className="text-[13px] text-ink-500 tabular-nums whitespace-nowrap">
                      {dateStr}
                    </span>
                  )}
                </div>

                {/* Description or Latest Update */}
                {isCurrent && (latestUpdate || m.description) && (
                  <div className="mt-2.5 text-[15px] leading-relaxed text-ink-800 font-serif border-l-2 border-river-300 pl-3 py-0.5">
                    {latestUpdate || m.description}
                    {updateDate && (
                      <span className="block mt-1 text-[12px] font-sans text-ink-500">
                        {updateDate}
                      </span>
                    )}
                  </div>
                )}

                {!isCurrent && m.description && !compact && (
                  <p className="mt-1 text-[14px] text-ink-600 font-sans">{m.description}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
