import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createRazorpayOrder,
  razorpayConfigured,
  razorpayKeyId,
} from "@/lib/razorpay";
import { serviceClient } from "@/lib/supabase/service";

/**
 * Opens a Razorpay order for one payment stage.
 *
 * The amount is always read from the database, never from the request body —
 * otherwise a client could pay one rupee against a hundred-thousand rupee
 * stage. The caller must be signed in and linked to the client that owns the
 * stage (or be an admin).
 */
export async function POST(req: NextRequest) {
  if (!razorpayConfigured()) {
    return NextResponse.json(
      { success: false, error: "Razorpay is not configured on this environment." },
      { status: 503 }
    );
  }

  try {
    const { paymentId } = await req.json();
    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json(
        { success: false, error: "paymentId is required." },
        { status: 400 }
      );
    }

    // 1. Who is asking?
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
    }

    // 2. Read the stage with the service role so the amount is authoritative.
    const admin = serviceClient();
    const { data: payment, error: payErr } = await admin
      .from("payments")
      .select("id, client_id, project_id, label, amount, currency, status, gateway_order_id")
      .eq("id", paymentId)
      .maybeSingle();

    if (payErr || !payment) {
      return NextResponse.json({ success: false, error: "Payment not found." }, { status: 404 });
    }

    // 3. Is this person entitled to pay it?
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      const { data: membership } = await admin
        .from("client_members")
        .select("client_id")
        .eq("profile_id", user.id)
        .eq("client_id", payment.client_id)
        .maybeSingle();

      if (!membership) {
        return NextResponse.json({ success: false, error: "Not your payment." }, { status: 403 });
      }
    }

    if (payment.status === "paid") {
      return NextResponse.json(
        { success: false, error: "This stage is already paid." },
        { status: 409 }
      );
    }

    // 4. Create the order and remember it against the stage.
    const order = await createRazorpayOrder({
      amountPaise: payment.amount,
      receipt: payment.id,
      notes: { payment_id: payment.id, label: payment.label },
    });

    await admin
      .from("payments")
      .update({ gateway: "razorpay", gateway_order_id: order.id })
      .eq("id", payment.id);

    return NextResponse.json({
      success: true,
      keyId: razorpayKeyId(),
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      label: payment.label,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Could not start payment." },
      { status: 500 }
    );
  }
}
