// components/DashboardMeetingPanel.tsx
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
import DailyRundown from "./DailyRunDown";
import { timeToMinutes } from "@/lib/dailyRunDownHelpers";

export default function DashboardMeetingsPanel() {
  const [anchorDateIso, setAnchorDateIso] = useState<string>(todayIso());
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDaily, setShowDaily] = useState(true);
  // Accordion state
  const [showCalendar, setShowCalendar] = useState(true);
  const [showNext7, setShowNext7] = useState(false);

  const { jobs } = useMemo(() => loadJobsAndProjects(), [refreshKey]);

  const jobsById = useMemo(() => {
    const map = new Map<string, Job>();
    jobs.forEach((j) => map.set(j.id, j));
    return map;
  }, [jobs]);

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

  const now = new Date();

  const upcomingMeetings = todayMeetings.filter((m) => {
    const end = getMeetingEndDate(m, todayIso());
    return end !== null && end.getTime() > now.getTime();
  });

  const totalUpcoming = Array.from(meetingsByDate.values()).reduce(
    (sum, list) => sum + list.length,
    0
  );

  const milestones: Milestone[] = useMemo(
    () => getAllMilestones(),
    [refreshKey]
  );

  function handleCancelMeeting(m: Meeting) {
    deleteMeeting(m.id);
    setRefreshKey((k) => k + 1);
  }

  function handleRescheduleMeeting(m: Meeting) {
    console.log("Reschedule meeting", m.id);
  }

  function getMeetingEndDate(m: Meeting, dateIso: string): Date | null {
    const startMinutes = timeToMinutes(m.time);
    if (startMinutes == null) return null;
    const endMinutes = startMinutes + 30;

    const [y, mo, d] = dateIso.split("-").map(Number);
    const base = new Date(y, (mo || 1) - 1, d || 1);
    base.setHours(0, 0, 0, 0);
    const hours = Math.floor(endMinutes / 60);
    const mins = endMinutes % 60;
    base.setHours(hours, mins, 0, 0);
    return base;
  }

  const toggleDaily = () => {
    setShowDaily((prev) => {
      const next = !prev;
      // If we’re about to close DRD and calendar is already closed,
      // force calendar open so we never have both closed.
      if (!next && !showCalendar) {
        setShowCalendar(true);
      }
      return next;
    });
  };

  const toggleCalendar = () => {
    setShowCalendar((prev) => {
      const next = !prev;
      // If we’re about to close calendar and DRD is already closed,
      // force DRD open.
      if (!next && !showDaily) {
        setShowDaily(true);
      }
      return next;
    });
  };

  return (
    <>
      {/* Whole left stack: fixed height, DRD + Calendar share it */}
      <section className="flex h-[1400px] flex-col rounded-3xl border border-white/10 bg-slate-950/80 p-4 text-xs text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* DRD region – always here, takes 50% when calendar open, 100% when closed */}
          <div
            className={`transition-all duration-300 ${
              showDaily ? "flex-1 min-h-0" : "flex-none"
            }`}
          >
            {/* This box is what actually owns the height and scrolls */}
            <div className="h-full min-h-0 overflow-y-auto">
              <DailyRundown show={showDaily} onToggle={toggleDaily} />
            </div>
          </div>

          {/* Calendar region – header always visible; body is accordion */}
          <div
            className={`flex flex-col rounded-2xl border border-slate-800 bg-slate-950/80 transition-all duration-300 ${
              showCalendar ? "flex-1 min-h-0" : "flex-none"
            }`}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={toggleCalendar}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleCalendar();
                }
              }}
              className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left"
            >
              <div>
                <h2 className="text-sm font-semibold text-slate-50">
                  Calendar
                </h2>
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

            {/* Body – only mounted when open; scrolls inside its half of the panel */}
            {showCalendar && (
              <div className="flex-1 min-h-0 border-t border-slate-800 p-3">
                <div className="flex h-full flex-col gap-3">
                  {/* Today summary */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
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

                    <ul className="mt-2 space-y-1.5">
                      {upcomingMeetings.map((m) => {
                        const company = m.jobId
                          ? jobsById.get(m.jobId)
                          : undefined;
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
                    </ul>
                  </div>

                  {/* Next 7 days – scrollable block */}
                  <div className="flex-1 min-h-0 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                    <button
                      type="button"
                      onClick={() => setShowNext7((v) => !v)}
                      className="mb-2 flex w-full items-center justify-between text-left"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Next 7 days
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">
                          {totalUpcoming} total meeting
                          {totalUpcoming === 1 ? "" : "s"}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {showNext7 ? "▾" : "▸"}
                        </span>
                      </div>
                    </button>

                    {showNext7 && (
                      <div className="h-full min-h-0 overflow-y-auto pr-1 text-[11px]">
                        <div className="flex flex-col gap-2">
                          {upcomingIsos.map((iso) => {
                            const meetingsForDay =
                              meetingsByDate.get(iso) ?? [];
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
                            const label = dateObj.toLocaleDateString(
                              undefined,
                              {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              }
                            );

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
                                          <div className="truncate text-[11px] text-slate-100">
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
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
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
