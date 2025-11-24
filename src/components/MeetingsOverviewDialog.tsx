"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getMeetingsForDate,
  loadJobsAndProjects,
  getAllMilestones,
} from "@/lib/storage";
import type { Meeting, Job, ViewMode, MonthCell, Milestone } from "@/lib/types";
import { MonthDayCell } from "./ui/MonthDayCell";
import {
  formatDayLabel,
  formatMonthLabel,
  formatTimeLabel,
  formatTimeUntil,
  fromYmdLocal,
  startOfWeek,
  toYmdLocal,
} from "@/lib/calendarHelpers";
import { MeetingCard } from "./ui/Meetingcard";

export function MeetingsOverviewDialog({
  open,
  onClose,
  anchorDateIso,
  onCancelMeeting,
  onRescheduleMeeting,
  refreshKey = 0,
}: {
  open: boolean;
  onClose: () => void;
  anchorDateIso: string;
  onCancelMeeting?: (m: Meeting) => void;
  onRescheduleMeeting?: (m: Meeting) => void;
  refreshKey?: number;
}) {
  const [mode, setMode] = useState<ViewMode>("week");
  const [viewDate, setViewDate] = useState(() => fromYmdLocal(anchorDateIso));
  const [selectedDay, setSelectedDay] = useState<{
    date: Date;
    iso: string;
    meetings: Meeting[];
    milestones: Milestone[];
  } | null>(null);

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

  // All milestones for the calendar
  const allMilestones: Milestone[] = useMemo(
    () => getAllMilestones(),
    [refreshKey]
  );

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
      const milestones = allMilestones.filter((ms) => ms.dueDateIso === iso);

      return { date: d, iso, meetings, milestones };
    });
  }, [viewDate, open, refreshKey, allMilestones]);

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
      const meetings = getMeetingsForDate(iso);
      const milestones = allMilestones.filter((ms) => ms.dueDateIso === iso);

      currentWeek[col] = {
        date: d,
        iso,
        meetings,
        milestones,
      };
    }

    if (hasCells(currentWeek)) {
      weeks.push(currentWeek);
    }

    return weeks;
  }, [viewDate, open, refreshKey, allMilestones]);

  const switchToWeek = () => {
    setMode("week");
    setViewDate((prev) => {
      // If the visible month matches the anchor month,
      // use the anchorDate's week; otherwise use the visible month's week.
      const sameMonth =
        prev.getFullYear() === anchorDate.getFullYear() &&
        prev.getMonth() === anchorDate.getMonth();

      const base = sameMonth ? anchorDate : prev;
      return startOfWeek(base);
    });
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
      <div className="flex w-[95vw] max-w-6xl h-[80vh] flex-col rounded-3xl border border-white/15 bg-slate-950/95 p-4 text-xs text-slate-100 shadow-[0_30px_90px_rgba(0,0,0,0.8)]">
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
              {weekDays.map(({ date, iso, meetings, milestones }) => (
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

                  {meetings.length === 0 && milestones.length === 0 ? (
                    <div className="mt-2 text-[11px] text-slate-500">
                      Nothing scheduled
                    </div>
                  ) : (
                    <ul className="mt-2 space-y-2 text-[11px]">
                      {meetings.map((m) => {
                        const company = m.jobId
                          ? jobsById.get(m.jobId)
                          : undefined;
                        return (
                          <li key={m.id + iso}>
                            <MeetingCard
                              meeting={m}
                              company={company}
                              onCancel={onCancelMeeting}
                              onReschedule={onRescheduleMeeting}
                            />
                          </li>
                        );
                      })}

                      {milestones.length > 0 && (
                        <li className="pt-1 border-t border-slate-800 mt-1">
                          <div className="flex flex-wrap gap-1">
                            {milestones.map((ms) => (
                              <span
                                key={ms.id}
                                className="inline-flex items-center rounded-full border border-amber-400/60 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-100"
                              >
                                {ms.title}
                              </span>
                            ))}
                          </div>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col space-y-2">
              {/* weekday header */}
              <div className="grid grid-cols-5 gap-1 text-center text-[10px] text-slate-500">
                {["Mo", "Tu", "We", "Th", "Fr"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              {/* weeks */}
              <div className="flex flex-1 flex-col gap-1">
                {monthGrid.map((week, wi) => (
                  <div
                    key={wi}
                    className="grid flex-1 min-h-20 md:min-h-24 xl:min-h-28 grid-cols-5 gap-1 text-[11px]"
                  >
                    {week.map((cell, ci) => {
                      if (!cell?.date) {
                        return (
                          <div
                            key={`${wi}-${ci}`}
                            className="h-full rounded-lg border border-slate-900 bg-slate-950/40"
                          />
                        );
                      }

                      const { date, iso, meetings, milestones } = cell;

                      return (
                        <MonthDayCell
                          key={`${wi}-${ci}-${iso}`}
                          date={date}
                          iso={iso}
                          meetings={meetings}
                          milestones={milestones}
                          jobsById={jobsById}
                          onClick={() =>
                            setSelectedDay({
                              date,
                              iso,
                              meetings,
                              milestones,
                            })
                          }
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedDay && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
          <div className="flex w-full max-w-lg flex-col rounded-3xl border border-slate-700 bg-slate-950/95 p-4 text-xs text-slate-100 shadow-[0_24px_70px_rgba(0,0,0,0.9)]">
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div>
                <div className="text-sm font-semibold text-slate-50">
                  {selectedDay.date.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <div className="text-[11px] text-slate-400">
                  {selectedDay.meetings.length} meeting
                  {selectedDay.meetings.length === 1 ? "" : "s"}
                  {selectedDay.milestones.length > 0 && (
                    <> · {selectedDay.milestones.length} milestone</>
                  )}
                  {selectedDay.milestones.length > 1 && "s"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-[11px] text-slate-100 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            {selectedDay.meetings.length === 0 &&
            selectedDay.milestones.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-slate-400">
                Nothing scheduled for this day.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDay.meetings.length > 0 && (
                  <div className="space-y-2">
                    {selectedDay.meetings.map((m) => {
                      const company = m.jobId
                        ? jobsById.get(m.jobId)
                        : undefined;
                      return (
                        <MeetingCard
                          key={m.id}
                          meeting={m}
                          company={company}
                          onCancel={onCancelMeeting}
                          onReschedule={onRescheduleMeeting}
                          className="border-slate-700"
                        />
                      );
                    })}
                  </div>
                )}

                {selectedDay.milestones.length > 0 && (
                  <div className="border-t border-slate-800 pt-2">
                    <div className="mb-1 text-[11px] font-semibold text-amber-200">
                      Milestones
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedDay.milestones.map((ms) => (
                        <span
                          key={ms.id}
                          className="inline-flex items-center rounded-full border border-amber-400/60 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-100"
                        >
                          {ms.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
