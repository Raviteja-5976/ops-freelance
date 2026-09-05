import { NextRequest, NextResponse } from "next/server";
import {
  sendProjectUpdateEmail,
  sendInvoiceIssuedEmail,
  sendCallRequestedAdminEmail,
  sendCallConfirmedClientEmail,
} from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, payload } = body;

    let result;
    switch (type) {
      case "project_update":
        result = await sendProjectUpdateEmail(payload);
        break;
      case "invoice_issued":
        result = await sendInvoiceIssuedEmail(payload);
        break;
      case "call_requested":
        result = await sendCallRequestedAdminEmail(payload);
        break;
      case "call_confirmed":
        result = await sendCallConfirmedClientEmail(payload);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported email type: ${type}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
