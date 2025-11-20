"use client";

import { useEffect, useMemo, useState } from "react";
import { getMeetingsForDate, loadJobsAndProjects } from "@/lib/storage";
import type { Meeting, Job } from "@/lib/types";

type ViewMode = "week" | "month";
type MonthCell = {
  date: Date;
  iso: string;
  meetings: Meeting[];
} | null;

function fromYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toYmdLocal(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun..6=Sat
  const offset = (day + 6) % 7; // Mon=0, Tue=1, ... Sun=6
  d.setDate(d.getDate() - offset);
  return d; // Monday
}

function formatDayLabel(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatMonthLabel(d: Date) {
  return d.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatTimeLabel(time: string | null | undefined) {
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

function buildMeetingDate(m: Meeting): Date | null {
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

function formatTimeUntil(m: Meeting): string | null {
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

export function MeetingsOverviewDialog({
  open,
  onClose,
  anchorDateIso,
}: {
  open: boolean;
  onClose: () => void;
  anchorDateIso: string;
}) {
  const [mode, setMode] = useState<ViewMode>("week");
  const [viewDate, setViewDate] = useState(() => fromYmdLocal(anchorDateIso));

  // keep in sync when the anchor changes from outside
  useEffect(() => {
    setViewDate(fromYmdLocal(anchorDateIso));
  }, [anchorDateIso]);

  const goPrevious = () => {
    setViewDate((prev) =>
      mode === "week"
        ? new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7)
        : new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const goNext = () => {
    setViewDate((prev) =>
      mode === "week"
        ? new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7)
        : new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  const anchorDate = useMemo(
    () => fromYmdLocal(anchorDateIso),
    [anchorDateIso]
  );

  const { jobs } = loadJobsAndProjects();

  // Build week view data
  const weekDays = useMemo(() => {
    if (!open) return [];
    const start = startOfWeek(viewDate); // Monday
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + i
      );
      const iso = toYmdLocal(d);
      const meetings = getMeetingsForDate(iso);
      return { date: d, iso, meetings };
    });
  }, [viewDate, open]);

  // Build month view data
  const monthGrid = useMemo(() => {
    if (!open) return [];
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const weeks: MonthCell[][] = [];
    let currentWeek: MonthCell[] = [null, null, null, null, null]; // Mon–Fri

    const hasCells = (week: MonthCell[]) => week.some((c) => c !== null);

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dow = d.getDay(); // 0=Sun, 1=Mon, ... 6=Sat

      // skip weekends entirely
      if (dow === 0 || dow === 6) continue;

      // Map JS day → column index: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4
      const col = dow - 1; // because dow is 1..5 here

      // If it's Monday and we already have something in the row,
      // push the previous week and start a new one
      if (col === 0 && hasCells(currentWeek)) {
        weeks.push(currentWeek);
        currentWeek = [null, null, null, null, null];
      }

      const iso = toYmdLocal(d);
      currentWeek[col] = {
        date: d,
        iso,
        meetings: getMeetingsForDate(iso),
      };
    }

    if (hasCells(currentWeek)) {
      weeks.push(currentWeek);
    }

    return weeks;
  }, [viewDate, open]);

  const switchToWeek = () => {
    setMode("week");
    setViewDate((prev) => startOfWeek(prev)); // clamp to Monday of that week
  };

  const switchToMonth = () => {
    setMode("month");
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), 1)); // first of current month
  };

  if (!open) return null;

  const jobsById = new Map<string, Job>();
  jobs.forEach((j) => jobsById.set(j.id, j));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex w-full max-w-5xl flex-col rounded-3xl border border-white/15 bg-slate-950/95 p-4 text-xs text-slate-100 shadow-[0_30px_90px_rgba(0,0,0,0.8)]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="text-sm font-semibold text-slate-50">
              Meetings overview
            </div>
            <div className="text-[11px] text-slate-400">
              Switch between weekly and monthly views to see everything on your
              calendar.
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <div className="inline-flex rounded-full border border-slate-700 bg-slate-900 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={switchToWeek}
                className={`rounded-full px-3 py-0.5 ${
                  mode === "week"
                    ? "bg-sky-500 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={switchToMonth}
                className={`rounded-full px-3 py-0.5 ${
                  mode === "month"
                    ? "bg-sky-500 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                Month
              </button>
            </div>

            {/* Prev/Next (scroll weeks/months) */}
            <div className="inline-flex rounded-full border border-slate-700 bg-slate-900 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={goPrevious}
                className="px-2 py-0.5 text-slate-300 hover:bg-slate-800"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={goNext}
                className="px-2 py-0.5 text-slate-300 hover:bg-slate-800"
              >
                ↓
              </button>
            </div>

            {/* Date label */}
            <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] text-slate-200">
              {mode === "week"
                ? `${formatDayLabel(startOfWeek(viewDate))} – ${formatDayLabel(
                    new Date(
                      startOfWeek(viewDate).getFullYear(),
                      startOfWeek(viewDate).getMonth(),
                      startOfWeek(viewDate).getDate() + 4 // Mon–Fri
                    )
                  )}`
                : formatMonthLabel(viewDate)}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-[11px] text-slate-100 hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="mt-3 flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
          {mode === "week" ? (
            <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-5 items-stretch">
              {weekDays.map(({ date, iso, meetings }) => (
                <div
                  key={iso}
                  className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/80 p-2"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {date.toLocaleDateString(undefined, {
                      weekday: "short",
                    })}
                  </div>
                  <div className="text-[12px] font-medium text-slate-100">
                    {date.getDate()}
                  </div>

                  {meetings.length === 0 ? (
                    <div className="mt-2 text-[11px] text-slate-500">
                      No meetings
                    </div>
                  ) : (
                    <ul className="mt-2 space-y-2 text-[11px]">
                      {meetings.map((m) => {
                        const company = m.jobId
                          ? jobsById.get(m.jobId)
                          : undefined;
                        return (
                          <li
                            key={m.id + iso}
                            className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5"
                          >
                            {company && (
                              <div className="mb-0.5 inline-flex items-center rounded-full border border-slate-600 bg-slate-900 px-2 py-0.5 text-[9px] text-slate-200">
                                {company.name}
                              </div>
                            )}
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-slate-50">
                                  {m.title}
                                </div>
                                {formatTimeUntil(m) && (
                                  <div className="mt-0.5 text-[10px] text-sky-300">
                                    {formatTimeUntil(m)}
                                  </div>
                                )}
                                {m.location && (
                                  <div className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">
                                    {m.location}
                                  </div>
                                )}
                              </div>
                              {m.time && (
                                <div className="shrink-0 font-mono text-[11px] text-sky-300">
                                  {formatTimeLabel(m.time)}
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Month view
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-1 text-center text-[10px] text-slate-500">
                {["Mo", "Tu", "We", "Th", "Fr"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-5 gap-1 text-[11px]">
                {monthGrid.map((week, wi) =>
                  week.map((cell, ci) => {
                    if (!cell?.date) {
                      return (
                        <div
                          key={`${wi}-${ci}`}
                          className="h-[72px] rounded-lg border border-slate-900 bg-slate-950/40"
                        />
                      );
                    }
                    const { date, iso, meetings } = cell;
                    const companyNames = [
                      ...new Set(
                        meetings
                          .map((m) =>
                            m.jobId ? jobsById.get(m.jobId)?.name : undefined
                          )
                          .filter((name): name is string => Boolean(name))
                      ),
                    ];

                    return (
                      <div
                        key={`${wi}-${ci}-${iso}`}
                        className="flex h-[72px] flex-col rounded-lg border border-slate-800 bg-slate-950/80 p-1"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] text-slate-300">
                            {date.getDate()}
                          </span>
                          {meetings.length > 0 && (
                            <span className="text-[9px] text-sky-300">
                              {meetings.length} mtg
                            </span>
                          )}
                        </div>

                        {meetings.length > 0 && (
                          <div className="mt-0.5 space-y-0.5">
                            {meetings.slice(0, 2).map((m) => (
                              <div
                                key={m.id}
                                className="truncate text-[9px] text-slate-100"
                              >
                                {m.time ? `${formatTimeLabel(m.time)} ` : ""}·{" "}
                                {m.title}
                              </div>
                            ))}
                            {meetings.length > 2 && (
                              <div className="text-[9px] text-slate-500">
                                +{meetings.length - 2} more
                              </div>
                            )}
                            {companyNames.length > 0 && (
                              <div className="text-[9px] text-slate-500 line-clamp-1">
                                {companyNames.join(" · ")}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
