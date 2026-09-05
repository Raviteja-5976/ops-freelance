import nodemailer from "nodemailer";
import { INVOICE_SLA_HOURS, INVOICE_SLA_NOTE } from "@/lib/formatters";
import type { Transporter } from "nodemailer";

// Email Configuration & Alias Constants
export const EMAIL_CONFIG = {
  defaultFrom: process.env.EMAIL_FROM || "OpenRiverStack <no-reply@openriverstack.com>",
  replyTo: process.env.EMAIL_REPLY_TO || "support@openriverstack.com",
  founder: process.env.FOUNDER_EMAIL || "founder@openriverstack.com",
  info: process.env.INFO_EMAIL || "info@openriverstack.com",
  support: process.env.EMAIL_REPLY_TO || "support@openriverstack.com",
  noReply: "no-reply@openriverstack.com",
};

// Singleton SMTP Transporter
let cachedTransporter: Transporter | null = null;

function getSMTPTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  return cachedTransporter;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

/**
 * Base Riverbed HTML Email Template Wrapper
 */
function wrapEmailTemplate({
  title,
  preheader,
  content,
  actionButton,
  footerNotes,
}: {
  title: string;
  preheader?: string;
  content: string;
  actionButton?: { label: string; url: string };
  footerNotes?: string;
}): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://openriverstack.com";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f7f5f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a1917; }
    .container { max-width: 580px; margin: 32px auto; background-color: #ffffff; border: 1px solid #e7e4dc; border-radius: 6px; overflow: hidden; }
    .header { padding: 24px 32px; border-bottom: 1px solid #f0ede6; background-color: #faf8f5; }
    .logo { font-size: 16px; font-weight: 700; letter-spacing: -0.02em; color: #1a1917; text-decoration: none; }
    .body { padding: 32px; font-size: 14px; line-height: 1.6; color: #3a3834; }
    .h1 { font-size: 20px; font-weight: 600; color: #1a1917; margin: 0 0 16px 0; letter-spacing: -0.01em; }
    .meta-box { background-color: #f9f8f5; border: 1px solid #e7e4dc; border-radius: 4px; padding: 16px; margin: 20px 0; }
    .btn { display: inline-block; background-color: #1f5146; color: #ffffff !important; padding: 10px 20px; border-radius: 4px; font-size: 13px; font-weight: 500; text-decoration: none; margin-top: 16px; }
    .footer { padding: 24px 32px; border-top: 1px solid #f0ede6; background-color: #faf8f5; font-size: 12px; color: #87847c; line-height: 1.5; }
    .footer a { color: #1f5146; text-decoration: none; }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden;">${preheader || title}</div>
  <div class="container">
    <div class="header">
      <a href="${appUrl}" class="logo">OpenRiverStack</a>
    </div>
    <div class="body">
      <h1 class="h1">${title}</h1>
      ${content}
      ${
        actionButton
          ? `<div><a href="${actionButton.url}" class="btn" target="_blank">${actionButton.label} &rarr;</a></div>`
          : ""
      }
    </div>
    <div class="footer">
      ${footerNotes ? `<p style="margin: 0 0 8px 0;">${footerNotes}</p>` : ""}
      <p style="margin: 0;">
        OpenRiverStack &bull; High-velocity studio for modern digital engineering.<br>
        Questions? Write to <a href="mailto:${EMAIL_CONFIG.support}">${EMAIL_CONFIG.support}</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Strips HTML tags for text/plain alternative
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Primary Direct SMTP Dispatch Function
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  from = EMAIL_CONFIG.defaultFrom,
  replyTo = EMAIL_CONFIG.replyTo,
}: SendEmailOptions): Promise<SendEmailResult> {
  const recipients = Array.isArray(to) ? to : [to];
  const transporter = getSMTPTransporter();

  if (!transporter) {
    console.warn(
      `[SMTP Simulation] No SMTP credentials configured. Simulated email to: ${recipients.join(", ")} | Subject: "${subject}"`
    );
    return {
      success: true,
      simulated: true,
      messageId: `simulated-${Date.now()}`,
    };
  }

  const plainText = text || stripHtml(html);

  try {
    const info = await transporter.sendMail({
      from,
      to: recipients,
      replyTo: replyTo || EMAIL_CONFIG.replyTo,
      subject,
      html,
      text: plainText,
    });

    console.log(`[SMTP] Email sent successfully to ${recipients.join(", ")}. MessageId: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
      simulated: false,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[SMTP] Failed to send email to ${recipients.join(", ")}:`, error);
    return {
      success: false,
      error,
    };
  }
}

/**
 * Verifies the SMTP handshake / connection
 */
export async function verifySMTPConnection(): Promise<{ success: boolean; error?: string }> {
  const transporter = getSMTPTransporter();
  if (!transporter) {
    return { success: false, error: "SMTP credentials (host, user, password) are not configured." };
  }
  try {
    await transporter.verify();
    return { success: true };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

// ------------------------------------------------------------------------------------------------
// TRANSACTIONAL EMAIL TRIGGERS & TEMPLATES
// ------------------------------------------------------------------------------------------------

/**
 * 1. Project Update Published Notification
 */
export async function sendProjectUpdateEmail({
  recipientEmail,
  clientName,
  projectName,
  updateTitle,
  excerpt,
  projectId,
}: {
  recipientEmail: string;
  clientName: string;
  projectName: string;
  updateTitle: string;
  excerpt: string;
  projectId: string;
}): Promise<SendEmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://openriverstack.com";
  const projectUrl = `${appUrl}/project`;

  const html = wrapEmailTemplate({
    title: `New Update: ${updateTitle}`,
    preheader: `Progress update published on ${projectName}`,
    content: `
      <p>Hello ${clientName},</p>
      <p>A new progress update has just been posted to your workspace for <strong>${projectName}</strong>:</p>
      <div class="meta-box">
        <strong style="color: #1a1917; display: block; margin-bottom: 6px;">${updateTitle}</strong>
        <div style="color: #4a4742;">${excerpt}</div>
      </div>
      <p>You can view full details, associated deliverables, and milestones directly in your client portal.</p>
    `,
    actionButton: {
      label: "View Project Update",
      url: projectUrl,
    },
  });

  return sendEmail({
    to: recipientEmail,
    subject: `[Update] ${projectName} · ${updateTitle}`,
    html,
  });
}

/**
 * 2. Invoice Issued Notification
 */
export async function sendInvoiceIssuedEmail({
  recipientEmail,
  clientName,
  invoiceNumber,
  totalFormatted,
  dueDate,
  invoiceId,
}: {
  recipientEmail: string;
  clientName: string;
  invoiceNumber: string;
  totalFormatted: string;
  dueDate: string;
  invoiceId: string;
}): Promise<SendEmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://openriverstack.com";
  const invoiceUrl = `${appUrl}/invoices/${invoiceId}`;

  const html = wrapEmailTemplate({
    title: `Tax Invoice Issued: ${invoiceNumber}`,
    preheader: `Invoice ${invoiceNumber} for ${totalFormatted} is ready`,
    content: `
      <p>Hello ${clientName},</p>
      <p>A new tax invoice has been generated for your account.</p>
      <div class="meta-box">
        <table style="width: 100%; font-size: 13px; color: #3a3834; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; color: #6e6b63;">Invoice Number:</td>
            <td style="padding: 4px 0; font-weight: 600; text-align: right; color: #1a1917;">${invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #6e6b63;">Amount Due:</td>
            <td style="padding: 4px 0; font-weight: 600; text-align: right; color: #1a1917;">${totalFormatted}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #6e6b63;">Due Date:</td>
            <td style="padding: 4px 0; text-align: right; color: #1a1917;">${dueDate}</td>
          </tr>
        </table>
      </div>
      <p>You can view the full line-item breakdown, download the tax-compliant PDF, or complete payment online through your client portal.</p>
    `,
    actionButton: {
      label: "View Invoice & Pay",
      url: invoiceUrl,
    },
    footerNotes: "Tax invoices include GSTIN details and can be downloaded as official tax receipts.",
  });

  return sendEmail({
    to: recipientEmail,
    subject: `Invoice ${invoiceNumber} from OpenRiverStack (${totalFormatted})`,
    html,
  });
}

/**
 * 3. Call Requested Notification (Sent to Studio Founder)
 */
export async function sendCallRequestedAdminEmail({
  clientName,
  clientEmail,
  companyName,
  slotDisplay,
  agenda,
}: {
  clientName: string;
  clientEmail: string;
  companyName: string;
  slotDisplay: string;
  agenda?: string;
}): Promise<SendEmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://openriverstack.com";
  const callsUrl = `${appUrl}/admin/calls`;

  const html = wrapEmailTemplate({
    title: `New Call Request from ${clientName}`,
    preheader: `${clientName} (${companyName}) requested a call`,
    content: `
      <p>A client has requested a call through their client portal.</p>
      <div class="meta-box">
        <p style="margin: 0 0 6px 0;"><strong>Client:</strong> ${clientName} &lt;${clientEmail}&gt;</p>
        <p style="margin: 0 0 6px 0;"><strong>Company:</strong> ${companyName}</p>
        <p style="margin: 0 0 6px 0;"><strong>Requested Slot:</strong> ${slotDisplay}</p>
        ${agenda ? `<p style="margin: 0;"><strong>Topic / Agenda:</strong> ${agenda}</p>` : ""}
      </div>
      <p>Review and confirm or reschedule this request in your admin dashboard.</p>
    `,
    actionButton: {
      label: "Review in Admin Portal",
      url: callsUrl,
    },
  });

  return sendEmail({
    to: EMAIL_CONFIG.founder,
    replyTo: clientEmail,
    subject: `[Call Request] ${clientName} · ${slotDisplay}`,
    html,
  });
}

/**
 * 4. Call Confirmed Notification (Sent to Client)
 */
export async function sendCallConfirmedClientEmail({
  recipientEmail,
  clientName,
  slotDisplay,
  meetingUrl,
}: {
  recipientEmail: string;
  clientName: string;
  slotDisplay: string;
  meetingUrl?: string;
}): Promise<SendEmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://openriverstack.com";
  const callsUrl = `${appUrl}/calls`;

  const html = wrapEmailTemplate({
    title: "Your Call is Confirmed",
    preheader: `Call confirmed for ${slotDisplay}`,
    content: `
      <p>Hello ${clientName},</p>
      <p>Your call request has been confirmed by OpenRiverStack.</p>
      <div class="meta-box">
        <p style="margin: 0 0 8px 0;"><strong>Date & Time:</strong> ${slotDisplay}</p>
        ${
          meetingUrl
            ? `<p style="margin: 0;"><strong>Meeting Link:</strong> <a href="${meetingUrl}" target="_blank" style="color: #1f5146; font-weight: 500;">${meetingUrl}</a></p>`
            : ""
        }
      </div>
      <p>Looking forward to speaking with you. You can manage or reschedule this call from your portal.</p>
    `,
    actionButton: {
      label: meetingUrl ? "Join Meeting" : "View Call Details",
      url: meetingUrl || callsUrl,
    },
  });

  return sendEmail({
    to: recipientEmail,
    subject: `Confirmed: OpenRiverStack Call · ${slotDisplay}`,
    html,
  });
}

/**
 * 5. Test Email (for SMTP Verification)
 */
export async function sendTestEmail(recipientEmail: string): Promise<SendEmailResult> {
  const isConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);

  const html = wrapEmailTemplate({
    title: "SMTP Configuration Verified",
    preheader: "Your direct SMTP email integration with OpenRiverStack is functioning.",
    content: `
      <p>This is a test notification confirming that Direct SMTP is properly configured in your OpenRiverStack portal.</p>
      <div class="meta-box">
        <p style="margin: 0 0 6px 0;"><strong>Sender:</strong> ${EMAIL_CONFIG.defaultFrom}</p>
        <p style="margin: 0 0 6px 0;"><strong>Reply-To:</strong> ${EMAIL_CONFIG.replyTo}</p>
        <p style="margin: 0 0 6px 0;"><strong>SMTP Server:</strong> ${process.env.SMTP_HOST || "Not configured"}</p>
        <p style="margin: 0 0 6px 0;"><strong>SMTP Port:</strong> ${process.env.SMTP_PORT || "587"}</p>
        <p style="margin: 0 0 6px 0;"><strong>Authenticated User:</strong> ${process.env.SMTP_USER || "Not configured"}</p>
        <p style="margin: 0;"><strong>Mode:</strong> ${isConfigured ? "Live Direct SMTP" : "Simulated / Dev"}</p>
      </div>
      <p>Your transactional email infrastructure is ready to send client updates, invoice receipts, and calendar confirmations directly through your mail server.</p>
    `,
  });

  return sendEmail({
    to: recipientEmail,
    subject: "OpenRiverStack · Direct SMTP Test Verification",
    html,
  });
}


/**
 * 5. Payment Received Confirmation (Sent to Client)
 */
export async function sendPaymentReceivedClientEmail({
  recipientEmail,
  clientName,
  stageLabel,
  amountFormatted,
  projectName,
  reference,
  paidOn,
}: {
  recipientEmail: string;
  clientName: string;
  stageLabel: string;
  amountFormatted: string;
  projectName: string;
  reference: string;
  paidOn: string;
}): Promise<SendEmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://openriverstack.com";

  const html = wrapEmailTemplate({
    title: `Payment received: ${amountFormatted}`,
    preheader: `We have received your payment of ${amountFormatted}`,
    content: `
      <p>Hello ${clientName},</p>
      <p>Thank you &mdash; we have received your payment. This email is your confirmation of receipt.</p>
      <div class="meta-box">
        <table style="width: 100%; font-size: 13px; color: #3a3834; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; color: #6e6b63;">Amount Paid:</td>
            <td style="padding: 4px 0; font-weight: 600; text-align: right; color: #1a1917;">${amountFormatted}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #6e6b63;">Towards:</td>
            <td style="padding: 4px 0; text-align: right; color: #1a1917;">${stageLabel}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #6e6b63;">Project:</td>
            <td style="padding: 4px 0; text-align: right; color: #1a1917;">${projectName}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #6e6b63;">Received On:</td>
            <td style="padding: 4px 0; text-align: right; color: #1a1917;">${paidOn}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #6e6b63;">Reference:</td>
            <td style="padding: 4px 0; text-align: right; font-family: monospace; color: #1a1917;">${reference}</td>
          </tr>
        </table>
      </div>
      <p><strong>${INVOICE_SLA_NOTE}</strong> We will email it to you as soon as it has been checked, and it will also appear in your client portal.</p>
    `,
    actionButton: {
      label: "View Payment Schedule",
      url: `${appUrl}/payments`,
    },
    footerNotes: "This is a payment receipt confirmation, not a tax invoice.",
  });

  return sendEmail({
    to: recipientEmail,
    subject: `Payment received: ${amountFormatted} \u00b7 OpenRiverStack`,
    html,
  });
}

/**
 * 6. Payment Received Alert (Sent to Studio Founder)
 */
export async function sendPaymentReceivedFounderEmail({
  clientName,
  clientEmail,
  stageLabel,
  amountFormatted,
  projectName,
  reference,
  method,
  invoiceId,
}: {
  clientName: string;
  clientEmail: string;
  stageLabel: string;
  amountFormatted: string;
  projectName: string;
  reference: string;
  method: string;
  invoiceId?: string | null;
}): Promise<SendEmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://openriverstack.com";
  const reviewUrl = invoiceId
    ? `${appUrl}/admin/invoices/${invoiceId}`
    : `${appUrl}/admin/payments`;

  const html = wrapEmailTemplate({
    title: `${amountFormatted} received from ${clientName}`,
    preheader: `${clientName} paid ${amountFormatted} for ${stageLabel}`,
    content: `
      <p>A client payment has cleared and been verified.</p>
      <div class="meta-box">
        <p style="margin: 0 0 6px 0;"><strong>Client:</strong> ${clientName} &lt;${clientEmail}&gt;</p>
        <p style="margin: 0 0 6px 0;"><strong>Project:</strong> ${projectName}</p>
        <p style="margin: 0 0 6px 0;"><strong>Stage:</strong> ${stageLabel}</p>
        <p style="margin: 0 0 6px 0;"><strong>Amount:</strong> ${amountFormatted}</p>
        <p style="margin: 0 0 6px 0;"><strong>Method:</strong> ${method}</p>
        <p style="margin: 0;"><strong>Reference:</strong> ${reference}</p>
      </div>
      ${
        invoiceId
          ? `<p><strong>A draft invoice has been prepared automatically.</strong> The client cannot see it until you review and issue it. You have told them it will arrive within ${INVOICE_SLA_HOURS} hours.</p>`
          : `<p>No draft invoice could be prepared automatically &mdash; raise one manually from the admin portal.</p>`
      }
    `,
    actionButton: {
      label: invoiceId ? "Review & Issue Invoice" : "Open Payments",
      url: reviewUrl,
    },
  });

  return sendEmail({
    to: EMAIL_CONFIG.founder,
    replyTo: clientEmail,
    subject: `[Payment] ${amountFormatted} from ${clientName} \u00b7 ${stageLabel}`,
    html,
  });
}

/**
 * 7. Workspace Invitation (Sent to a newly added client team member)
 */
export async function sendWorkspaceInviteEmail({
  recipientEmail,
  clientName,
  actionLink,
  invitedByName,
  isExistingUser,
}: {
  recipientEmail: string;
  clientName: string;
  actionLink?: string | null;
  invitedByName?: string;
  isExistingUser: boolean;
}): Promise<SendEmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://openriverstack.com";

  const content = isExistingUser
    ? `
      <p>Hello,</p>
      <p>${invitedByName || "OpenRiverStack"} has given your account access to the
      <strong>${clientName}</strong> workspace.</p>
      <p>Sign in with your existing password to see project progress, milestones,
      files, payments and invoices.</p>
    `
    : `
      <p>Hello,</p>
      <p>${invitedByName || "OpenRiverStack"} has invited you to the
      <strong>${clientName}</strong> client workspace.</p>
      <p>Use the button below to choose a password and activate your account. From
      there you can follow project progress, milestones, files, payments and
      invoices in one place.</p>
    `;

  const html = wrapEmailTemplate({
    title: `You have access to ${clientName}`,
    preheader: `Your OpenRiverStack workspace for ${clientName} is ready`,
    content,
    actionButton: {
      label: isExistingUser ? "Open your workspace" : "Set your password",
      url: actionLink || `${appUrl}/login`,
    },
    footerNotes: isExistingUser
      ? undefined
      : "This invitation link is single-use. If it has expired, use \u201cForgot password\u201d on the sign-in page.",
  });

  return sendEmail({
    to: recipientEmail,
    subject: `You have been added to ${clientName} \u00b7 OpenRiverStack`,
    html,
  });
}

/**
 * 8. Sign-up confirmation.
 *
 * Sent through the studio's own SMTP rather than Supabase's built-in mailer,
 * which caps auth emails at a handful per hour and blocks real sign-ups.
 */
export async function sendSignupConfirmationEmail({
  recipientEmail,
  name,
  actionLink,
}: {
  recipientEmail: string;
  name?: string | null;
  actionLink: string;
}): Promise<SendEmailResult> {
  const html = wrapEmailTemplate({
    title: "Confirm your email address",
    preheader: "One click to activate your OpenRiverStack account",
    content: `
      <p>Hello${name ? ` ${name}` : ""},</p>
      <p>Thanks for creating an OpenRiverStack account. Confirm this address to
      activate it &mdash; you will not be able to sign in until you do.</p>
      <p style="font-size: 13px; color: #6e6b63;">If you did not create this
      account, simply ignore this email and nothing further will happen.</p>
    `,
    actionButton: { label: "Confirm email address", url: actionLink },
    footerNotes: "This confirmation link can only be used once.",
  });

  return sendEmail({
    to: recipientEmail,
    subject: "Confirm your email \u00b7 OpenRiverStack",
    html,
  });
}

/**
 * 9. Sign-up attempted on an address that already has an account.
 *
 * Sent instead of the confirmation email so the sign-up form can respond
 * identically either way and never reveal which addresses are registered.
 */
export async function sendAccountExistsEmail({
  recipientEmail,
  resetLink,
}: {
  recipientEmail: string;
  resetLink?: string | null;
}): Promise<SendEmailResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://openriverstack.com";

  const html = wrapEmailTemplate({
    title: "You already have an account",
    preheader: "Someone tried to sign up with this address",
    content: `
      <p>Hello,</p>
      <p>Somebody just tried to create an OpenRiverStack account with this email
      address, but you already have one. No new account was created and nothing
      has changed.</p>
      <p>If that was you, sign in with your existing password${
        resetLink ? ", or set a new one using the button below" : ""
      }.</p>
      <p style="font-size: 13px; color: #6e6b63;">If it was not you, you can
      safely ignore this email.</p>
    `,
    actionButton: resetLink
      ? { label: "Set a new password", url: resetLink }
      : { label: "Go to sign in", url: `${appUrl}/login` },
  });

  return sendEmail({
    to: recipientEmail,
    subject: "About your OpenRiverStack account",
    html,
  });
}

/**
 * 10. Password reset.
 */
export async function sendPasswordResetEmail({
  recipientEmail,
  actionLink,
}: {
  recipientEmail: string;
  actionLink: string;
}): Promise<SendEmailResult> {
  const html = wrapEmailTemplate({
    title: "Reset your password",
    preheader: "Choose a new password for your OpenRiverStack account",
    content: `
      <p>Hello,</p>
      <p>Use the button below to choose a new password for your OpenRiverStack
      account.</p>
      <p style="font-size: 13px; color: #6e6b63;">If you did not ask for this,
      ignore this email &mdash; your password stays as it is.</p>
    `,
    actionButton: { label: "Choose a new password", url: actionLink },
    footerNotes: "This link can only be used once and expires shortly.",
  });

  return sendEmail({
    to: recipientEmail,
    subject: "Reset your password \u00b7 OpenRiverStack",
    html,
  });
}
