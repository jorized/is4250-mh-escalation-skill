import type { MoodEntry, UsageLog } from "./storage";

/** Placeholder thresholds from skill/references/thresholds.md. Calibrate with clinicians. */
export const THRESHOLDS = {
  sessionMessages: 40,
  dayMessages: 60,
  daySessions: 3,
  lateNightConsecutive: 3,
  multiDayMessages: 30,
  multiDayDays: 5,
  lowScore: 2,
  lowsIn14Days: 3,
} as const;

const DAY = 24 * 60 * 60 * 1000;

function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** M7: one low triggers nothing; a pattern triggers a gentle offer. */
export function moodOfferDue(entries: MoodEntry[], now = Date.now()): boolean {
  const recent = entries.filter((e) => now - e.at <= 14 * DAY);
  const lows = recent.filter((e) => e.score <= THRESHOLDS.lowScore).length;
  if (lows >= THRESHOLDS.lowsIn14Days) return true;

  const week = (offset: number) =>
    entries.filter((e) => now - e.at > offset * 7 * DAY && now - e.at <= (offset + 1) * 7 * DAY);
  const avg = (xs: MoodEntry[]) => xs.reduce((s, e) => s + e.score, 0) / xs.length;
  const [w0, w1] = [week(0), week(1)];
  return w0.length > 0 && w1.length > 0 && avg(w0) <= 2 && avg(w1) <= 2;
}

export function checkinDue(entries: MoodEntry[], now = Date.now()): boolean {
  const last = entries.at(-1);
  return !last || now - last.at >= 7 * DAY;
}

/** M8 usage signals. Content signals ("you're the only one I talk to") are the model's job. */
export function dependencySignals(usage: UsageLog, sessionMessages: number, now = Date.now()): string[] {
  const out: string[] = [];
  const today = dayKey(now);

  if (sessionMessages >= THRESHOLDS.sessionMessages)
    out.push(`single session: ${sessionMessages} student messages (suggest a break and mention a person)`);

  const todayMsgs = usage.messages.filter((t) => dayKey(t) === today).length;
  const todaySessions = usage.sessions.filter((t) => dayKey(t) === today).length;
  if (todayMsgs >= THRESHOLDS.dayMessages || todaySessions >= THRESHOLDS.daySessions)
    out.push(`single day: ${todaySessions} sessions, ${todayMsgs} messages today (bridge to a named person or service)`);

  let lateNights = 0;
  for (let i = 0; i < THRESHOLDS.lateNightConsecutive; i++) {
    const key = dayKey(now - i * DAY);
    const hit = usage.messages.some((t) => {
      const h = new Date(t).getHours();
      return dayKey(t) === key && h >= 1 && h < 5;
    });
    if (hit) lateNights++;
    else break;
  }
  if (lateNights >= THRESHOLDS.lateNightConsecutive)
    out.push(`late night: used between 1am and 5am on ${lateNights} consecutive nights (gentle note, then the faculty route)`);

  let heavyDays = 0;
  for (let i = 0; i < 7; i++) {
    const key = dayKey(now - i * DAY);
    if (usage.messages.filter((t) => dayKey(t) === key).length >= THRESHOLDS.multiDayMessages) heavyDays++;
  }
  if (heavyDays >= THRESHOLDS.multiDayDays)
    out.push(`multi-day: ${heavyDays} of the last 7 days with ${THRESHOLDS.multiDayMessages}+ messages (offer a human route)`);

  return out;
}
