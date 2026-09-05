import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase/service";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  sendAccountExistsEmail,
  sendSignupConfirmationEmail,
} from "@/lib/email";

/**
 * Public sign-up.
 *
 * Deliberately does not use `supabase.auth.signUp` from the browser: that makes
 * Supabase send the confirmation itself, and its built-in mailer caps auth
 * emails at a handful per hour — which is what produced "email rate limit
 * exceeded" for real people trying to sign up. It also rejects some perfectly
 * ordinary domains.
 *
 * Instead the account is created here with the service role and the
 * confirmation link is emailed through the studio's own SMTP.
 *
 * The account is created **unconfirmed**, so nobody can sign in until they
 * prove they own the address. That matters: an admin later adds a client by
 * email, so letting somebody claim an address they do not own would hand them
 * that client's workspace.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanName = typeof name === "string" ? name.trim() : "";

    if (!cleanEmail || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: "That does not look like a valid email address." },
        { status: 400 }
      );
    }
    if (typeof password !== "string" || password.length < 10) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 10 characters." },
        { status: 400 }
      );
    }

    // Public endpoint that sends mail: cap it per address and per caller.
    const ip = clientIp(req);
    const byEmail = rateLimit(`signup:email:${cleanEmail}`, { limit: 3, windowMs: 60 * 60 * 1000 });
    const byIp = rateLimit(`signup:ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
    if (!byEmail.allowed || !byIp.allowed) {
      const retryAfter = Math.max(byEmail.retryAfter, byIp.retryAfter);
      return NextResponse.json(
        {
          success: false,
          error: `Too many sign-up attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const admin = serviceClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

    // Creates the user unconfirmed and hands back a confirmation link, without
    // Supabase mailing anything itself.
    const { data, error } = await admin.auth.admin.generateLink({
      type: "signup",
      email: cleanEmail,
      password,
      options: {
        redirectTo: `${appUrl}/overview`,
        data: cleanName ? { full_name: cleanName } : undefined,
      },
    });

    if (error) {
      const message = error.message || "";

      // Address already taken. Answer exactly as for a fresh sign-up so the
      // form cannot be used to discover who has an account, and email the
      // owner instead so a real person is never left confused.
      if (/already|registered|exists/i.test(message)) {
        const { data: recovery } = await admin.auth.admin.generateLink({
          type: "recovery",
          email: cleanEmail,
          options: { redirectTo: `${appUrl}/reset-password` },
        });

        await sendAccountExistsEmail({
          recipientEmail: cleanEmail,
          resetLink: recovery?.properties?.action_link || null,
        }).catch(() => {});

        return NextResponse.json({ success: true, pendingConfirmation: true });
      }

      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const actionLink = data?.properties?.action_link;
    if (!actionLink) {
      return NextResponse.json(
        { success: false, error: "Could not generate a confirmation link." },
        { status: 500 }
      );
    }

    // Make sure the name they typed is on the profile. The `handle_new_user`
    // trigger fills it from metadata, but only when metadata was supplied.
    if (cleanName && data.user) {
      await admin
        .from("profiles")
        .update({ full_name: cleanName })
        .eq("id", data.user.id);
    }

    const sent = await sendSignupConfirmationEmail({
      recipientEmail: cleanEmail,
      name: cleanName || null,
      actionLink,
    });

    if (!sent.success) {
      // The account exists but is unreachable without the link, so remove it
      // rather than stranding an unconfirmable account on the address.
      if (data.user) await admin.auth.admin.deleteUser(data.user.id);
      return NextResponse.json(
        {
          success: false,
          error: "Could not send the confirmation email. Please try again shortly.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, pendingConfirmation: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Could not create your account." },
      { status: 500 }
    );
  }
}
