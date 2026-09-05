// OpenRiverStack — Formatting Utilities

/**
 * Format integer paise into standard Indian Rupee presentation.
 * Never use floats in database or storage.
 * @param paise Amount in paise (100 paise = 1 INR)
 * @param currency Default 'INR'
 */
export function formatMoney(paise: number | undefined | null, currency: string = "INR"): string {
  if (paise === undefined || paise === null || isNaN(paise)) return "₹0";
  const rupees = Math.floor(paise / 100);
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(rupees);
  return `₹${formatted}`;
}

/**
 * Format dates per Riverbed spec:
 * - Client full: 18 October 2026
 * - Admin table: 18/10/2026
 * - Call time: Tuesday 8 September, 2:00 PM
 */
export function formatDate(
  val: string | Date | undefined | null,
  style: "full" | "table" | "short" | "datetime" | "monthday" = "full",
  timeZone: string = "Asia/Kolkata"
): string {
  if (!val) return "—";
  const date = typeof val === "string" ? new Date(val) : val;
  if (isNaN(date.getTime())) return "—";

  try {
    if (style === "table") {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone,
      }).format(date);
    }

    if (style === "short") {
      return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone,
      }).format(date);
    }

    if (style === "monthday") {
      return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        timeZone,
      }).format(date);
    }

    if (style === "datetime") {
      const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone }).format(date);
      const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone }).format(date);
      const month = new Intl.DateTimeFormat("en-IN", { month: "long", timeZone }).format(date);
      const time = new Intl.DateTimeFormat("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone,
      }).format(date);
      return `${weekday} ${day} ${month}, ${time}`;
    }

    // Default 'full'
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone,
    }).format(date);
  } catch (err) {
    return date.toLocaleDateString();
  }
}

/**
 * Convert number in Rupees to words in Indian System
 */
export function numberToWords(amountInRupees: number): string {
  if (amountInRupees === 0) return "Zero Rupees Only";
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  function convertBelowThousand(n: number): string {
    let s = "";
    if (n >= 100) {
      s += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      s += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      s += ones[n] + " ";
    }
    return s.trim();
  }

  let num = Math.floor(amountInRupees);
  let res = "";

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const rem = num;

  if (crore > 0) res += convertBelowThousand(crore) + " Crore ";
  if (lakh > 0) res += convertBelowThousand(lakh) + " Lakh ";
  if (thousand > 0) res += convertBelowThousand(thousand) + " Thousand ";
  if (rem > 0) res += convertBelowThousand(rem);

  return `${res.trim()} Rupees Only`;
}

/**
 * Works out whether an invoice actually carries GST, and at what rate.
 *
 * Invoices raised before the studio was GST registered store zero in every tax
 * column, so the tax rows must disappear rather than print "CGST (9%): ₹0".
 * The rate comes from the stored line items, falling back to deriving it from
 * the totals, so a historic invoice always reports the rate it was raised at
 * rather than whatever the current setting says.
 */
export function invoiceTaxSummary(invoice: {
  subtotal: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  items?: Array<{ tax_rate_bps: number }>;
}): { hasGst: boolean; rateBps: number; fullRate: number; halfRate: number } {
  const taxTotal =
    (invoice.cgst_total || 0) + (invoice.sgst_total || 0) + (invoice.igst_total || 0);

  const fromItems = invoice.items?.find((i) => i.tax_rate_bps > 0)?.tax_rate_bps;
  const derived =
    invoice.subtotal > 0 ? Math.round((taxTotal / invoice.subtotal) * 10000) : 0;
  const rateBps = fromItems ?? derived;

  return {
    hasGst: taxTotal > 0,
    rateBps,
    fullRate: rateBps / 100,
    halfRate: rateBps / 200,
  };
}

/**
 * How long the studio takes to review and issue a tax invoice once a payment
 * has cleared.
 *
 * Payments settle instantly but the invoice is held as a draft for an admin to
 * check, so both the receipt email and the client portal quote this window.
 * Kept here rather than in the email module so client components can import it
 * without pulling in nodemailer.
 */
export const INVOICE_SLA_HOURS = 24;
export const INVOICE_SLA_NOTE = `Your tax invoice will be generated within ${INVOICE_SLA_HOURS} hours of payment verification.`;
