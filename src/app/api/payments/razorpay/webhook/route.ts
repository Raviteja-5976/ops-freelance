import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { serviceClient } from "@/lib/supabase/service";
import { settlePayment } from "@/lib/payment-settlement";

/**
 * Razorpay webhook receiver.
 *
 * The browser-side verify route handles the happy path, but a customer who
 * closes the tab mid-redirect would otherwise leave a captured payment showing
 * as unpaid. Razorpay retries this endpoint until it gets a 2xx.
 *
 * Point a `payment.captured` webhook at
 *   https://<your-domain>/api/payments/razorpay/webhook
 * and set RAZORPAY_WEBHOOK_SECRET to the secret shown in the dashboard.
 */
export async function POST(req: NextRequest) {
  // The signature covers the exact bytes sent, so the body must be read raw
  // before any JSON parsing.
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ success: false, error: "Bad signature." }, { status: 400 });
  }

  try {
    const event = JSON.parse(rawBody);
    const entity = event?.payload?.payment?.entity;

    if (event?.event !== "payment.captured" || !entity) {
      // Acknowledge events we do not act on, otherwise Razorpay keeps retrying.
      return NextResponse.json({ success: true, ignored: event?.event || "unknown" });
    }

    const admin = serviceClient();

    // `receipt` on the order is the stage id, and notes carry it too; match on
    // the order id we stored when the checkout was opened.
    const { data: stage } = await admin
      .from("payments")
      .select("id, amount, status")
      .eq("gateway_order_id", entity.order_id)
      .maybeSingle();

    if (!stage) {
      return NextResponse.json({ success: true, ignored: "no matching stage" });
    }
    if (stage.status === "paid") {
      return NextResponse.json({ success: true, alreadyPaid: true });
    }
    if (entity.amount !== stage.amount) {
      return NextResponse.json({ success: true, ignored: "amount mismatch" });
    }

    const result = await settlePayment({
      paymentId: stage.id,
      gatewayPaymentId: entity.id,
      method: entity.method,
      gateway: "razorpay",
    });

    return NextResponse.json({
      success: true,
      alreadyPaid: result.alreadyPaid ?? false,
      invoiceDrafted: Boolean(result.invoiceId),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Webhook failed." },
      { status: 500 }
    );
  }
}
