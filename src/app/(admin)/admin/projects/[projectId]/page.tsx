"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, notFound } from "next/navigation";
import { formatMoney, formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { StatusPill } from "@/components/ui/StatusPill";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { TheCurrent } from "@/components/ui/TheCurrent";
import { useData } from "@/components/providers/DataProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  createFeatureRecord,
  createMilestoneRecord,
  createTechnologyRecord,
  createPaymentRecord,
  createUpdateRecord,
  deletePaymentRecord,
  deleteProjectRecord,
  updateFeatureRecord,
  updateMilestoneRecord,
  updateProjectRecord,
  uploadDocumentRecord,
} from "@/lib/db";
import {
  DocCategory,
  MilestoneStatus,
  PaymentMethod,
  ProjectStatus,
} from "@/types/database";

export default function ProjectEditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { showToast } = useToast();
  const { user } = useAuth();

  const {
    projects,
    milestones: allMilestones,
    features: allFeatures,
    technologies: allTechnologies,
    updates: allUpdates,
    payments: allPayments,
    documents: allDocuments,
    loading,
    error,
    refresh,
  } = useData();

  const project = projects.find((p) => p.id === projectId);

  const [activeTab, setActiveTab] = useState<
    "general" | "timeline" | "scope" | "stack" | "updates" | "payments" | "files" | "preview"
  >("general");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  // General tab state
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [progress, setProgress] = useState(0);
  const [progressMode, setProgressMode] = useState<"auto" | "manual">("auto");
  const [totalRupees, setTotalRupees] = useState("0");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [visibleToClient, setVisibleToClient] = useState(false);

  // Mirror the saved project into the editable form whenever it (re)loads.
  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setSummary(project.summary || "");
    setDescription(project.description || "");
    setStatus(project.status);
    setProgress(project.progress);
    setProgressMode(project.progress_mode);
    setTotalRupees(String(project.total_value / 100));
    setExpectedDelivery(project.expected_delivery || "");
    setVisibleToClient(project.visible_to_client);
  }, [project]);

  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDesc, setNewMilestoneDesc] = useState("");
  const [newMilestoneStart, setNewMilestoneStart] = useState("");
  const [newMilestoneEnd, setNewMilestoneEnd] = useState("");

  const [newFeatureLabel, setNewFeatureLabel] = useState("");
  const [newFeatureNote, setNewFeatureNote] = useState("");
  const [newFeatureIncluded, setNewFeatureIncluded] = useState(true);

  const [newTechArea, setNewTechArea] = useState("Website");
  const [newTechName, setNewTechName] = useState("");

  const [newUpdateTitle, setNewUpdateTitle] = useState("");
  const [newUpdateBody, setNewUpdateBody] = useState("");

  const [newStageLabel, setNewStageLabel] = useState("");
  const [newStageAmount, setNewStageAmount] = useState("");
  const [newStageDue, setNewStageDue] = useState("");

  const [recordPaymentModal, setRecordPaymentModal] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentPaidAt, setPaymentPaidAt] = useState(new Date().toISOString().split("T")[0]);

  const [newFileTitle, setNewFileTitle] = useState("");
  const [newFileCategory, setNewFileCategory] = useState<DocCategory>("design");
  const [newFile, setNewFile] = useState<File | null>(null);

  const milestones = allMilestones.filter((m) => m.project_id === projectId);
  const features = allFeatures.filter((f) => f.project_id === projectId);
  const technologies = allTechnologies.filter((t) => t.project_id === projectId);
  const updates = allUpdates.filter((u) => u.project_id === projectId);
  const payments = allPayments.filter((p) => p.project_id === projectId);
  const documents = allDocuments.filter((d) => d.project_id === projectId);

  // The contract value is fixed; these track how much of it the schedule covers.
  const contractPaise = project?.total_value ?? 0;
  const scheduledPaise = payments.reduce((acc, p) => acc + p.amount, 0);
  const unscheduledPaise = contractPaise - scheduledPaise;
  const collectedPaise = payments
    .filter((p) => p.status === "paid")
    .reduce((acc, p) => acc + p.amount, 0);

  /** Runs a mutation, refreshes the workspace, and reports failures. */
  const run = async (label: string, fn: () => Promise<unknown>, done?: () => void) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await refresh();
      done?.();
      showToast(label);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveGeneral = () => {
    if (!project) return;
    const rupees = Number(totalRupees);
    if (!Number.isFinite(rupees) || rupees < 0) {
      showToast("Contract value must be a positive number");
      return;
    }
    void run("Project changes saved", () =>
      updateProjectRecord(project.id, {
        name: name.trim(),
        summary: summary.trim() || null,
        description: description.trim() || null,
        status,
        progress,
        progress_mode: progressMode,
        total_value: Math.round(rupees * 100),
        expected_delivery: expectedDelivery || null,
        visible_to_client: visibleToClient,
      })
    );
  };

  const toggleVisibility = () => {
    if (!project) return;
    const next = !visibleToClient;
    setVisibleToClient(next);
    void run(
      next ? "Project is now visible to client" : "Project hidden from client",
      () => updateProjectRecord(project.id, { visible_to_client: next })
    );
  };

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !newMilestoneTitle.trim()) return;
    void run(
      "Milestone added",
      () =>
        createMilestoneRecord({
          project_id: project.id,
          title: newMilestoneTitle.trim(),
          description: newMilestoneDesc.trim() || null,
          status: "upcoming" as MilestoneStatus,
          start_date: newMilestoneStart || null,
          end_date: newMilestoneEnd || null,
          position: milestones.length + 1,
          visible_to_client: true,
        }),
      () => {
        setNewMilestoneTitle("");
        setNewMilestoneDesc("");
        setNewMilestoneStart("");
        setNewMilestoneEnd("");
      }
    );
  };

  /**
   * Completes one milestone and starts the next. A database trigger
   * recalculates project progress for projects in `auto` mode, so progress is
   * not written here.
   */
  const handleCompleteAndStartNext = (milestoneId: string) => {
    const idx = milestones.findIndex((m) => m.id === milestoneId);
    if (idx === -1) return;
    const next = milestones[idx + 1];

    void run("Milestone completed · next stage started", async () => {
      await updateMilestoneRecord(milestoneId, {
        status: "completed" as MilestoneStatus,
        completed_at: new Date().toISOString(),
      });
      if (next) {
        await updateMilestoneRecord(next.id, { status: "in_progress" as MilestoneStatus });
      }
    });
  };

  const handleAddFeature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !newFeatureLabel.trim()) return;
    void run(
      "Feature item added",
      () =>
        createFeatureRecord({
          project_id: project.id,
          label: newFeatureLabel.trim(),
          note: newFeatureNote.trim() || null,
          included: newFeatureIncluded,
          position: features.length + 1,
        }),
      () => {
        setNewFeatureLabel("");
        setNewFeatureNote("");
      }
    );
  };

  const handleAddTechnology = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !newTechName.trim()) return;
    void run(
      "Technology stack item added",
      () =>
        createTechnologyRecord({
          project_id: project.id,
          area: newTechArea,
          name: newTechName.trim(),
          position: technologies.length + 1,
        }),
      () => setNewTechName("")
    );
  };

  const handlePublishUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !newUpdateBody.trim()) return;

    const title = newUpdateTitle.trim() || null;
    const body = newUpdateBody.trim();

    void run(
      "Update published",
      async () => {
        await createUpdateRecord({
          project_id: project.id,
          title,
          body,
          published_at: new Date().toISOString(),
          author_id: user?.id || null,
        });

        if (project.client?.email) {
          // Best effort: a failed email must not undo a published update.
          fetch("/api/email/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "project_update",
              payload: {
                recipientEmail: project.client.email,
                clientName: project.client.name,
                projectName: project.name,
                updateTitle: title || "Project Milestone Update",
                excerpt: body.slice(0, 180),
                projectId: project.id,
              },
            }),
          }).catch(() => {});
        }
      },
      () => {
        setNewUpdateTitle("");
        setNewUpdateBody("");
      }
    );
  };

  /**
   * Adds one stage to the payment schedule.
   *
   * The contract value is agreed up front and never changes here — stages only
   * carve that fixed amount into instalments, so the form warns when the
   * schedule drifts away from the total rather than silently allowing it.
   */
  const handleAddStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    const label = newStageLabel.trim();
    if (!label) {
      showToast("Give the stage a name");
      return;
    }
    const rupees = Number(newStageAmount);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      showToast("Stage amount must be greater than zero");
      return;
    }

    void run(
      `Stage "${label}" added`,
      () =>
        createPaymentRecord({
          project_id: project.id,
          client_id: project.client_id,
          label,
          amount: Math.round(rupees * 100),
          due_date: newStageDue || null,
          position: payments.length + 1,
        }),
      () => {
        setNewStageLabel("");
        setNewStageAmount("");
        setNewStageDue("");
      }
    );
  };

  const handleDeleteStage = (id: string, label: string) => {
    if (!window.confirm(`Remove the "${label}" stage from the schedule?`)) return;
    void run("Stage removed", () => deletePaymentRecord(id));
  };

  /** Fills the amount box with whatever is still unallocated. */
  const fillRemainingAmount = () => {
    setNewStageAmount(String(Math.max(0, unscheduledPaise) / 100));
  };

  /**
   * Confirms money that arrived outside Razorpay.
   *
   * Uses the settlement route so the draft invoice and the receipt emails
   * happen here too, rather than only for gateway payments.
   */
  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentId) return;

    void run(
      "Payment verified · draft invoice ready to issue",
      async () => {
        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId: selectedPaymentId,
            method: paymentMethod,
            reference: paymentRef.trim() || null,
            paidAt: paymentPaidAt,
          }),
        });
        const body = await res.json();
        if (!res.ok || !body.success) {
          throw new Error(body.error || "Could not verify that payment");
        }
      },
      () => {
        setRecordPaymentModal(false);
        setPaymentRef("");
      }
    );
  };

  const handleAddFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !newFile) {
      showToast("Choose a file to upload");
      return;
    }
    void run(
      "File uploaded and made visible to client",
      () =>
        uploadDocumentRecord(newFile, {
          client_id: project.client_id,
          project_id: project.id,
          title: newFileTitle.trim() || newFile.name,
          category: newFileCategory,
          visibility: "client",
          uploaded_by: user?.id || null,
        }),
      () => {
        setNewFileTitle("");
        setNewFile(null);
      }
    );
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    setDeleting(true);
    try {
      await deleteProjectRecord(project.id);
      await refresh();
      showToast(`Project "${project.name}" permanently deleted`);
      router.push("/admin/projects");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error deleting project");
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="text-[13px] text-ink-500 font-sans">Loading project...</div>;
  }

  if (error) {
    return (
      <div className="max-w-2xl p-4 bg-brick-100/80 border border-brick-600 rounded-sm text-[13px] text-brick-900">
        {error}
      </div>
    );
  }

  if (!project) notFound();

  const tabs = [
    { key: "general", label: "General" },
    { key: "timeline", label: "Timeline" },
    { key: "scope", label: "Scope" },
    { key: "stack", label: "Stack" },
    { key: "updates", label: "Updates" },
    { key: "payments", label: "Payments" },
    { key: "files", label: "Files" },
    { key: "preview", label: "Client Preview" },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* 1. Header Bar with Visibility Toggle and Delete */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ink-100">
        <div>
          <div className="text-[13px] text-ink-500 font-sans">
            <Link href="/admin/projects" className="hover:text-ink-950">
              Projects
            </Link>{" "}
            / {project.client?.name}
          </div>
          <h1 className="font-serif text-[28px] text-ink-950 font-normal mt-0.5">
            {project.name}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setDeleteModalOpen(true)}
          >
            Delete project
          </Button>

          <button
            type="button"
            onClick={toggleVisibility}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors flex items-center gap-1.5 border ${
              visibleToClient
                ? "bg-river-50 border-river-700/30 text-river-800"
                : "bg-ink-100/70 border-ink-200 text-ink-600"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                visibleToClient ? "bg-river-500" : "bg-ink-400"
              }`}
            />
            {visibleToClient ? "Visible to client" : "Hidden from client"}
          </button>
        </div>
      </div>

      {/* 2. Sub-Route Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-ink-100 pb-px overflow-x-auto text-[13px]">
        {tabs.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`px-3.5 py-2 font-medium transition-colors relative whitespace-nowrap ${
                isActive
                  ? "text-ink-950 font-semibold border-b-2 border-river-700 -mb-px"
                  : "text-ink-600 hover:text-ink-950"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 3. Tab Contents */}

      {/* TAB: GENERAL */}
      {activeTab === "general" && (
        <div className="bg-surface border border-ink-100 rounded-md p-6 flex flex-col gap-5">
          <Input
            label="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            label="One-line summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            helperText="Displays directly below greeting on client overview"
          />

          <Textarea
            label="Project description (Markdown)"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-ink-600 font-sans">
                Stage / Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="h-[38px] px-3 bg-surface border border-ink-200 rounded-sm text-[14px] text-ink-950 font-sans"
              >
                <option value="planning">Planning</option>
                <option value="design">Design</option>
                <option value="development">Development</option>
                <option value="testing">Testing</option>
                <option value="review">Review</option>
                <option value="launch">Launch</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On hold</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-medium text-ink-600 font-sans">
                  Progress (%)
                </label>
                <button
                  type="button"
                  onClick={() => setProgressMode(progressMode === "auto" ? "manual" : "auto")}
                  className="text-[11px] text-river-700 hover:underline"
                >
                  {progressMode === "auto" ? "Set manual" : "Calculate auto"}
                </button>
              </div>
              <input
                type="number"
                min={0}
                max={100}
                disabled={progressMode === "auto"}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="h-[38px] px-3 bg-surface border border-ink-200 rounded-sm text-[14px] text-ink-950 font-sans disabled:bg-ink-50 disabled:text-ink-500"
              />
              <span className="text-[11px] text-ink-400">
                {progressMode === "auto" ? "Derived from completed milestones" : "Manual override"}
              </span>
            </div>

            <Input
              label="Total Value (₹)"
              type="number"
              value={totalRupees}
              onChange={(e) => setTotalRupees(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Expected delivery date"
              type="date"
              value={expectedDelivery}
              onChange={(e) => setExpectedDelivery(e.target.value)}
            />
          </div>

          <div className="pt-4 border-t border-ink-100 flex items-center justify-between">
            <Button variant="primary" size="md" onClick={handleSaveGeneral}>
              Save changes
            </Button>
          </div>

          {/* Danger Zone */}
          <div className="mt-4 bg-surface border border-brick-600/30 rounded-md p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-[15px] font-semibold text-brick-800">
                Delete Project
              </h3>
              <p className="text-[13px] text-ink-500 mt-0.5">
                Permanently deletes this project and all its milestones, updates, deliverables, and scope specifications.
              </p>
            </div>
            <Button
              type="button"
              variant="danger"
              size="md"
              onClick={() => setDeleteModalOpen(true)}
              className="shrink-0"
            >
              Delete project
            </Button>
          </div>
        </div>
      )}

      {/* TAB: TIMELINE */}
      {activeTab === "timeline" && (
        <div className="flex flex-col gap-6">
          <div className="bg-surface border border-ink-100 rounded-md divide-y divide-ink-100">
            {milestones.map((m, idx) => (
              <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="font-mono text-ink-400 text-[13px] mt-0.5">{idx + 1}.</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink-950 text-[15px]">{m.title}</span>
                      <StatusPill status={m.status} />
                    </div>
                    {m.description && (
                      <p className="text-[13px] text-ink-600 mt-0.5">{m.description}</p>
                    )}
                    <div className="text-[12px] text-ink-500 mt-1 font-mono">
                      {m.start_date || "—"} to {m.end_date || "—"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  {m.status === "in_progress" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCompleteAndStartNext(m.id)}
                    >
                      Complete & start next →
                    </Button>
                  )}
                  {m.status === "upcoming" && (
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() =>
                        void run("Set as current milestone", async () => {
                          const previous = milestones.find(
                            (item) => item.status === "in_progress" && item.id !== m.id
                          );
                          if (previous) {
                            await updateMilestoneRecord(previous.id, {
                              status: "upcoming" as MilestoneStatus,
                            });
                          }
                          await updateMilestoneRecord(m.id, {
                            status: "in_progress" as MilestoneStatus,
                          });
                        })
                      }
                    >
                      Set current
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Milestone Form */}
          <form onSubmit={handleAddMilestone} className="bg-surface border border-ink-100 rounded-md p-5 flex flex-col gap-4">
            <h3 className="font-serif text-[18px] text-ink-950 font-medium">
              Add milestone
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Milestone title"
                required
                placeholder="e.g. Content integration"
                value={newMilestoneTitle}
                onChange={(e) => setNewMilestoneTitle(e.target.value)}
              />
              <Input
                label="Description (optional)"
                placeholder="Short scope note for client view"
                value={newMilestoneDesc}
                onChange={(e) => setNewMilestoneDesc(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Start date"
                type="date"
                value={newMilestoneStart}
                onChange={(e) => setNewMilestoneStart(e.target.value)}
              />
              <Input
                label="End date"
                type="date"
                value={newMilestoneEnd}
                onChange={(e) => setNewMilestoneEnd(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" size="md" className="self-start">
              + Append milestone
            </Button>
          </form>
        </div>
      )}

      {/* TAB: SCOPE */}
      {activeTab === "scope" && (
        <div className="flex flex-col gap-6">
          <div className="bg-surface border border-ink-100 rounded-md divide-y divide-ink-100">
            {features.map((f) => (
              <div key={f.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      void run("Deliverable updated", () =>
                        updateFeatureRecord(f.id, { included: !f.included })
                      )
                    }
                    className={`w-6 h-6 rounded-xs flex items-center justify-center text-[12px] font-bold border transition-colors ${
                      f.included
                        ? "bg-river-50 border-river-700 text-river-700"
                        : "bg-ink-100 border-ink-300 text-ink-400"
                    }`}
                  >
                    {f.included ? "✓" : "✕"}
                  </button>
                  <div>
                    <span className={`text-[14px] font-medium ${f.included ? "text-ink-950" : "text-ink-500 line-through"}`}>
                      {f.label}
                    </span>
                    {f.note && <span className="text-[13px] text-ink-500 ml-2">({f.note})</span>}
                  </div>
                </div>
                <span className="text-[12px] font-mono text-ink-500">
                  {f.included ? "Included" : "Excluded"}
                </span>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddFeature} className="bg-surface border border-ink-100 rounded-md p-5 flex flex-col gap-4">
            <h3 className="font-serif text-[18px] text-ink-950 font-medium">Add scope item</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Feature label"
                required
                placeholder="e.g. Multi-language support"
                value={newFeatureLabel}
                onChange={(e) => setNewFeatureLabel(e.target.value)}
              />
              <Input
                label="Note / Constraint"
                placeholder="e.g. English and Hindi only"
                value={newFeatureNote}
                onChange={(e) => setNewFeatureNote(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="feat-inc"
                checked={newFeatureIncluded}
                onChange={(e) => setNewFeatureIncluded(e.target.checked)}
                className="rounded-xs text-river-700 focus:ring-river-500"
              />
              <label htmlFor="feat-inc" className="text-[13px] text-ink-800 font-sans">
                Included in agreed scope (uncheck for explicit out-of-scope items)
              </label>
            </div>
            <Button type="submit" variant="secondary" size="md" className="self-start">
              + Add item
            </Button>
          </form>
        </div>
      )}

      {/* TAB: STACK */}
      {activeTab === "stack" && (
        <div className="flex flex-col gap-6">
          <div className="bg-surface border border-ink-100 rounded-md divide-y divide-ink-100">
            {technologies.map((t) => (
              <div key={t.id} className="p-4 flex items-center justify-between text-[14px]">
                <span className="font-medium text-ink-600">{t.area}</span>
                <span className="font-semibold text-ink-950">{t.name}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddTechnology} className="bg-surface border border-ink-100 rounded-md p-5 flex flex-col gap-4">
            <h3 className="font-serif text-[18px] text-ink-950 font-medium">Add technology</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Area"
                required
                placeholder="e.g. Analytics, Styling, Search"
                value={newTechArea}
                onChange={(e) => setNewTechArea(e.target.value)}
              />
              <Input
                label="Technology / Tool"
                required
                placeholder="e.g. Plausible, Tailwind CSS"
                value={newTechName}
                onChange={(e) => setNewTechName(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" size="md" className="self-start">
              + Add technology
            </Button>
          </form>
        </div>
      )}

      {/* TAB: UPDATES */}
      {activeTab === "updates" && (
        <div className="flex flex-col gap-6">
          {/* New update composer */}
          <form onSubmit={handlePublishUpdate} className="bg-surface border border-ink-100 rounded-md p-5 flex flex-col gap-4">
            <h3 className="font-serif text-[18px] text-ink-950 font-medium">
              Publish project update
            </h3>
            <p className="text-[13px] text-ink-600 font-sans -mt-2">
              Publishing sends a notification email to the client and updates the overview stage card.
            </p>
            <Input
              label="Subject / Title (optional)"
              placeholder="e.g. Weekly progress — Admin dashboard completed"
              value={newUpdateTitle}
              onChange={(e) => setNewUpdateTitle(e.target.value)}
            />
            <Textarea
              label="Update body (Markdown)"
              required
              rows={4}
              placeholder="Two lines on what was built and what's next..."
              value={newUpdateBody}
              onChange={(e) => setNewUpdateBody(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" size="md">
                Publish update · Notify client
              </Button>
            </div>
          </form>

          {/* Past updates */}
          <div className="bg-surface border border-ink-100 rounded-md divide-y divide-ink-100">
            {updates.map((u) => (
              <div key={u.id} className="p-5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-mono text-ink-500">
                    {formatDate(u.published_at, "full")}
                  </span>
                  <span className="text-[11px] font-mono text-river-700 bg-river-50 px-2 py-0.5 rounded-full">
                    Published
                  </span>
                </div>
                {u.title && (
                  <h4 className="font-medium text-ink-950 text-[15px]">{u.title}</h4>
                )}
                <p className="text-[14px] text-ink-700 whitespace-pre-line font-serif leading-relaxed">
                  {u.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: PAYMENTS */}
      {activeTab === "payments" && (
        <div className="flex flex-col gap-6">
          {/* Contract value vs what the schedule actually covers */}
          <div className="bg-surface border border-ink-100 rounded-md p-5 flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[14px] uppercase tracking-wider font-semibold text-ink-500">
                Payment schedule
              </h3>
              <span className="text-[12px] text-ink-500 font-sans">
                Contract value is set on the General tab
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <span className="text-[12px] text-ink-500 block">Contract value</span>
                <span className="font-mono text-[20px] font-semibold text-ink-950 tabular-nums">
                  {formatMoney(contractPaise)}
                </span>
              </div>
              <div>
                <span className="text-[12px] text-ink-500 block">Scheduled across stages</span>
                <span className="font-mono text-[20px] font-semibold text-ink-950 tabular-nums">
                  {formatMoney(scheduledPaise)}
                </span>
              </div>
              <div>
                <span className="text-[12px] text-ink-500 block">Collected</span>
                <span className="font-mono text-[20px] font-semibold text-river-700 tabular-nums">
                  {formatMoney(collectedPaise)}
                </span>
              </div>
            </div>

            {/* Proportion of the contract carved into stages */}
            <div className="h-1.5 w-full bg-ink-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${unscheduledPaise < 0 ? "bg-brick-600" : "bg-river-700"}`}
                style={{
                  width: `${
                    contractPaise > 0
                      ? Math.min(100, (scheduledPaise / contractPaise) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>

            {unscheduledPaise > 0 && (
              <p className="text-[13px] text-ink-600">
                <strong>{formatMoney(unscheduledPaise)}</strong> of the contract is not
                in any stage yet.
              </p>
            )}
            {unscheduledPaise < 0 && (
              <p className="text-[13px] text-brick-900 bg-brick-100/80 border border-brick-600 rounded-sm p-3">
                The stages add up to <strong>{formatMoney(Math.abs(unscheduledPaise))}</strong>{" "}
                more than the contract value. Adjust a stage or raise the contract value.
              </p>
            )}
            {unscheduledPaise === 0 && contractPaise > 0 && (
              <p className="text-[13px] text-river-800">
                The schedule matches the contract value exactly.
              </p>
            )}
          </div>

          {/* Add a stage */}
          <form
            onSubmit={handleAddStage}
            className="bg-surface border border-ink-100 rounded-md p-5 flex flex-col gap-4"
          >
            <h3 className="font-serif text-[18px] text-ink-950 font-medium">
              Add a stage
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Stage name"
                placeholder="e.g. Advance, On design sign-off"
                value={newStageLabel}
                onChange={(e) => setNewStageLabel(e.target.value)}
                helperText="Your own wording — the client sees this"
              />
              <div className="flex flex-col gap-1">
                <Input
                  label="Amount (₹)"
                  type="number"
                  min="1"
                  value={newStageAmount}
                  onChange={(e) => setNewStageAmount(e.target.value)}
                />
                {unscheduledPaise > 0 && (
                  <button
                    type="button"
                    onClick={fillRemainingAmount}
                    className="self-start text-[12px] text-river-700 hover:text-river-800 underline underline-offset-2"
                  >
                    Use remaining {formatMoney(unscheduledPaise)}
                  </button>
                )}
              </div>
              <Input
                label="Due date"
                type="date"
                value={newStageDue}
                onChange={(e) => setNewStageDue(e.target.value)}
                helperText="Leave blank for on-delivery"
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              size="md"
              className="self-start"
              loading={busy}
            >
              + Add stage
            </Button>
          </form>

          {payments.length === 0 && (
            <div className="bg-surface border border-dashed border-ink-200 rounded-md p-8 text-center text-ink-500 text-[14px]">
              No stages yet. Split the contract value into the instalments you
              agreed with the client.
            </div>
          )}

          <div className="bg-surface border border-ink-100 rounded-md divide-y divide-ink-100">
            {payments.map((p) => (
              <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink-950 text-[15px]">{p.label}</span>
                    <StatusPill status={p.status} />
                  </div>
                  <div className="text-[13px] text-ink-500 font-sans mt-0.5">
                    Due: {p.due_date ? formatDate(p.due_date, "table") : "On delivery"} ·{" "}
                    {p.paid_at && `Paid: ${formatDate(p.paid_at, "table")}`}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="money font-semibold text-ink-950 text-[15px] tabular-nums">
                    {formatMoney(p.amount)}
                  </span>
                  {p.status !== "paid" && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedPaymentId(p.id);
                          setRecordPaymentModal(true);
                        }}
                      >
                        Verify payment
                      </Button>
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() => handleDeleteStage(p.id, p.label)}
                        className="text-brick-800 hover:bg-brick-100/60"
                      >
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: FILES */}
      {activeTab === "files" && (
        <div className="flex flex-col gap-6">
          <div className="bg-surface border border-ink-100 rounded-md divide-y divide-ink-100">
            {documents.map((doc) => (
              <div key={doc.id} className="p-4 flex items-center justify-between gap-4 text-[14px]">
                <div>
                  <span className="font-medium text-ink-950">{doc.title}</span>
                  <span className="text-[12px] text-ink-500 ml-2 capitalize font-mono">
                    ({doc.category})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] px-2 py-0.5 rounded-full bg-river-50 text-river-800">
                    Visible to client
                  </span>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddFile} className="bg-surface border border-ink-100 rounded-md p-5 flex flex-col gap-4">
            <h3 className="font-serif text-[18px] text-ink-950 font-medium">Add file / deliverable</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="File title"
                placeholder="Defaults to the file name"
                value={newFileTitle}
                onChange={(e) => setNewFileTitle(e.target.value)}
              />
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-medium text-ink-600 font-sans">
                  Category
                </label>
                <select
                  value={newFileCategory}
                  onChange={(e) => setNewFileCategory(e.target.value as DocCategory)}
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
              <label className="text-[13px] font-medium text-ink-600 font-sans">
                File
              </label>
              <input
                type="file"
                onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                className="text-[13px] text-ink-700 file:mr-3 file:h-[30px] file:px-3 file:rounded-sm file:border file:border-ink-200 file:bg-ink-50 file:text-[13px] file:text-ink-800"
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              size="md"
              className="self-start"
              loading={busy}
            >
              + Add file
            </Button>
          </form>
        </div>
      )}

      {/* TAB: PREVIEW */}
      {activeTab === "preview" && (
        <div className="border border-ink-200 rounded-md bg-paper p-6 sm:p-8 shadow-inner">
          <div className="text-[12px] font-mono text-ink-500 uppercase tracking-wider mb-4 border-b border-ink-200 pb-2 flex items-center justify-between">
            <span>Read-Only Client Preview Frame</span>
            <span>{visibleToClient ? "Live to client" : "Hidden (Draft)"}</span>
          </div>

          <div className="max-w-[680px] mx-auto bg-paper">
            <h2 className="font-serif text-[32px] text-ink-950 font-normal">
              Good morning, Rahul
            </h2>
            <p className="text-[15px] text-ink-600 font-sans">
              {project.client?.name} · {project.name}
            </p>

            <div className="my-6 border-y border-ink-100 py-3 flex items-center justify-between">
              <StatusPill status={project.status} />
              <span className="font-serif text-[28px] text-ink-950">{project.progress}%</span>
            </div>

            <TheCurrent
              milestones={milestones.filter((m) => m.visible_to_client)}
              compact={false}
              latestUpdate={updates[0]?.body}
            />
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <Modal
        isOpen={recordPaymentModal}
        onClose={() => setRecordPaymentModal(false)}
        title="Verify payment received"
      >
        <form onSubmit={handleRecordPaymentSubmit} className="flex flex-col gap-4 text-[14px]">
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-ink-600 font-sans">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="h-[38px] px-3 bg-surface border border-ink-200 rounded-sm text-[14px] text-ink-950 font-sans"
            >
              <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="netbanking">Netbanking</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </div>

          <Input
            label="Transaction Reference / UTR"
            placeholder="e.g. UTR-HDFC-998877"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
          />

          <Input
            label="Payment date"
            type="date"
            value={paymentPaidAt}
            onChange={(e) => setPaymentPaidAt(e.target.value)}
          />

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="quiet"
              size="md"
              onClick={() => setRecordPaymentModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md">
              Confirm payment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Project Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !deleting && setDeleteModalOpen(false)}
        title={`Delete Project: ${project.name}`}
      >
        <div className="flex flex-col gap-4 text-[14px]">
          <div className="p-3 bg-brick-100/80 border border-brick-600 rounded-sm text-[13px] text-brick-900 leading-snug">
            <strong>Warning: Permanent Action</strong>
            <p className="mt-1">
              Deleting <strong>{project.name}</strong> will permanently remove all associated:
            </p>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-brick-800">
              <li>Milestones and stage progress</li>
              <li>Published updates & notes</li>
              <li>Scope features and tech stack items</li>
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
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="md"
              loading={deleting}
              onClick={handleDeleteProject}
            >
              Permanently delete project
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
