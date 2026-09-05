"use client";

import React from "react";
import Link from "next/link";
import { formatMoney, formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { useData } from "@/components/providers/DataProvider";

export default function AdminDashboardPage() {
  const { clients, projects, payments, invoices, updates, callRequests, loading, error } = useData();

  const pendingCalls = callRequests.filter((c) => c.status === "pending");
  const draftInvoices = invoices.filter((i) => i.status === "draft");
  const overduePayments = payments.filter((p) => p.status === "due");

  const hasNeedsYou = pendingCalls.length > 0 || draftInvoices.length > 0 || overduePayments.length > 0;

  const activeProjects = projects.filter((p) => p.status !== "archived");

  // Money calculations
  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((acc, p) => acc + p.amount, 0);

  const totalOutstanding = projects.reduce((acc, proj) => {
    const paid = payments
      .filter((p) => p.project_id === proj.id && p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0);
    return acc + Math.max(0, proj.total_value - paid);
  }, 0);

  const totalOverdue = overduePayments.reduce((acc, p) => acc + p.amount, 0);

  // Check days since last update
  const getDaysSinceLastUpdate = (projectId: string) => {
    const published = updates.filter(
      (u) => u.project_id === projectId && u.published_at
    );
    if (published.length === 0) return 14;
    const latest = new Date(published[0].published_at!).getTime();
    const diffDays = Math.floor((Date.now() - latest) / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="text-[13px] text-ink-500 font-sans">Loading dashboard...</div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl p-4 bg-brick-100/80 border border-brick-600 rounded-sm text-[13px] text-brick-900">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      {/* 1. Header with date */}
      <div className="flex items-baseline justify-between border-b border-ink-100 pb-4">
        <div>
          <h1 className="font-serif text-[32px] text-ink-950 font-normal leading-none">
            Today
          </h1>
          <p className="text-[14px] text-ink-500 font-sans mt-1">
            Studio operational dashboard & priority actions.
          </p>
        </div>
        <div className="font-mono text-[13px] text-ink-600">
          {formatDate(new Date(), "full")}
        </div>
      </div>

      {/* 2. "Needs you" queue (C1 spec) */}
      {hasNeedsYou && (
        <div className="bg-surface border border-ink-100 rounded-md p-5">
          <h2 className="text-[14px] uppercase tracking-wider font-semibold text-ink-500 mb-3">
            Needs you
          </h2>
          <div className="flex flex-col divide-y divide-ink-100/70 text-[14px]">
            {pendingCalls.length > 0 && (
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-ink-950">
                  ├ <strong>{pendingCalls.length}</strong> call requests pending
                </span>
                <Link href="/admin/calls">
                  <Button variant="secondary" size="sm">Review</Button>
                </Link>
              </div>
            )}
            {draftInvoices.length > 0 && (
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-ink-950">
                  ├ <strong>{draftInvoices.length}</strong> invoices in draft
                </span>
                <Link href="/admin/invoices">
                  <Button variant="secondary" size="sm">Open</Button>
                </Link>
              </div>
            )}
            {overduePayments.length > 0 && (
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-ink-950">
                  └ <strong>{overduePayments.length}</strong> payment awaiting receipt{clients.length > 0 ? ` — ${clients[0].name}` : ""},{" "}
                  {formatMoney(totalOverdue)}
                </span>
                <Link href="/admin/payments">
                  <Button variant="secondary" size="sm">Chase</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Active Projects List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-ink-950 font-sans">
              Active projects
            </h2>
            <span className="text-[12px] font-mono bg-ink-100 px-2 py-0.5 rounded-full text-ink-700">
              {activeProjects.length}
            </span>
          </div>
          <Link href="/admin/projects/new">
            <Button variant="secondary" size="sm">+ New project</Button>
          </Link>
        </div>

        <div className="bg-surface border border-ink-100 rounded-md divide-y divide-ink-100 overflow-hidden">
          {activeProjects.length === 0 && (
            <div className="p-8 text-center text-[13px] text-ink-500">
              No active projects yet.
            </div>
          )}
          {activeProjects.map((proj) => {
            const daysSince = getDaysSinceLastUpdate(proj.id);
            const isStale = daysSince >= 10;
            const paid = payments
              .filter((p) => p.project_id === proj.id && p.status === "paid")
              .reduce((sum, p) => sum + p.amount, 0);
            const remaining = Math.max(0, proj.total_value - paid);

            return (
              <div
                key={proj.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-ink-50/40 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink-950 text-[15px]">
                      {proj.client?.name || "Client"}
                    </span>
                    <span className="text-ink-400">·</span>
                    <span className="text-ink-800 text-[15px]">{proj.name}</span>
                    <StatusPill status={proj.status} />
                  </div>
                  <div className="text-[13px] text-ink-600 mt-1 flex flex-wrap items-center gap-3">
                    <span>{proj.progress}% complete</span>
                    <span>·</span>
                    <span>Due {formatDate(proj.expected_delivery, "table")}</span>
                    <span>·</span>
                    <span className="font-mono tabular-nums">
                      {remaining > 0 ? `${formatMoney(remaining)} outstanding` : "Paid in full"}
                    </span>
                  </div>
                  <div className="mt-2 text-[12px] flex items-center gap-1.5">
                    <span className="text-ink-500">Last update {daysSince} days ago</span>
                    {isStale && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-xs bg-amber-100 text-amber-800 font-medium">
                        ⚠ Client update due
                      </span>
                    )}
                  </div>
                </div>

                <Link href={`/admin/projects/${proj.id}`}>
                  <Button variant="secondary" size="sm">
                    Open editor
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Financial Summary Metrics */}
      <div className="bg-surface border border-ink-100 rounded-md p-6">
        <h2 className="text-[13px] uppercase tracking-wider font-semibold text-ink-500 mb-4">
          Money
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <span className="text-[12px] text-ink-500 block">Outstanding</span>
            <span className="font-mono text-[22px] font-semibold text-ink-950 tabular-nums">
              {formatMoney(totalOutstanding)}
            </span>
          </div>
          <div>
            <span className="text-[12px] text-ink-500 block">Overdue</span>
            <span className="font-mono text-[22px] font-semibold text-brick-800 tabular-nums">
              {formatMoney(totalOverdue)}
            </span>
          </div>
          <div>
            <span className="text-[12px] text-ink-500 block">Paid this FY (2026-27)</span>
            <span className="font-mono text-[22px] font-semibold text-river-700 tabular-nums">
              {formatMoney(totalPaid)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
