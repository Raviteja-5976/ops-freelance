"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { generateAvailableSlots } from "@/lib/slots";
import { useData } from "@/components/providers/DataProvider";
import { createCallRequestRecord } from "@/lib/db";
import { useAuth } from "@/components/providers/AuthProvider";

export default function RequestCallPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, profile } = useAuth();

  const {
    myClient,
    myProjects,
    selectedProject,
    availabilityRules,
    callRequests,
    refresh,
  } = useData();

  const client = myClient;
  const userProjects = myProjects;
  const project = selectedProject;

  const daysWithSlots = generateAvailableSlots(
    availabilityRules,
    callRequests
  );

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedSlotIso, setSelectedSlotIso] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currentDay = daysWithSlots[selectedDayIndex];

  if (!client) {
    return (
      <div className="py-12 flex flex-col items-center text-center max-w-md mx-auto">
        <h1 className="font-serif text-[28px] text-ink-950 font-normal">
          Cannot request a call
        </h1>
        <p className="mt-3 text-[14px] text-ink-600 font-sans leading-relaxed">
          Your account is not currently assigned to an active client workspace. Please contact OpenRiverStack directly at founder@openriverstack.com.
        </p>
        <Link href="/overview" className="mt-4">
          <Button variant="secondary" size="md">
            Return to workspace
          </Button>
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!selectedSlotIso) {
      setError("Please select a time slot.");
      return;
    }
    if (!reason.trim()) {
      setError("Please specify what you would like to discuss.");
      return;
    }
    if (!user?.id) {
      setError("You need to be signed in to request a call.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await createCallRequestRecord({
        client_id: client.id,
        project_id: project?.id || null,
        requested_by: user.id,
        requested_start: selectedSlotIso,
        duration_minutes: 30,
        reason: reason.trim(),
      });

      // Best effort: a failed notification must not lose the booking.
      fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "call_requested",
          payload: {
            clientName: profile?.full_name || user.email?.split("@")[0] || "Client",
            clientEmail: user.email || profile?.email || "",
            companyName: client.name,
            slotDisplay: `${currentDay?.fullLabel} at ${
              currentDay?.slots.find((sl) => sl.isoTime === selectedSlotIso)?.timeStr ||
              "selected time"
            }`,
            agenda: reason.trim(),
          },
        }),
      }).catch(() => {});

      await refresh();
      showToast("Call requested \u00b7 OpenRiverStack notified");
      router.push("/calls");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request this call.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-[600px]">
      <div>
        <Link
          href="/calls"
          className="text-[13px] text-ink-600 hover:text-ink-950 flex items-center gap-1 font-sans mb-3"
        >
          ← Back to calls
        </Link>
        <h1 className="font-serif text-[32px] text-ink-950 font-normal">
          Request a call
        </h1>
        <p className="text-[14px] text-ink-600 font-sans mt-0.5">
          Pick a time that works for you. 30 minutes · times shown in your timezone.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Date Strip */}
        <div>
          <label className="text-[13px] font-medium text-ink-600 font-sans block mb-2">
            When works for you?
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {daysWithSlots.map((d, idx) => {
              const isSelected = selectedDayIndex === idx;
              return (
                <button
                  type="button"
                  key={d.date}
                  onClick={() => {
                    setSelectedDayIndex(idx);
                    setSelectedSlotIso(null);
                  }}
                  className={`px-3 py-2 rounded-sm border text-[13px] font-sans font-medium transition-colors whitespace-nowrap ${
                    isSelected
                      ? "border-river-700 bg-river-100 text-river-950"
                      : "border-ink-200 bg-surface text-ink-700 hover:bg-ink-50"
                  }`}
                >
                  {d.dayLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Slot Chips Grid */}
        {currentDay && (
          <div>
            <span className="text-[14px] font-medium text-ink-950 font-sans block mb-2">
              {currentDay.fullLabel}
            </span>
            <div className="flex flex-wrap gap-2">
              {currentDay.slots.map((slot) => {
                const isSelected = selectedSlotIso === slot.isoTime;
                return (
                  <button
                    type="button"
                    key={slot.isoTime}
                    onClick={() => {
                      setSelectedSlotIso(slot.isoTime);
                      setError("");
                    }}
                    className={`h-[36px] px-3.5 rounded-full border text-[13px] font-medium font-sans transition-all ${
                      isSelected
                        ? "bg-river-100 border-river-700 text-river-950 ring-1 ring-river-700"
                        : "bg-surface border-ink-200 text-ink-800 hover:bg-ink-50 hover:border-ink-300"
                    }`}
                  >
                    {slot.timeStr}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Reason */}
        <div>
          <Textarea
            label="What would you like to discuss?"
            required
            maxLength={300}
            rows={3}
            placeholder="e.g. Review final homepage revisions and discuss launch schedule."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError("");
            }}
            helperText={`${reason.length}/300 characters`}
            error={error}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="self-start mt-2"
        >
          Request this time
        </Button>
      </form>
    </div>
  );
}
