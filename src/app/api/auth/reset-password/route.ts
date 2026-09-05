import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase/service";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";

/**
 * Public "forgot password".
 *
 * Same reasoning as sign-up: `resetPasswordForEmail` makes Supabase send the
 * mail through its rate-limited built-in mailer. The link is generated here and
 * delivered over the studio's own SMTP instead.
 *
 * Always answers success, whether or not the address exists, so the form cannot
 * be used to enumerate accounts.
 */
export async function POST(req: NextRequest) {
  const generic = NextResponse.json({ success: true });

  try {
    const { email } = await req.json();
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: "That does not look like a valid email address." },
        { status: 400 }
      );
    }

    const ip = clientIp(req);
    const byEmail = rateLimit(`reset:email:${cleanEmail}`, { limit: 3, windowMs: 60 * 60 * 1000 });
    const byIp = rateLimit(`reset:ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
    if (!byEmail.allowed || !byIp.allowed) {
      const retryAfter = Math.max(byEmail.retryAfter, byIp.retryAfter);
      return NextResponse.json(
        {
          success: false,
          error: `Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const admin = serviceClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: cleanEmail,
      options: { redirectTo: `${appUrl}/reset-password` },
    });

    // No such account: stay silent rather than confirming the address is unused.
    if (error || !data?.properties?.action_link) return generic;

    await sendPasswordResetEmail({
      recipientEmail: cleanEmail,
      actionLink: data.properties.action_link,
    }).catch(() => {});

    return generic;
  } catch {
    return generic;
  }
}
