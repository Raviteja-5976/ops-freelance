// OpenRiverStack — Supabase data access layer.
//
// Every admin screen reads and writes through here so that nothing lives only
// in browser memory. Deletes are ordered explicitly because several foreign
// keys in the initial migration are `on delete restrict`.

import { createClient } from "@/lib/supabase/client";
import {
  ActivityLog,
  AvailabilityRule,
  CallRequest,
  Client,
  ClientMember,
  Document,
  Invoice,
  InvoiceItem,
  Milestone,
  Payment,
  Profile,
  Project,
  ProjectFeature,
  ProjectTechnology,
  ProjectUpdate,
  Settings,
} from "@/types/database";

/** Turns a Supabase error into something a human can act on. */
export class DbError extends Error {
  readonly code?: string;
  readonly details?: string;

  constructor(action: string, error: { message: string; code?: string; details?: string; hint?: string }) {
    const parts = [error.message];
    if (error.details) parts.push(error.details);
    if (error.hint) parts.push(error.hint);
    super(`${action}: ${parts.filter(Boolean).join(" — ")}`);
    this.name = "DbError";
    this.code = error.code;
    this.details = error.details;
  }
}

function unwrap<T>(action: string, res: { data: T | null; error: any }): T {
  if (res.error) throw new DbError(action, res.error);
  return res.data as T;
}

/** A full snapshot of everything the admin portal renders. */
export interface DataSnapshot {
  clients: Client[];
  clientMembers: ClientMember[];
  profiles: Profile[];
  projects: Project[];
  milestones: Milestone[];
  updates: ProjectUpdate[];
  features: ProjectFeature[];
  technologies: ProjectTechnology[];
  invoices: Invoice[];
  payments: Payment[];
  documents: Document[];
  callRequests: CallRequest[];
  availabilityRules: AvailabilityRule[];
  activityLogs: ActivityLog[];
  settings: Settings | null;
}

export const emptySnapshot: DataSnapshot = {
  clients: [],
  clientMembers: [],
  profiles: [],
  projects: [],
  milestones: [],
  updates: [],
  features: [],
  technologies: [],
  invoices: [],
  payments: [],
  documents: [],
  callRequests: [],
  availabilityRules: [],
  activityLogs: [],
  settings: null,
};

/**
 * Loads the whole workspace in one pass.
 *
 * Every table is queried in parallel and then stitched together in memory:
 * PostgREST embedding would need each relationship spelled out, and the join
 * shapes the pages want (project.client, payment.project, invoice.items) are
 * cheap to assemble here given the row counts involved.
 */
export async function fetchSnapshot(): Promise<DataSnapshot> {
  const supabase = createClient();

  const [
    clients,
    clientMembers,
    profiles,
    projects,
    milestones,
    updates,
    features,
    technologies,
    invoices,
    invoiceItems,
    payments,
    documents,
    callRequests,
    availabilityRules,
    activityLogs,
    settings,
  ] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("client_members").select("*"),
    supabase.from("profiles").select("*"),
    supabase.from("projects").select("*").order("created_at", { ascending: false }),
    supabase.from("milestones").select("*").order("position", { ascending: true }),
    supabase.from("project_updates").select("*").order("created_at", { ascending: false }),
    supabase.from("project_features").select("*").order("position", { ascending: true }),
    supabase.from("project_technologies").select("*").order("position", { ascending: true }),
    supabase.from("invoices").select("*").order("created_at", { ascending: false }),
    supabase.from("invoice_items").select("*").order("position", { ascending: true }),
    supabase.from("payments").select("*").order("position", { ascending: true }),
    supabase.from("documents").select("*").order("created_at", { ascending: false }),
    supabase.from("call_requests").select("*").order("requested_start", { ascending: false }),
    supabase.from("availability_rules").select("*").order("weekday", { ascending: true }),
    supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  const first = [
    ["load clients", clients],
    ["load client members", clientMembers],
    ["load profiles", profiles],
    ["load projects", projects],
    ["load milestones", milestones],
    ["load updates", updates],
    ["load features", features],
    ["load technologies", technologies],
    ["load invoices", invoices],
    ["load invoice items", invoiceItems],
    ["load payments", payments],
    ["load documents", documents],
    ["load call requests", callRequests],
    ["load availability", availabilityRules],
    ["load activity", activityLogs],
    ["load settings", settings],
  ].find(([, res]) => (res as any).error);

  if (first) throw new DbError(first[0] as string, (first[1] as any).error);

  const clientRows = (clients.data || []) as Client[];
  const profileRows = (profiles.data || []) as Profile[];
  const projectRows = (projects.data || []) as Project[];
  const invoiceRows = (invoices.data || []) as Invoice[];

  const clientById = new Map(clientRows.map((c) => [c.id, c]));
  const profileById = new Map(profileRows.map((p) => [p.id, p]));

  // Attach the relations the pages read off each row.
  const projectsJoined: Project[] = projectRows.map((p) => ({
    ...p,
    client: clientById.get(p.client_id),
  }));
  const projectById = new Map(projectsJoined.map((p) => [p.id, p]));

  const invoicesJoined: Invoice[] = invoiceRows.map((inv) => ({
    ...inv,
    client: clientById.get(inv.client_id),
    project: inv.project_id ? projectById.get(inv.project_id) : undefined,
    items: ((invoiceItems.data || []) as any[]).filter((it) => it.invoice_id === inv.id),
  }));
  const invoiceById = new Map(invoicesJoined.map((i) => [i.id, i]));

  return {
    clients: clientRows,
    clientMembers: ((clientMembers.data || []) as ClientMember[]).map((cm) => ({
      ...cm,
      profile: profileById.get(cm.profile_id),
    })),
    profiles: profileRows,
    projects: projectsJoined,
    milestones: (milestones.data || []) as Milestone[],
    updates: ((updates.data || []) as ProjectUpdate[]).map((u) => ({
      ...u,
      author: u.author_id ? profileById.get(u.author_id) : undefined,
    })),
    features: (features.data || []) as ProjectFeature[],
    technologies: (technologies.data || []) as ProjectTechnology[],
    invoices: invoicesJoined,
    payments: ((payments.data || []) as Payment[]).map((p) => ({
      ...p,
      project: projectById.get(p.project_id),
      invoice: p.invoice_id ? invoiceById.get(p.invoice_id) : undefined,
    })),
    documents: (documents.data || []) as Document[],
    callRequests: ((callRequests.data || []) as CallRequest[]).map((c) => ({
      ...c,
      client: clientById.get(c.client_id),
      project: c.project_id ? projectById.get(c.project_id) : undefined,
      requested_by_profile: c.requested_by ? profileById.get(c.requested_by) : undefined,
    })),
    availabilityRules: (availabilityRules.data || []) as AvailabilityRule[],
    activityLogs: (activityLogs.data || []) as ActivityLog[],
    settings: (settings.data as Settings) || null,
  };
}

/* ------------------------------------------------------------------ clients */

export type NewClientInput = {
  name: string;
  legal_name?: string | null;
  gstin?: string | null;
  pan?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  state_code?: string | null;
  postal_code?: string | null;
  country?: string | null;
  internal_notes?: string | null;
};

export async function createClientRecord(input: NewClientInput): Promise<Client> {
  const supabase = createClient();
  return unwrap(
    "Could not create client",
    await supabase
      .from("clients")
      .insert({ ...input, status: "active" })
      .select("*")
      .single()
  );
}

export async function updateClientRecord(
  id: string,
  patch: Partial<Client>
): Promise<Client> {
  const supabase = createClient();
  // Strip joined/immutable fields so PostgREST never sees an unknown column.
  const { created_at, updated_at, id: _id, ...rest } = patch as any;
  return unwrap(
    "Could not update client",
    await supabase.from("clients").update(rest).eq("id", id).select("*").single()
  );
}

/**
 * Deletes a client and everything hanging off it.
 *
 * `projects`, `invoices` and `payments` reference `clients` with
 * `on delete restrict`, so the database will not cascade for us — the children
 * have to go first, deepest dependency last.
 */
export async function deleteClientRecord(clientId: string): Promise<void> {
  const supabase = createClient();

  // Remove the client's uploaded files first. Object keys are prefixed with the
  // client id, so the whole folder goes; deleting rows alone would leave the
  // objects stranded in the bucket forever.
  const { data: objects } = await supabase.storage.from("documents").list(clientId);
  if (objects && objects.length > 0) {
    await supabase.storage
      .from("documents")
      .remove(objects.map((o) => `${clientId}/${o.name}`));
  }

  const steps: Array<[string, string, string]> = [
    ["payments", "client_id", "payments"],
    ["invoices", "client_id", "invoices"],
    ["documents", "client_id", "documents"],
    ["call_requests", "client_id", "call requests"],
    ["projects", "client_id", "projects"],
    ["client_members", "client_id", "team members"],
  ];

  for (const [table, column, label] of steps) {
    const { error } = await supabase.from(table).delete().eq(column, clientId);
    if (error) throw new DbError(`Could not delete ${label} for this client`, error);
  }

  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) throw new DbError("Could not delete client", error);
}

/* ----------------------------------------------------------------- projects */

export type NewProjectInput = {
  client_id: string;
  name: string;
  summary?: string | null;
  description?: string | null;
  status: Project["status"];
  total_value: number;
  expected_delivery?: string | null;
  start_date?: string | null;
  visible_to_client?: boolean;
};

export async function createProjectRecord(input: NewProjectInput): Promise<Project> {
  const supabase = createClient();
  return unwrap(
    "Could not create project",
    await supabase
      .from("projects")
      .insert({
        ...input,
        progress: 0,
        progress_mode: "auto",
        currency: "INR",
        visible_to_client: input.visible_to_client ?? false,
      })
      .select("*")
      .single()
  );
}

export async function updateProjectRecord(
  id: string,
  patch: Partial<Project>
): Promise<Project> {
  const supabase = createClient();
  const { created_at, updated_at, id: _id, client, ...rest } = patch as any;
  return unwrap(
    "Could not update project",
    await supabase.from("projects").update(rest).eq("id", id).select("*").single()
  );
}

/**
 * Deletes a project. Milestones, updates, features, technologies, documents and
 * payments all cascade from `projects`, but `payments.client_id` is `restrict`,
 * so payments are removed explicitly before the project row goes.
 */
export async function deleteProjectRecord(projectId: string): Promise<void> {
  const supabase = createClient();

  // `documents` cascades from `projects`, so collect the storage keys before
  // the rows disappear and the objects become unreachable.
  const { data: docs } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("project_id", projectId);

  const { error: payErr } = await supabase
    .from("payments")
    .delete()
    .eq("project_id", projectId);
  if (payErr) throw new DbError("Could not delete payments for this project", payErr);

  // Invoices point at projects with `on delete set null`; detach explicitly so
  // the invoice history survives the project.
  const { error: invErr } = await supabase
    .from("invoices")
    .update({ project_id: null })
    .eq("project_id", projectId);
  if (invErr) throw new DbError("Could not detach invoices from this project", invErr);

  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw new DbError("Could not delete project", error);

  if (docs && docs.length > 0) {
    await supabase.storage.from("documents").remove(docs.map((d) => d.storage_path));
  }
}

/* ---------------------------------------------------------------- milestones */

export async function createMilestoneRecord(
  input: Partial<Milestone> & { project_id: string; title: string }
): Promise<Milestone> {
  const supabase = createClient();
  return unwrap(
    "Could not add milestone",
    await supabase.from("milestones").insert(input).select("*").single()
  );
}

export async function updateMilestoneRecord(
  id: string,
  patch: Partial<Milestone>
): Promise<Milestone> {
  const supabase = createClient();
  const { created_at, updated_at, id: _id, ...rest } = patch as any;
  return unwrap(
    "Could not update milestone",
    await supabase.from("milestones").update(rest).eq("id", id).select("*").single()
  );
}

export async function deleteMilestoneRecord(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("milestones").delete().eq("id", id);
  if (error) throw new DbError("Could not delete milestone", error);
}

/* ------------------------------------------------------------------ updates */

export async function createUpdateRecord(
  input: Partial<ProjectUpdate> & { project_id: string; body: string }
): Promise<ProjectUpdate> {
  const supabase = createClient();
  return unwrap(
    "Could not publish update",
    await supabase.from("project_updates").insert(input).select("*").single()
  );
}

export async function deleteUpdateRecord(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("project_updates").delete().eq("id", id);
  if (error) throw new DbError("Could not delete update", error);
}

/* --------------------------------------------------- features & technologies */

export async function createFeatureRecord(
  input: Partial<ProjectFeature> & { project_id: string; label: string }
): Promise<ProjectFeature> {
  const supabase = createClient();
  return unwrap(
    "Could not add deliverable",
    await supabase.from("project_features").insert(input).select("*").single()
  );
}

export async function updateFeatureRecord(
  id: string,
  patch: Partial<ProjectFeature>
): Promise<ProjectFeature> {
  const supabase = createClient();
  const { id: _id, ...rest } = patch as any;
  return unwrap(
    "Could not update deliverable",
    await supabase.from("project_features").update(rest).eq("id", id).select("*").single()
  );
}

export async function deleteFeatureRecord(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("project_features").delete().eq("id", id);
  if (error) throw new DbError("Could not delete deliverable", error);
}

export async function createTechnologyRecord(
  input: Partial<ProjectTechnology> & { project_id: string; area: string; name: string }
): Promise<ProjectTechnology> {
  const supabase = createClient();
  return unwrap(
    "Could not add technology",
    await supabase.from("project_technologies").insert(input).select("*").single()
  );
}

export async function deleteTechnologyRecord(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("project_technologies").delete().eq("id", id);
  if (error) throw new DbError("Could not delete technology", error);
}

/* ----------------------------------------------------------- client members */

/**
 * Links an existing portal user to a client.
 *
 * `profiles.id` is a foreign key onto `auth.users`, so a member can only be
 * attached once that person actually has an account — there is no way to
 * fabricate a profile row from the browser.
 */
export async function addClientMemberRecord(
  clientId: string,
  email: string,
  isPrimary: boolean
): Promise<ClientMember> {
  const supabase = createClient();

  const profile = unwrap(
    "Could not look up that person",
    await supabase
      .from("profiles")
      .select("*")
      .ilike("email", email.trim())
      .maybeSingle()
  ) as Profile | null;

  if (!profile) {
    throw new Error(
      `No portal account exists for ${email}. Ask them to sign up first, then add them here.`
    );
  }

  return unwrap(
    "Could not add team member",
    await supabase
      .from("client_members")
      .upsert(
        { client_id: clientId, profile_id: profile.id, is_primary: isPrimary },
        { onConflict: "client_id,profile_id" }
      )
      .select("*")
      .single()
  );
}

export async function removeClientMemberRecord(
  clientId: string,
  profileId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("client_members")
    .delete()
    .eq("client_id", clientId)
    .eq("profile_id", profileId);
  if (error) throw new DbError("Could not remove team member", error);
}

/* ----------------------------------------------------------------- settings */

export async function saveSettingsRecord(patch: Partial<Settings>): Promise<Settings> {
  const supabase = createClient();
  const { updated_at, ...rest } = patch as any;
  return unwrap(
    "Could not save settings",
    await supabase
      .from("settings")
      .upsert({ ...rest, id: 1 }, { onConflict: "id" })
      .select("*")
      .single()
  );
}

/* ----------------------------------------------------------------- invoices */

export type NewInvoiceInput = {
  invoice: Omit<Partial<Invoice>, "items"> & { client_id: string };
  items: Array<Omit<InvoiceItem, "id" | "invoice_id">>;
  /** Issue immediately (reserves a number) instead of saving a draft. */
  issue: boolean;
};

/**
 * Creates an invoice and its line items.
 *
 * Issued invoices take their number from `next_invoice_number`, which bumps
 * `invoice_counters` atomically — never number an invoice by counting rows,
 * which races and leaves gaps.
 */
export async function createInvoiceRecord({
  invoice,
  items,
  issue,
}: NewInvoiceInput): Promise<Invoice> {
  const supabase = createClient();

  let number: string | null = null;
  if (issue) {
    const { data, error } = await supabase.rpc("next_invoice_number", {
      p_series: invoice.series || "ORS",
      p_fy: invoice.fy || null,
    });
    if (error) throw new DbError("Could not reserve an invoice number", error);
    number = data as string;
  }

  const created = unwrap(
    "Could not create invoice",
    await supabase
      .from("invoices")
      .insert({
        ...invoice,
        number,
        status: issue ? "issued" : "draft",
        issued_at: issue ? new Date().toISOString() : null,
      })
      .select("*")
      .single()
  ) as Invoice;

  if (items.length > 0) {
    const { error } = await supabase
      .from("invoice_items")
      .insert(items.map((it) => ({ ...it, invoice_id: created.id })));
    if (error) {
      // The invoice is meaningless without its lines — roll it back by hand
      // since PostgREST gives us no multi-statement transaction.
      await supabase.from("invoices").delete().eq("id", created.id);
      throw new DbError("Could not save invoice line items", error);
    }
  }

  return created;
}

export async function updateInvoiceRecord(
  id: string,
  patch: Partial<Invoice>
): Promise<Invoice> {
  const supabase = createClient();
  const { created_at, updated_at, id: _id, items, client, project, ...rest } = patch as any;
  return unwrap(
    "Could not update invoice",
    await supabase.from("invoices").update(rest).eq("id", id).select("*").single()
  );
}

/** Moves a draft to issued, reserving its number at that moment. */
export async function issueInvoiceRecord(invoice: Invoice): Promise<Invoice> {
  const supabase = createClient();

  let number = invoice.number;
  if (!number) {
    const { data, error } = await supabase.rpc("next_invoice_number", {
      p_series: invoice.series || "ORS",
      p_fy: invoice.fy || null,
    });
    if (error) throw new DbError("Could not reserve an invoice number", error);
    number = data as string;
  }

  return unwrap(
    "Could not issue invoice",
    await supabase
      .from("invoices")
      .update({ status: "issued", number, issued_at: new Date().toISOString() })
      .eq("id", invoice.id)
      .select("*")
      .single()
  );
}

export async function voidInvoiceRecord(id: string, reason: string): Promise<Invoice> {
  const supabase = createClient();
  return unwrap(
    "Could not void invoice",
    await supabase
      .from("invoices")
      .update({ status: "void", voided_at: new Date().toISOString(), void_reason: reason })
      .eq("id", id)
      .select("*")
      .single()
  );
}

/* ----------------------------------------------------------------- profiles */

export async function updateProfileRecord(
  id: string,
  patch: Partial<Profile>
): Promise<Profile> {
  const supabase = createClient();
  // `role` is deliberately not updatable here — the self-update RLS policy
  // rejects any change to it.
  const { created_at, updated_at, id: _id, role, ...rest } = patch as any;
  return unwrap(
    "Could not save your profile",
    await supabase.from("profiles").update(rest).eq("id", id).select("*").single()
  );
}

/* ------------------------------------------------------------- availability */

export async function replaceAvailabilityRules(
  rules: Array<Omit<AvailabilityRule, "id">>
): Promise<AvailabilityRule[]> {
  const supabase = createClient();

  const { error: delErr } = await supabase
    .from("availability_rules")
    .delete()
    .not("id", "is", null);
  if (delErr) throw new DbError("Could not clear availability", delErr);

  if (rules.length === 0) return [];

  return unwrap(
    "Could not save availability",
    await supabase.from("availability_rules").insert(rules).select("*")
  );
}

/* ------------------------------------------------------------ call requests */

/**
 * Books a call slot for the signed-in client.
 *
 * The `cr_client_insert` policy only accepts rows where `requested_by` is the
 * caller and the status is `pending`, so both are set here rather than trusted
 * from the caller.
 */
export async function createCallRequestRecord(input: {
  client_id: string;
  project_id?: string | null;
  requested_by: string;
  requested_start: string;
  duration_minutes: number;
  reason: string;
}): Promise<CallRequest> {
  const supabase = createClient();
  return unwrap(
    "Could not request this call",
    await supabase
      .from("call_requests")
      .insert({ ...input, project_id: input.project_id || null, status: "pending" })
      .select("*")
      .single()
  );
}

export async function updateCallRequestRecord(
  id: string,
  patch: Partial<CallRequest>
): Promise<CallRequest> {
  const supabase = createClient();
  const { created_at, updated_at, id: _id, client, project, requested_by_profile, ...rest } =
    patch as any;
  return unwrap(
    "Could not update call request",
    await supabase.from("call_requests").update(rest).eq("id", id).select("*").single()
  );
}

/* ---------------------------------------------------------------- payments */

/**
 * Adds one stage to a project's payment schedule.
 *
 * `label` is the studio's own wording for the stage ("Advance", "On design
 * sign-off", ...), and `amount` is in paise. The table rejects amounts of zero
 * or less, so callers must validate before getting here.
 */
export async function createPaymentRecord(input: {
  project_id: string;
  client_id: string;
  label: string;
  amount: number;
  due_date?: string | null;
  position: number;
  notes?: string | null;
}): Promise<Payment> {
  const supabase = createClient();
  return unwrap(
    "Could not add payment stage",
    await supabase
      .from("payments")
      .insert({
        ...input,
        due_date: input.due_date || null,
        currency: "INR",
        status: "scheduled",
      })
      .select("*")
      .single()
  );
}

export async function deletePaymentRecord(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw new DbError("Could not delete payment stage", error);
}

export async function updatePaymentRecord(
  id: string,
  patch: Partial<Payment>
): Promise<Payment> {
  const supabase = createClient();
  const { created_at, updated_at, id: _id, invoice, project, ...rest } = patch as any;
  return unwrap(
    "Could not update payment",
    await supabase.from("payments").update(rest).eq("id", id).select("*").single()
  );
}

/* --------------------------------------------------------------- documents */

/**
 * Uploads a file to the private `documents` bucket and records it.
 *
 * The object key must start with the client id — the storage policy that lets a
 * client read their own files matches on the first path segment.
 */
export async function uploadDocumentRecord(
  file: File,
  meta: {
    client_id: string;
    project_id?: string | null;
    title: string;
    category: Document["category"];
    visibility: Document["visibility"];
    uploaded_by?: string | null;
  }
): Promise<Document> {
  const supabase = createClient();

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${meta.client_id}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file, { upsert: false, contentType: file.type || undefined });
  if (uploadError) throw new DbError("Could not upload file", uploadError as any);

  try {
    return unwrap(
      "Could not save file details",
      await supabase
        .from("documents")
        .insert({
          ...meta,
          project_id: meta.project_id || null,
          storage_path: storagePath,
          mime_type: file.type || null,
          size_bytes: file.size,
        })
        .select("*")
        .single()
    );
  } catch (err) {
    // Don't leave an orphaned object behind if the row insert fails.
    await supabase.storage.from("documents").remove([storagePath]);
    throw err;
  }
}

/** Short-lived signed URL for a private document. */
export async function getDocumentUrl(storagePath: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 60);
  if (error || !data) throw new DbError("Could not open file", (error as any) || { message: "no url" });
  return data.signedUrl;
}

export async function updateDocumentRecord(
  id: string,
  patch: Partial<Document>
): Promise<Document> {
  const supabase = createClient();
  const { created_at, id: _id, ...rest } = patch as any;
  return unwrap(
    "Could not update file",
    await supabase.from("documents").update(rest).eq("id", id).select("*").single()
  );
}

export async function deleteDocumentRecord(id: string, storagePath?: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw new DbError("Could not delete file", error);
  if (storagePath) {
    await supabase.storage.from("documents").remove([storagePath]);
  }
}
