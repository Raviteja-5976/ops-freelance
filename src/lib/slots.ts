import { AvailabilityRule, CallRequest } from "@/types/database";

export interface DaySlots {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "Tue 8"
  fullLabel: string; // "Tuesday 8 September"
  slots: {
    timeStr: string; // "10:00 AM"
    isoTime: string; // ISO string
  }[];
}

/**
 * Generates available call slots for client booking
 */
export function generateAvailableSlots(
  rules: AvailabilityRule[],
  confirmedCalls: CallRequest[],
  options: {
    noticeHours?: number;
    maxDaysAhead?: number;
    durationMins?: number;
    bufferMins?: number;
    timeZone?: string;
  } = {}
): DaySlots[] {
  const {
    noticeHours = 24,
    maxDaysAhead = 14,
    durationMins = 30,
    bufferMins = 15,
    timeZone = "Asia/Kolkata",
  } = options;

  const results: DaySlots[] = [];
  const now = new Date();
  const minNoticeTime = new Date(now.getTime() + noticeHours * 60 * 60 * 1000);

  // Generate for the next N days
  for (let i = 1; i <= maxDaysAhead; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;

    const weekday = d.getDay(); // 0 = Sun, 1 = Mon ...
    const activeRules = rules.filter((r) => r.weekday === weekday && r.is_active);

    if (activeRules.length === 0) continue;

    const weekdayShort = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone }).format(d);
    const dayNum = d.getDate();
    const dayLabel = `${weekdayShort} ${dayNum}`;
    const fullLabel = new Intl.DateTimeFormat("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone,
    }).format(d);

    const slots: { timeStr: string; isoTime: string }[] = [];

    for (const rule of activeRules) {
      const [startH, startM] = rule.start_time.split(":").map(Number);
      const [endH, endM] = rule.end_time.split(":").map(Number);

      const ruleStart = new Date(d);
      ruleStart.setHours(startH, startM, 0, 0);

      const ruleEnd = new Date(d);
      ruleEnd.setHours(endH, endM, 0, 0);

      let cur = new Date(ruleStart);
      while (cur.getTime() + durationMins * 60 * 1000 <= ruleEnd.getTime()) {
        const slotEnd = new Date(cur.getTime() + durationMins * 60 * 1000);

        // Check min notice
        if (cur > minNoticeTime) {
          // Check collision with confirmed calls (including buffer)
          const hasCollision = confirmedCalls.some((call) => {
            if (call.status !== "confirmed" || !call.confirmed_start) return false;
            const callStart = new Date(call.confirmed_start);
            const callEnd = new Date(callStart.getTime() + (call.duration_minutes + bufferMins) * 60 * 1000);
            return cur < callEnd && slotEnd > callStart;
          });

          if (!hasCollision) {
            const timeStr = new Intl.DateTimeFormat("en-IN", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
              timeZone,
            }).format(cur);

            slots.push({
              timeStr,
              isoTime: cur.toISOString(),
            });
          }
        }

        // Advance by duration + buffer
        cur = new Date(cur.getTime() + (durationMins + bufferMins) * 60 * 1000);
      }
    }

    if (slots.length > 0) {
      results.push({
        date: dateKey,
        dayLabel,
        fullLabel,
        slots,
      });
    }
  }

  return results;
}
