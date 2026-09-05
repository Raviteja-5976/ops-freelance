-- OpenRiverStack Client Portal — Initial Migration
-- Postgres 15 on Supabase

-- 1. Extensions
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- 2. Custom Types (Idempotent creation)
do $$ begin
  create type user_role as enum ('admin','client');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type client_status as enum ('active','archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type project_status as enum ('planning','design','development','testing','review','launch','completed','on_hold','archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type milestone_status as enum ('upcoming','in_progress','completed','skipped');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_status as enum ('scheduled','due','paid','failed','refunded','cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_method as enum ('bank_transfer','upi','card','netbanking','cash','other');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type invoice_status as enum ('draft','issued','partly_paid','paid','void');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type call_status as enum ('pending','confirmed','declined','reschedule_proposed','completed','cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type visibility as enum ('client','admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type doc_category as enum ('contract','proposal','design','report','invoice','other');
exception when duplicate_object then null;
end $$;

-- 3. Tables

-- profiles
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        user_role not null default 'client',
  full_name   text not null,
  email       text not null,
  phone       text,
  timezone    text not null default 'Asia/Kolkata',
  avatar_url  text,
  last_seen_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- clients
create table if not exists clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  legal_name    text,
  gstin         text,
  pan           text,
  email         text,
  phone         text,
  address_line1 text,
  address_line2 text,
  city          text,
  state         text,
  state_code    text,
  postal_code   text,
  country       text default 'India',
  status        client_status not null default 'active',
  internal_notes text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_clients_status on clients (status);

-- client_members
create table if not exists client_members (
  client_id  uuid not null references clients(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (client_id, profile_id)
);
create index if not exists idx_client_members_profile_id on client_members (profile_id);

-- projects
create table if not exists projects (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id) on delete restrict,
  name              text not null,
  summary           text,
  description       text,
  status            project_status not null default 'planning',
  progress          smallint not null default 0 check (progress between 0 and 100),
  progress_mode     text not null default 'auto' check (progress_mode in ('auto','manual')),
  currency          char(3) not null default 'INR',
  total_value       bigint not null default 0 check (total_value >= 0),
  start_date        date,
  expected_delivery date,
  delivered_at      date,
  visible_to_client boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_projects_client_status on projects (client_id, status);

-- milestones
create table if not exists milestones (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  title             text not null,
  description       text,
  status            milestone_status not null default 'upcoming',
  start_date        date,
  end_date          date,
  completed_at      timestamptz,
  position          integer not null default 0,
  visible_to_client boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (start_date is null or end_date is null or end_date >= start_date)
);
create index if not exists idx_milestones_project_pos on milestones (project_id, position);

create unique index if not exists one_current_milestone
  on milestones (project_id) where (status = 'in_progress');

-- project_updates
create table if not exists project_updates (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  title        text,
  body         text not null,
  published_at timestamptz,
  notified_at  timestamptz,
  author_id    uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_project_updates_published on project_updates (project_id, published_at desc nulls last);

-- project_features
create table if not exists project_features (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label      text not null,
  note       text,
  included   boolean not null default true,
  position   integer not null default 0
);

-- project_technologies
create table if not exists project_technologies (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  area       text not null,
  name       text not null,
  position   integer not null default 0
);

-- invoices
create table if not exists invoices (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references clients(id) on delete restrict,
  project_id       uuid references projects(id) on delete set null,
  number           text unique,
  series           text not null default 'ORS',
  fy               text,
  status           invoice_status not null default 'draft',
  issue_date       date,
  due_date         date,
  currency         char(3) not null default 'INR',
  bill_to_snapshot jsonb,
  seller_snapshot  jsonb,
  place_of_supply  text,
  is_interstate    boolean not null default false,
  subtotal         bigint not null default 0,
  discount_total   bigint not null default 0,
  cgst_total       bigint not null default 0,
  sgst_total       bigint not null default 0,
  igst_total       bigint not null default 0,
  total            bigint not null default 0,
  amount_paid      bigint not null default 0,
  notes            text,
  terms            text,
  pdf_path         text,
  issued_at        timestamptz,
  voided_at        timestamptz,
  void_reason      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (status = 'draft' or number is not null)
);
create index if not exists idx_invoices_client_status on invoices (client_id, status);
create index if not exists idx_invoices_status_due on invoices (status, due_date);

-- invoice_items
create table if not exists invoice_items (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references invoices(id) on delete cascade,
  description   text not null,
  hsn_sac       text,
  quantity      numeric(10,2) not null default 1,
  unit_price    bigint not null,
  discount      bigint not null default 0,
  tax_rate_bps  integer not null default 1800,
  taxable_value bigint not null default 0,
  cgst          bigint not null default 0,
  sgst          bigint not null default 0,
  igst          bigint not null default 0,
  line_total    bigint not null default 0,
  position      integer not null default 0
);
create index if not exists idx_invoice_items_invoice_pos on invoice_items (invoice_id, position);

-- invoice_counters
create table if not exists invoice_counters (
  series      text not null,
  fy          text not null,
  last_number integer not null default 0,
  primary key (series, fy)
);

-- payments
create table if not exists payments (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects(id) on delete cascade,
  client_id          uuid not null references clients(id) on delete restrict,
  invoice_id         uuid references invoices(id) on delete set null,
  label              text not null,
  amount             bigint not null check (amount > 0),
  currency           char(3) not null default 'INR',
  status             payment_status not null default 'scheduled',
  due_date           date,
  paid_at            timestamptz,
  method             payment_method,
  reference          text,
  gateway            text,
  gateway_order_id   text,
  gateway_payment_id text unique,
  payment_link_url   text,
  notes              text,
  position           integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check ((status = 'paid') = (paid_at is not null))
);
create index if not exists idx_payments_project_pos on payments (project_id, position);
create index if not exists idx_payments_status_due on payments (status, due_date);

-- documents
create table if not exists documents (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  project_id   uuid references projects(id) on delete cascade,
  title        text not null,
  description  text,
  category     doc_category not null default 'other',
  storage_path text not null unique,
  mime_type    text,
  size_bytes   bigint,
  visibility   visibility not null default 'admin',
  uploaded_by  uuid references profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists idx_documents_lookup on documents (client_id, project_id, visibility);

-- availability
create table if not exists availability_rules (
  id         uuid primary key default gen_random_uuid(),
  weekday    smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null,
  is_active  boolean not null default true,
  check (end_time > start_time)
);

create table if not exists availability_exceptions (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  is_blocked boolean not null default true,
  start_time time,
  end_time   time,
  reason     text
);
create index if not exists idx_availability_exceptions_date on availability_exceptions (date);

-- call_requests
-- Note: confirmed_end is stored and maintained by trigger to ensure exclusion constraint is 100% immutable
create table if not exists call_requests (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references clients(id) on delete cascade,
  project_id       uuid references projects(id) on delete set null,
  requested_by     uuid not null references profiles(id),
  requested_start  timestamptz not null,
  duration_minutes smallint not null default 30,
  reason           text not null,
  status           call_status not null default 'pending',
  confirmed_start  timestamptz,
  confirmed_end    timestamptz,
  proposed_start   timestamptz,
  meeting_url      text,
  admin_note       text,
  responded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_call_requests_status on call_requests (status, requested_start);

-- Trigger to automatically calculate confirmed_end whenever confirmed_start or duration changes
create or replace function sync_call_confirmed_end() returns trigger
language plpgsql as $$
begin
  if new.confirmed_start is not null then
    new.confirmed_end := new.confirmed_start + (coalesce(new.duration_minutes, 30) * interval '1 minute');
  else
    new.confirmed_end := null;
  end if;
  return new;
end $$;

drop trigger if exists tr_call_requests_confirmed_end on call_requests;
create trigger tr_call_requests_confirmed_end
  before insert or update on call_requests
  for each row execute function sync_call_confirmed_end();

-- The exclusion constraint uses pure column references, which are strictly immutable in PostgreSQL
alter table call_requests drop constraint if exists no_double_booking;
alter table call_requests add constraint no_double_booking
  exclude using gist (
    tstzrange(confirmed_start, confirmed_end) with &&
  ) where (status = 'confirmed');

-- settings
create table if not exists settings (
  id                    smallint primary key default 1 check (id = 1),
  business_name         text not null default 'OpenRiverStack',
  legal_name            text,
  gstin                 text,
  pan                   text,
  address               jsonb,
  email                 text,
  phone                 text,
  website               text,
  logo_path             text,
  default_currency      char(3) not null default 'INR',
  default_tax_rate_bps  integer not null default 1800,
  invoice_series        text not null default 'ORS',
  invoice_terms         text,
  invoice_notes         text,
  timezone              text not null default 'Asia/Kolkata',
  call_duration_minutes smallint not null default 30,
  call_buffer_minutes   smallint not null default 15,
  call_min_notice_hours smallint not null default 24,
  call_max_days_ahead   smallint not null default 21,
  updated_at            timestamptz not null default now()
);

-- activity_log
create table if not exists activity_log (
  id          bigserial primary key,
  actor_id    uuid references profiles(id),
  actor_role  user_role,
  entity_type text not null,
  entity_id   uuid,
  client_id   uuid references clients(id) on delete set null,
  action      text not null,
  diff        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_activity_log_entity on activity_log (entity_type, entity_id, created_at desc);
create index if not exists idx_activity_log_client on activity_log (client_id, created_at desc);

-- email_log
create table if not exists email_log (
  id          bigserial primary key,
  to_email    text not null,
  template    text not null,
  subject     text,
  payload     jsonb,
  provider_id text,
  status      text not null default 'queued',
  error       text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

-- 4. Derived Views & Functions

create or replace view project_financials as
select
  p.id as project_id,
  p.client_id,
  p.total_value,
  coalesce(sum(pay.amount) filter (where pay.status = 'paid'), 0) as amount_paid,
  p.total_value
    - coalesce(sum(pay.amount) filter (where pay.status = 'paid'), 0) as balance,
  min(pay.due_date) filter (where pay.status in ('scheduled','due')) as next_due_date
from projects p
left join payments pay on pay.project_id = p.id
group by p.id;

alter view project_financials set (security_invoker = on);

-- User trigger
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
          new.email);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- Auto progress recalculation
create or replace function recalc_project_progress() returns trigger
language plpgsql as $$
declare pid uuid; pct smallint;
begin
  pid := coalesce(new.project_id, old.project_id);
  select round(100.0 * count(*) filter (where status = 'completed')
               / greatest(count(*) filter (where status <> 'skipped'), 1))
    into pct
  from milestones where project_id = pid and visible_to_client;

  update projects set progress = pct, updated_at = now()
   where id = pid and progress_mode = 'auto';
  return null;
end $$;

drop trigger if exists milestones_progress on milestones;
create trigger milestones_progress
  after insert or update or delete on milestones
  for each row execute function recalc_project_progress();

-- touch updated_at
create or replace function touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists tr_profiles_updated on profiles;
create trigger tr_profiles_updated before update on profiles for each row execute function touch_updated_at();

drop trigger if exists tr_clients_updated on clients;
create trigger tr_clients_updated before update on clients for each row execute function touch_updated_at();

drop trigger if exists tr_projects_updated on projects;
create trigger tr_projects_updated before update on projects for each row execute function touch_updated_at();

drop trigger if exists tr_milestones_updated on milestones;
create trigger tr_milestones_updated before update on milestones for each row execute function touch_updated_at();

drop trigger if exists tr_updates_updated on project_updates;
create trigger tr_updates_updated before update on project_updates for each row execute function touch_updated_at();

drop trigger if exists tr_invoices_updated on invoices;
create trigger tr_invoices_updated before update on invoices for each row execute function touch_updated_at();

drop trigger if exists tr_payments_updated on payments;
create trigger tr_payments_updated before update on payments for each row execute function touch_updated_at();

drop trigger if exists tr_call_requests_updated on call_requests;
create trigger tr_call_requests_updated before update on call_requests for each row execute function touch_updated_at();

-- Invoice number generator
create or replace function next_invoice_number(p_series text, p_fy text)
returns text language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into invoice_counters (series, fy, last_number)
  values (p_series, p_fy, 1)
  on conflict (series, fy)
    do update set last_number = invoice_counters.last_number + 1
  returning last_number into n;
  return p_series || '/' || p_fy || '/' || lpad(n::text, 3, '0');
end $$;

-- 5. Row Level Security

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function my_client_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select client_id from client_members where profile_id = auth.uid();
$$;

alter table profiles enable row level security;
alter table clients enable row level security;
alter table client_members enable row level security;
alter table projects enable row level security;
alter table milestones enable row level security;
alter table project_updates enable row level security;
alter table project_features enable row level security;
alter table project_technologies enable row level security;
alter table payments enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table documents enable row level security;
alter table call_requests enable row level security;
alter table availability_rules enable row level security;
alter table availability_exceptions enable row level security;
alter table settings enable row level security;
alter table activity_log enable row level security;
alter table email_log enable row level security;
alter table invoice_counters enable row level security;

-- Policies (Idempotent drops before creation)
drop policy if exists p_self_read on profiles;
create policy p_self_read on profiles for select using (id = auth.uid() or is_admin());

drop policy if exists p_self_update on profiles;
create policy p_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));

drop policy if exists p_admin_all on profiles;
create policy p_admin_all on profiles for all using (is_admin()) with check (is_admin());

drop policy if exists c_admin on clients;
create policy c_admin on clients for all using (is_admin()) with check (is_admin());

drop policy if exists c_member_read on clients;
create policy c_member_read on clients for select using (id in (select my_client_ids()));

drop policy if exists cm_admin on client_members;
create policy cm_admin on client_members for all using (is_admin()) with check (is_admin());

drop policy if exists cm_self_read on client_members;
create policy cm_self_read on client_members for select using (profile_id = auth.uid());

drop policy if exists pr_admin on projects;
create policy pr_admin on projects for all using (is_admin()) with check (is_admin());

drop policy if exists pr_client_read on projects;
create policy pr_client_read on projects for select using (visible_to_client and client_id in (select my_client_ids()));

drop policy if exists ms_admin on milestones;
create policy ms_admin on milestones for all using (is_admin()) with check (is_admin());

drop policy if exists ms_client_read on milestones;
create policy ms_client_read on milestones for select using (visible_to_client and exists (select 1 from projects p where p.id = milestones.project_id and p.visible_to_client and p.client_id in (select my_client_ids())));

drop policy if exists pu_admin on project_updates;
create policy pu_admin on project_updates for all using (is_admin()) with check (is_admin());

drop policy if exists pu_client_read on project_updates;
create policy pu_client_read on project_updates for select using (published_at is not null and published_at <= now() and exists (select 1 from projects p where p.id = project_updates.project_id and p.visible_to_client and p.client_id in (select my_client_ids())));

drop policy if exists pf_admin on project_features;
create policy pf_admin on project_features for all using (is_admin()) with check (is_admin());

drop policy if exists pf_client_read on project_features;
create policy pf_client_read on project_features for select using (exists (select 1 from projects p where p.id = project_features.project_id and p.visible_to_client and p.client_id in (select my_client_ids())));

drop policy if exists pt_admin on project_technologies;
create policy pt_admin on project_technologies for all using (is_admin()) with check (is_admin());

drop policy if exists pt_client_read on project_technologies;
create policy pt_client_read on project_technologies for select using (exists (select 1 from projects p where p.id = project_technologies.project_id and p.visible_to_client and p.client_id in (select my_client_ids())));

drop policy if exists pay_admin on payments;
create policy pay_admin on payments for all using (is_admin()) with check (is_admin());

drop policy if exists pay_client_read on payments;
create policy pay_client_read on payments for select using (client_id in (select my_client_ids()));

drop policy if exists inv_admin on invoices;
create policy inv_admin on invoices for all using (is_admin()) with check (is_admin());

drop policy if exists inv_client_read on invoices;
create policy inv_client_read on invoices for select using (status <> 'draft' and client_id in (select my_client_ids()));

drop policy if exists ii_admin on invoice_items;
create policy ii_admin on invoice_items for all using (is_admin()) with check (is_admin());

drop policy if exists ii_client_read on invoice_items;
create policy ii_client_read on invoice_items for select using (exists (select 1 from invoices i where i.id = invoice_items.invoice_id and i.status <> 'draft' and i.client_id in (select my_client_ids())));

drop policy if exists doc_admin on documents;
create policy doc_admin on documents for all using (is_admin()) with check (is_admin());

drop policy if exists doc_client_read on documents;
create policy doc_client_read on documents for select using (visibility = 'client' and client_id in (select my_client_ids()));

drop policy if exists cr_admin on call_requests;
create policy cr_admin on call_requests for all using (is_admin()) with check (is_admin());

drop policy if exists cr_client_read on call_requests;
create policy cr_client_read on call_requests for select using (client_id in (select my_client_ids()));

drop policy if exists cr_client_insert on call_requests;
create policy cr_client_insert on call_requests for insert with check (requested_by = auth.uid() and client_id in (select my_client_ids()) and status = 'pending');

drop policy if exists cr_client_cancel on call_requests;
create policy cr_client_cancel on call_requests for update using (client_id in (select my_client_ids()) and status in ('pending','reschedule_proposed')) with check (status in ('cancelled','confirmed'));

drop policy if exists av_read on availability_rules;
create policy av_read on availability_rules for select using (auth.uid() is not null);

drop policy if exists av_admin on availability_rules;
create policy av_admin on availability_rules for all using (is_admin()) with check (is_admin());

drop policy if exists ax_read on availability_exceptions;
create policy ax_read on availability_exceptions for select using (auth.uid() is not null);

drop policy if exists ax_admin on availability_exceptions;
create policy ax_admin on availability_exceptions for all using (is_admin()) with check (is_admin());

drop policy if exists s_admin on settings;
create policy s_admin on settings for all using (is_admin()) with check (is_admin());

drop policy if exists al_admin on activity_log;
create policy al_admin on activity_log for select using (is_admin());

drop policy if exists el_admin on email_log;
create policy el_admin on email_log for select using (is_admin());

drop policy if exists ic_admin on invoice_counters;
create policy ic_admin on invoice_counters for all using (is_admin()) with check (is_admin());

-- Storage policies
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('invoices', 'invoices', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('branding', 'branding', true) on conflict (id) do nothing;

drop policy if exists "clients read own documents" on storage.objects;
create policy "clients read own documents" on storage.objects for select using (
  bucket_id = 'documents' and (storage.foldername(name))[1] in (select my_client_ids()::text)
);

drop policy if exists "admin manages documents" on storage.objects;
create policy "admin manages documents" on storage.objects for all using (
  bucket_id in ('documents','invoices','branding') and is_admin()
);
