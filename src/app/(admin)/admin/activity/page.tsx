"use client";

import React, { useState } from "react";
import { formatDate } from "@/lib/formatters";
import { useData } from "@/components/providers/DataProvider";

export default function AdminActivityPage() {
  const { activityLogs: logs, clients, loading } = useData();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="pb-2 border-b border-ink-100">
        <h1 className="font-serif text-[28px] text-ink-950 font-normal">
          Activity log
        </h1>
        <p className="text-[13px] text-ink-500 font-sans">
          Immutable audit trail of all project events, updates, payments, and client actions.
        </p>
      </div>

      <div className="bg-surface border border-ink-100 rounded-md divide-y divide-ink-100 font-sans">
        {loading && (
          <div className="p-8 text-center text-[13px] text-ink-500">
            Loading activity...
          </div>
        )}
        {!loading && logs.length === 0 && (
          <div className="p-8 text-center text-[13px] text-ink-500">
            No activity recorded yet.
          </div>
        )}
        {logs.map((log) => {
          const client = clients.find((c) => c.id === log.client_id);
          const isExpanded = expandedId === log.id;

          return (
            <div key={log.id} className="p-4 hover:bg-ink-50/40 transition-colors">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleExpand(log.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-river-500" />
                  <div>
                    <span className="font-medium text-ink-950 text-[14px]">
                      {log.actor_role === "admin" ? "Studio Admin" : "Client User"}
                    </span>{" "}
                    <span className="text-ink-600 text-[13px]">{log.action}</span>{" "}
                    <span className="font-mono text-ink-800 text-[12px] bg-ink-100 px-1.5 py-0.5 rounded-xs">
                      {log.entity_type}
                    </span>
                    {client && (
                      <span className="text-ink-500 text-[12px] ml-2">({client.name})</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-[12px] text-ink-500">
                    {formatDate(log.created_at, "datetime")}
                  </span>
                  <span className="text-ink-400 text-[12px]">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>

              {isExpanded && log.diff && (
                <div className="mt-3 p-3 bg-ink-50 rounded-sm border border-ink-100 font-mono text-[12px] text-ink-800 overflow-x-auto">
                  <pre>{JSON.stringify(log.diff, null, 2)}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
