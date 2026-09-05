// Server-only Razorpay helpers.
//
// The key secret must never reach the browser, so everything here runs in route
// handlers. Razorpay's REST API is plain Basic auth, so no SDK is needed.

import crypto from "crypto";

const API = "https://api.razorpay.com/v1";

export function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/** The publishable key id, safe to hand to the browser for Checkout. */
export function razorpayKeyId(): string {
  return process.env.RAZORPAY_KEY_ID || "";
}

function authHeader(): string {
  const id = process.env.RAZORPAY_KEY_ID || "";
  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
}

export async function createRazorpayOrder(params: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: "INR",
      receipt: params.receipt,
      notes: params.notes || {},
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.description || `Razorpay order failed (${res.status})`);
  }
  return body as RazorpayOrder;
}

/**
 * Checks the signature Checkout hands back after a successful payment.
 *
 * Razorpay signs `order_id|payment_id` with the key secret. Without this a
 * caller could POST any order/payment pair and have the stage marked paid.
 */
export function verifyCheckoutSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");
  return timingSafeEqual(expected, params.signature);
}

/** Verifies a webhook body against the webhook secret. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b || "");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Confirms with Razorpay that a payment really was captured. */
export async function fetchRazorpayPayment(paymentId: string): Promise<{
  id: string;
  status: string;
  amount: number;
  order_id: string;
  method?: string;
}> {
  const res = await fetch(`${API}/payments/${paymentId}`, {
    headers: { Authorization: authHeader() },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error?.description || `Could not read payment (${res.status})`);
  }
  return body;
}

/**
 * Maps a payment method onto the portal's `payment_method` enum.
 *
 * Handles both Razorpay's vocabulary and the enum's own values, because manual
 * verification passes the enum value straight through — without that,
 * `bank_transfer` and `cash` would be flattened to `other`.
 */
export function mapPaymentMethod(
  method?: string
): "upi" | "card" | "netbanking" | "bank_transfer" | "cash" | "other" {
  switch (method) {
    case "upi":
      return "upi";
    case "card":
    case "wallet":
    case "emi":
      return "card";
    case "netbanking":
      return "netbanking";
    case "bank_transfer":
    case "transfer":
      return "bank_transfer";
    case "cash":
      return "cash";
    default:
      return "other";
  }
}
