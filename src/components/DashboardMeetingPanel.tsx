// components/DashboardMeetingPanel.tsx
"use client";

import type React from "react";
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
import { CalendarDays } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function getCurrentWeekMondayIsoLocal(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

// --- Local-storage helpers for daily DRD order ---
const DAILY_ORDER_KEY = "tessera:dailyRundownOrder";
type DailyOrderMap = Record<string, string[]>; // dateIso -> block IDs

function loadDailyOrderMap(): DailyOrderMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DAILY_ORDER_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as DailyOrderMap;
  } catch {
    return {};
  }
}

function saveDailyOrder(dateIso: string, order: string[]) {
  if (typeof window === "undefined") return;
  try {
    const map = loadDailyOrderMap();
    map[dateIso] = order;
    window.localStorage.setItem(DAILY_ORDER_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

// --- Local-storage helpers for per-block time overrides (per day) ---
const DAILY_TIME_OVERRIDES_KEY = "tessera:dailyRundownOverrides";

type DailyTimeOverride = {
  startMinutes: number;
  endMinutes: number;
};

type DailyTimeOverridesMap = Record<
  string, // dateIso
  Record<string, DailyTimeOverride> // blockId -> override
>;

function loadDailyTimeOverrides(): DailyTimeOverridesMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DAILY_TIME_OVERRIDES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as DailyTimeOverridesMap;
  } catch {
    return {};
  }
}

function saveDailyTimeOverride(
  dateIso: string,
  blockId: string,
  override: DailyTimeOverride
) {
  if (typeof window === "undefined") return;
  try {
    const map = loadDailyTimeOverrides();
    const dayOverrides = map[dateIso] ?? {};
    dayOverrides[blockId] = override;
    map[dateIso] = dayOverrides;
    window.localStorage.setItem(DAILY_TIME_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

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

type TodayBlock = {
  id: string;
  kind: "work" | "lunch" | "meeting" | "free";
  label: string;
  startMinutes: number;
  endMinutes: number;
};

// Sortable row for DRD – meetings & lunch are not draggable or editable
function TodayBlockRow({
  block,
  timeLabel,
  onEdit,
}: {
  block: TodayBlock;
  timeLabel: string;
  onEdit: (block: TodayBlock) => void;
}) {
  const isLocked = block.kind === "meeting" || block.kind === "lunch";

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: block.id,
      disabled: isLocked,
    });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: isLocked ? "default" : "grab",
  };

  const tone =
    block.kind === "work"
      ? "bg-sky-500/10 text-sky-100"
      : block.kind === "meeting"
      ? "bg-violet-500/15 text-violet-100 border border-violet-400/60"
      : block.kind === "lunch"
      ? "bg-amber-500/10 text-amber-100 border border-amber-400/60"
      : "bg-emerald-500/5 text-emerald-100 border border-emerald-400/40";

  const labelText =
    block.kind === "lunch"
      ? "Lunch break"
      : block.kind === "free"
      ? "Free time (personal)"
      : block.label;

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(!isLocked ? listeners : {})}
      onClick={() => {
        if (!isLocked) onEdit(block);
      }}
      className={[
        "flex items-center justify-between rounded-lg px-2 py-1",
        tone,
      ].join(" ")}
    >
      <div>
        <div className="text-[15px]">{labelText}</div>
        <div className="text-[13px] text-slate-300/50">{timeLabel}</div>
      </div>

      {block.kind === "meeting" && (
        <div className="ml-3 flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20">
          <CalendarDays className="h-3.5 w-3.5 text-violet-100" />
        </div>
      )}
    </li>
  );
}

export default function DashboardMeetingsPanel() {
  const [anchorDateIso, setAnchorDateIso] = useState<string>(todayIso());
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { jobs } = useMemo(() => loadJobsAndProjects(), [refreshKey]);
  const [savedPlan, setSavedPlan] = useState<SavedWeeklyPlan | null>(null);
  const [showRundown, setShowRundown] = useState(true);
  const [showCalendar, setShowCalendar] = useState(true);
  const [todayOrder, setTodayOrder] = useState<string[] | null>(null);
  const [todayOverrides, setTodayOverrides] = useState<Record<
    string,
    DailyTimeOverride
  > | null>(null);

  // edit-dialog state
  const [editBlock, setEditBlock] = useState<TodayBlock | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

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
    const weekStartIso = getCurrentWeekMondayIsoLocal();
    const plan = loadSavedWeeklyPlan(weekStartIso);
    setSavedPlan(plan);
  }, []);

  // Load saved DRD order + overrides for the current anchor date
  useEffect(() => {
    if (typeof window === "undefined") return;
    const map = loadDailyOrderMap();
    setTodayOrder(map[anchorDateIso] ?? null);

    const overridesMap = loadDailyTimeOverrides();
    setTodayOverrides(overridesMap[anchorDateIso] ?? null);
  }, [anchorDateIso]);

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
    const [y, m, d] = today.split("-").map(Number);
    const dateObj = new Date(y, (m || 1) - 1, d || 1);
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

  const todayBlocksBase: TodayBlock[] = useMemo(() => {
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

    // Meetings as 30m blocks based on their time field
    todayMeetings.forEach((m, idx) => {
      const startMinutes = timeToMinutes(m.time);
      if (startMinutes == null) return;

      let start = startMinutes;
      let end = start + 30;

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
  }, [savedPlan, todayPlan, todayMeetings]);

  // Apply any time overrides for this specific day (non-meeting/lunch only)
  const todayBlocksWithOverrides: TodayBlock[] = useMemo(() => {
    if (!todayBlocksBase.length) return [];
    const overrides = todayOverrides ?? {};
    return todayBlocksBase.map((b) => {
      const ov = overrides[b.id];
      if (!ov || b.kind === "meeting" || b.kind === "lunch") return b;
      return {
        ...b,
        startMinutes: ov.startMinutes,
        endMinutes: ov.endMinutes,
      };
    });
  }, [todayBlocksBase, todayOverrides]);

  // Apply saved drag order
  const orderedTodayBlocks: TodayBlock[] = useMemo(() => {
    if (!todayBlocksWithOverrides.length) return [];
    if (!todayOrder) return todayBlocksWithOverrides;

    const byId = new Map(todayBlocksWithOverrides.map((b) => [b.id, b]));
    const ordered: TodayBlock[] = [];

    // First, use saved order where IDs still exist
    for (const id of todayOrder) {
      const b = byId.get(id);
      if (b) {
        ordered.push(b);
        byId.delete(id);
      }
    }

    // Then append any new blocks not in saved order
    byId.forEach((b) => ordered.push(b));

    return ordered;
  }, [todayBlocksWithOverrides, todayOrder]);

  const workMinutesToday = orderedTodayBlocks.reduce((sum, b) => {
    if (b.kind !== "work") return sum;
    return sum + (b.endMinutes - b.startMinutes);
  }, 0);

  function handleCancelMeeting(m: Meeting) {
    deleteMeeting(m.id);
    setRefreshKey((k) => k + 1);
  }

  function handleRescheduleMeeting(m: Meeting) {
    console.log("Reschedule meeting", m.id);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const current = orderedTodayBlocks;
    const oldIndex = current.findIndex((b) => b.id === active.id);
    const newIndex = current.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const moved = arrayMove(current, oldIndex, newIndex);
    const newOrder = moved.map((b) => b.id);
    setTodayOrder(newOrder);
    saveDailyOrder(anchorDateIso, newOrder);
  }

  function openEditDialog(block: TodayBlock) {
    // meetings / lunch are already guarded in row, but double-check
    if (block.kind === "meeting" || block.kind === "lunch") return;
    setEditBlock(block);
    setEditStart(formatMinutes(block.startMinutes));
    setEditEnd(formatMinutes(block.endMinutes));
    setEditError(null);
  }

  function closeEditDialog() {
    setEditBlock(null);
    setEditError(null);
  }

  function handleEditSave() {
    if (!editBlock || !todayPlan || todayPlan.status !== "work") return;

    const { windowStart, windowEnd } = todayPlan;

    const start = timeToMinutes(editStart);
    const end = timeToMinutes(editEnd);
    if (start == null || end == null) {
      setEditError("Please enter valid times (HH:MM).");
      return;
    }

    let newStart = Math.max(windowStart, Math.min(start, windowEnd));
    let newEnd = Math.max(windowStart, Math.min(end, windowEnd));

    if (newEnd <= newStart) {
      setEditError("End time must be after start time.");
      return;
    }

    // Prevent overlap with locked blocks (meetings & lunch)
    const locked = orderedTodayBlocks.filter(
      (b) =>
        (b.kind === "meeting" || b.kind === "lunch") && b.id !== editBlock.id
    );
    const overlapsLocked = locked.some((b) => {
      return newStart < b.endMinutes && newEnd > b.startMinutes;
    });
    if (overlapsLocked) {
      setEditError("This range overlaps a meeting or lunch block.");
      return;
    }

    const override: DailyTimeOverride = {
      startMinutes: newStart,
      endMinutes: newEnd,
    };

    setTodayOverrides((prev) => ({
      ...(prev ?? {}),
      [editBlock.id]: override,
    }));
    saveDailyTimeOverride(anchorDateIso, editBlock.id, override);
    closeEditDialog();
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

              {savedPlan &&
                todayPlan &&
                todayPlan.status === "work" &&
                orderedTodayBlocks.length > 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/85 p-2">
                    {/* Header row: matches StepFinalize day cards */}
                    <div className="mb-1 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] text-slate-400">
                          Planned {todayPlan.plannedHours.toFixed(1)}h ·{" "}
                          {todayMeetings.length} meeting
                          {todayMeetings.length === 1 ? "" : "s"} ·{" "}
                          {milestonesToday.length} milestone
                          {milestonesToday.length === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-300">
                        {(workMinutesToday / 60).toFixed(1)}h work
                      </div>
                    </div>

                    {/* Full-day block list (timeline) */}
                    <ul className="space-y-1.5 text-[11px]">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={orderedTodayBlocks.map((b) => b.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {orderedTodayBlocks.map((b) => {
                            const timeLabel = `${formatMinutes(
                              b.startMinutes
                            )} – ${formatMinutes(b.endMinutes)}`;

                            return (
                              <TodayBlockRow
                                key={b.id}
                                block={b}
                                timeLabel={timeLabel}
                                onEdit={openEditDialog}
                              />
                            );
                          })}
                        </SortableContext>
                      </DndContext>
                    </ul>
                  </div>
                )}
            </div>
          )}
        </div>

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
            className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left"
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

      {/* Time-edit dialog for DRD blocks */}
      {editBlock && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900/95 p-4 text-xs text-slate-100 shadow-xl">
            <h2 className="text-sm font-semibold text-slate-50">
              Adjust block time
            </h2>
            <p className="mt-1 text-[11px] text-slate-400">
              {editBlock.kind === "free"
                ? "Update this free/personal slot for today."
                : editBlock.kind === "work"
                ? "Update this deep-work slot for today."
                : editBlock.label}
            </p>

            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleEditSave();
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[11px] text-slate-400">Start</span>
                  <input
                    type="time"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[13px] text-slate-100"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[11px] text-slate-400">End</span>
                  <input
                    type="time"
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[13px] text-slate-100"
                  />
                </label>
              </div>

              {editError && (
                <p className="text-[11px] text-rose-300">{editError}</p>
              )}

              <div className="mt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditDialog}
                  className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-sky-500 px-4 py-1 text-[11px] font-semibold text-slate-950 hover:bg-sky-400"
                >
                  Update time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
