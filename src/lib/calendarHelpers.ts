import { CalendarItem, Meeting, Milestone } from "./types";

export function fromYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toYmdLocal(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun..6=Sat
  const offset = (day + 6) % 7; // Mon=0, Tue=1, ... Sun=6
  d.setDate(d.getDate() - offset);
  return d; // Monday
}

export function formatDayLabel(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatMonthLabel(d: Date) {
  return d.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function formatTimeLabel(time: string | null | undefined) {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildMeetingDate(m: Meeting): Date | null {
  if (!m.dateIso) return null;

  const base = fromYmdLocal(m.dateIso);
  if (m.time) {
    const [hStr, minStr] = m.time.split(":");
    const h = Number(hStr) || 0;
    const min = Number(minStr) || 0;
    base.setHours(h, min, 0, 0);
  }
  return base;
}

export function formatTimeUntil(m: Meeting): string | null {
  const dt = buildMeetingDate(m);
  if (!dt) return null;
  const diffMs = dt.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes <= 0) return null;
  if (diffMinutes < 60) {
    return `In ${diffMinutes} minute${diffMinutes === 1 ? "" : "s"}`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `In ${diffHours} hour${diffHours === 1 ? "" : "s"}`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `In ${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(y, (m || 1) - 1, d || 1);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

export function formatDayShort(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function buildCalendarItemsForDay(
  iso: string,
  meetings: Meeting[],
  milestones: Milestone[]
): CalendarItem[] {
  const meetingItems: CalendarItem[] = meetings
    .filter((m) => m.dateIso === iso)
    .map((m) => ({
      id: `meeting:${m.id}`,
      dateIso: iso,
      title: m.title,
      kind: "meeting" as const,
    }));

  const milestoneItems: CalendarItem[] = milestones
    .filter((ms) => ms.dueDateIso === iso)
    .map((ms) => ({
      id: `milestone:${ms.id}`,
      dateIso: iso,
      title: ms.title,
      kind: "milestone" as const,
    }));

  return [...meetingItems, ...milestoneItems];
}
