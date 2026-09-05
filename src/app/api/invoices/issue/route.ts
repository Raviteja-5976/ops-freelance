import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { sendInvoiceIssuedEmail } from "@/lib/email";
import { formatMoney, formatDate } from "@/lib/formatters";

/**
 * Publishes a draft invoice to the client and emails it out.
 *
 * Auto-generated invoices land as drafts, and the client-side RLS policy hides
 * drafts entirely — so this is the admin confirmation gate. The number is
 * reserved here rather than at draft time, which keeps the sequence gap-free
 * and in issue order.
 *
 * The email goes to everyone under People & Access, not just the billing
 * address, so whoever is actually using the portal receives it.
 */
export async function POST(req: NextRequest) {
  try {
    const { invoiceId } = await req.json();
    if (!invoiceId || typeof invoiceId !== "string") {
      return NextResponse.json(
        { success: false, error: "invoiceId is required." },
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

    const { data: invoice } = await admin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Invoice not found." }, { status: 404 });
    }
    if (invoice.status === "void") {
      return NextResponse.json(
        { success: false, error: "This invoice has been voided." },
        { status: 409 }
      );
    }

    // Already issued: re-send rather than burning a second number.
    let number = invoice.number as string | null;
    let issuedAt = invoice.issued_at as string | null;

    if (invoice.status === "draft" || !number) {
      issuedAt = new Date().toISOString();

      // `invoice_numbers` is unique. If the counter has drifted behind the
      // invoices that already exist — a restore, a manual edit — the first
      // number back collides. Take the next one instead of dead-ending the
      // admin, rather than trusting the counter blindly.
      let assigned: string | null = null;
      let lastError: string | null = null;

      for (let attempt = 0; attempt < 25; attempt++) {
        const { data: nextNumber, error: numErr } = await admin.rpc("next_invoice_number", {
          p_series: invoice.series || "ORS",
          p_fy: invoice.fy || null,
        });
        if (numErr) {
          return NextResponse.json({ success: false, error: numErr.message }, { status: 500 });
        }

        const candidate = nextNumber as string;
        const { error: updErr } = await admin
          .from("invoices")
          .update({ status: "issued", number: candidate, issued_at: issuedAt })
          .eq("id", invoice.id);

        if (!updErr) {
          assigned = candidate;
          break;
        }
        // 23505 = unique violation; anything else is a real failure.
        if ((updErr as { code?: string }).code !== "23505") {
          return NextResponse.json({ success: false, error: updErr.message }, { status: 500 });
        }
        lastError = updErr.message;
      }

      if (!assigned) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Could not assign an unused invoice number. The invoice counter looks out of step with the invoices already issued. " +
              (lastError || ""),
          },
          { status: 500 }
        );
      }
      number = assigned;
    }

    // Everyone who can actually sign in, plus the billing address.
    const { data: client } = await admin
      .from("clients")
      .select("name, email")
      .eq("id", invoice.client_id)
      .maybeSingle();

    const { data: members } = await admin
      .from("client_members")
      .select("profile_id")
      .eq("client_id", invoice.client_id);

    const recipients: string[] = [];
    if (members && members.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("email")
        .in(
          "id",
          members.map((m) => m.profile_id)
        );
      for (const p of profiles || []) {
        if (p.email && !recipients.includes(p.email)) recipients.push(p.email);
      }
    }
    if (client?.email && !recipients.includes(client.email)) recipients.push(client.email);

    // A failed email must not leave the invoice unissued.
    let emailed = 0;
    const results = await Promise.allSettled(
      recipients.map((to) =>
        sendInvoiceIssuedEmail({
          recipientEmail: to,
          clientName: client?.name || "there",
          invoiceNumber: number || "Invoice",
          totalFormatted: formatMoney(invoice.total, invoice.currency),
          dueDate: formatDate(invoice.due_date, "table"),
          invoiceId: invoice.id,
        })
      )
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.success) emailed++;
    }

    return NextResponse.json({
      success: true,
      number,
      recipients: recipients.length,
      emailed,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Could not issue the invoice." },
      { status: 500 }
    );
  }
}
