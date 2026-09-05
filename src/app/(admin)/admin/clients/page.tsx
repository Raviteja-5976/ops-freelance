"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatMoney, formatDate } from "@/lib/formatters";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useData } from "@/components/providers/DataProvider";
import { deleteClientRecord } from "@/lib/db";

export default function AdminClientsPage() {
  const { showToast } = useToast();
  const { clients: allClients, loading, error, refresh } = useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const term = searchTerm.trim().toLowerCase();
  const clients = allClients.filter(
    (c) =>
      !term ||
      c.name.toLowerCase().includes(term) ||
      (c.city || "").toLowerCase().includes(term)
  );

  const handleConfirmDelete = async () => {
    if (!clientToDelete) return;
    setDeleting(true);
    try {
      await deleteClientRecord(clientToDelete.id);
      await refresh();
      showToast(`Client "${clientToDelete.name}" and all related data deleted`);
      setClientToDelete(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error deleting client");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-[28px] text-ink-950 font-normal">
            Clients
          </h1>
          <p className="text-[13px] text-ink-500 font-sans">
            Client organisations, contacts, billing details, and active projects.
          </p>
        </div>
        <Link href="/admin/clients/new">
          <Button variant="primary" size="md">
            + New client
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search clients by name or city..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-[38px] px-3 max-w-sm w-full bg-surface border border-ink-200 rounded-sm text-[14px] text-ink-950 placeholder:text-ink-400 font-sans"
        />
      </div>

      <div className="bg-surface border border-ink-100 rounded-md overflow-x-auto">
        <table className="w-full text-left text-[13px] font-sans">
          <thead>
            <tr className="bg-ink-50/70 border-b border-ink-100 text-ink-500 uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-4 font-medium">Name</th>
              <th className="py-2.5 px-4 font-medium">Location</th>
              <th className="py-2.5 px-4 font-medium">GSTIN</th>
              <th className="py-2.5 px-4 font-medium">Status</th>
              <th className="py-2.5 px-4 font-medium text-right">Created</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-ink-500">
                  Loading clients...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-brick-800">
                  {error}
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-ink-500">
                  {allClients.length === 0
                    ? "No clients yet. Create your first client to get started."
                    : "No clients match your search."}
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr key={c.id} className="hover:bg-ink-50/50 transition-colors h-[40px]">
                  <td className="py-2.5 px-4 font-medium text-ink-950">
                    <Link href={`/admin/clients/${c.id}`} className="hover:text-river-700">
                      {c.name}
                    </Link>
                  </td>
                  <td className="py-2.5 px-4 text-ink-600">
                    {c.city ? `${c.city}, ${c.state || ""}` : "—"}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-ink-700">{c.gstin || "—"}</td>
                  <td className="py-2.5 px-4">
                    <StatusPill status={c.status} />
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-600">
                    {formatDate(c.created_at, "table")}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link href={`/admin/clients/${c.id}`}>
                        <Button variant="quiet" size="sm">
                          View
                        </Button>
                      </Link>
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() => setClientToDelete({ id: c.id, name: c.name })}
                        className="text-brick-800 hover:bg-brick-100/60"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Client Confirmation Modal */}
      <Modal
        isOpen={!!clientToDelete}
        onClose={() => !deleting && setClientToDelete(null)}
        title={`Delete Client: ${clientToDelete?.name}`}
      >
        <div className="flex flex-col gap-4 text-[14px]">
          <div className="p-3 bg-brick-100/80 border border-brick-600 rounded-sm text-[13px] text-brick-900 leading-snug">
            <strong>Warning: Permanent Action</strong>
            <p className="mt-1">
              Deleting <strong>{clientToDelete?.name}</strong> will permanently remove all associated:
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
              onClick={() => setClientToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="md"
              loading={deleting}
              onClick={handleConfirmDelete}
            >
              Permanently delete client
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
