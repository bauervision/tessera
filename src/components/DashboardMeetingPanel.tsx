"use client";

import { useMemo, useState } from "react";
import {
  loadJobsAndProjects,
  getMeetingsForDate,
  deleteMeeting,
} from "@/lib/storage";
import type { Job, Meeting } from "@/lib/types";
import { MeetingsOverviewDialog } from "@/components/MeetingsOverviewDialog";
import {
  addDays,
  formatDayShort,
  formatTimeLabel,
  todayIso,
} from "@/lib/calendarHelpers";
import { MeetingCard } from "./ui/Meetingcard";

export default function DashboardMeetingsPanel() {
  const [anchorDateIso, setAnchorDateIso] = useState<string>(todayIso);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { jobs } = useMemo(() => loadJobsAndProjects(), [refreshKey]);

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
    [todayIso, refreshKey]
  );
  const totalUpcoming = Array.from(meetingsByDate.values()).reduce(
    (sum, list) => sum + list.length,
    0
  );

  function handleCancelMeeting(m: Meeting) {
    deleteMeeting(m.id);
    setRefreshKey((k) => k + 1);
  }

  function handleRescheduleMeeting(m: Meeting) {
    // You haven't implemented reschedule yet, so keep this as a stub for now
    console.log("Reschedule meeting", m.id);
    // Later: open a reschedule dialog or call an update helper,
    // then bump refreshKey
    // setRefreshKey((k) => k + 1);
  }

  return (
    <>
      <section className="flex flex-col rounded-3xl border border-white/10 bg-slate-950/80 p-4 text-xs text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
        {/* Header row */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">Calendar</h2>
            <p className="text-[11px] text-slate-400">
              Pick a day and see your meetings. Use the overview to scan across
              weeks and months.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setAnchorDateIso(todayIso());
                setOverviewOpen(true);
              }}
              className="rounded-full border border-sky-500/60 bg-sky-500/10 px-3 py-1 text-[11px] text-sky-200 hover:bg-sky-500/20"
            >
              View calendar
            </button>
          </div>
        </div>

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
              {totalUpcoming} total meeting{totalUpcoming === 1 ? "" : "s"}
            </div>
          </div>

          <div className="flex flex-col gap-2 text-[11px]">
            {upcomingIsos.map((iso) => {
              const list = meetingsByDate.get(iso) ?? [];
              if (list.length === 0) {
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
                    {list.slice(0, 3).map((m) => {
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
                    {list.length > 3 && (
                      <li className="text-[10px] text-slate-500">
                        +{list.length - 3} more
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
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
