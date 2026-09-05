"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/formatters";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useData } from "@/components/providers/DataProvider";
import { updateCallRequestRecord } from "@/lib/db";

export default function AdminCallsPage() {
  const { showToast } = useToast();
  const { callRequests: calls, clients, loading, error, refresh } = useData();

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [proposeModalOpen, setProposeModalOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);

  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [saving, setSaving] = useState(false);

  const pendingCalls = calls.filter((c) => c.status === "pending");
  const confirmedCalls = calls.filter((c) => c.status === "confirmed");
  const otherCalls = calls.filter((c) => c.status !== "pending" && c.status !== "confirmed");

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCallId || saving) return;
    const target = calls.find((c) => c.id === activeCallId);
    if (!target) return;

    setSaving(true);
    try {
      await updateCallRequestRecord(activeCallId, {
        status: "confirmed",
        confirmed_start: target.requested_start,
        meeting_url: meetingUrl || null,
        responded_at: new Date().toISOString(),
      });

      const client = clients.find((c) => c.id === target.client_id);
      if (client?.email) {
        // Best effort: a failed notification must not undo a confirmed call.
        fetch("/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "call_confirmed",
            payload: {
              recipientEmail: client.email,
              clientName: client.name,
              slotDisplay: formatDate(target.requested_start, "full"),
              meetingUrl,
            },
          }),
        }).catch(() => {});
      }

      await refresh();
      setConfirmModalOpen(false);
      showToast("Call confirmed · meeting link saved");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not confirm call");
    } finally {
      setSaving(false);
    }
  };

  const handleProposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCallId || !proposedTime || saving) return;

    setSaving(true);
    try {
      await updateCallRequestRecord(activeCallId, {
        status: "reschedule_proposed",
        proposed_start: new Date(proposedTime).toISOString(),
        responded_at: new Date().toISOString(),
      });
      await refresh();
      setProposeModalOpen(false);
      showToast("Alternate time proposed");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not propose a new time");
    } finally {
      setSaving(false);
    }
  };

  const handleDeclineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCallId || saving) return;

    setSaving(true);
    try {
      await updateCallRequestRecord(activeCallId, {
        status: "declined",
        admin_note: declineReason || null,
        responded_at: new Date().toISOString(),
      });
      await refresh();
      setDeclineModalOpen(false);
      showToast("Call declined");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not decline call");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ink-100">
        <div>
          <h1 className="font-serif text-[28px] text-ink-950 font-normal">
            Call requests
          </h1>
          <p className="text-[13px] text-ink-500 font-sans">
            Client booking queue, meeting links, and studio schedule.
          </p>
        </div>
        <Link href="/admin/calls/availability">
          <Button variant="secondary" size="md">
            Availability rules ⚙
          </Button>
        </Link>
      </div>

      {/* 1. Pending Requests */}
      <div>
        <h2 className="text-[14px] uppercase tracking-wider font-semibold text-ink-500 mb-3">
          Pending Review ({pendingCalls.length})
        </h2>
        {pendingCalls.length === 0 ? (
          <div className="p-4 bg-surface border border-ink-100 rounded-md text-ink-500 text-[13px]">
            No pending call requests.
          </div>
        ) : (
          <div className="bg-surface border border-ink-100 rounded-md divide-y divide-ink-100">
            {pendingCalls.map((call) => {
              const client = clients.find((c) => c.id === call.client_id);
              return (
                <div key={call.id} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink-950 text-[15px]">
                        {client?.name} · {call.requested_by_profile?.full_name || "Client"}
                      </span>
                      <StatusPill status={call.status} />
                    </div>
                    <p className="text-[14px] font-medium text-ink-800 mt-1">
                      Requested: {formatDate(call.requested_start, "datetime")} (30 min)
                    </p>
                    <p className="text-[14px] text-ink-600 mt-1 italic">
                      &quot;{call.reason}&quot;
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setActiveCallId(call.id);
                        setConfirmModalOpen(true);
                      }}
                    >
                      Confirm
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setActiveCallId(call.id);
                        setProposeModalOpen(true);
                      }}
                    >
                      Propose new time
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setActiveCallId(call.id);
                        setDeclineModalOpen(true);
                      }}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Upcoming Confirmed */}
      <div>
        <h2 className="text-[14px] uppercase tracking-wider font-semibold text-ink-500 mb-3">
          Upcoming Confirmed ({confirmedCalls.length})
        </h2>
        <div className="bg-surface border border-ink-100 rounded-md divide-y divide-ink-100">
          {confirmedCalls.map((call) => (
            <div key={call.id} className="p-5 flex items-center justify-between">
              <div>
                <p className="font-medium text-ink-950 text-[15px]">
                  {formatDate(call.confirmed_start || call.requested_start, "datetime")}
                </p>
                <p className="text-[13px] text-ink-600 mt-0.5">{call.reason}</p>
                {call.meeting_url && (
                  <a
                    href={call.meeting_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] font-mono text-river-700 hover:underline block mt-1"
                  >
                    {call.meeting_url} ↗
                  </a>
                )}
              </div>
              <StatusPill status="confirmed" />
            </div>
          ))}
        </div>
      </div>

      {/* Confirm Modal */}
      <Modal isOpen={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} title="Confirm Call">
        <form onSubmit={handleConfirmSubmit} className="flex flex-col gap-4 text-[14px]">
          <Input
            label="Meeting Video URL (Google Meet / Zoom)"
            required
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
          />
          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="quiet" size="md" onClick={() => setConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md">
              Confirm and send invite
            </Button>
          </div>
        </form>
      </Modal>

      {/* Propose Modal */}
      <Modal isOpen={proposeModalOpen} onClose={() => setProposeModalOpen(false)} title="Propose Alternate Time">
        <form onSubmit={handleProposeSubmit} className="flex flex-col gap-4 text-[14px]">
          <Input
            label="Select alternate date and time"
            type="datetime-local"
            required
            value={proposedTime}
            onChange={(e) => setProposedTime(e.target.value)}
          />
          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="quiet" size="md" onClick={() => setProposeModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md">
              Send proposal
            </Button>
          </div>
        </form>
      </Modal>

      {/* Decline Modal */}
      <Modal isOpen={declineModalOpen} onClose={() => setDeclineModalOpen(false)} title="Decline Call Request">
        <form onSubmit={handleDeclineSubmit} className="flex flex-col gap-4 text-[14px]">
          <Textarea
            label="Reason for declining (shared with client)"
            required
            rows={3}
            placeholder="e.g. In client delivery crunch this week; please send questions via project updates."
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
          />
          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="quiet" size="md" onClick={() => setDeclineModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" size="md">
              Confirm decline
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
