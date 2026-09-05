-- OpenRiverStack Client Portal — Cascade Delete Foreign Keys
-- Allows clean deletion of clients and projects with automatic cascade to child records.

-- 1. Projects table: cascade on client delete
alter table projects drop constraint if exists projects_client_id_fkey;
alter table projects
  add constraint projects_client_id_fkey
  foreign key (client_id) references clients(id) on delete cascade;

-- 2. Invoices table: cascade on client delete
alter table invoices drop constraint if exists invoices_client_id_fkey;
alter table invoices
  add constraint invoices_client_id_fkey
  foreign key (client_id) references clients(id) on delete cascade;

-- 3. Payments table: cascade on client delete
alter table payments drop constraint if exists payments_client_id_fkey;
alter table payments
  add constraint payments_client_id_fkey
  foreign key (client_id) references clients(id) on delete cascade;

-- 4. Invoices table: cascade on project delete (if attached)
alter table invoices drop constraint if exists invoices_project_id_fkey;
alter table invoices
  add constraint invoices_project_id_fkey
  foreign key (project_id) references projects(id) on delete set null;

-- 5. Payments table: cascade on project delete
alter table payments drop constraint if exists payments_project_id_fkey;
alter table payments
  add constraint payments_project_id_fkey
  foreign key (project_id) references projects(id) on delete cascade;
