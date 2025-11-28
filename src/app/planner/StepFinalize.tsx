// app/planner/StepFinalize.tsx
"use client";

import {
  saveWeeklyPlan,
  type SavedWeeklyPlan,
  type WeeklyPlannerTask,
} from "@/lib/weeklyPlanner";
import type {
  DayConfig,
  DaySchedule,
  DayScheduleBlock,
  PlannerPriorityRow,
  StepFinalizeProps,
} from "./types";
import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

const formatMinutes = (mins: number) => {
  // Round to the nearest whole minute to avoid float artifacts
  const total = Math.round(mins); // e.g. 629.7599 → 630

  const h = Math.floor(total / 60);
  const m = total % 60;

  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");

  return `${hh}:${mm}`;
};

// Basic schedule model for this step

const LUNCH_START = 12 * 60; // 12:00
const LUNCH_END = LUNCH_START + 30; // 12:30

export default function StepFinalize({
  tasks,
  days,
  totalAvailableHours,
  priorities,
  projectDoneFromDayIndex,
  onProjectDoneFromDayIndexChange,
  onSavePlan,
  weekStartIso,
  onViewModeChange,
  hasSavedPlan,
  viewMode,
}: StepFinalizeProps) {
  const [cancelledMeetingIds, setCancelledMeetingIds] = useState<string[]>([]);
  const byId = new Map(tasks.map((t) => [t.projectId, t]));

  const effective = priorities
    .map((row) => {
      const base = byId.get(row.projectId);
      if (!base) return null;
      return {
        projectId: row.projectId,
        projectName: base.projectName,
        companyName: base.companyName,
        included: row.enabled,
        weeklyHours: row.weeklyHours,
      };
    })
    .filter(Boolean) as {
    projectId: string;
    projectName: string;
    companyName?: string;
    included: boolean;
    weeklyHours: number;
  }[];

  const includedProjects = effective.filter((p) => p.included);
  const totalPlannedHours = includedProjects.reduce(
    (sum, p) => sum + p.weeklyHours,
    0
  );
  const delta = totalAvailableHours - totalPlannedHours;
  const overCapacity = delta < 0;

  const activeDays = days.filter((d) => d.active);
  const totalActiveHours = activeDays.reduce((sum, d) => {
    const minutes = Math.max(0, d.endMinutes - d.startMinutes);
    return sum + minutes / 60;
  }, 0);
  const avgPerDay = activeDays.length
    ? totalPlannedHours / activeDays.length
    : 0;

  const meetingsByDate = useMemo(() => {
    const map = new Map<
      string,
      { id: string; title: string; minutes: number; projectId?: string }[]
    >();

    const cancelled = new Set(cancelledMeetingIds); // ← add this

    tasks.forEach((t) => {
      if (!t.meetings) return;

      t.meetings.forEach((m) => {
        if (!m.id || cancelled.has(m.id)) return; // ← skip cancelled meetings

        const key = m.dateIso;
        if (!key) return;

        const list = map.get(key) ?? [];

        // ✅ De-dupe by meeting id for this date
        if (list.some((existing) => existing.id === m.id)) {
          return;
        }

        list.push({
          id: m.id,
          title: m.title,
          minutes: m.hours * 60,
          projectId: t.projectId,
        });

        map.set(key, list);
      });
    });

    return map;
  }, [tasks, cancelledMeetingIds]);

  // ============= LUNCH =============== //
  // Build a naive per-day schedule from active days + planned project hours
  const daySchedules: DaySchedule[] = useMemo(() => {
    if (!activeDays.length || !effective.length) return [];

    const includedProjects = effective.filter(
      (p) => p.included && p.weeklyHours > 0
    );
    if (!includedProjects.length) return [];

    const daysCount = activeDays.length;

    // Simple: distribute each project's weekly hours evenly across active days
    const perDayMinutes = includedProjects.map((p) => ({
      projectId: p.projectId,
      projectName: p.projectName,
      minutesPerDay: (p.weeklyHours / daysCount) * 60,
    }));

    const totalMinutesByProject = new Map<string, number>();
    const cumulativeMinutesByProject = new Map<string, number>();

    includedProjects.forEach((p) => {
      totalMinutesByProject.set(p.projectId, p.weeklyHours * 60);
      cumulativeMinutesByProject.set(p.projectId, 0);
    });

    // Map labels to offsets relative to Monday's ISO date
    const weekdayOffsets: Record<string, number> = {
      Sun: -1,
      Mon: 0,
      Tue: 1,
      Wed: 2,
      Thu: 3,
      Fri: 4,
      Sat: 5,
    };

    function addDaysToIso(iso: string, days: number): string {
      const [y, m, d] = iso.split("-").map(Number);
      const dt = new Date(y, (m || 1) - 1, d || 1);
      dt.setDate(dt.getDate() + days);
      return dt.toISOString().slice(0, 10);
    }

    return activeDays.map((day) => {
      const blocks: DayScheduleBlock[] = [];
      const dayStart = day.startMinutes;
      const dayEnd = day.endMinutes;

      if (dayEnd <= dayStart) {
        return {
          dayId: String(day.id),
          label: day.label,
          blocks,
          dayEndMinutes: dayEnd,
        };
      }

      // Figure out ISO date for this day (relative to Monday weekStartIso)
      const offset = weekdayOffsets[day.label] ?? 0;
      const dayIso =
        offset === 0 ? weekStartIso : addDaysToIso(weekStartIso, offset);

      const dayMeetings = meetingsByDate.get(dayIso) ?? [];

      type Reserved = {
        id: string;
        kind: "lunch" | "meeting";
        label: string;
        start: number;
        end: number;
        projectId?: string;
        meetingId?: string;
      };

      const reserved: Reserved[] = [];

      // Lunch block if it fits entirely inside the day window
      const lunchFits =
        dayStart <= LUNCH_START &&
        LUNCH_END <= dayEnd &&
        LUNCH_END - LUNCH_START <= dayEnd - dayStart;

      if (lunchFits) {
        reserved.push({
          id: `lunch-${day.id}`,
          kind: "lunch",
          label: "Lunch break",
          start: LUNCH_START,
          end: LUNCH_END,
        });
      }

      // Place meetings sequentially after lunch (or at day start if no lunch)
      let meetingCursor = Math.max(dayStart, lunchFits ? LUNCH_END : dayStart);

      dayMeetings.forEach((m, idx) => {
        const duration = m.minutes;
        if (duration <= 0) return;
        if (meetingCursor >= dayEnd) return;

        const start = meetingCursor;
        const end = Math.min(dayEnd, start + duration);

        reserved.push({
          id: `${day.id}-mtg-${m.id ?? idx}`,
          kind: "meeting",
          label: m.title,
          start,
          end,
          projectId: m.projectId,
          meetingId: m.id,
        });

        meetingCursor = end;
      });

      // Sort reserved by time
      reserved.sort((a, b) => a.start - b.start);

      // Build free segments as gaps between reserved blocks
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

      // Seed blocks with reserved items (lunch + meetings)
      reserved.forEach((r) => {
        blocks.push({
          id: r.id,
          kind: r.kind,
          label: r.label,
          projectId: r.projectId,
          meetingId: r.meetingId,
          startMinutes: r.start,
          endMinutes: r.end,
        });
      });

      // Sequential scheduling: walk forward through segments and fill them with work
      let segmentIndex = 0;
      let cursor = segments.length > 0 ? segments[0].start : dayStart;

      perDayMinutes.forEach((proj) => {
        let remaining = proj.minutesPerDay;

        while (remaining > 1) {
          const seg = segments[segmentIndex];

          // No more configured time → overflow past the end of the day
          if (!seg) {
            const overflowStart = cursor;
            const slice = remaining;

            const prev = cumulativeMinutesByProject.get(proj.projectId) ?? 0;
            const next = prev + slice;
            cumulativeMinutesByProject.set(proj.projectId, next);

            blocks.push({
              id: `${day.id}-${proj.projectId}-${blocks.length}`,
              kind: "work",
              label: proj.projectName,
              projectId: proj.projectId,
              startMinutes: overflowStart,
              endMinutes: overflowStart + slice,
              cumulativeMinutesAfter: next,
              totalMinutesPlanned: totalMinutesByProject.get(proj.projectId),
            });

            cursor += slice;
            break;
          }

          // Ensure cursor is at least at the start of the current segment
          if (cursor < seg.start) {
            cursor = seg.start;
          }

          // If we've exhausted this segment, move to the next
          if (cursor >= seg.end) {
            segmentIndex++;
            continue;
          }

          const space = seg.end - cursor;
          if (space <= 0) {
            segmentIndex++;
            continue;
          }

          const slice = Math.min(space, remaining);
          if (slice <= 1) break;

          const prev = cumulativeMinutesByProject.get(proj.projectId) ?? 0;
          const next = prev + slice;
          cumulativeMinutesByProject.set(proj.projectId, next);

          blocks.push({
            id: `${day.id}-${proj.projectId}-${blocks.length}`,
            kind: "work",
            label: proj.projectName,
            projectId: proj.projectId,
            startMinutes: cursor,
            endMinutes: cursor + slice,
            cumulativeMinutesAfter: next,
            totalMinutesPlanned: totalMinutesByProject.get(proj.projectId),
          });

          cursor += slice;
          remaining -= slice;

          if (cursor >= seg.end) {
            segmentIndex++;
          }
        }
      });

      // sort by time so lunch, meetings & work appear in order
      blocks.sort((a, b) => a.startMinutes - b.startMinutes);

      return {
        dayId: String(day.id),
        label: day.label,
        blocks,
        dayEndMinutes: dayEnd,
      };
    });
  }, [activeDays, effective, meetingsByDate, weekStartIso]);

  return (
    <section className="space-y-4">
      {/* Daily schedule preview */}
      {daySchedules.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-200">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">
              Proposed daily schedule
            </h3>

            {hasSavedPlan && viewMode && onViewModeChange && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex rounded-full border border-slate-700 bg-slate-900/70 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => onViewModeChange("schedule")}
                    className={[
                      "rounded-full px-3 py-1.5 font-medium transition",
                      viewMode === "schedule"
                        ? "bg-emerald-500 text-slate-950"
                        : "text-slate-300 hover:bg-slate-800",
                    ].join(" ")}
                  >
                    Weekly schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewModeChange("wizard")}
                    className={[
                      "rounded-full px-3 py-1.5 font-medium transition",
                      viewMode === "wizard"
                        ? "bg-sky-500 text-slate-950"
                        : "text-slate-300 hover:bg-slate-800",
                    ].join(" ")}
                  >
                    Plan builder
                  </button>
                </div>
              </div>
            )}

            {onSavePlan && (
              <button
                type="button"
                onClick={onSavePlan}
                className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950 shadow-sm hover:bg-emerald-400"
              >
                Save weekly schedule
              </button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {daySchedules.map((day, dayIndex) => {
              // Find matching day meta so we know the configured end time
              const dayMeta = activeDays.find(
                (d) => String(d.id) === day.dayId
              );
              const dayEnd = dayMeta?.endMinutes ?? day.dayEndMinutes;

              // Figure out how much time becomes "free" for this day,
              // and what's the last non-free block end time.
              let freedMinutes = 0;
              let lastNonFreeEnd = 0;

              day.blocks.forEach((b) => {
                const projectId = b.projectId;
                const doneFromIndex =
                  projectId != null
                    ? projectDoneFromDayIndex[projectId]
                    : undefined;

                const isFreeBlock =
                  b.kind === "work" &&
                  projectId != null &&
                  doneFromIndex !== undefined &&
                  dayIndex >= doneFromIndex;

                if (isFreeBlock) {
                  freedMinutes += b.endMinutes - b.startMinutes;
                } else {
                  lastNonFreeEnd = Math.max(lastNonFreeEnd, b.endMinutes);
                }
              });

              const freeStart =
                freedMinutes > 0
                  ? Math.max(lastNonFreeEnd, dayEnd - freedMinutes)
                  : null;
              const freeEnd = freedMinutes > 0 ? dayEnd : null;

              const workMinutes = day.blocks.reduce((sum, b) => {
                if (b.kind !== "work") return sum;
                const projectId = b.projectId;
                const doneFromIndex =
                  projectId != null
                    ? projectDoneFromDayIndex[projectId]
                    : undefined;

                const isFreeBlock =
                  b.kind === "work" &&
                  projectId != null &&
                  doneFromIndex !== undefined &&
                  dayIndex >= doneFromIndex;

                if (isFreeBlock) return sum; // don't count freed time as "work"
                return sum + (b.endMinutes - b.startMinutes);
              }, 0);
              return (
                <div
                  key={day.dayId}
                  className="rounded-xl border border-slate-800 bg-slate-950/80 p-2"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[16px] font-semibold text-slate-100">
                      {day.label}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {(workMinutes / 60).toFixed(1)}h work
                    </span>
                  </div>

                  <ul className="space-y-1.5 text-[11px]">
                    {day.blocks.map((b) => {
                      const projectId = b.projectId;
                      const doneFromIndex =
                        projectId != null
                          ? projectDoneFromDayIndex[projectId]
                          : undefined;

                      const isFreedBlock =
                        b.kind === "work" &&
                        projectId != null &&
                        doneFromIndex !== undefined &&
                        dayIndex >= doneFromIndex;

                      // Don't render individual freed blocks; they'll be collapsed into
                      // one "Free time" block at the end of the list.
                      if (isFreedBlock) {
                        return null;
                      }

                      const isOverflow =
                        b.kind === "work" && b.endMinutes > day.dayEndMinutes;

                      const tone = isOverflow
                        ? "bg-rose-500/15 text-rose-100 border border-rose-400/60"
                        : b.kind === "work"
                        ? "bg-sky-500/10 text-sky-100"
                        : b.kind === "meeting"
                        ? "bg-violet-500/15 text-violet-100 border border-violet-400/60"
                        : "bg-amber-500/10 text-amber-100"; // lunch

                      const durationHours =
                        (b.endMinutes - b.startMinutes) / 60;

                      const workedHours =
                        b.kind === "work" && b.cumulativeMinutesAfter != null
                          ? b.cumulativeMinutesAfter / 60
                          : null;
                      const totalHours =
                        b.kind === "work" && b.totalMinutesPlanned != null
                          ? b.totalMinutesPlanned / 60
                          : null;

                      const labelText =
                        b.kind === "lunch" ? "Lunch break" : b.label;

                      return (
                        <li
                          key={b.id}
                          onClick={() => {
                            // Click behavior for work blocks: mark project "done from this day"
                            if (b.kind === "work") {
                              const pid = b.projectId;
                              if (!pid) return;

                              onProjectDoneFromDayIndexChange((prev) => {
                                const existing = prev[pid];

                                if (
                                  existing !== undefined &&
                                  existing === dayIndex
                                ) {
                                  const copy: Record<string, number> = {
                                    ...prev,
                                  };
                                  delete copy[pid];
                                  return copy;
                                }

                                return {
                                  ...prev,
                                  [pid]: dayIndex,
                                };
                              });

                              return;
                            }

                            // Click behavior for meeting blocks: cancel from schedule
                            if (b.kind === "meeting") {
                              const meetingId = b.meetingId;
                              if (!meetingId) return; // narrow to string

                              setCancelledMeetingIds((prev) =>
                                prev.includes(meetingId)
                                  ? prev
                                  : [...prev, meetingId]
                              );
                            }
                          }}
                          className={[
                            "flex items-center justify-between rounded-lg px-2 py-1 cursor-pointer",
                            tone,
                          ].join(" ")}
                        >
                          <div>
                            <div className="text-[15px]">{labelText}</div>
                            <div className="text-[13px] text-slate-300/50">
                              {formatMinutes(b.startMinutes)} –{" "}
                              {formatMinutes(b.endMinutes)}
                            </div>
                          </div>

                          {/* Right side tally: only for active work blocks */}
                          {b.kind === "work" &&
                            workedHours != null &&
                            totalHours != null && (
                              <div className="ml-3 text-[13px] font-semibold text-slate-50">
                                {workedHours.toFixed(1)} /{" "}
                                {totalHours.toFixed(1)} hrs
                              </div>
                            )}

                          {b.kind === "meeting" && (
                            <div className="ml-3 flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20">
                              <CalendarDays className="h-3.5 w-3.5 text-violet-100" />
                            </div>
                          )}
                        </li>
                      );
                    })}

                    {/* Collapsed free-time block at end-of-day */}
                    {freeStart != null && freeEnd != null && (
                      <li
                        className="flex items-center justify-between rounded-lg px-2 py-1
                 bg-emerald-500/5 text-emerald-200 border border-emerald-400/40"
                      >
                        <div>
                          <div className="text-[15px]">
                            Free time (personal)
                          </div>
                          <div className="text-[13px] text-slate-300/50">
                            {formatMinutes(freeStart)} –{" "}
                            {formatMinutes(freeEnd)}
                          </div>
                        </div>
                        <div className="ml-3 text-[13px] font-semibold text-emerald-100">
                          {(freedMinutes / 60).toFixed(1)}h
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

      {/* Capacity summary */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-xs text-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] text-slate-400">
              Total available hours (from your weekly config)
            </div>
            <div className="text-lg font-semibold">
              {totalAvailableHours.toFixed(1)}h
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Across {activeDays.length} active day
              {activeDays.length === 1 ? "" : "s"} (
              {totalActiveHours.toFixed(1)}h of configured work time)
            </div>
          </div>

          <div className="sm:text-right">
            <div className="text-[11px] text-slate-400">
              Planned project hours (from priorities)
            </div>
            <div className="text-lg font-semibold">
              {totalPlannedHours.toFixed(1)}h
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Average {avgPerDay.toFixed(1)}h per active day
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/80 px-3 py-2 text-[11px]">
          {overCapacity ? (
            <p className="text-rose-300">
              You are{" "}
              <span className="font-semibold">
                {Math.abs(delta).toFixed(1)}h
              </span>{" "}
              <span>over capacity this week.</span>{" "}
              <span className="text-rose-200">
                Either reduce project hours, skip a project, or expand your day
                windows.
              </span>
            </p>
          ) : (
            <p className="text-emerald-300">
              You are within capacity, with{" "}
              <span className="font-semibold">{delta.toFixed(1)}h</span> of
              slack time available.
            </p>
          )}
        </div>
      </div>

      {/* Project breakdown */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-200">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">
            Projects in this week
          </h3>
          <span className="text-[13px] text-slate-400">
            {includedProjects.length} included / {effective.length} total
          </span>
        </div>

        {effective.length === 0 ? (
          <p className="text-[11px] text-slate-400">
            No projects configured. Go back to Focus & Priority to set up your
            week.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-1 text-left text-[20px]">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-1">Project</th>
                  <th className="px-2 py-1 hidden sm:table-cell">Company</th>
                  <th className="px-2 py-1 text-right">Hours</th>
                  <th className="px-2 py-1 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {effective.map((p) => {
                  const isIncluded = p.included;
                  const tone = isIncluded
                    ? "text-emerald-300 bg-emerald-500/5 border-emerald-500/40"
                    : "text-slate-400 bg-slate-800/40 border-slate-700/70";

                  return (
                    <tr key={p.projectId}>
                      <td className="px-2 py-1 align-top">
                        <div className="font-semibold text-slate-100">
                          {p.projectName}
                        </div>
                        {p.companyName && (
                          <div className="text-[10px] text-slate-400">
                            {p.companyName}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1 align-top hidden sm:table-cell text-slate-400">
                        {p.companyName ?? "—"}
                      </td>
                      <td className="px-2 py-1 align-top text-right text-slate-100">
                        {p.weeklyHours.toFixed(1)}h
                      </td>
                      <td className="px-2 py-1 align-top text-right">
                        <span
                          className={[
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]",
                            tone,
                          ].join(" ")}
                        >
                          {isIncluded ? "Included" : "Skipped"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
