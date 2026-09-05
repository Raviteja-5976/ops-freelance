import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { createDraftInvoiceForPayment, settlePayment } from "@/lib/payment-settlement";

/**
 * Admin confirmation that a payment has actually arrived.
 *
 * Used for money that did not come through Razorpay — a bank transfer, UPI
 * straight to the studio account, a cheque. It runs the identical settlement
 * path as the gateway: mark the stage paid, draft its invoice, and email both
 * the client and the founder. Recording it any other way would leave the
 * invoice ungenerated.
 *
 * Admin only, and idempotent.
 */
export async function POST(req: NextRequest) {
  try {
    const { paymentId, method, reference, paidAt } = await req.json();

    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json(
        { success: false, error: "paymentId is required." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
    }

    const admin = serviceClient();
    const { data: actor } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (actor?.role !== "admin") {
      return NextResponse.json({ success: false, error: "Admins only." }, { status: 403 });
    }

    const result = await settlePayment({
      paymentId,
      method: typeof method === "string" ? method : "bank_transfer",
      reference: typeof reference === "string" && reference.trim() ? reference.trim() : null,
      gateway: null, // verified by hand, not by a gateway
      paidAt: typeof paidAt === "string" && paidAt ? new Date(paidAt).toISOString() : undefined,
    });

    if (result.alreadyPaid) {
      // A stage marked paid before invoices were generated automatically still
      // has none. Draft it now rather than leaving the admin with no way to
      // produce an invoice for money already received.
      let invoiceId = result.invoiceId ?? null;
      let backfilled = false;
      if (!invoiceId) {
        invoiceId = await createDraftInvoiceForPayment(paymentId);
        backfilled = Boolean(invoiceId);
      }

      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        invoiceId,
        invoiceDrafted: backfilled,
        backfilled,
      });
    }

    if (!result.settled) {
      return NextResponse.json(
        { success: false, error: result.reason || "Could not verify that payment." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      invoiceId: result.invoiceId ?? null,
      invoiceDrafted: Boolean(result.invoiceId),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Could not verify that payment." },
      { status: 500 }
    );
  }
}
