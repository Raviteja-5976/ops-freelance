"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatMoney, formatDate, INVOICE_SLA_HOURS, INVOICE_SLA_NOTE } from "@/lib/formatters";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { useData } from "@/components/providers/DataProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import {
  loadRazorpayCheckout,
  RazorpayHandlerResponse,
} from "@/lib/razorpay-checkout";

export default function PaymentsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const {
    myClient,
    myProjects,
    selectedProject,
    payments: allPayments,
    invoices: allInvoices,
    loading: dataLoading,
  } = useData();
  const loading = authLoading || dataLoading;
  const client = myClient;
  const userProjects = myProjects;
  const project = selectedProject;

  const { showToast } = useToast();
  const { refresh } = useData();
  const [payingId, setPayingId] = useState<string | null>(null);

  /**
   * Opens Razorpay Checkout for one stage.
   *
   * The amount comes from the server, never from this page, and settlement
   * happens server-side after the signature is verified -- a client cannot mark
   * their own instalment paid.
   */
  const payStage = async (stagePaymentId: string) => {
    if (payingId) return;
    setPayingId(stagePaymentId);
    try {
      const orderRes = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: stagePaymentId }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok || !order.success) {
        showToast(order.error || "Could not start the payment", "error");
        setPayingId(null);
        return;
      }

      const loaded = await loadRazorpayCheckout();
      if (!loaded) {
        showToast("Could not reach Razorpay. Check your connection.", "error");
        setPayingId(null);
        return;
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "OpenRiverStack",
        description: order.label,
        prefill: {
          name: profile?.full_name || "",
          email: user?.email || "",
        },
        theme: { color: "#1d4e5f" },
        handler: async (response: RazorpayHandlerResponse) => {
          try {
            const verifyRes = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paymentId: stagePaymentId, ...response }),
            });
            const verified = await verifyRes.json();
            if (verifyRes.ok && verified.success) {
              await refresh();
              showToast(`Payment received — invoice within ${INVOICE_SLA_HOURS}h`);
            } else {
              // The webhook is the backstop if this ever fails.
              showToast(
                verified.error || "Payment taken but not yet confirmed. It will update shortly.",
                "error"
              );
            }
          } finally {
            setPayingId(null);
          }
        },
        modal: { ondismiss: () => setPayingId(null) },
      });

      rzp.on("payment.failed", (resp: { error?: { description?: string } }) => {
        showToast(resp?.error?.description || "Payment failed", "error");
        setPayingId(null);
      });

      rzp.open();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not start the payment", "error");
      setPayingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-ink-500 font-sans text-sm">
        Loading payment schedule...
      </div>
    );
  }

  if (!client || !project) {
    return (
      <div className="py-12 flex flex-col items-center text-center max-w-md mx-auto">
        <h1 className="font-serif text-[28px] text-ink-950 font-normal">
          No payment records
        </h1>
        <p className="mt-3 text-[14px] text-ink-600 font-sans leading-relaxed">
          Your account is not currently assigned to an active client project. Payment milestones and tax invoices will be listed here once assigned.
        </p>
      </div>
    );
  }

  const payments = allPayments.filter((p) => p.project_id === project.id);
  // `inv_client_read` only checks client_id, so an invoice raised against a
  // still-hidden project would otherwise surface here. Keep invoices with no
  // project as well as those for projects they can see.
  const visibleProjectIds = new Set(myProjects.map((p) => p.id));
  const invoices = allInvoices.filter(
    (inv) =>
      inv.client_id === client.id &&
      inv.status !== "draft" &&
      (!inv.project_id || visibleProjectIds.has(inv.project_id))
  );

  const totalValue = project.total_value;
  const paidPayments = payments.filter((p) => p.status === "paid");
  const paidAmount = paidPayments.reduce((acc, p) => acc + p.amount, 0);
  const outstandingAmount = Math.max(0, totalValue - paidAmount);

  // The hero button pays one stage, not an arbitrary lump sum, so the amount
  // always lines up with something the studio actually scheduled.
  // Paid stages whose invoice has not been issued to them yet.
  const awaitingInvoice = payments.filter(
    (p) =>
      p.status === "paid" &&
      !invoices.some((inv) => inv.id === p.invoice_id && inv.status !== "draft")
  );

  const nextDue = payments
    .filter((p) => p.status !== "paid" && p.status !== "cancelled" && p.status !== "refunded")
    .sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return a.position - b.position;
    })[0];

  return (
    <div className="flex flex-col gap-10">
      {/* 1. Header & Hero Amount */}
      <div>
        <h1 className="font-serif text-[32px] text-ink-950 font-normal">
          Payments
        </h1>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
          <div>
            <div className="font-serif text-[48px] sm:text-[56px] text-ink-950 font-normal tracking-tight leading-none">
              {formatMoney(outstandingAmount)}
            </div>
            <p className="mt-2 text-[15px] text-ink-600 font-sans">
              outstanding of {formatMoney(totalValue)}
            </p>
          </div>

          {nextDue && (
            <div className="flex flex-col items-start sm:items-end gap-1">
              <Button
                variant="primary"
                size="lg"
                loading={payingId === nextDue.id}
                onClick={() => payStage(nextDue.id)}
              >
                Pay {formatMoney(nextDue.amount)} now
              </Button>
              <span className="text-[12px] text-ink-500 font-sans">
                {nextDue.label}
                {nextDue.due_date ? ` · due ${formatDate(nextDue.due_date, "short")}` : ""}
              </span>
              <span className="text-[12px] text-ink-500 font-sans sm:text-right max-w-[280px]">
                {INVOICE_SLA_NOTE}
              </span>
            </div>
          )}
        </div>
      </div>

      {awaitingInvoice.length > 0 && (
        <div className="bg-river-50 border border-river-700/30 rounded-md p-4 text-[13px] text-river-900 leading-snug">
          <strong>
            Payment received for{" "}
            {awaitingInvoice.map((p) => p.label).join(", ")}.
          </strong>
          <p className="mt-1">
            {INVOICE_SLA_NOTE} It will appear here and be emailed to you once it
            has been checked.
          </p>
        </div>
      )}

      {/* 2. Payments Schedule & History Table */}
      <div className="border-t border-ink-100 divide-y divide-ink-100">
        {payments.map((p) => {
          const isPaid = p.status === "paid";
          const invoice = invoices.find((inv) => inv.id === p.invoice_id);

          return (
            <div
              key={p.id}
              className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <StatusPill status={p.status} className="mt-0.5" />
                <div>
                  <h3 className="text-[16px] font-medium text-ink-950 font-sans">
                    {p.label}
                  </h3>
                  <div className="text-[13px] text-ink-500 font-sans mt-0.5 flex flex-wrap items-center gap-2">
                    {isPaid ? (
                      <span>
                        {formatDate(p.paid_at, "full")} · {p.method?.toUpperCase()}
                      </span>
                    ) : (
                      <span>Due {p.due_date ? formatDate(p.due_date, "full") : "on delivery"}</span>
                    )}

                    {p.reference && (
                      <span className="font-mono text-ink-400 text-[12px]">
                        (Ref: {p.reference})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-5 pl-14 sm:pl-0">
                <span className="money text-[16px] font-medium text-ink-950 tabular-nums">
                  {formatMoney(p.amount)}
                </span>

                <div className="flex items-center gap-2">
                  {!isPaid && (
                    <Button
                      variant="primary"
                      size="sm"
                      loading={payingId === p.id}
                      onClick={() => payStage(p.id)}
                    >
                      Pay
                    </Button>
                  )}
                  {invoice && invoice.status !== "draft" ? (
                    <Link href={`/invoices/${invoice.id}`}>
                      <Button variant="secondary" size="sm">
                        View invoice
                      </Button>
                    </Link>
                  ) : isPaid ? (
                    <span className="text-[12px] text-ink-500 font-sans">
                      Invoice within {INVOICE_SLA_HOURS}h
                    </span>
                  ) : (
                    <span className="text-[12px] text-ink-400 font-sans italic">
                      Invoice on payment
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
