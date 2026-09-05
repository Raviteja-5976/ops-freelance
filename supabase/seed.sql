-- OpenRiverStack Client Portal — Seed Data

-- 1. Default Settings
insert into settings (
  id, business_name, legal_name, gstin, pan, email, phone, website,
  invoice_series, timezone, default_tax_rate_bps, call_duration_minutes
) values (
  1,
  'OpenRiverStack',
  'OpenRiverStack Studio',
  '36AAFCO0000A1Z5',
  'AAFCO0000A',
  'raviteja@openriverstack.com',
  '+91 98765 43210',
  'https://openriverstack.com',
  'ORS',
  'Asia/Kolkata',
  1800,
  30
) on conflict (id) do update set
  business_name = excluded.business_name,
  timezone = excluded.timezone;

-- 2. Availability Rules (Mon-Fri 10am-1pm, 3pm-6pm)
delete from availability_rules;
insert into availability_rules (weekday, start_time, end_time, is_active) values
  (1, '10:00', '13:00', true),
  (1, '15:00', '18:00', true),
  (2, '10:00', '13:00', true),
  (2, '15:00', '18:00', true),
  (3, '10:00', '13:00', true),
  (3, '15:00', '18:00', true),
  (4, '10:00', '13:00', true),
  (4, '15:00', '18:00', true),
  (5, '10:00', '13:00', true);
