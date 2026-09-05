"use client";

import React, { useEffect, useState } from "react";
import { formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useData } from "@/components/providers/DataProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  deleteDocumentRecord,
  getDocumentUrl,
  updateDocumentRecord,
  uploadDocumentRecord,
} from "@/lib/db";
import { DocCategory } from "@/types/database";

export default function AdminFilesPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { documents, clients, loading, error, refresh } = useData();

  const [filterCategory, setFilterCategory] = useState("all");
  const [newTitle, setNewTitle] = useState("");
  const [newCat, setNewCat] = useState<DocCategory>("design");
  const [newClientId, setNewClientId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!newClientId && clients.length > 0) setNewClientId(clients[0].id);
  }, [clients, newClientId]);

  const totalBytes = documents.reduce((acc, d) => acc + (d.size_bytes || 0), 0);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);

  const filtered = documents.filter((d) => {
    if (filterCategory === "all") return true;
    return d.category === filterCategory;
  });

  const toggleVisibility = async (id: string, current: string) => {
    setBusyId(id);
    try {
      await updateDocumentRecord(id, {
        visibility: current === "client" ? "admin" : "client",
      });
      await refresh();
      showToast("File visibility updated");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update visibility");
    } finally {
      setBusyId(null);
    }
  };

  const handleOpen = async (storagePath: string) => {
    try {
      const url = await getDocumentUrl(storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not open file");
    }
  };

  const handleDelete = async (id: string, storagePath: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBusyId(id);
    try {
      await deleteDocumentRecord(id, storagePath);
      await refresh();
      showToast("File deleted");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not delete file");
    } finally {
      setBusyId(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading) return;

    if (!newClientId) {
      setFormError("Create a client before uploading files.");
      return;
    }
    if (!file) {
      setFormError("Choose a file to upload.");
      return;
    }

    setUploading(true);
    setFormError(null);
    try {
      await uploadDocumentRecord(file, {
        client_id: newClientId,
        title: newTitle.trim() || file.name,
        category: newCat,
        visibility: "admin", // admin-only until explicitly shared
        uploaded_by: user?.id || null,
      });
      await refresh();
      setNewTitle("");
      setFile(null);
      showToast("File uploaded (admin only)");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not upload file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ink-100">
        <div>
          <h1 className="font-serif text-[28px] text-ink-950 font-normal">
            Files & Storage
          </h1>
          <p className="text-[13px] text-ink-500 font-sans">
            Contracts, design assets, and client deliverable documents.
          </p>
        </div>
        <div className="text-[13px] font-mono text-ink-600 bg-ink-100/60 px-3 py-1 rounded-sm">
          Total Storage: <strong>{totalMb} MB</strong>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-ink-100 pb-2 text-[13px]">
        {["all", "contract", "proposal", "design", "report"].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1 rounded-sm capitalize font-medium transition-colors ${
              filterCategory === cat
                ? "bg-ink-100 text-ink-950 font-semibold"
                : "text-ink-600 hover:text-ink-950"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-ink-100 rounded-md overflow-x-auto">
        <table className="w-full text-left text-[13px] font-sans">
          <thead>
            <tr className="bg-ink-50/70 border-b border-ink-100 text-ink-500 uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-4 font-medium">Title</th>
              <th className="py-2.5 px-4 font-medium">Client</th>
              <th className="py-2.5 px-4 font-medium">Category</th>
              <th className="py-2.5 px-4 font-medium text-right">Size</th>
              <th className="py-2.5 px-4 font-medium">Visibility</th>
              <th className="py-2.5 px-4 text-right">Date</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-ink-500">
                  Loading files...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-brick-800">
                  {error}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-ink-500">
                  No files uploaded yet.
                </td>
              </tr>
            ) : null}
            {filtered.map((doc) => {
              const client = clients.find((c) => c.id === doc.client_id);
              const isClientVisible = doc.visibility === "client";

              return (
                <tr key={doc.id} className="hover:bg-ink-50/50 transition-colors h-[40px]">
                  <td className="py-2.5 px-4 font-medium text-ink-950">{doc.title}</td>
                  <td className="py-2.5 px-4 text-ink-700">{client?.name || "Client"}</td>
                  <td className="py-2.5 px-4 capitalize font-mono text-[12px] text-ink-600">
                    {doc.category}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-600">
                    {doc.size_bytes ? `${Math.round(doc.size_bytes / 1024)} KB` : "—"}
                  </td>
                  <td className="py-2.5 px-4">
                    <button
                      type="button"
                      disabled={busyId === doc.id}
                      onClick={() => toggleVisibility(doc.id, doc.visibility)}
                      className={`text-[12px] px-2 py-0.5 rounded-full border transition-colors ${
                        isClientVisible
                          ? "bg-river-50 border-river-700/30 text-river-800"
                          : "bg-ink-100/60 border-ink-200 text-ink-500"
                      }`}
                    >
                      {isClientVisible ? "● Client visible" : "○ Admin only"}
                    </button>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-ink-500">
                    {formatDate(doc.created_at, "table")}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() => handleOpen(doc.storage_path)}
                      >
                        Open
                      </Button>
                      <Button
                        variant="quiet"
                        size="sm"
                        disabled={busyId === doc.id}
                        onClick={() => handleDelete(doc.id, doc.storage_path, doc.title)}
                        className="text-brick-800 hover:bg-brick-100/60"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Upload Form */}
      <form onSubmit={handleUpload} className="bg-surface border border-ink-100 rounded-md p-5 flex flex-col gap-4 max-w-xl">
        <h2 className="font-serif text-[18px] text-ink-950 font-medium">
          Upload file
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="File title"
            required
            placeholder="e.g. Master Services Agreement.pdf"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-ink-600">Category</label>
            <select
              value={newCat}
              onChange={(e) => setNewCat(e.target.value as DocCategory)}
              className="h-[38px] px-3 bg-surface border border-ink-200 rounded-sm text-[14px] text-ink-950 font-sans"
            >
              <option value="contract">Contract</option>
              <option value="proposal">Proposal</option>
              <option value="design">Design</option>
              <option value="report">Report</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[13px] font-medium text-ink-600">Client</label>
          <select
            value={newClientId}
            onChange={(e) => setNewClientId(e.target.value)}
            className="h-[38px] px-3 bg-surface border border-ink-200 rounded-sm text-[14px] text-ink-950 font-sans"
          >
            {clients.length === 0 && <option value="">No clients yet</option>}
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[13px] font-medium text-ink-600">File</label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-[13px] text-ink-700 file:mr-3 file:h-[30px] file:px-3 file:rounded-sm file:border file:border-ink-200 file:bg-ink-50 file:text-[13px] file:text-ink-800"
          />
        </div>

        {formError && (
          <div className="p-3 bg-brick-100/80 border border-brick-600 rounded-sm text-[13px] text-brick-900">
            {formError}
          </div>
        )}

        <Button
          type="submit"
          variant="secondary"
          size="md"
          className="self-start"
          loading={uploading}
          disabled={clients.length === 0}
        >
          + Upload document
        </Button>
      </form>
    </div>
  );
}
