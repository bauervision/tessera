"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadJobsAndProjects,
  getMeetingsForDate,
  deleteMeeting,
  getAllMilestones,
} from "@/lib/storage";
import type { Job, Meeting, Milestone } from "@/lib/types";
import { MeetingsOverviewDialog } from "@/components/MeetingsOverviewDialog";
import {
  addDays,
  formatDayShort,
  formatTimeLabel,
  todayIso,
} from "@/lib/calendarHelpers";
import { MeetingCard } from "./ui/Meetingcard";
import { loadSavedWeeklyPlan, type SavedWeeklyPlan } from "@/lib/weeklyPlanner";
import { getCurrentWeekMondayIso } from "@/app/planner/helpers";

export default function DashboardMeetingsPanel() {
  const [anchorDateIso, setAnchorDateIso] = useState<string>(todayIso);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { jobs } = useMemo(() => loadJobsAndProjects(), [refreshKey]);
  const [savedPlan, setSavedPlan] = useState<SavedWeeklyPlan | null>(null);
  const [showRundown, setShowRundown] = useState(true);
  const [showCalendar, setShowCalendar] = useState(true);

  function formatMinutes(mins: number): string {
    const total = Math.round(mins);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  function timeToMinutes(t: string | null | undefined): number | null {
    if (!t) return null;
    const [hh, mm] = t.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return hh * 60 + mm;
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMeetingsUpdated = () => {
      setRefreshKey((k) => k + 1);
    };

    window.addEventListener("tessera:meetings-updated", handleMeetingsUpdated);
    return () => {
      window.removeEventListener(
        "tessera:meetings-updated",
        handleMeetingsUpdated
      );
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const weekStartIso = getCurrentWeekMondayIso();
    const plan = loadSavedWeeklyPlan(weekStartIso);
    setSavedPlan(plan);
  }, []);

  const jobsById = useMemo(() => {
    const map = new Map<string, Job>();
    jobs.forEach((j) => map.set(j.id, j));
    return map;
  }, [jobs]);

  const today = anchorDateIso;

  const upcomingIsos = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(today, i)),
    [today]
  );

  const meetingsByDate = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    upcomingIsos.forEach((iso) => {
      map.set(iso, getMeetingsForDate(iso));
    });
    return map;
  }, [upcomingIsos, refreshKey]);

  const todayMeetings = useMemo(
    () => getMeetingsForDate(todayIso()),
    [refreshKey]
  );

  const totalUpcoming = Array.from(meetingsByDate.values()).reduce(
    (sum, list) => sum + list.length,
    0
  );

  const milestones: Milestone[] = useMemo(
    () => getAllMilestones(),
    [refreshKey]
  );

  const milestonesToday = useMemo(
    () => milestones.filter((ms) => ms.dueDateIso === today),
    [milestones, today]
  );

  const todayPlan = useMemo(() => {
    if (!savedPlan) return null;

    const days = savedPlan.days;
    const activeDays = days.filter((d) => d.active);
    if (!activeDays.length) return null;

    const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dateObj = new Date(today);
    const dayIdx = dateObj.getDay();
    const label = weekdayLabels[dayIdx];

    const dayConfig = days.find((d) => d.label === label);
    if (!dayConfig) return null;

    if (!dayConfig.active) {
      return {
        status: "off" as const,
        label,
      };
    }

    const totalPlannedHours = savedPlan.priorities
      .filter((p) => p.enabled && p.weeklyHours > 0)
      .reduce((sum, p) => sum + p.weeklyHours, 0);

    const perDay =
      activeDays.length > 0 ? totalPlannedHours / activeDays.length : 0;

    return {
      status: "work" as const,
      label,
      plannedHours: perDay,
      windowStart: dayConfig.startMinutes,
      windowEnd: dayConfig.endMinutes,
    };
  }, [savedPlan, today]);

  type TodayBlock = {
    id: string;
    kind: "work" | "lunch" | "meeting" | "free";
    label: string;
    startMinutes: number;
    endMinutes: number;
  };

  const todayBlocks: TodayBlock[] = useMemo(() => {
    if (!savedPlan || !todayPlan || todayPlan.status !== "work") return [];

    const dayStart = todayPlan.windowStart;
    const dayEnd = todayPlan.windowEnd;
    if (dayEnd <= dayStart) return [];

    const plannedMinutes = todayPlan.plannedHours * 60;

    const LUNCH_START = 12 * 60;
    const LUNCH_END = LUNCH_START + 30;

    type Reserved = {
      id: string;
      kind: "lunch" | "meeting";
      label: string;
      start: number;
      end: number;
    };

    const reserved: Reserved[] = [];

    // Lunch if it fits in the window
    const lunchFits =
      dayStart <= LUNCH_START &&
      LUNCH_END <= dayEnd &&
      LUNCH_END - LUNCH_START <= dayEnd - dayStart;

    if (lunchFits) {
      reserved.push({
        id: "lunch-today",
        kind: "lunch",
        label: "Lunch break",
        start: LUNCH_START,
        end: LUNCH_END,
      });
    }

    // Meetings as 1h blocks based on their time field
    todayMeetings.forEach((m, idx) => {
      const startMinutes = timeToMinutes(m.time);
      if (startMinutes == null) return;

      let start = startMinutes;
      let end = start + 60;

      if (end <= dayStart || start >= dayEnd) return;
      start = Math.max(start, dayStart);
      end = Math.min(end, dayEnd);
      if (end <= start) return;

      reserved.push({
        id: `mtg-${m.id ?? idx}`,
        kind: "meeting",
        label: m.title,
        start,
        end,
      });
    });

    reserved.sort((a, b) => a.start - b.start);

    // Build free segments between reserved blocks
    const segments: { start: number; end: number }[] = [];
    if (reserved.length === 0) {
      segments.push({ start: dayStart, end: dayEnd });
    } else {
      let cursor = dayStart;
      for (const r of reserved) {
        if (r.start > cursor) {
          segments.push({ start: cursor, end: r.start });
        }
        cursor = Math.max(cursor, r.end);
      }
      if (cursor < dayEnd) {
        segments.push({ start: cursor, end: dayEnd });
      }
    }

    const workBlocks: TodayBlock[] = [];
    let remaining = plannedMinutes;
    let blockCount = 0;

    for (const seg of segments) {
      if (remaining <= 1) break;
      const space = seg.end - seg.start;
      if (space <= 0) continue;

      const slice = Math.min(space, remaining);
      if (slice <= 1) continue;

      workBlocks.push({
        id: `work-${blockCount++}`,
        kind: "work",
        label: "Deep work",
        startMinutes: seg.start,
        endMinutes: seg.start + slice,
      });

      remaining -= slice;
    }

    // Combine reserved + work, then fill free gaps
    const baseBlocks: TodayBlock[] = [
      ...reserved.map((r) => ({
        id: r.id,
        kind: r.kind,
        label: r.label,
        startMinutes: r.start,
        endMinutes: r.end,
      })),
      ...workBlocks,
    ];

    baseBlocks.sort((a, b) => a.startMinutes - b.startMinutes);

    const fullTimeline: TodayBlock[] = [];
    let cursor = dayStart;

    for (const b of baseBlocks) {
      if (b.startMinutes > cursor) {
        fullTimeline.push({
          id: `free-before-${b.id}`,
          kind: "free",
          label: "Free / personal",
          startMinutes: cursor,
          endMinutes: b.startMinutes,
        });
      }
      fullTimeline.push(b);
      cursor = Math.max(cursor, b.endMinutes);
    }

    if (cursor < dayEnd) {
      fullTimeline.push({
        id: "free-end",
        kind: "free",
        label: "Free / personal",
        startMinutes: cursor,
        endMinutes: dayEnd,
      });
    }

    return fullTimeline;
  }, [savedPlan, todayPlan, todayMeetings, timeToMinutes]);

  function handleCancelMeeting(m: Meeting) {
    deleteMeeting(m.id);
    setRefreshKey((k) => k + 1);
  }

  function handleRescheduleMeeting(m: Meeting) {
    // Stub for future reschedule implementation
    console.log("Reschedule meeting", m.id);
  }

  return (
    <>
      <section className="flex flex-col rounded-3xl border border-white/10 bg-slate-950/80 p-4 text-xs text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
        {/* Daily rundown (accordion) */}
        <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/90">
          <button
            type="button"
            onClick={() => setShowRundown((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-left"
          >
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Daily rundown
              </div>
              <div className="text-[13px] font-medium text-slate-50">
                {formatDayShort(today)}
              </div>
            </div>
            <div className="text-[11px] text-slate-400">
              {showRundown ? "▾" : "▸"}
            </div>
          </button>

          {showRundown && (
            <div className="border-t border-slate-800 px-3 pb-3 pt-2 text-[11px]">
              {!savedPlan && (
                <p className="text-slate-400">
                  No weekly plan saved yet. Use the{" "}
                  <span className="font-medium text-sky-300">
                    Weekly planner
                  </span>{" "}
                  to generate your schedule for the week.
                </p>
              )}

              {savedPlan && todayPlan && todayPlan.status === "off" && (
                <p className="text-slate-400">
                  Today is configured as a{" "}
                  <span className="font-medium text-emerald-300">
                    non-work day
                  </span>{" "}
                  in your weekly planner.
                </p>
              )}

              {savedPlan && todayPlan && todayPlan.status === "work" && (
                <>
                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1.5">
                      <div className="text-[10px] text-slate-400">
                        Planned work
                      </div>
                      <div className="text-[13px] font-semibold text-emerald-300">
                        {todayPlan.plannedHours.toFixed(1)}h
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {formatMinutes(todayPlan.windowStart)} –{" "}
                        {formatMinutes(todayPlan.windowEnd)}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1.5">
                      <div className="text-[10px] text-slate-400">Today</div>
                      <div className="text-[13px] font-semibold text-sky-300">
                        {todayMeetings.length} meeting
                        {todayMeetings.length === 1 ? "" : "s"}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {milestonesToday.length} milestone
                        {milestonesToday.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>

                  {/* Time-sliced Today strip */}
                  {todayBlocks.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {todayBlocks.map((b) => {
                        const tone =
                          b.kind === "work"
                            ? "bg-sky-500/10 text-sky-100 border border-sky-400/40"
                            : b.kind === "meeting"
                            ? "bg-violet-500/15 text-violet-100 border border-violet-400/60"
                            : b.kind === "lunch"
                            ? "bg-amber-500/10 text-amber-100 border border-amber-400/60"
                            : "bg-emerald-500/5 text-emerald-100 border border-emerald-400/40";

                        return (
                          <li
                            key={b.id}
                            className={`flex items-center justify-between rounded-lg px-2 py-1 text-[11px] ${tone}`}
                          >
                            <div>
                              <div className="text-[13px] font-medium">
                                {b.label}
                              </div>
                              <div className="text-[10px] text-slate-300/60">
                                {formatMinutes(b.startMinutes)} –{" "}
                                {formatMinutes(b.endMinutes)}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Header row */}
        {/* Calendar (accordion) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setShowCalendar((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShowCalendar((v) => !v);
              }
            }}
            className="flex w-full items-center justify-between px-3 py-2 text-left cursor-pointer"
          >
            <div>
              <h2 className="text-sm font-semibold text-slate-50">Calendar</h2>
              <p className="text-[11px] text-slate-400">
                Pick a day and see your meetings. Use the overview to scan
                across weeks and months.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">
                {showCalendar ? "▾" : "▸"}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAnchorDateIso(todayIso());
                  setOverviewOpen(true);
                }}
                className="rounded-full border border-sky-500/60 bg-sky-500/10 px-3 py-1 text-[11px] text-sky-200 hover:bg-sky-500/20"
              >
                View calendar
              </button>
            </div>
          </div>

          {showCalendar && (
            <div className="border-t border-slate-800 p-3">
              {/* Today summary */}
              <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Today
                    </div>
                    <div className="text-[13px] font-medium text-slate-50">
                      {formatDayShort(today)}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    {todayMeetings.length === 0
                      ? "No meetings today"
                      : `${todayMeetings.length} meeting${
                          todayMeetings.length === 1 ? "" : "s"
                        }`}
                  </div>
                </div>

                {todayMeetings.map((m) => {
                  const company = m.jobId ? jobsById.get(m.jobId) : undefined;
                  return (
                    <li key={m.id}>
                      <MeetingCard
                        meeting={m}
                        company={company}
                        onCancel={handleCancelMeeting}
                        onReschedule={handleRescheduleMeeting}
                      />
                    </li>
                  );
                })}
              </div>

              {/* Upcoming list */}
              <div className="mt-1 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Next 7 days
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {totalUpcoming} total meeting
                    {totalUpcoming === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-[11px]">
                  {upcomingIsos.map((iso) => {
                    const meetingsForDay = meetingsByDate.get(iso) ?? [];
                    const milestonesForDay = milestones.filter(
                      (ms) => ms.dueDateIso === iso
                    );

                    if (
                      meetingsForDay.length === 0 &&
                      milestonesForDay.length === 0
                    ) {
                      return null;
                    }

                    const [y, m, d] = iso.split("-").map(Number);
                    const dateObj = new Date(y, (m || 1) - 1, d || 1);
                    const label = dateObj.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });

                    return (
                      <div
                        key={iso}
                        className="rounded-xl border border-slate-800 bg-slate-950/90 p-2"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <div className="text-[11px] font-medium text-slate-100">
                            {label}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setAnchorDateIso(iso);
                              setOverviewOpen(true);
                            }}
                            className="text-[10px] text-sky-300 hover:text-sky-200"
                          >
                            View day
                          </button>
                        </div>

                        <ul className="space-y-1">
                          {meetingsForDay.slice(0, 3).map((m) => {
                            const company = m.jobId
                              ? jobsById.get(m.jobId)
                              : undefined;
                            return (
                              <li
                                key={m.id}
                                className="flex items-baseline justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-[16px] text-slate-100">
                                    {m.title}
                                  </div>
                                  {company && (
                                    <div className="text-[10px] text-slate-500">
                                      {company.name}
                                    </div>
                                  )}
                                </div>
                                {m.time && (
                                  <div className="shrink-0 font-mono text-[10px] text-sky-300">
                                    {formatTimeLabel(m.time)}
                                  </div>
                                )}
                              </li>
                            );
                          })}

                          {meetingsForDay.length > 3 && (
                            <li className="text-[10px] text-slate-500">
                              +{meetingsForDay.length - 3} more
                            </li>
                          )}

                          {milestonesForDay.length > 0 && (
                            <li className="pt-1">
                              <div className="flex flex-wrap gap-1">
                                {milestonesForDay.map((ms) => (
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
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Overview dialog (week/month calendar) */}
      <MeetingsOverviewDialog
        open={overviewOpen}
        onClose={() => setOverviewOpen(false)}
        anchorDateIso={anchorDateIso}
        onCancelMeeting={handleCancelMeeting}
        onRescheduleMeeting={handleRescheduleMeeting}
        refreshKey={refreshKey}
      />
    </>
  );
}
