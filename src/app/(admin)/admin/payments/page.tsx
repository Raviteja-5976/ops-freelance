"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatMoney, formatDate } from "@/lib/formatters";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useData } from "@/components/providers/DataProvider";

export default function AdminPaymentsPage() {
  const { showToast } = useToast();
  const { payments, clients, loading, error, refresh } = useData();
  const [filter, setFilter] = useState("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  const filtered = payments.filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  /**
   * Confirms money that arrived outside Razorpay.
   *
   * Goes through the settlement route rather than writing `paid` directly, so
   * the draft invoice is generated and both emails go out — exactly as they do
   * for a gateway payment.
   */
  const handleVerifyPayment = async (paymentId: string) => {
    setSavingId(paymentId);
    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, method: "bank_transfer" }),
      });
      const body = await res.json();

      if (!res.ok || !body.success) {
        showToast(body.error || "Could not verify that payment", "error");
        return;
      }

      await refresh();
      showToast(
        body.backfilled
          ? "Draft invoice generated · ready to issue"
          : body.alreadyPaid
          ? "That payment was already verified and invoiced"
          : body.invoiceDrafted
          ? "Payment verified · draft invoice ready to issue"
          : "Payment verified"
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not verify that payment", "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between pb-2 border-b border-ink-100">
        <div>
          <h1 className="font-serif text-[28px] text-ink-950 font-normal">
            Payments
          </h1>
          <p className="text-[13px] text-ink-500 font-sans">
            Payment tracking, receivables, and reconciliation across all clients.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-ink-100 pb-2 text-[13px]">
        {["all", "due", "paid", "scheduled"].map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`px-3 py-1 rounded-sm capitalize font-medium transition-colors ${
              filter === st
                ? "bg-ink-100 text-ink-950 font-semibold"
                : "text-ink-600 hover:text-ink-950"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-ink-100 rounded-md overflow-x-auto">
        <table className="w-full text-left text-[13px] font-sans">
          <thead>
            <tr className="bg-ink-50/70 border-b border-ink-100 text-ink-500 uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-4 font-medium">Due Date</th>
              <th className="py-2.5 px-4 font-medium">Client</th>
              <th className="py-2.5 px-4 font-medium">Label</th>
              <th className="py-2.5 px-4 font-medium text-right">Amount</th>
              <th className="py-2.5 px-4 font-medium">Status</th>
              <th className="py-2.5 px-4 font-medium">Method / Ref</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-ink-500">
                  Loading payments...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-brick-800">
                  {error}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-ink-500">
                  No payments recorded yet.
                </td>
              </tr>
            ) : null}
            {filtered.map((p) => {
              const client = clients.find((c) => c.id === p.client_id);

              return (
                <tr key={p.id} className="hover:bg-ink-50/50 transition-colors h-[40px]">
                  <td className="py-2.5 px-4 font-mono tabular-nums text-ink-600">
                    {p.due_date ? formatDate(p.due_date, "table") : "On delivery"}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-ink-950">{client?.name}</td>
                  <td className="py-2.5 px-4 text-ink-800">{p.label}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums text-ink-950">
                    {formatMoney(p.amount)}
                  </td>
                  <td className="py-2.5 px-4">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="py-2.5 px-4 text-ink-600 font-mono text-[12px]">
                    {p.method ? `${p.method.toUpperCase()}` : "—"}{" "}
                    {p.reference && `(${p.reference})`}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {p.status !== "paid" ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={savingId === p.id}
                        onClick={() => handleVerifyPayment(p.id)}
                      >
                        Verify payment
                      </Button>
                    ) : !p.invoice_id ? (
                      // Paid, but with no invoice — either settled before
                      // invoices were generated automatically, or the draft
                      // failed. Offer to produce it now.
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[12px] font-mono text-river-700">
                          {formatDate(p.paid_at, "table")}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={savingId === p.id}
                          onClick={() => handleVerifyPayment(p.id)}
                        >
                          Generate invoice
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[12px] font-mono text-river-700">
                        {formatDate(p.paid_at, "table")}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
