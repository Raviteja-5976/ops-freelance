import { Settings } from "@/types/database";

/**
 * Fallback business details.
 *
 * Real settings live in the `settings` table (row id 1) and are loaded through
 * `DataProvider`. This constant only fills in the gaps when that row has not
 * been created yet, so invoices and headers still render something sane.
 *
 * It is presentation fallback only — never seed it into the database and never
 * treat it as workspace content.
 */
export const defaultSettings: Settings = {
  id: 1,
  business_name: "OpenRiverStack",
  legal_name: "OpenRiverStack Studio",
  gstin: "",
  pan: "",
  address: {
    line1: "",
    city: "",
    state: "",
    state_code: "",
    postal_code: "",
    country: "India",
  },
  email: "",
  phone: "",
  website: "",
  logo_path: "/logo.png",
  default_currency: "INR",
  default_tax_rate_bps: 1800,
  invoice_series: "ORS",
  invoice_terms: "Payment due within 15 days of invoice date.",
  invoice_notes: "",
  timezone: "Asia/Kolkata",
  call_duration_minutes: 30,
  call_buffer_minutes: 15,
  call_min_notice_hours: 24,
  call_max_days_ahead: 21,
  updated_at: new Date().toISOString(),
};
