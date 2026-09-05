"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/formatters";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useData } from "@/components/providers/DataProvider";
import { updateCallRequestRecord } from "@/lib/db";
import { useAuth } from "@/components/providers/AuthProvider";

export default function CallsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const { myClient, callRequests, loading, refresh } = useData();
  const client = myClient;
  const [busyId, setBusyId] = useState<string | null>(null);

  const calls = client
    ? callRequests.filter((c) => c.client_id === client.id)
    : [];

  const handleCancel = async (callId: string) => {
    setBusyId(callId);
    try {
      await updateCallRequestRecord(callId, { status: "cancelled" });
      await refresh();
      showToast("Call request cancelled");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not cancel request");
    } finally {
      setBusyId(null);
    }
  };

  const handleAcceptProposal = async (callId: string) => {
    const call = calls.find((c) => c.id === callId);
    if (!call) return;
    setBusyId(callId);
    try {
      await updateCallRequestRecord(callId, {
        status: "confirmed",
        confirmed_start: call.proposed_start || call.requested_start,
      });
      await refresh();
      showToast("Proposed time accepted and confirmed");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not accept that time");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-[32px] text-ink-950 font-normal">
            Calls
          </h1>
          <p className="text-[14px] text-ink-600 font-sans mt-0.5">
            Book 30-minute working sessions directly with OpenRiverStack.
          </p>
        </div>
        <Link href="/calls/new">
          <Button variant="primary" size="md">
            Request a call
          </Button>
        </Link>
      </div>

      <div className="border-t border-ink-100 divide-y divide-ink-100">
        {calls.length === 0 ? (
          <div className="py-10 text-center text-ink-500 text-[14px]">
            No calls booked yet. Request a slot whenever you need to talk something through.
          </div>
        ) : (
          calls.map((call) => {
            const isConfirmed = call.status === "confirmed";
            const isPending = call.status === "pending";
            const isProposed = call.status === "reschedule_proposed";
            const isCancelled = call.status === "cancelled";

            return (
              <div
                key={call.id}
                className="py-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <StatusPill status={call.status} className="mt-1" />
                  <div>
                    <h3 className="text-[16px] font-medium text-ink-950 font-sans">
                      {isConfirmed && call.confirmed_start
                        ? formatDate(call.confirmed_start, "datetime")
                        : formatDate(call.requested_start, "datetime")}
                    </h3>
                    <p className="text-[14px] text-ink-700 font-sans mt-1">
                      {call.reason}
                    </p>

                    {isProposed && call.proposed_start && (
                      <div className="mt-2 text-[13px] bg-amber-100/70 border border-amber-600/30 p-2.5 rounded-sm text-amber-800">
                        OpenRiverStack suggested a new time:{" "}
                        <strong>{formatDate(call.proposed_start, "datetime")}</strong>
                      </div>
                    )}

                    {isPending && (
                      <span className="text-[12px] text-ink-500 block mt-1">
                        Waiting on OpenRiverStack confirmation
                      </span>
                    )}

                    {call.admin_note && (
                      <p className="text-[13px] text-ink-600 mt-1 italic">
                        Note: {call.admin_note}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center pl-12 sm:pl-0">
                  {isConfirmed && call.meeting_url && (
                    <a
                      href={call.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="primary" size="sm">
                        Join call ↗
                      </Button>
                    </a>
                  )}

                  {isProposed && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleAcceptProposal(call.id)}
                    >
                      Accept time
                    </Button>
                  )}

                  {(isPending || isConfirmed) && !isCancelled && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCancel(call.id)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
