"use client";

import React from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { formatMoney, formatDate, numberToWords, invoiceTaxSummary } from "@/lib/formatters";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { useData } from "@/components/providers/DataProvider";
import { defaultSettings } from "@/lib/data-store";
import { useAuth } from "@/components/providers/AuthProvider";

export default function InvoiceViewerPage() {
  const params = useParams();
  const invoiceId = params.invoiceId as string;
  const { user, loading: authLoading } = useAuth();
  const { myClient, invoices, settings, loading: dataLoading } = useData();
  const loading = authLoading || dataLoading;

  const client = myClient;
  const invoice = invoices.find((inv) => inv.id === invoiceId);

  if (loading) {
    return (
      <div className="py-16 text-center text-ink-500 font-sans text-sm">
        Loading invoice...
      </div>
    );
  }

  // Invoice must exist, must not be draft for clients, and must belong to the user's client company
  if (!invoice || !client || invoice.client_id !== client.id) {
    notFound();
  }

  const tax = invoiceTaxSummary(invoice);

  // Draft invoices return not found message for client
  if (invoice.status === "draft") {
    return (
      <div className="py-12 text-center">
        <h1 className="text-[20px] font-serif font-medium text-ink-950">
          Invoice not found
        </h1>
        <p className="text-ink-600 mt-2 text-[14px]">
          This document is not yet published or does not exist.
        </p>
        <Link href="/payments" className="inline-block mt-4">
          <Button variant="secondary" size="md">
            Return to payments
          </Button>
        </Link>
      </div>
    );
  }

  const billTo = invoice.bill_to_snapshot || {
    name: client.legal_name || client.name,
    gstin: client.gstin,
    address_line1: client.address_line1,
    city: client.city,
    state: client.state,
    state_code: client.state_code,
    postal_code: client.postal_code,
  };

  const seller = invoice.seller_snapshot || {
    legal_name: defaultSettings.legal_name,
    gstin: defaultSettings.gstin,
    pan: defaultSettings.pan,
    address: defaultSettings.address,
    email: defaultSettings.email,
  };

  const isVoided = invoice.status === "void";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Action Bar (hidden on print) */}
      <div className="no-print flex items-center justify-between pb-4 border-b border-ink-100">
        <Link
          href="/payments"
          className="text-[13px] text-ink-600 hover:text-ink-950 flex items-center gap-1.5 font-sans"
        >
          ← Back to payments
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handlePrint}>
            Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* Void Banner */}
      {isVoided && (
        <div className="bg-brick-100 border border-brick-600 text-brick-800 p-4 rounded-sm text-[14px]">
          <strong>Voided:</strong> This invoice was marked void on{" "}
          {formatDate(invoice.voided_at, "full")}. Reason: {invoice.void_reason || "Replaced by updated invoice"}.
        </div>
      )}

      {/* The Invoice Document Sheet (680px) */}
      <div className="bg-surface border border-ink-100 rounded-md p-6 sm:p-10 shadow-none font-sans print:border-none print:p-0">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-8 border-b border-ink-100">
          <div>
            <h1 className="font-serif text-[28px] font-semibold text-ink-950 tracking-tight leading-none">
              Tax Invoice
            </h1>
            <p className="font-mono text-[14px] text-ink-600 mt-2">
              {invoice.number}
            </p>
            <div className="mt-3">
              <StatusPill status={invoice.status} />
            </div>
          </div>

          {/* Seller Block */}
          <div className="text-right sm:max-w-[280px] text-[13px] text-ink-600 leading-relaxed">
            <p className="font-semibold text-ink-950 text-[14px]">
              {seller.legal_name || "OpenRiverStack Studio"}
            </p>
            {seller.address && (
              <p>
                {seller.address.line1}, {seller.address.city}, {seller.address.state} - {seller.address.postal_code}
              </p>
            )}
            <p className="mt-1">
              <strong className="text-ink-800">GSTIN:</strong> {seller.gstin}
            </p>
            <p>
              <strong className="text-ink-800">PAN:</strong> {seller.pan}
            </p>
          </div>
        </div>

        {/* Bill To & Invoice Meta Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-ink-100 text-[13px]">
          <div>
            <span className="uppercase tracking-wider text-[11px] font-semibold text-ink-500 block mb-1.5">
              Billed To
            </span>
            <p className="font-semibold text-ink-950 text-[14px]">
              {billTo.name}
            </p>
            {billTo.address_line1 && (
              <p className="text-ink-600 mt-0.5">
                {billTo.address_line1}, {billTo.city}, {billTo.state} - {billTo.postal_code}
              </p>
            )}
            {billTo.gstin && (
              <p className="text-ink-600 mt-1">
                <strong className="text-ink-800">GSTIN:</strong> {billTo.gstin}
              </p>
            )}
            <p className="text-ink-600 mt-0.5">
              <strong className="text-ink-800">Place of Supply:</strong> {invoice.place_of_supply || "Telangana (36)"}
            </p>
          </div>

          <div className="sm:text-right flex flex-col justify-end gap-1.5 text-ink-700">
            <div>
              <span className="text-ink-500">Invoice Date: </span>
              <span className="font-medium text-ink-950">
                {formatDate(invoice.issue_date, "full")}
              </span>
            </div>
            <div>
              <span className="text-ink-500">Payment Due: </span>
              <span className="font-medium text-ink-950">
                {formatDate(invoice.due_date, "full")}
              </span>
            </div>
          </div>
        </div>

        {/* Item Table */}
        <div className="py-6 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink-100 text-ink-500 uppercase tracking-wider text-[11px]">
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 font-medium">HSN/SAC</th>
                <th className="py-2 font-medium text-right">Qty</th>
                <th className="py-2 font-medium text-right">Rate</th>
                <th className="py-2 font-medium text-right">Tax</th>
                <th className="py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100/60">
              {invoice.items?.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 font-medium text-ink-950">{item.description}</td>
                  <td className="py-3 font-mono text-ink-600">{item.hsn_sac || "998314"}</td>
                  <td className="py-3 text-right font-mono tabular-nums">{item.quantity}</td>
                  <td className="py-3 text-right font-mono tabular-nums">{formatMoney(item.unit_price)}</td>
                  <td className="py-3 text-right font-mono tabular-nums">
                    {item.tax_rate_bps / 100}%
                  </td>
                  <td className="py-3 text-right font-mono font-medium tabular-nums text-ink-950">
                    {formatMoney(item.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tax Breakdown & Totals */}
        <div className="border-t border-ink-100 pt-4 flex flex-col items-end text-[13px] text-ink-700 gap-2">
          <div className="w-full sm:w-64 flex justify-between">
            <span>Subtotal</span>
            <span className="font-mono tabular-nums">{formatMoney(invoice.subtotal)}</span>
          </div>

          {tax.hasGst &&
            (!invoice.is_interstate ? (
              <>
                <div className="w-full sm:w-64 flex justify-between">
                  <span>CGST ({tax.halfRate}%)</span>
                  <span className="font-mono tabular-nums">{formatMoney(invoice.cgst_total)}</span>
                </div>
                <div className="w-full sm:w-64 flex justify-between">
                  <span>SGST ({tax.halfRate}%)</span>
                  <span className="font-mono tabular-nums">{formatMoney(invoice.sgst_total)}</span>
                </div>
              </>
            ) : (
              <div className="w-full sm:w-64 flex justify-between">
                <span>IGST ({tax.fullRate}%)</span>
                <span className="font-mono tabular-nums">{formatMoney(invoice.igst_total)}</span>
              </div>
            ))}

          <div className="w-full sm:w-64 flex justify-between pt-2 border-t border-ink-100 text-[16px] font-semibold text-ink-950">
            <span>Total</span>
            <span className="font-mono tabular-nums">{formatMoney(invoice.total)}</span>
          </div>
        </div>

        {/* Amount in words */}
        <div className="mt-6 pt-4 border-t border-ink-100 text-[13px] text-ink-600 italic">
          <strong>Amount in words:</strong> {numberToWords(invoice.total / 100)}
        </div>

        {/* Terms and notes */}
        {(invoice.notes || invoice.terms) && (
          <div className="mt-6 pt-4 border-t border-ink-100 text-[12px] text-ink-500 leading-relaxed">
            {invoice.notes && <p className="mb-1">{invoice.notes}</p>}
            {invoice.terms && <p>{invoice.terms}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
