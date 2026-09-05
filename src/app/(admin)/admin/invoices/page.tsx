"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatMoney, formatDate } from "@/lib/formatters";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { useData } from "@/components/providers/DataProvider";

export default function AdminInvoicesPage() {
  const { invoices: allInvoices, clients, loading } = useData();
  const [filter, setFilter] = useState("all");

  const invoices = allInvoices.filter((inv) => {
    if (filter === "all") return true;
    return inv.status === filter;
  });

  const totalAmount = invoices.reduce((acc, i) => acc + i.total, 0);
  const totalPaid = invoices.reduce((acc, i) => acc + i.amount_paid, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-[28px] text-ink-950 font-normal">
            Invoices
          </h1>
          <p className="text-[13px] text-ink-500 font-sans">
            Tax invoices, GST compliance records, and payment reconciliation.
          </p>
        </div>
        <Link href="/admin/invoices/new">
          <Button variant="primary" size="md">
            + New invoice
          </Button>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-ink-100 pb-2 text-[13px]">
        {["all", "draft", "issued", "paid", "void"].map((st) => (
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

      {/* Invoices Table */}
      <div className="bg-surface border border-ink-100 rounded-md overflow-x-auto">
        <table className="w-full text-left text-[13px] font-sans">
          <thead>
            <tr className="bg-ink-50/70 border-b border-ink-100 text-ink-500 uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-4 font-medium">Invoice No</th>
              <th className="py-2.5 px-4 font-medium">Client</th>
              <th className="py-2.5 px-4 font-medium">Status</th>
              <th className="py-2.5 px-4 font-medium">Date</th>
              <th className="py-2.5 px-4 font-medium">Due</th>
              <th className="py-2.5 px-4 font-medium text-right">Total</th>
              <th className="py-2.5 px-4 font-medium text-right">Paid</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-ink-50/50 transition-colors h-[40px]">
                <td className="py-2.5 px-4 font-mono font-medium text-ink-950">
                  <Link href={`/admin/invoices/${inv.id}`} className="hover:text-river-700">
                    {inv.number || "Draft"}
                  </Link>
                </td>
                <td className="py-2.5 px-4 text-ink-700">
                  {clients.find((c) => c.id === inv.client_id)?.name || "Client"}
                </td>
                <td className="py-2.5 px-4">
                  <StatusPill status={inv.status} />
                </td>
                <td className="py-2.5 px-4 font-mono tabular-nums text-ink-600">
                  {formatDate(inv.issue_date, "table")}
                </td>
                <td className="py-2.5 px-4 font-mono tabular-nums text-ink-600">
                  {formatDate(inv.due_date, "table")}
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-ink-950">
                  {formatMoney(inv.total)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-700">
                  {formatMoney(inv.amount_paid)}
                </td>
                <td className="py-2.5 px-4 text-right">
                  <Link href={`/admin/invoices/${inv.id}`}>
                    <Button variant="quiet" size="sm">
                      Open
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-ink-50/40 border-t border-ink-200 font-semibold text-[13px] text-ink-950">
              <td colSpan={5} className="py-3 px-4">
                Total ({invoices.length} invoices)
              </td>
              <td className="py-3 px-4 text-right font-mono tabular-nums">
                {formatMoney(totalAmount)}
              </td>
              <td className="py-3 px-4 text-right font-mono tabular-nums">
                {formatMoney(totalPaid)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
