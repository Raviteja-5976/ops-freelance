import { NextRequest, NextResponse } from "next/server";
import { sendTestEmail, EMAIL_CONFIG } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const recipient = body.recipient || EMAIL_CONFIG.founder;

    const result = await sendTestEmail(recipient);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to send email via SMTP",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      simulated: result.simulated ?? false,
      messageId: result.messageId,
      recipient,
      smtpHost: process.env.SMTP_HOST || null,
      smtpPort: process.env.SMTP_PORT || "587",
      smtpUser: process.env.SMTP_USER || null,
      configured: Boolean(
        process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
      ),
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
