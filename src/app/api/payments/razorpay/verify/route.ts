import { NextRequest, NextResponse } from "next/server";
import {
  fetchRazorpayPayment,
  razorpayConfigured,
  verifyCheckoutSignature,
} from "@/lib/razorpay";
import { serviceClient } from "@/lib/supabase/service";
import { settlePayment } from "@/lib/payment-settlement";

/**
 * Settles a stage after Checkout reports success.
 *
 * Three things are checked before anything is marked paid:
 *   1. the signature Razorpay returned actually verifies against our secret,
 *   2. the order id matches the one we opened for this stage,
 *   3. Razorpay itself confirms the payment is captured for the right amount.
 *
 * Only then does the service role write `paid`, because clients have read-only
 * access to `payments` under RLS.
 */
export async function POST(req: NextRequest) {
  if (!razorpayConfigured()) {
    return NextResponse.json(
      { success: false, error: "Razorpay is not configured." },
      { status: 503 }
    );
  }

  try {
    const {
      paymentId,
      razorpay_order_id: orderId,
      razorpay_payment_id: gatewayPaymentId,
      razorpay_signature: signature,
    } = await req.json();

    if (!paymentId || !orderId || !gatewayPaymentId || !signature) {
      return NextResponse.json(
        { success: false, error: "Missing payment confirmation fields." },
        { status: 400 }
      );
    }

    if (!verifyCheckoutSignature({ orderId, paymentId: gatewayPaymentId, signature })) {
      return NextResponse.json(
        { success: false, error: "Payment signature did not verify." },
        { status: 400 }
      );
    }

    const admin = serviceClient();
    const { data: stage } = await admin
      .from("payments")
      .select("id, amount, status, gateway_order_id")
      .eq("id", paymentId)
      .maybeSingle();

    if (!stage) {
      return NextResponse.json({ success: false, error: "Payment not found." }, { status: 404 });
    }

    // The signature proves Razorpay issued this pair; this proves the pair
    // belongs to the stage being settled.
    if (stage.gateway_order_id !== orderId) {
      return NextResponse.json(
        { success: false, error: "Order does not belong to this payment." },
        { status: 400 }
      );
    }

    if (stage.status === "paid") {
      return NextResponse.json({ success: true, alreadyPaid: true });
    }

    const gatewayPayment = await fetchRazorpayPayment(gatewayPaymentId);
    if (gatewayPayment.status !== "captured" && gatewayPayment.status !== "authorized") {
      return NextResponse.json(
        { success: false, error: `Payment is ${gatewayPayment.status}, not captured.` },
        { status: 409 }
      );
    }
    if (gatewayPayment.amount !== stage.amount) {
      return NextResponse.json(
        { success: false, error: "Paid amount does not match the stage amount." },
        { status: 409 }
      );
    }

    // Marks the stage paid, drafts the invoice, and emails both sides.
    const result = await settlePayment({
      paymentId,
      gatewayPaymentId,
      method: gatewayPayment.method,
      gateway: "razorpay",
    });

    if (!result.settled && !result.alreadyPaid) {
      return NextResponse.json(
        { success: false, error: result.reason || "Could not settle the payment." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      alreadyPaid: result.alreadyPaid ?? false,
      invoiceDrafted: Boolean(result.invoiceId),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Could not confirm payment." },
      { status: 500 }
    );
  }
}
