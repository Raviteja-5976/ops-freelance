"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useData } from "@/components/providers/DataProvider";
import { replaceAvailabilityRules, saveSettingsRecord } from "@/lib/db";
import { defaultSettings } from "@/lib/data-store";
import { AvailabilityRule } from "@/types/database";

export default function AvailabilityPage() {
  const { showToast } = useToast();
  const { availabilityRules, settings, loading, refresh } = useData();
  const effective = settings || defaultSettings;

  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [duration, setDuration] = useState(effective.call_duration_minutes);
  const [buffer, setBuffer] = useState(effective.call_buffer_minutes);
  const [notice, setNotice] = useState(effective.call_min_notice_hours);
  const [lookahead, setLookahead] = useState(effective.call_max_days_ahead);
  const [saving, setSaving] = useState(false);

  // Seed the editable copy once the saved values arrive.
  useEffect(() => {
    setRules(availabilityRules);
  }, [availabilityRules]);

  useEffect(() => {
    if (!settings) return;
    setDuration(settings.call_duration_minutes);
    setBuffer(settings.call_buffer_minutes);
    setNotice(settings.call_min_notice_hours);
    setLookahead(settings.call_max_days_ahead);
  }, [settings]);

  const weekdays = [
    { num: 1, label: "Monday" },
    { num: 2, label: "Tuesday" },
    { num: 3, label: "Wednesday" },
    { num: 4, label: "Thursday" },
    { num: 5, label: "Friday" },
    { num: 6, label: "Saturday" },
    { num: 0, label: "Sunday" },
  ];

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveSettingsRecord({
        call_duration_minutes: Number(duration),
        call_buffer_minutes: Number(buffer),
        call_min_notice_hours: Number(notice),
        call_max_days_ahead: Number(lookahead),
      });
      await replaceAvailabilityRules(
        rules.map(({ weekday, start_time, end_time, is_active }) => ({
          weekday,
          start_time,
          end_time,
          is_active,
        }))
      );
      await refresh();
      showToast("Availability rules updated");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save availability");
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = (id: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, is_active: !r.is_active } : r)));
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Link
          href="/admin/calls"
          className="text-[13px] text-ink-600 hover:text-ink-950 flex items-center gap-1 font-sans mb-2"
        >
          ← Back to calls
        </Link>
        <h1 className="font-serif text-[28px] text-ink-950 font-normal">
          Weekly availability
        </h1>
        <p className="text-[13px] text-ink-500 font-sans">
          Working hours and booking constraints for client call requests.
        </p>
      </div>

      <div className="bg-surface border border-ink-100 rounded-md p-6 flex flex-col gap-6 font-sans">
        {/* Weekly schedule */}
        <div>
          <h2 className="text-[14px] uppercase tracking-wider font-semibold text-ink-500 mb-3">
            Weekly Hours
          </h2>
          <div className="divide-y divide-ink-100">
            {weekdays.map((w) => {
              const dayRules = rules.filter((r) => r.weekday === w.num);
              return (
                <div key={w.num} className="py-3 flex items-center justify-between">
                  <span className="font-medium text-ink-950 w-28">{w.label}</span>
                  <div className="flex flex-wrap items-center gap-3">
                    {dayRules.length > 0 ? (
                      dayRules.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => toggleRule(r.id)}
                          className={`px-3 py-1 rounded-sm border text-[13px] font-mono transition-colors ${
                            r.is_active
                              ? "bg-river-50 border-river-700 text-river-800"
                              : "bg-ink-50 border-ink-200 text-ink-400 line-through"
                          }`}
                        >
                          {r.start_time} – {r.end_time}
                        </button>
                      ))
                    ) : (
                      <span className="text-[13px] text-ink-400 italic">Closed</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Booking parameters */}
        <div className="border-t border-ink-100 pt-5">
          <h2 className="text-[14px] uppercase tracking-wider font-semibold text-ink-500 mb-3">
            Booking Settings
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Call duration (minutes)"
              type="number"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
            <Input
              label="Buffer between calls (minutes)"
              type="number"
              value={buffer}
              onChange={(e) => setBuffer(Number(e.target.value))}
            />
            <Input
              label="Minimum notice (hours)"
              type="number"
              value={notice}
              onChange={(e) => setNotice(Number(e.target.value))}
            />
            <Input
              label="Max lookahead (days ahead)"
              type="number"
              value={lookahead}
              onChange={(e) => setLookahead(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="pt-3 border-t border-ink-100">
          <Button variant="primary" size="md" loading={saving} onClick={handleSave}>
            Save availability
          </Button>
        </div>
      </div>
    </div>
  );
}
