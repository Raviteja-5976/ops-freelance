"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/formatters";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useData } from "@/components/providers/DataProvider";
import { createInvoiceRecord } from "@/lib/db";
import { defaultSettings } from "@/lib/data-store";

interface LineItemDraft {
  id: string;
  description: string;
  hsn_sac: string;
  quantity: number;
  rateRupees: number;
  taxRateBps: number;
}

export default function InvoiceBuilderPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { clients, projects, settings, loading, refresh } = useData();
  const effective = settings || defaultSettings;

  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Defaults to the studio setting (Settings -> Invoicing), overridable for a
  // single invoice. A zero default rate means the studio is not GST registered.
  const [gstEnabled, setGstEnabled] = useState(false);

  const [items, setItems] = useState<LineItemDraft[]>([
    {
      id: "item-1",
      description: "",
      hsn_sac: "998314",
      quantity: 1,
      rateRupees: 0,
      taxRateBps: 0,
    },
  ]);

  // Pick sensible defaults once the workspace has loaded.
  useEffect(() => {
    if (!clientId && clients.length > 0) setClientId(clients[0].id);
  }, [clients, clientId]);

  useEffect(() => {
    setNotes(effective.invoice_notes || "");
    setTerms(effective.invoice_terms || "");
  }, [effective.invoice_notes, effective.invoice_terms]);

  useEffect(() => {
    setGstEnabled(effective.default_tax_rate_bps > 0);
  }, [effective.default_tax_rate_bps]);

  // Every line follows the studio's configured rate; switching GST off zeroes
  // it so the stored invoice carries no tax at all.
  const activeRateBps = gstEnabled ? effective.default_tax_rate_bps || 1800 : 0;

  useEffect(() => {
    setItems((prev) =>
      prev.every((it) => it.taxRateBps === activeRateBps)
        ? prev
        : prev.map((it) => ({ ...it, taxRateBps: activeRateBps }))
    );
  }, [activeRateBps]);

  // Default the due date to the studio's standard net-15 terms.
  useEffect(() => {
    if (dueDate) return;
    const d = new Date(issueDate);
    d.setDate(d.getDate() + 15);
    setDueDate(d.toISOString().split("T")[0]);
  }, [issueDate, dueDate]);

  const clientProjects = projects.filter((p) => p.client_id === clientId);

  // Keep the project selection consistent with the chosen client.
  useEffect(() => {
    if (projectId && clientProjects.some((p) => p.id === projectId)) return;
    setProjectId(clientProjects[0]?.id || "");
  }, [clientId, clientProjects, projectId]);

  const selectedClient = clients.find((c) => c.id === clientId);

  // The studio is registered in Telangana (state code 36); anything else is an
  // inter-state supply and attracts IGST instead of CGST + SGST.
  const sellerStateCode = (effective.address?.state_code as string) || "36";
  const isInterstate = Boolean(
    gstEnabled &&
      selectedClient?.state_code &&
      selectedClient.state_code !== sellerStateCode
  );

  // Recalculate totals in paise
  const subtotalPaise = items.reduce(
    (acc, it) => acc + Math.round(it.quantity * it.rateRupees * 100),
    0
  );

  const taxPaise = items.reduce(
    (acc, it) =>
      acc + Math.round((it.quantity * it.rateRupees * 100 * it.taxRateBps) / 10000),
    0
  );

  const cgstPaise = isInterstate ? 0 : Math.round(taxPaise / 2);
  const sgstPaise = isInterstate ? 0 : taxPaise - Math.round(taxPaise / 2);
  const igstPaise = isInterstate ? taxPaise : 0;
  const totalPaise = subtotalPaise + cgstPaise + sgstPaise + igstPaise;

  /** Indian financial year label, e.g. "2026-27" for any date from 1 April. */
  const financialYear = (dateStr: string) => {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const startYear = d.getMonth() >= 3 ? y : y - 1;
    return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
  };

  const buildPayload = () => {
    if (!selectedClient) throw new Error("Pick a client for this invoice.");
    if (items.every((it) => !it.description.trim())) {
      throw new Error("Add at least one line item with a description.");
    }

    const lineItems = items.map((it, idx) => {
      const taxable = Math.round(it.quantity * it.rateRupees * 100);
      const tax = Math.round((taxable * it.taxRateBps) / 10000);
      const cgst = isInterstate ? 0 : Math.round(tax / 2);
      const sgst = isInterstate ? 0 : tax - Math.round(tax / 2);
      const igst = isInterstate ? tax : 0;
      return {
        description: it.description.trim(),
        hsn_sac: it.hsn_sac || null,
        quantity: it.quantity,
        unit_price: Math.round(it.rateRupees * 100),
        discount: 0,
        tax_rate_bps: it.taxRateBps,
        taxable_value: taxable,
        cgst,
        sgst,
        igst,
        line_total: taxable + cgst + sgst + igst,
        position: idx + 1,
      };
    });

    return {
      invoice: {
        client_id: clientId,
        project_id: projectId || null,
        series: effective.invoice_series || "ORS",
        fy: financialYear(issueDate),
        issue_date: issueDate,
        due_date: dueDate || null,
        currency: "INR",
        place_of_supply: `${selectedClient.state || ""} (${selectedClient.state_code || sellerStateCode})`,
        is_interstate: isInterstate,
        subtotal: subtotalPaise,
        discount_total: 0,
        cgst_total: cgstPaise,
        sgst_total: sgstPaise,
        igst_total: igstPaise,
        total: totalPaise,
        amount_paid: 0,
        notes: notes.trim() || null,
        terms: terms.trim() || null,
        bill_to_snapshot: {
          name: selectedClient.legal_name || selectedClient.name,
          gstin: selectedClient.gstin,
          address_line1: selectedClient.address_line1,
          city: selectedClient.city,
          state: selectedClient.state,
          state_code: selectedClient.state_code,
        },
        seller_snapshot: {
          legal_name: effective.legal_name,
          gstin: effective.gstin,
          pan: effective.pan,
          address: effective.address,
        },
      },
      items: lineItems,
    };
  };

  const save = async (issue: boolean) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      const created = await createInvoiceRecord({ ...payload, issue });

      if (issue && selectedClient?.email) {
        // Best effort: a failed email must not undo an issued invoice.
        fetch("/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "invoice_issued",
            payload: {
              recipientEmail: selectedClient.email,
              clientName: selectedClient.name,
              invoiceNumber: created.number,
              totalFormatted: `\u20b9${(totalPaise / 100).toLocaleString("en-IN")}`,
              dueDate,
              invoiceId: created.id,
            },
          }),
        }).catch(() => {});
      }

      await refresh();
      showToast(issue ? `Invoice ${created.number} issued` : "Invoice saved as draft");
      router.push("/admin/invoices");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save invoice.");
      setSaving(false);
    }
  };

  const handleSaveDraft = () => void save(false);
  const handleIssueInvoice = () => void save(true);

  if (loading) {
    return <div className="text-[13px] text-ink-500 font-sans">Loading invoice builder...</div>;
  }

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: `draft-item-${Date.now()}`,
        description: "",
        hsn_sac: "998314",
        quantity: 1,
        rateRupees: 10000,
        taxRateBps: activeRateBps,
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter((it) => it.id !== id));
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <Link
          href="/admin/invoices"
          className="text-[13px] text-ink-600 hover:text-ink-950 flex items-center gap-1 font-sans mb-2"
        >
          ← Back to invoices
        </Link>
        <h1 className="font-serif text-[28px] text-ink-950 font-normal">
          New invoice
        </h1>
        <p className="text-[13px] text-ink-500 font-sans">
          GST-compliant tax invoice builder with automatic intra/interstate tax derivation.
        </p>
      </div>

      <div className="bg-surface border border-ink-100 rounded-md p-6 flex flex-col gap-6 font-sans">
        {/* Client & Project Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-ink-600">Client</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-[38px] px-3 bg-surface border border-ink-200 rounded-sm text-[14px] text-ink-950"
            >
              {clients.length === 0 && <option value="">No clients yet</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.city}, {c.state})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-ink-600">Project (optional)</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-[38px] px-3 bg-surface border border-ink-200 rounded-sm text-[14px] text-ink-950"
            >
              <option value="">No project</option>
              {clientProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dates & GST Jurisdiction */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Issue Date"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
          <Input
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-ink-600">Place of Supply</label>
            <div className="h-[38px] px-3 bg-ink-50 border border-ink-100 rounded-sm text-[13px] text-ink-800 flex items-center">
              {selectedClient?.state || "—"} ({selectedClient?.state_code || sellerStateCode})
            </div>
            <span className="text-[11px] text-ink-500">
              {!gstEnabled
                ? "No GST on this invoice"
                : isInterstate
                ? `Interstate supply: IGST ${activeRateBps / 100}% applied`
                : `Intrastate supply: CGST ${activeRateBps / 200}% + SGST ${activeRateBps / 200}% applied`}
            </span>
          </div>
        </div>

        {/* GST switch for this one invoice */}
        <div className="border-t border-ink-100 pt-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[14px] font-medium text-ink-950">Charge GST</p>
            <p className="text-[13px] text-ink-500 mt-0.5 leading-snug">
              {gstEnabled
                ? `Adds ${activeRateBps / 100}% to every line on this invoice.`
                : "This invoice is raised at the contract value with no tax lines."}{" "}
              The default comes from Settings &rarr; Invoicing.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={gstEnabled}
            onClick={() => setGstEnabled(!gstEnabled)}
            className={`shrink-0 w-[46px] h-[26px] rounded-full border transition-colors relative ${
              gstEnabled ? "bg-river-700 border-river-700" : "bg-ink-100 border-ink-200"
            }`}
          >
            <span
              className={`absolute top-[2px] w-[20px] h-[20px] rounded-full bg-surface shadow-sm transition-all ${
                gstEnabled ? "left-[23px]" : "left-[2px]"
              }`}
            />
          </button>
        </div>

        {/* Line Items Builder */}
        <div className="border-t border-ink-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[14px] font-semibold text-ink-950">Line items</h3>
            <Button type="button" variant="secondary" size="sm" onClick={handleAddItem}>
              + Add item
            </Button>
          </div>

          <div className="divide-y divide-ink-100">
            {items.map((item, idx) => (
              <div key={item.id} className="py-3 grid grid-cols-12 gap-3 items-center text-[13px]">
                <div className="col-span-12 sm:col-span-5">
                  <input
                    type="text"
                    required
                    placeholder="Description of service / deliverable"
                    value={item.description}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[idx].description = e.target.value;
                      setItems(updated);
                    }}
                    className="w-full h-[36px] px-2.5 bg-surface border border-ink-200 rounded-xs text-[13px] text-ink-950"
                  />
                </div>

                <div className="col-span-4 sm:col-span-2">
                  <input
                    type="text"
                    placeholder="HSN/SAC"
                    value={item.hsn_sac}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[idx].hsn_sac = e.target.value;
                      setItems(updated);
                    }}
                    className="w-full h-[36px] px-2 bg-surface border border-ink-200 rounded-xs text-[12px] font-mono text-ink-700"
                  />
                </div>

                <div className="col-span-3 sm:col-span-2">
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[idx].quantity = Number(e.target.value);
                      setItems(updated);
                    }}
                    className="w-full h-[36px] px-2 bg-surface border border-ink-200 rounded-xs text-[13px] font-mono text-right"
                  />
                </div>

                <div className="col-span-4 sm:col-span-2">
                  <input
                    type="number"
                    min={0}
                    value={item.rateRupees}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[idx].rateRupees = Number(e.target.value);
                      setItems(updated);
                    }}
                    className="w-full h-[36px] px-2 bg-surface border border-ink-200 rounded-xs text-[13px] font-mono text-right"
                  />
                </div>

                <div className="col-span-1 text-right">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-ink-400 hover:text-brick-800 text-[14px]"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals Summary */}
        <div className="border-t border-ink-100 pt-4 flex flex-col items-end text-[13px] gap-1.5">
          <div className="w-64 flex justify-between">
            <span className="text-ink-600">Subtotal:</span>
            <span className="font-mono tabular-nums">{formatMoney(subtotalPaise)}</span>
          </div>

          {gstEnabled &&
            (!isInterstate ? (
              <>
                <div className="w-64 flex justify-between">
                  <span className="text-ink-600">CGST ({activeRateBps / 200}%):</span>
                  <span className="font-mono tabular-nums">{formatMoney(cgstPaise)}</span>
                </div>
                <div className="w-64 flex justify-between">
                  <span className="text-ink-600">SGST ({activeRateBps / 200}%):</span>
                  <span className="font-mono tabular-nums">{formatMoney(sgstPaise)}</span>
                </div>
              </>
            ) : (
              <div className="w-64 flex justify-between">
                <span className="text-ink-600">IGST ({activeRateBps / 100}%):</span>
                <span className="font-mono tabular-nums">{formatMoney(igstPaise)}</span>
              </div>
            ))}

          <div className="w-64 flex justify-between pt-2 border-t border-ink-100 text-[16px] font-semibold text-ink-950">
            <span>Total:</span>
            <span className="font-mono tabular-nums">{formatMoney(totalPaise)}</span>
          </div>
        </div>

        {/* Notes & Terms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-ink-100 pt-4">
          <Textarea
            label="Notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Textarea
            label="Terms"
            rows={2}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
          />
        </div>

        {/* Bottom Actions */}
        <div className="pt-4 border-t border-ink-100 flex items-center justify-between">
          {error && (
            <div className="w-full p-3 bg-brick-100/80 border border-brick-600 rounded-sm text-[13px] text-brick-900">
              {error}
            </div>
          )}
          <Button type="button" variant="secondary" size="md" loading={saving} disabled={!clientId} onClick={handleSaveDraft}>
            Save as draft
          </Button>
          <Button type="button" variant="primary" size="md" loading={saving} disabled={!clientId} onClick={handleIssueInvoice}>
            Issue invoice · Assign number
          </Button>
        </div>
      </div>
    </div>
  );
}
