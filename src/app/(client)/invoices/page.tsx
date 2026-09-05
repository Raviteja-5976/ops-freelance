"use client";

import React from "react";
import Link from "next/link";
import { formatMoney, formatDate, INVOICE_SLA_NOTE } from "@/lib/formatters";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { useData } from "@/components/providers/DataProvider";

export default function ClientInvoicesPage() {
  const { myClient, myProjects, invoices: allInvoices, payments, loading } = useData();

  if (loading) {
    return (
      <div className="py-16 text-center text-ink-500 font-sans text-sm">
        Loading invoices...
      </div>
    );
  }

  if (!myClient) {
    return (
      <div className="py-12 flex flex-col items-center text-center max-w-md mx-auto">
        <h1 className="font-serif text-[28px] text-ink-950 font-normal">
          No invoices
        </h1>
        <p className="mt-3 text-[14px] text-ink-600 font-sans leading-relaxed">
          Your account is not linked to a client workspace yet. Tax invoices will
          be listed here once it is.
        </p>
      </div>
    );
  }

  // Drafts are invisible at the database level until the studio issues them,
  // but filter defensively and drop invoices for projects not shared yet.
  const visibleProjectIds = new Set(myProjects.map((p) => p.id));
  const invoices = allInvoices
    .filter(
      (inv) =>
        inv.client_id === myClient.id &&
        inv.status !== "draft" &&
        (!inv.project_id || visibleProjectIds.has(inv.project_id))
    )
    .sort((a, b) =>
      (b.issue_date || b.created_at).localeCompare(a.issue_date || a.created_at)
    );

  // Money that has been received but whose invoice has not been issued yet.
  const awaitingInvoice = payments.filter(
    (p) =>
      p.status === "paid" &&
      !invoices.some((inv) => inv.id === p.invoice_id) &&
      visibleProjectIds.has(p.project_id)
  );

  const totalBilled = invoices
    .filter((inv) => inv.status !== "void")
    .reduce((acc, inv) => acc + inv.total, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-[32px] text-ink-950 font-normal">Invoices</h1>
        <p className="mt-1 text-[15px] text-ink-600 font-sans">
          Tax invoices issued to {myClient.name}.
        </p>
      </div>

      {awaitingInvoice.length > 0 && (
        <div className="bg-river-50 border border-river-700/30 rounded-md p-4 text-[13px] text-river-900 leading-snug">
          <strong>
            Payment received for {awaitingInvoice.map((p) => p.label).join(", ")}.
          </strong>
          <p className="mt-1">{INVOICE_SLA_NOTE} It will appear here once issued.</p>
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="bg-surface border border-dashed border-ink-200 rounded-md p-10 text-center">
          <h2 className="font-serif text-[20px] text-ink-950 font-medium">
            No invoices yet
          </h2>
          <p className="mt-2 text-[14px] text-ink-600 font-sans leading-relaxed max-w-sm mx-auto">
            Tax invoices appear here once the studio has issued them. {INVOICE_SLA_NOTE}
          </p>
          <Link href="/payments" className="inline-block mt-5">
            <Button variant="secondary" size="md">
              View payment schedule
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="border-t border-ink-100 divide-y divide-ink-100">
            {invoices.map((inv) => {
              const isVoid = inv.status === "void";
              return (
                <div
                  key={inv.id}
                  className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <StatusPill status={inv.status} className="mt-0.5" />
                    <div>
                      <h3 className="text-[16px] font-medium text-ink-950 font-sans font-mono">
                        {inv.number || "Invoice"}
                      </h3>
                      <div className="text-[13px] text-ink-500 font-sans mt-0.5 flex flex-wrap items-center gap-2">
                        <span>Issued {formatDate(inv.issue_date, "full")}</span>
                        {inv.due_date && !isVoid && (
                          <span>· Due {formatDate(inv.due_date, "short")}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 pl-14 sm:pl-0">
                    <span
                      className={`money text-[16px] font-medium tabular-nums ${
                        isVoid ? "text-ink-400 line-through" : "text-ink-950"
                      }`}
                    >
                      {formatMoney(inv.total, inv.currency)}
                    </span>
                    <Link href={`/invoices/${inv.id}`}>
                      <Button variant="secondary" size="sm">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-baseline justify-between border-t border-ink-100 pt-4 text-[14px]">
            <span className="text-ink-600 font-sans">Total invoiced</span>
            <span className="money font-medium text-ink-950 tabular-nums">
              {formatMoney(totalBilled)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
