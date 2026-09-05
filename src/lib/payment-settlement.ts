// Server-only: what happens once a payment is confirmed.
//
// Both the browser-side verify route and the Razorpay webhook end up here, so
// settlement behaves identically whichever one wins the race. Every step is
// idempotent because Razorpay retries webhooks and the customer may also land
// back on the verify route.

import { formatMoney, formatDate } from "@/lib/formatters";
import {
  sendPaymentReceivedClientEmail,
  sendPaymentReceivedFounderEmail,
} from "@/lib/email";
import { mapPaymentMethod } from "@/lib/razorpay";
import { serviceClient } from "@/lib/supabase/service";

export interface SettlementResult {
  settled: boolean;
  alreadyPaid?: boolean;
  invoiceId?: string | null;
  reason?: string;
}

/**
 * Marks a payment stage paid, drafts its invoice, and notifies both sides.
 *
 * The invoice is deliberately left as a **draft**: the client-side RLS policy
 * only returns invoices whose status is not 'draft', so nothing reaches the
 * client until an admin reviews it and presses Issue. That is the confirmation
 * gate — it is enforced by the database, not just by the UI.
 */
export async function settlePayment(params: {
  paymentId: string;
  /** Razorpay's payment id. Omitted when the studio verified it by hand. */
  gatewayPaymentId?: string | null;
  /** Free-text reference: a UTR, cheque number, or the gateway payment id. */
  reference?: string | null;
  method?: string;
  gateway?: string | null;
  /** When the money actually arrived, if not now. */
  paidAt?: string;
}): Promise<SettlementResult> {
  const admin = serviceClient();

  const { data: stage } = await admin
    .from("payments")
    .select("id, client_id, project_id, label, amount, currency, status, invoice_id")
    .eq("id", params.paymentId)
    .maybeSingle();

  if (!stage) return { settled: false, reason: "payment not found" };
  if (stage.status === "paid") {
    return { settled: false, alreadyPaid: true, invoiceId: stage.invoice_id };
  }

  const paidAt = params.paidAt || new Date().toISOString();
  const reference = params.reference ?? params.gatewayPaymentId ?? null;

  const { error: payErr } = await admin
    .from("payments")
    .update({
      status: "paid",
      paid_at: paidAt,
      method: mapPaymentMethod(params.method),
      gateway: params.gateway ?? null,
      // `gateway_payment_id` is unique, so it stays null for manual payments
      // rather than colliding on a blank string.
      gateway_payment_id: params.gatewayPaymentId || null,
      reference,
    })
    .eq("id", stage.id);

  if (payErr) return { settled: false, reason: payErr.message };

  // Neither the invoice nor the emails may undo a confirmed payment, so from
  // here on failures are reported but never thrown.
  let invoiceId: string | null = stage.invoice_id ?? null;
  if (!invoiceId) {
    invoiceId = await createDraftInvoiceForPayment(stage.id);
  }

  await notifyPaymentReceived({
    stageId: stage.id,
    invoiceId,
    paidAt,
    reference: reference || "—",
    method: params.method,
  });

  return { settled: true, invoiceId };
}

/**
 * Builds the draft tax invoice for a settled stage.
 *
 * The amount the client actually paid is treated as the gross total, and any
 * GST is worked backwards out of it. Adding tax on top instead would produce an
 * invoice for more than was received, which no receipt should ever do.
 *
 * Drafts carry no number: `next_invoice_number` is only called at issue time,
 * so the sequence stays gap-free and in issue order.
 */
export async function createDraftInvoiceForPayment(
  paymentId: string
): Promise<string | null> {
  const admin = serviceClient();

  const { data: stage } = await admin
    .from("payments")
    .select("id, client_id, project_id, label, amount, currency, invoice_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (!stage) return null;
  if (stage.invoice_id) return stage.invoice_id;

  const [{ data: client }, { data: settings }, { data: project }] = await Promise.all([
    admin.from("clients").select("*").eq("id", stage.client_id).maybeSingle(),
    admin.from("settings").select("*").eq("id", 1).maybeSingle(),
    admin.from("projects").select("name").eq("id", stage.project_id).maybeSingle(),
  ]);

  const rateBps = settings?.default_tax_rate_bps ?? 0;
  const sellerStateCode = (settings?.address?.state_code as string) || "36";
  const isInterstate = Boolean(
    rateBps > 0 && client?.state_code && client.state_code !== sellerStateCode
  );

  const gross = stage.amount;
  // Reverse-charge the tax out of the gross so total === amount received.
  const taxable = rateBps > 0 ? Math.round((gross * 10000) / (10000 + rateBps)) : gross;
  const tax = gross - taxable;
  const cgst = isInterstate ? 0 : Math.round(tax / 2);
  const sgst = isInterstate ? 0 : tax - Math.round(tax / 2);
  const igst = isInterstate ? tax : 0;

  const today = new Date().toISOString().split("T")[0];

  const { data: invoice, error: invErr } = await admin
    .from("invoices")
    .insert({
      client_id: stage.client_id,
      project_id: stage.project_id,
      series: settings?.invoice_series || "ORS",
      fy: financialYear(today),
      status: "draft", // hidden from the client until an admin issues it
      issue_date: today,
      due_date: today,
      currency: stage.currency || "INR",
      place_of_supply: `${client?.state || ""} (${client?.state_code || sellerStateCode})`,
      is_interstate: isInterstate,
      subtotal: taxable,
      discount_total: 0,
      cgst_total: cgst,
      sgst_total: sgst,
      igst_total: igst,
      total: gross,
      amount_paid: gross,
      notes: settings?.invoice_notes || null,
      terms: settings?.invoice_terms || null,
      bill_to_snapshot: {
        name: client?.legal_name || client?.name,
        gstin: client?.gstin,
        address_line1: client?.address_line1,
        city: client?.city,
        state: client?.state,
        state_code: client?.state_code,
      },
      seller_snapshot: {
        legal_name: settings?.legal_name,
        gstin: settings?.gstin,
        pan: settings?.pan,
        address: settings?.address,
      },
    })
    .select("id")
    .single();

  if (invErr || !invoice) return null;

  const { error: itemErr } = await admin.from("invoice_items").insert({
    invoice_id: invoice.id,
    description: project?.name ? `${project.name} — ${stage.label}` : stage.label,
    hsn_sac: "998314",
    quantity: 1,
    unit_price: taxable,
    discount: 0,
    tax_rate_bps: rateBps,
    taxable_value: taxable,
    cgst,
    sgst,
    igst,
    line_total: gross,
    position: 1,
  });

  if (itemErr) {
    await admin.from("invoices").delete().eq("id", invoice.id);
    return null;
  }

  await admin.from("payments").update({ invoice_id: invoice.id }).eq("id", stage.id);
  return invoice.id;
}

/** Emails the client their receipt and alerts the founder. Never throws. */
async function notifyPaymentReceived(params: {
  stageId: string;
  invoiceId: string | null;
  paidAt: string;
  reference: string;
  method?: string;
}): Promise<void> {
  try {
    const admin = serviceClient();

    const { data: stage } = await admin
      .from("payments")
      .select("id, client_id, project_id, label, amount")
      .eq("id", params.stageId)
      .maybeSingle();
    if (!stage) return;

    const [{ data: client }, { data: project }] = await Promise.all([
      admin.from("clients").select("name, email").eq("id", stage.client_id).maybeSingle(),
      admin.from("projects").select("name").eq("id", stage.project_id).maybeSingle(),
    ]);

    // Prefer the people who actually log in; fall back to the billing address.
    const { data: members } = await admin
      .from("client_members")
      .select("profile_id")
      .eq("client_id", stage.client_id);

    let recipients: string[] = [];
    if (members && members.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("email")
        .in(
          "id",
          members.map((m) => m.profile_id)
        );
      recipients = (profiles || []).map((p) => p.email).filter(Boolean);
    }
    if (client?.email && !recipients.includes(client.email)) {
      recipients.push(client.email);
    }

    const amountFormatted = formatMoney(stage.amount);
    const projectName = project?.name || "your project";

    await Promise.allSettled([
      ...recipients.map((to) =>
        sendPaymentReceivedClientEmail({
          recipientEmail: to,
          clientName: client?.name || "there",
          stageLabel: stage.label,
          amountFormatted,
          projectName,
          reference: params.reference,
          paidOn: formatDate(params.paidAt, "full"),
        })
      ),
      sendPaymentReceivedFounderEmail({
        clientName: client?.name || "Client",
        clientEmail: recipients[0] || client?.email || "",
        stageLabel: stage.label,
        amountFormatted,
        projectName,
        reference: params.reference,
        method: (params.method || "manual").toUpperCase(),
        invoiceId: params.invoiceId,
      }),
    ]);
  } catch {
    // A failed notification must never roll back a confirmed payment.
  }
}

/** Indian financial year label, e.g. "2026-27" for any date from 1 April. */
function financialYear(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}
