// Applies supabase/seed.sql's intent via the service-role key.
//
// Seeds only studio configuration (settings row 1 + weekly availability).
// It never creates clients, projects or invoices — that is real workspace data
// and belongs to the admin portal.
//
//   npm run seed

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { error: settingsError } = await supabase.from("settings").upsert(
  {
    id: 1,
    business_name: "OpenRiverStack",
    legal_name: "OpenRiverStack Studio",
    invoice_series: "ORS",
    timezone: "Asia/Kolkata",
    default_currency: "INR",
    default_tax_rate_bps: 1800,
    call_duration_minutes: 30,
    call_buffer_minutes: 15,
    call_min_notice_hours: 24,
    call_max_days_ahead: 21,
  },
  { onConflict: "id" }
);

if (settingsError) {
  console.error("settings:", settingsError.message);
  process.exit(1);
}
console.log("settings row ready");

// Mon-Fri, 10:00-13:00 and 15:00-18:00.
const { count } = await supabase
  .from("availability_rules")
  .select("*", { count: "exact", head: true });

if (count === 0) {
  const rules = [];
  for (let weekday = 1; weekday <= 5; weekday++) {
    rules.push({ weekday, start_time: "10:00", end_time: "13:00", is_active: true });
    rules.push({ weekday, start_time: "15:00", end_time: "18:00", is_active: true });
  }
  const { error } = await supabase.from("availability_rules").insert(rules);
  if (error) {
    console.error("availability_rules:", error.message);
    process.exit(1);
  }
  console.log(`inserted ${rules.length} availability rules`);
} else {
  console.log(`availability_rules already has ${count} rows — left alone`);
}

console.log("Done.");
