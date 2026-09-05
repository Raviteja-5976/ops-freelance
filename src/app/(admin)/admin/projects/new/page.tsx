"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useData } from "@/components/providers/DataProvider";
import { createProjectRecord } from "@/lib/db";
import { ProjectStatus } from "@/types/database";

export default function NewProjectPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { clients, loading, refresh } = useData();

  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [totalRupees, setTotalRupees] = useState("150000");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default to the first client once the workspace has loaded. Reading
  // `clients[0].id` during render used to throw whenever no clients existed.
  useEffect(() => {
    if (!clientId && clients.length > 0) setClientId(clients[0].id);
  }, [clients, clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!clientId) {
      setError("Pick a client for this project.");
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Project name is required.");
      return;
    }
    const rupees = Number(totalRupees);
    if (!Number.isFinite(rupees) || rupees < 0) {
      setError("Contract value must be a positive number.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const created = await createProjectRecord({
        client_id: clientId,
        name: trimmedName,
        summary: summary.trim() || null,
        description: description.trim() || null,
        status,
        // Stored in paise; round so fractional rupees never reach a bigint column.
        total_value: Math.round(rupees * 100),
        expected_delivery: expectedDelivery || null,
        visible_to_client: false,
      });

      await refresh();
      showToast("Project created · Ready for milestone planning");
      router.push(`/admin/projects/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-[13px] text-ink-500 font-sans">Loading clients...</div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="flex flex-col gap-4 max-w-2xl">
        <h1 className="font-serif text-[28px] text-ink-950 font-normal">New project</h1>
        <div className="bg-surface border border-ink-100 rounded-md p-6 text-[14px] text-ink-600">
          <p>You need at least one client before you can create a project.</p>
          <Link href="/admin/clients/new" className="inline-block mt-4">
            <Button variant="primary" size="md">
              + Create a client first
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Link
          href="/admin/projects"
          className="text-[13px] text-ink-600 hover:text-ink-950 flex items-center gap-1 font-sans mb-2"
        >
          ← Back to projects
        </Link>
        <h1 className="font-serif text-[28px] text-ink-950 font-normal">
          New project
        </h1>
        <p className="text-[13px] text-ink-500 font-sans">
          Configure engagement parameters and deliverables.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface border border-ink-100 rounded-md p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label className="text-[13px] font-medium text-ink-600 font-sans">
            Client
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="h-[38px] px-3 bg-surface border border-ink-200 rounded-sm text-[14px] text-ink-950 font-sans focus-visible:outline-none focus-visible:border-river-500"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[13px] font-medium text-ink-600 font-sans">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            className="h-[38px] px-3 bg-surface border border-ink-200 rounded-sm text-[14px] text-ink-950 font-sans capitalize focus-visible:outline-none focus-visible:border-river-500"
          >
            {(
              [
                "planning",
                "design",
                "development",
                "testing",
                "review",
                "launch",
                "completed",
                "on_hold",
              ] as ProjectStatus[]
            ).map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Project name"
          required
          placeholder="e.g. Company website redesign"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          label="One-line summary"
          placeholder="e.g. Responsive marketing site with custom client portal"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          helperText="Displays directly below greeting on client overview"
        />

        <Textarea
          label="Scope description (Markdown)"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detailed scope, goals, and deliverable specifications..."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Total contract value (₹)"
            type="number"
            required
            value={totalRupees}
            onChange={(e) => setTotalRupees(e.target.value)}
            helperText="Stored precisely in paise"
          />

          <Input
            label="Expected delivery date"
            type="date"
            required
            value={expectedDelivery}
            onChange={(e) => setExpectedDelivery(e.target.value)}
          />
        </div>

        {error && (
          <div className="p-3 bg-brick-100/80 border border-brick-600 rounded-sm text-[13px] text-brick-900 leading-snug">
            {error}
          </div>
        )}

        <div className="pt-3 border-t border-ink-100 flex items-center justify-between">
          <Button type="submit" variant="primary" size="md" loading={saving}>
            Create project
          </Button>
          <Link href="/admin/projects">
            <Button type="button" variant="quiet" size="md">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
