"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter, notFound } from "next/navigation";
import { formatMoney, formatDate, numberToWords, invoiceTaxSummary } from "@/lib/formatters";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useData } from "@/components/providers/DataProvider";
import { createInvoiceRecord, voidInvoiceRecord } from "@/lib/db";
import { defaultSettings } from "@/lib/data-store";

export default function AdminInvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.invoiceId as string;
  const router = useRouter();
  const { showToast } = useToast();
  const { invoices, clients, settings, loading, error, refresh } = useData();

  const invoice = invoices.find((inv) => inv.id === invoiceId);

  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const client = clients.find((c) => c.id === invoice?.client_id);
  const effective = settings || defaultSettings;

  // Snapshots are taken when the invoice is issued so a later edit to the
  // client or the studio never rewrites history. Fall back to live records only
  // while a draft has no snapshot yet.
  const billTo = invoice?.bill_to_snapshot || {
    name: client?.legal_name || client?.name,
    gstin: client?.gstin,
    address_line1: client?.address_line1,
    city: client?.city,
    state: client?.state,
    state_code: client?.state_code,
  };

  const seller = invoice?.seller_snapshot || {
    legal_name: effective.legal_name,
    gstin: effective.gstin,
    pan: effective.pan,
    address: effective.address,
    email: effective.email,
  };

  const handleVoidInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || busy) return;
    setBusy(true);
    try {
      await voidInvoiceRecord(invoice.id, voidReason.trim());
      await refresh();
      setVoidModalOpen(false);
      showToast("Invoice marked as void");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not void invoice");
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async () => {
    if (!invoice || busy) return;
    setBusy(true);
    try {
      const {
        id,
        number,
        status,
        issued_at,
        voided_at,
        void_reason,
        amount_paid,
        created_at,
        updated_at,
        items,
        client: _client,
        project: _project,
        ...rest
      } = invoice;

      const created = await createInvoiceRecord({
        invoice: { ...rest, amount_paid: 0 },
        items: (items || []).map(({ id: _itemId, invoice_id, ...item }) => item),
        issue: false,
      });

      await refresh();
      showToast("Duplicated as draft");
      router.push(`/admin/invoices/${created.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not duplicate invoice");
      setBusy(false);
    }
  };

  /**
   * Publishes a draft to the client.
   *
   * Auto-generated invoices land as drafts, and the client-side RLS policy
   * hides drafts entirely — so this button is the confirmation step. Issuing
   * reserves the invoice number and emails the client.
   */
  const handleIssueInvoice = async () => {
    if (!invoice || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/invoices/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const body = await res.json();

      if (!res.ok || !body.success) {
        showToast(body.error || "Could not issue invoice", "error");
        return;
      }

      await refresh();
      showToast(
        body.emailed > 0
          ? `Invoice ${body.number} issued and emailed to ${body.emailed} recipient${body.emailed === 1 ? "" : "s"}`
          : `Invoice ${body.number} issued, but no email could be sent`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not issue invoice", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleResendInvoice = async () => {
    if (!invoice) return;
    if (!client?.email) {
      showToast("This client has no email address on file", "error");
      return;
    }
    setIsResending(true);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "invoice_issued",
          payload: {
            recipientEmail: client?.email || "",
            clientName: billTo.name || client?.name || "Client",
            invoiceNumber: invoice.number || "Invoice",
            totalFormatted: formatMoney(invoice.total, invoice.currency),
            dueDate: formatDate(invoice.due_date, "table"),
            invoiceId: invoice.id,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Invoice dispatched via email to ${client?.email || "client"}`);
      } else {
        showToast(data.error || "Failed to dispatch email", "error");
      }
    } catch {
      showToast("Network error resending invoice", "error");
    } finally {
      setIsResending(false);
    }
  };

  if (loading) {
    return <div className="text-[13px] text-ink-500 font-sans">Loading invoice...</div>;
  }

  if (error) {
    return (
      <div className="max-w-2xl p-4 bg-brick-100/80 border border-brick-600 rounded-sm text-[13px] text-brick-900">
        {error}
      </div>
    );
  }

  if (!invoice) notFound();

  const tax = invoiceTaxSummary(invoice);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ink-100">
        <div>
          <Link
            href="/admin/invoices"
            className="text-[13px] text-ink-600 hover:text-ink-950 flex items-center gap-1 font-sans"
          >
            ← Back to invoices
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="font-serif text-[28px] text-ink-950 font-normal">
              {invoice.number || "Draft Invoice"}
            </h1>
            <StatusPill status={invoice.status} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {invoice.status === "draft" && (
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              onClick={handleIssueInvoice}
            >
              Issue to client
            </Button>
          )}
          {invoice.status === "issued" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResendInvoice}
              disabled={isResending}
            >
              {isResending ? "Sending..." : "Resend to client"}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            Print / PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDuplicate}>
            Duplicate as draft
          </Button>
          {invoice.status !== "void" && (
            <Button variant="danger" size="sm" onClick={() => setVoidModalOpen(true)}>
              Void
            </Button>
          )}
        </div>
      </div>

      {invoice.status === "draft" && (
        <div className="bg-river-50 border border-river-700/30 text-river-900 p-4 rounded-sm text-[14px] leading-snug">
          <strong>Draft — the client cannot see this invoice.</strong>
          <p className="mt-1 text-[13px]">
            {invoice.amount_paid > 0
              ? "It was prepared automatically when their payment cleared. Check the figures, then press Issue to client — they have been told to expect it within 24 hours of payment verification."
              : "Check the figures, then press Issue to client. Issuing reserves the next invoice number and emails it to them."}
          </p>
        </div>
      )}

      {invoice.status === "void" && (
        <div className="bg-brick-100 border border-brick-600 text-brick-800 p-4 rounded-sm text-[14px]">
          <strong>Voided on {formatDate(invoice.voided_at, "full")}:</strong>{" "}
          {invoice.void_reason || "Voided by admin"}
        </div>
      )}

      {/* Invoice Document Preview Sheet */}
      <div className="bg-surface border border-ink-100 rounded-md p-8 sm:p-10 text-[13px] font-sans">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-ink-100">
          <div>
            <h2 className="font-serif text-[26px] font-semibold text-ink-950 tracking-tight">
              Tax Invoice
            </h2>
            <p className="font-mono text-ink-600 mt-1">{invoice.number || "DRAFT"}</p>
          </div>
          <div className="text-right text-ink-600">
            <p className="font-semibold text-ink-950">{seller.legal_name}</p>
            <p>GSTIN: {seller.gstin}</p>
            <p>PAN: {seller.pan}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-ink-100">
          <div>
            <span className="text-[11px] uppercase font-semibold text-ink-500 block mb-1">
              Billed To
            </span>
            <p className="font-semibold text-ink-950">{billTo.name}</p>
            <p className="text-ink-600">{billTo.address_line1}, {billTo.city}</p>
            <p className="text-ink-600">GSTIN: {billTo.gstin}</p>
          </div>
          <div className="sm:text-right flex flex-col justify-end gap-1">
            <p><span className="text-ink-500">Date:</span> {formatDate(invoice.issue_date, "full")}</p>
            <p><span className="text-ink-500">Due:</span> {formatDate(invoice.due_date, "full")}</p>
          </div>
        </div>

        {/* Line Items */}
        <div className="py-6 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink-100 text-ink-500 uppercase text-[11px]">
                <th className="py-2">Description</th>
                <th className="py-2">HSN/SAC</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {invoice.items?.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 font-medium text-ink-950">{item.description}</td>
                  <td className="py-2.5 font-mono text-ink-600">{item.hsn_sac || "998314"}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">{item.quantity}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">{formatMoney(item.unit_price)}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-ink-950">
                    {formatMoney(item.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-ink-100 pt-4 flex flex-col items-end gap-1.5">
          <div className="w-64 flex justify-between">
            <span className="text-ink-600">Subtotal:</span>
            <span className="font-mono tabular-nums">{formatMoney(invoice.subtotal)}</span>
          </div>
          {tax.hasGst &&
            (!invoice.is_interstate ? (
              <>
                <div className="w-64 flex justify-between">
                  <span className="text-ink-600">CGST ({tax.halfRate}%):</span>
                  <span className="font-mono tabular-nums">{formatMoney(invoice.cgst_total)}</span>
                </div>
                <div className="w-64 flex justify-between">
                  <span className="text-ink-600">SGST ({tax.halfRate}%):</span>
                  <span className="font-mono tabular-nums">{formatMoney(invoice.sgst_total)}</span>
                </div>
              </>
            ) : (
              <div className="w-64 flex justify-between">
                <span className="text-ink-600">IGST ({tax.fullRate}%):</span>
                <span className="font-mono tabular-nums">{formatMoney(invoice.igst_total)}</span>
              </div>
            ))}
          <div className="w-64 flex justify-between pt-2 border-t border-ink-100 text-[16px] font-semibold text-ink-950">
            <span>Total:</span>
            <span className="font-mono tabular-nums">{formatMoney(invoice.total)}</span>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-ink-100 text-ink-600 italic">
          <strong>Amount in words:</strong> {numberToWords(invoice.total / 100)}
        </div>
      </div>

      {/* Void Confirmation Modal */}
      <Modal
        isOpen={voidModalOpen}
        onClose={() => setVoidModalOpen(false)}
        title="Void Invoice"
      >
        <form onSubmit={handleVoidInvoice} className="flex flex-col gap-4 text-[14px]">
          <p className="text-ink-700">
            Voiding an invoice marks it permanently canceled but preserves its number for GST audit compliance.
          </p>
          <Textarea
            label="Reason for voiding"
            required
            rows={3}
            placeholder="e.g. Scope adjusted prior to payment, reissuing with revised amounts"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />
          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="quiet" size="md" onClick={() => setVoidModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" size="md">
              Confirm void
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
