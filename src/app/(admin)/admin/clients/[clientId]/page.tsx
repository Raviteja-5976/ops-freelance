"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, notFound } from "next/navigation";
import { formatMoney, formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmailCombobox, EmailSuggestion } from "@/components/ui/EmailCombobox";
import { useToast } from "@/components/ui/Toast";
import { useData } from "@/components/providers/DataProvider";
import {
  deleteClientRecord,
  deleteProjectRecord,
  removeClientMemberRecord,
  updateClientRecord,
  updateProjectRecord,
} from "@/lib/db";
import { ClientStatus } from "@/types/database";

export default function AdminClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const { showToast } = useToast();

  const {
    clients,
    clientMembers,
    profiles,
    projects,
    invoices,
    callRequests,
    loading,
    error,
    refresh,
  } = useData();

  const client = clients.find((c) => c.id === clientId);

  const [activeTab, setActiveTab] = useState<"overview" | "people" | "projects" | "invoices" | "calls">("overview");

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [gstin, setGstin] = useState("");
  const [pan, setPan] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [status, setStatus] = useState<ClientStatus>("active");
  const [notes, setNotes] = useState("");
  const [savingBilling, setSavingBilling] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteClientModalOpen, setDeleteClientModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);

  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [togglingProjectId, setTogglingProjectId] = useState<string | null>(null);

  // Mirror the saved record into the edit form whenever it (re)loads.
  useEffect(() => {
    if (!client) return;
    setName(client.name || "");
    setLegalName(client.legal_name || "");
    setContactEmail(client.email || "");
    setContactPhone(client.phone || "");
    setGstin(client.gstin || "");
    setPan(client.pan || "");
    setAddressLine1(client.address_line1 || "");
    setAddressLine2(client.address_line2 || "");
    setCity(client.city || "");
    setState(client.state || "");
    setStateCode(client.state_code || "");
    setPostalCode(client.postal_code || "");
    setStatus(client.status);
    setNotes(client.internal_notes || "");
  }, [client]);

  const members = clientMembers.filter((cm) => cm.client_id === clientId);

  /**
   * Everyone who already has an account, offered as type-ahead.
   *
   * People already on this client stay in the list but are flagged and cannot
   * be picked — hiding them would just look like the address does not exist.
   */
  const emailSuggestions: EmailSuggestion[] = profiles
    .filter((p) => Boolean(p.email))
    .map((p) => {
      const alreadyMember = members.some((m) => m.profile_id === p.id);
      return {
        email: p.email,
        name: p.full_name,
        tag: p.role === "admin" ? "Studio admin" : null,
        disabled: alreadyMember,
        disabledReason: "Already added",
      };
    });
  const clientProjects = projects.filter((p) => p.client_id === clientId);
  const clientInvoices = invoices.filter((i) => i.client_id === clientId);
  const clientCalls = callRequests.filter((c) => c.client_id === clientId);

  const handleSaveBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || savingBilling) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Client name is required.");
      return;
    }

    setSavingBilling(true);
    setFormError(null);
    try {
      await updateClientRecord(client.id, {
        name: trimmedName,
        legal_name: legalName.trim() || null,
        email: contactEmail.trim() || null,
        phone: contactPhone.trim() || null,
        gstin: gstin.trim() || null,
        pan: pan.trim() || null,
        address_line1: addressLine1.trim() || null,
        address_line2: addressLine2.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        state_code: stateCode.trim() || null,
        postal_code: postalCode.trim() || null,
        status,
        internal_notes: notes.trim() || null,
      });
      await refresh();
      showToast("Client details updated");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save client details");
    } finally {
      setSavingBilling(false);
    }
  };

  /**
   * Grants someone access by email.
   *
   * Runs through an API route rather than the browser client: creating an
   * account for an address that has never signed up needs the service role,
   * which must never be exposed here.
   */
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || inviting) return;
    if (!inviteEmail.trim()) {
      setInviteError("Enter an email address.");
      return;
    }

    setInviting(true);
    setInviteError(null);
    try {
      const res = await fetch("/api/clients/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, email: inviteEmail }),
      });
      const body = await res.json();

      if (!res.ok || !body.success) {
        setInviteError(body.error || "Could not add that person.");
        return;
      }

      await refresh();
      setInviteModalOpen(false);
      setInviteEmail("");
      showToast(
        body.isExistingUser
          ? `${body.email} now has access to ${client.name}`
          : body.emailed
          ? `Invite sent to ${body.email}`
          : `${body.email} was added, but the invite email could not be sent`
      );
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Could not add that person.");
    } finally {
      setInviting(false);
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!client || !memberToRemove) return;
    try {
      await removeClientMemberRecord(client.id, memberToRemove.id);
      await refresh();
      showToast(`Removed access for ${memberToRemove.name}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not remove member");
    } finally {
      setMemberToRemove(null);
    }
  };

  /**
   * Publishes a project to the client portal, or pulls it back.
   *
   * Projects are created hidden, and the client-side RLS policy only returns
   * rows where `visible_to_client` is true — so adding someone under People &
   * Access is not enough on its own to make a project show up for them.
   */
  const handleToggleProjectVisibility = async (
    projectId: string,
    next: boolean
  ) => {
    setTogglingProjectId(projectId);
    try {
      await updateProjectRecord(projectId, { visible_to_client: next });
      await refresh();
      showToast(next ? "Project is now visible to the client" : "Project hidden from the client");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not change visibility");
    } finally {
      setTogglingProjectId(null);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProjectRecord(projectToDelete.id);
      await refresh();
      showToast(`Project "${projectToDelete.name}" deleted`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not delete project");
    } finally {
      setProjectToDelete(null);
    }
  };

  const handleDeleteClient = async () => {
    if (!client) return;
    setDeleting(true);
    try {
      await deleteClientRecord(client.id);
      await refresh();
      showToast(`Client "${client.name}" and all related data deleted`);
      router.push("/admin/clients");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error deleting client");
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="text-[13px] text-ink-500 font-sans">Loading client...</div>;
  }

  if (error) {
    return (
      <div className="max-w-2xl p-4 bg-brick-100/80 border border-brick-600 rounded-sm text-[13px] text-brick-900">
        {error}
      </div>
    );
  }

  if (!client) notFound();

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ink-100">
        <div>
          <Link
            href="/admin/clients"
            className="text-[13px] text-ink-600 hover:text-ink-950 flex items-center gap-1 font-sans mb-1"
          >
            ← Back to clients
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-[28px] text-ink-950 font-normal">
              {client.name}
            </h1>
            <StatusPill status={client.status} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="danger"
            size="md"
            onClick={() => setDeleteClientModalOpen(true)}
          >
            Delete client
          </Button>
          <Link href={`/admin/projects/new?client=${client.id}`}>
            <Button variant="secondary" size="md">
              + Create project
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-ink-100 pb-px text-[13px]">
        {[
          { key: "overview", label: "Overview & Billing" },
          { key: "people", label: `People & Access (${members.length})` },
          { key: "projects", label: `Projects (${clientProjects.length})` },
          { key: "invoices", label: `Invoices (${clientInvoices.length})` },
          { key: "calls", label: `Calls (${clientCalls.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-3.5 py-2 font-medium transition-colors ${
              activeTab === t.key
                ? "text-ink-950 font-semibold border-b-2 border-river-700 -mb-px"
                : "text-ink-600 hover:text-ink-950"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-6">
          <form onSubmit={handleSaveBilling} className="bg-surface border border-ink-100 rounded-md p-6 flex flex-col gap-6">
            {/* Section 1: Identity & contact */}
            <div>
              <h2 className="text-[14px] uppercase tracking-wider font-semibold text-ink-500 mb-3">
                1. Identity &amp; Primary Contact
              </h2>
              <div className="flex flex-col gap-4">
                <Input
                  label="Display Name / Organisation"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Contact Email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                  <Input
                    label="Contact Phone"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] font-medium text-ink-600 font-sans">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ClientStatus)}
                    className="h-[38px] px-3 bg-surface border border-ink-200 rounded-sm text-[14px] text-ink-950 font-sans capitalize focus-visible:outline-none focus-visible:border-river-500"
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Invoicing & tax */}
            <div className="border-t border-ink-100 pt-5">
              <h2 className="text-[14px] uppercase tracking-wider font-semibold text-ink-500 mb-3">
                2. Invoicing &amp; Tax Details
              </h2>
              <div className="flex flex-col gap-4">
                <Input
                  label="Legal Name (for tax invoice)"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="GSTIN"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                  />
                  <Input
                    label="PAN"
                    value={pan}
                    onChange={(e) => setPan(e.target.value)}
                  />
                </div>
                <Input
                  label="Registered Address"
                  placeholder="Street, Building, Floor"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                />
                <Input
                  label="Address line 2"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                  <Input
                    label="State"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                  />
                  <Input
                    label="State Code (GST)"
                    value={stateCode}
                    onChange={(e) => setStateCode(e.target.value)}
                    helperText="36 = Telangana"
                  />
                </div>
                <Input
                  label="Postal Code"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </div>
            </div>

            <div className="border-t border-ink-100 pt-5">
              <Textarea
                label="Internal notes (Only visible to you)"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {formError && (
              <div className="p-3 bg-brick-100/80 border border-brick-600 rounded-sm text-[13px] text-brick-900">
                {formError}
              </div>
            )}

            <Button type="submit" variant="primary" size="md" className="self-start" loading={savingBilling}>
              Save changes
            </Button>
          </form>

          {/* Danger Zone */}
          <div className="bg-surface border border-brick-600/30 rounded-md p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-[15px] font-semibold text-brick-800">
                Delete Client
              </h3>
              <p className="text-[13px] text-ink-500 mt-0.5">
                Permanently deletes this client organisation, all its team members, projects, invoices, and payments.
              </p>
            </div>
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={() => setDeleteClientModalOpen(true)}
              className="shrink-0"
            >
              Delete client
            </Button>
          </div>
        </div>
      )}

      {/* TAB: PEOPLE */}
      {activeTab === "people" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-ink-600">
              Team members with client portal access to this workspace:
            </span>
            <Button variant="secondary" size="sm" onClick={() => setInviteModalOpen(true)}>
              + Invite person
            </Button>
          </div>

          {members.length > 0 &&
            clientProjects.length > 0 &&
            !clientProjects.some((p) => p.visible_to_client) && (
              <div className="p-3 bg-brick-100/80 border border-brick-600 rounded-sm text-[13px] text-brick-900 leading-snug">
                <strong>These people cannot see any project yet.</strong>
                <p className="mt-1">
                  Access to the workspace and access to a project are separate.
                  Every project for this client is still hidden — open the{" "}
                  <button
                    type="button"
                    onClick={() => setActiveTab("projects")}
                    className="underline underline-offset-2 font-medium"
                  >
                    Projects tab
                  </button>{" "}
                  and make one visible.
                </p>
              </div>
            )}

          {members.length === 0 ? (
            <div className="bg-surface border border-dashed border-ink-200 rounded-md p-8 text-center text-ink-500 text-[14px]">
              No team members have been added to this client yet. Click <strong>+ Invite person</strong> to grant workspace access.
            </div>
          ) : (
            <div className="bg-surface border border-ink-100 rounded-md divide-y divide-ink-100">
              {members.map((m) => {
                const name = m.profile?.full_name || "Team Member";
                const email = m.profile?.email || "";
                return (
                  <div key={m.profile_id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-ink-950 text-[14px]">{name}</p>
                        {m.is_primary && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-river-50 text-river-800 font-mono">
                            Primary Contact
                          </span>
                        )}
                      </div>
                      <p className="text-ink-500 text-[13px]">{email}</p>
                      {m.profile?.last_seen_at && (
                        <p className="text-ink-400 text-[11px] mt-0.5">
                          Last seen: {formatDate(m.profile.last_seen_at, "datetime")}
                        </p>
                      )}
                    </div>

                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => setMemberToRemove({ id: m.profile_id, name })}
                      className="text-brick-800 hover:bg-brick-100/60"
                    >
                      Remove
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: PROJECTS */}
      {activeTab === "projects" && (
        <div className="flex flex-col gap-4">
          {clientProjects.length === 0 ? (
            <div className="bg-surface border border-dashed border-ink-200 rounded-md p-8 text-center text-ink-500 text-[14px]">
              No active projects for this client.
            </div>
          ) : (
            <div className="bg-surface border border-ink-100 rounded-md divide-y divide-ink-100">
              {clientProjects.map((p) => (
                <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink-950 text-[15px]">{p.name}</span>
                      <StatusPill status={p.status} />
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-mono border ${
                          p.visible_to_client
                            ? "bg-river-50 border-river-700/30 text-river-800"
                            : "bg-ink-100/60 border-ink-200 text-ink-500"
                        }`}
                      >
                        {p.visible_to_client ? "● Visible to client" : "○ Hidden from client"}
                      </span>
                    </div>
                    <p className="text-[13px] text-ink-500 mt-0.5">
                      {p.progress}% completed · {formatMoney(p.total_value)}
                    </p>
                    {!p.visible_to_client && (
                      <p className="text-[12px] text-ink-500 mt-1 leading-snug">
                        Team members cannot see this project in their portal until
                        you make it visible.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant={p.visible_to_client ? "quiet" : "primary"}
                      size="sm"
                      loading={togglingProjectId === p.id}
                      onClick={() =>
                        handleToggleProjectVisibility(p.id, !p.visible_to_client)
                      }
                    >
                      {p.visible_to_client ? "Hide from client" : "Make visible"}
                    </Button>
                    <Link href={`/admin/projects/${p.id}`}>
                      <Button variant="secondary" size="sm">
                        Edit
                      </Button>
                    </Link>
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => setProjectToDelete({ id: p.id, name: p.name })}
                      className="text-brick-800 hover:bg-brick-100/60"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: INVOICES */}
      {activeTab === "invoices" && (
        <div className="bg-surface border border-ink-100 rounded-md divide-y divide-ink-100">
          {clientInvoices.length === 0 ? (
            <div className="p-8 text-center text-ink-500 text-[14px]">No invoices for this client.</div>
          ) : (
            clientInvoices.map((inv) => (
              <div key={inv.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-ink-950">{inv.number || "Draft"}</span>
                    <StatusPill status={inv.status} />
                  </div>
                  <p className="text-[13px] text-ink-500 mt-0.5">
                    {formatMoney(inv.total)} · Due {formatDate(inv.due_date, "table")}
                  </p>
                </div>
                <Link href={`/admin/invoices/${inv.id}`}>
                  <Button variant="quiet" size="sm">Open</Button>
                </Link>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: CALLS */}
      {activeTab === "calls" && (
        <div className="bg-surface border border-ink-100 rounded-md divide-y divide-ink-100">
          {clientCalls.length === 0 ? (
            <div className="p-8 text-center text-ink-500 text-[14px]">No call bookings for this client.</div>
          ) : (
            clientCalls.map((c) => (
              <div key={c.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink-950">{formatDate(c.requested_start, "datetime")}</span>
                    <StatusPill status={c.status} />
                  </div>
                  <p className="text-[13px] text-ink-600 mt-0.5">{c.reason}</p>
                </div>
                <Link href="/admin/calls">
                  <Button variant="quiet" size="sm">Review</Button>
                </Link>
              </div>
            ))
          )}
        </div>
      )}

      {/* Invite Member Modal */}
      <Modal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title={`Add Team Member to ${client.name}`}
        allowOverflow
      >
        <form onSubmit={handleSendInvite} className="flex flex-col gap-4 text-[14px]">
          <p className="text-[13px] text-ink-600 leading-snug">
            They get access to this client&apos;s workspace &mdash; every project
            you have made visible, plus its milestones, files, payments and
            invoices. If they have never signed in, an account is created and
            they are emailed a link to set a password.
          </p>
          <EmailCombobox
            label="Email address"
            required
            placeholder="Start typing a name or address"
            value={inviteEmail}
            onChange={setInviteEmail}
            suggestions={emailSuggestions}
            helperText="Pick an existing account, or type any address to invite it."
            emptyHint="They will be sent an invite to set a password."
          />
          {inviteError && (
            <div className="p-3 bg-brick-100/80 border border-brick-600 rounded-sm text-[13px] text-brick-900">
              {inviteError}
            </div>
          )}
          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="quiet" size="md" onClick={() => setInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={inviting}>
              Grant access
            </Button>
          </div>
        </form>
      </Modal>

      {/* Remove Member Confirmation Modal */}
      <Modal
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        title="Remove Team Member"
      >
        <div className="flex flex-col gap-4 text-[14px]">
          <p className="text-ink-700">
            Are you sure you want to remove <strong>{memberToRemove?.name}</strong> from <strong>{client.name}</strong>?
          </p>
          <p className="text-ink-500 text-[13px]">
            They will lose portal access to this client&apos;s projects, timeline, files, and payments immediately.
          </p>
          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="quiet" size="md" onClick={() => setMemberToRemove(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" size="md" onClick={handleConfirmRemoveMember}>
              Remove member
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Project Confirmation Modal */}
      <Modal
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        title="Delete Project"
      >
        <div className="flex flex-col gap-4 text-[14px]">
          <p className="text-ink-700">
            Are you sure you want to permanently delete the project <strong>{projectToDelete?.name}</strong>?
          </p>
          <p className="text-ink-500 text-[13px]">
            This will permanently remove all milestones, scope deliverables, updates, and associated project assets.
          </p>
          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="quiet" size="md" onClick={() => setProjectToDelete(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" size="md" onClick={handleDeleteProject}>
              Delete project
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Client Confirmation Modal */}
      <Modal
        isOpen={deleteClientModalOpen}
        onClose={() => !deleting && setDeleteClientModalOpen(false)}
        title={`Delete Client: ${client.name}`}
      >
        <div className="flex flex-col gap-4 text-[14px]">
          <div className="p-3 bg-brick-100/80 border border-brick-600 rounded-sm text-[13px] text-brick-900 leading-snug">
            <strong>Warning: Permanent Action</strong>
            <p className="mt-1">
              Deleting <strong>{client.name}</strong> will permanently remove all associated:
            </p>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-brick-800">
              <li>Team members and workspace access</li>
              <li>Projects, milestones, updates & scope</li>
              <li>Invoices, payment logs & documents</li>
              <li>Call requests and history</li>
            </ul>
          </div>
          <p className="text-ink-600 text-[13px]">
            This action cannot be undone. Are you sure you want to continue?
          </p>
          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="quiet"
              size="md"
              disabled={deleting}
              onClick={() => setDeleteClientModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="md"
              loading={deleting}
              onClick={handleDeleteClient}
            >
              Permanently delete client
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
