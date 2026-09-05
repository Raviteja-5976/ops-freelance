-- OpenRiverStack — stop hidden projects leaking through their billing records.
--
-- `projects`, `milestones`, `project_updates` and `project_features` all gate
-- client reads on `visible_to_client`. Three tables did not:
--
--   pay_client_read  on payments  -- client_id only
--   doc_client_read  on documents -- client_id + visibility only
--   inv_client_read  on invoices  -- client_id only
--
-- So a client linked under People & Access could read the label and amount of a
-- payment stage, the title of a file, and the number and total of an invoice
-- belonging to a project that had deliberately not been shared with them.
--
-- These policies keep client-level records (project_id is null) visible, and
-- otherwise require the parent project to be visible — matching how every other
-- client-facing table already behaves.

-- payments
drop policy if exists pay_client_read on payments;
create policy pay_client_read on payments for select using (
  client_id in (select my_client_ids())
  and exists (
    select 1 from projects p
    where p.id = payments.project_id
      and p.visible_to_client
  )
);

-- documents
drop policy if exists doc_client_read on documents;
create policy doc_client_read on documents for select using (
  visibility = 'client'
  and client_id in (select my_client_ids())
  and (
    project_id is null
    or exists (
      select 1 from projects p
      where p.id = documents.project_id
        and p.visible_to_client
    )
  )
);

-- invoices
drop policy if exists inv_client_read on invoices;
create policy inv_client_read on invoices for select using (
  status <> 'draft'
  and client_id in (select my_client_ids())
  and (
    project_id is null
    or exists (
      select 1 from projects p
      where p.id = invoices.project_id
        and p.visible_to_client
    )
  )
);

-- invoice_items follow their invoice, so the tightened invoice rule applies.
drop policy if exists ii_client_read on invoice_items;
create policy ii_client_read on invoice_items for select using (
  exists (
    select 1 from invoices i
    where i.id = invoice_items.invoice_id
      and i.status <> 'draft'
      and i.client_id in (select my_client_ids())
      and (
        i.project_id is null
        or exists (
          select 1 from projects p
          where p.id = i.project_id
            and p.visible_to_client
        )
      )
  )
);
