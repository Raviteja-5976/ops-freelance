"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/formatters";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useData } from "@/components/providers/DataProvider";
import { deleteProjectRecord } from "@/lib/db";

export default function AdminProjectsPage() {
  const { showToast } = useToast();
  const { projects: allProjects, loading, error, refresh } = useData();
  const [filter, setFilter] = useState("all");
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const projects = allProjects.filter((p) => {
    if (filter === "all") return p.status !== "archived";
    return p.status === filter;
  });

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setDeleting(true);
    try {
      await deleteProjectRecord(projectToDelete.id);
      await refresh();
      showToast(`Project "${projectToDelete.name}" permanently deleted`);
      setProjectToDelete(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error deleting project");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-[28px] text-ink-950 font-normal">
            Projects
          </h1>
          <p className="text-[13px] text-ink-500 font-sans">
            Client engagements, delivery status, and milestone progress.
          </p>
        </div>
        <Link href="/admin/projects/new">
          <Button variant="primary" size="md">
            + New project
          </Button>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-ink-100 pb-2 text-[13px]">
        {["all", "development", "design", "planning", "completed"].map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`px-3 py-1 rounded-sm capitalize font-medium transition-colors ${
              filter === st
                ? "bg-ink-100 text-ink-950 font-semibold"
                : "text-ink-600 hover:text-ink-950"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-ink-100 rounded-md overflow-x-auto">
        <table className="w-full text-left text-[13px] font-sans">
          <thead>
            <tr className="bg-ink-50/70 border-b border-ink-100 text-ink-500 uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-4 font-medium">Project</th>
              <th className="py-2.5 px-4 font-medium">Client</th>
              <th className="py-2.5 px-4 font-medium">Status</th>
              <th className="py-2.5 px-4 font-medium text-right">Progress</th>
              <th className="py-2.5 px-4 font-medium text-right">Delivery</th>
              <th className="py-2.5 px-4 font-medium text-right">Value</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-ink-500">
                  Loading projects...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-brick-800">
                  {error}
                </td>
              </tr>
            ) : projects.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-ink-500">
                  {allProjects.length === 0
                    ? "No projects yet. Create your first project to get started."
                    : "No projects with this status."}
                </td>
              </tr>
            ) : (
              projects.map((p) => (
                <tr key={p.id} className="hover:bg-ink-50/50 transition-colors h-[40px]">
                  <td className="py-2.5 px-4 font-medium text-ink-950">
                    <Link href={`/admin/projects/${p.id}`} className="hover:text-river-700">
                      {p.name}
                    </Link>
                    {!p.visible_to_client && (
                      <span
                        title="The client cannot see this project in their portal yet"
                        className="ml-2 text-[11px] px-2 py-0.5 rounded-full font-mono bg-ink-100/60 border border-ink-200 text-ink-500"
                      >
                        ○ Hidden
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-ink-700">{p.client?.name || "Client"}</td>
                  <td className="py-2.5 px-4">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">{p.progress}%</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {formatDate(p.expected_delivery, "table")}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium">
                    {formatMoney(p.total_value)}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link href={`/admin/projects/${p.id}`}>
                        <Button variant="quiet" size="sm">
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Project Confirmation Modal */}
      <Modal
        isOpen={!!projectToDelete}
        onClose={() => !deleting && setProjectToDelete(null)}
        title={`Delete Project: ${projectToDelete?.name}`}
      >
        <div className="flex flex-col gap-4 text-[14px]">
          <div className="p-3 bg-brick-100/80 border border-brick-600 rounded-sm text-[13px] text-brick-900 leading-snug">
            <strong>Warning: Permanent Action</strong>
            <p className="mt-1">
              Deleting <strong>{projectToDelete?.name}</strong> will permanently remove all associated:
            </p>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-brick-800">
              <li>Milestones and progress records</li>
              <li>Published updates & notes</li>
              <li>Scope deliverables and tech stack specs</li>
              <li>Project files and attachments</li>
            </ul>
          </div>
          <p className="text-ink-600 text-[13px]">
            This action cannot be undone. Are you sure you want to permanently delete this project?
          </p>
          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="quiet"
              size="md"
              disabled={deleting}
              onClick={() => setProjectToDelete(null)}
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
              Permanently delete project
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
