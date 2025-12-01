"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { DayConfig, PlannerPriorityRow } from "./types";
import { CalendarDays, AlertTriangle } from "lucide-react";
import { getMeetingsForDate } from "@/lib/storage";
import type { Meeting } from "@/lib/types";

import {
  DndContext,
  PointerSensor,
  closestCenter,
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

interface StepFinalizeProps {
  tasks: any[];
  days: DayConfig[];
  totalAvailableHours: number;
  priorities: PlannerPriorityRow[];
  projectDoneFromDayIndex: Record<string, number>;
  onProjectDoneFromDayIndexChange: (next: Record<string, number>) => void;
  onSavePlan: () => void;
  weekStartIso: string;
  hasSavedPlan: boolean;
  viewMode: "wizard" | "schedule";
  onViewModeChange: (mode: "wizard" | "schedule") => void;
}

type DayBlockKind = "work" | "meeting";

type DayBlock = {
  id: string;
  kind: DayBlockKind;
  label: string;
  projectId?: string;
  startMinutes: number;
  endMinutes: number;
  weeklyHours?: number;
  dailyHours?: number;
  meetingId?: string;
  conflict?: boolean;
  timeLabel: string;
};

const ORDER_KEY_PREFIX = "tessera:plannerProjectOrder:";

// ---------- localStorage helpers (per-week project order) ----------

function loadProjectOrder(weekStartIso: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ORDER_KEY_PREFIX + weekStartIso);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

function saveProjectOrder(weekStartIso: string, order: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ORDER_KEY_PREFIX + weekStartIso,
      JSON.stringify(order)
    );
  } catch {
    // ignore
  }
}

// ---------- date / time helpers ----------

function parseIsoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDaysIso(baseIso: string, offset: number): string {
  const base = parseIsoToLocalDate(baseIso);
  base.setDate(base.getDate() + offset);
  return base.toISOString().slice(0, 10);
}

function minutesToLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const mm = m.toString().padStart(2, "0");
  return `${hour12}:${mm} ${ampm}`;
}

function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const [hh, mm] = t.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

function formatDateLabel(iso: string): string {
  const d = parseIsoToLocalDate(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// ---------- meeting conflict helpers ----------

type MeetingWithTimes = {
  meeting: Meeting;
  start: number;
  end: number;
};

function getMeetingsWithTimes(meetings: Meeting[]): MeetingWithTimes[] {
  return meetings
    .map((m) => {
      const start = timeToMinutes(m.time);
      if (start == null) return null;
      const end = start + 30; // 30-min default
      return { meeting: m, start, end };
    })
    .filter(Boolean) as MeetingWithTimes[];
}

function computeMeetingConflicts(meetings: Meeting[]): {
  hasAny: boolean;
  conflictIds: Set<string>;
} {
  const withTimes = getMeetingsWithTimes(meetings).sort(
    (a, b) => a.start - b.start
  );
  const conflictIds = new Set<string>();

  for (let i = 1; i < withTimes.length; i++) {
    const prev = withTimes[i - 1];
    const cur = withTimes[i];
    if (cur.start < prev.end) {
      const prevId = String((prev.meeting as any).id ?? "");
      const curId = String((cur.meeting as any).id ?? "");
      if (prevId) conflictIds.add(prevId);
      if (curId) conflictIds.add(curId);
    }
  }

  return { hasAny: conflictIds.size > 0, conflictIds };
}

// ---------- DnD row ----------

function DayBlockRow({ block }: { block: DayBlock }) {
  const isLocked = block.kind === "meeting";

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: block.id,
      disabled: isLocked,
    });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: isLocked ? "default" : "grab",
  };

  const tone =
    block.kind === "work"
      ? "bg-sky-500/10 text-sky-100"
      : "bg-violet-500/15 text-violet-100 border border-violet-400/60";

  const subtitle =
    block.kind === "work" && block.dailyHours != null
      ? `${block.dailyHours.toFixed(1)} / ${block.weeklyHours ?? 0} hrs`
      : block.timeLabel;

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(!isLocked ? listeners : {})}
      className={[
        "flex items-center justify-between rounded-lg px-2 py-1",
        tone,
      ].join(" ")}
    >
      <div>
        <div className="text-[15px]">{block.label}</div>
        <div className="text-[13px] text-slate-300/60">{subtitle}</div>
        {block.kind === "meeting" && block.conflict && (
          <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-rose-600/20 px-2 py-[1px] text-[10px] font-semibold text-rose-200">
            <AlertTriangle className="h-3 w-3" />
            Conflict
          </div>
        )}
      </div>

      {block.kind === "meeting" && (
        <div className="ml-3 flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20">
          <CalendarDays className="h-3.5 w-3.5 text-violet-100" />
        </div>
      )}
    </li>
  );
}

// ---------- main component ----------

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function StepFinalize(props: StepFinalizeProps) {
  const {
    tasks,
    days,
    totalAvailableHours,
    priorities,
    projectDoneFromDayIndex,
    onProjectDoneFromDayIndexChange: _onProjectDoneFromDayIndexChange, // not used yet
    onSavePlan,
    weekStartIso,
    hasSavedPlan,
    viewMode,
    onViewModeChange,
  } = props;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const activeDaysCount = days.filter((d) => d.active).length || 1;

  const enabledPriorities = useMemo(
    () => priorities.filter((p) => p.enabled && p.weeklyHours > 0),
    [priorities]
  );

  // Global project order for the week
  const [projectOrder, setProjectOrder] = useState<string[] | null>(null);

  useEffect(() => {
    const order = loadProjectOrder(weekStartIso);
    setProjectOrder(order);
  }, [weekStartIso]);

  const orderedPriorities = useMemo(() => {
    if (!projectOrder) return enabledPriorities;

    const byId = new Map(enabledPriorities.map((p) => [p.projectId, p]));
    const ordered: PlannerPriorityRow[] = [];

    projectOrder.forEach((id) => {
      const row = byId.get(id);
      if (row) {
        ordered.push(row);
        byId.delete(id);
      }
    });

    byId.forEach((row) => ordered.push(row));
    return ordered;
  }, [enabledPriorities, projectOrder]);

  function getProjectLabel(projectId: string): string {
    const row = orderedPriorities.find((p) => p.projectId === projectId) as any;
    const task = tasks.find((t: any) => t.projectId === projectId) as any;

    return (
      row?.label ?? row?.name ?? task?.name ?? task?.projectName ?? projectId
    );
  }

  // Map label -> DayConfig (Sun/Mon/etc.)
  const dayConfigByLabel = useMemo(() => {
    const map = new Map<string, DayConfig>();
    days.forEach((d) => map.set(d.label, d));
    return map;
  }, [days]);

  // Build view model for each calendar day of this week
  const dayViews = useMemo(() => {
    const views: {
      iso: string;
      dateLabel: string;
      config: DayConfig | null;
      configIndex: number | null;
      blocks: DayBlock[];
      workHours: number;
      hasMeetingConflict: boolean;
    }[] = [];

    for (let offset = 0; offset < 7; offset++) {
      const iso = addDaysIso(weekStartIso, offset);
      const dateObj = parseIsoToLocalDate(iso);
      const weekdayLabel = weekdayLabels[dateObj.getDay()];
      const configIndex = days.findIndex((d) => d.label === weekdayLabel);
      const config = configIndex >= 0 ? days[configIndex] : null;

      const meetingsForDay = getMeetingsForDate(iso);
      const { hasAny, conflictIds } = computeMeetingConflicts(meetingsForDay);

      const blocks: DayBlock[] = [];

      if (config && config.active) {
        const dayStart = config.startMinutes;
        const dayEnd = config.endMinutes;

        if (dayEnd > dayStart) {
          let cursor = dayStart;

          // work blocks, in global project order
          orderedPriorities.forEach((p) => {
            const doneFrom = projectDoneFromDayIndex[p.projectId];
            const idxForDoneCompare = configIndex >= 0 ? configIndex : offset;
            if (doneFrom !== undefined && idxForDoneCompare >= doneFrom) {
              return;
            }

            const minutesPerDay = (p.weeklyHours / activeDaysCount) * 60;
            if (minutesPerDay <= 0) return;
            if (cursor >= dayEnd) return;

            const startMinutes = cursor;
            const endMinutes = Math.min(
              dayEnd,
              cursor + Math.round(minutesPerDay)
            );
            if (endMinutes <= startMinutes) return;

            cursor = endMinutes;

            const dailyHours = (endMinutes - startMinutes) / 60;

            blocks.push({
              id: `${weekdayLabel}-work-${p.projectId}`,
              kind: "work",
              label: getProjectLabel(p.projectId),
              projectId: p.projectId,
              startMinutes,
              endMinutes,
              weeklyHours: p.weeklyHours,
              dailyHours,
              timeLabel: `${minutesToLabel(startMinutes)} – ${minutesToLabel(
                endMinutes
              )}`,
            });
          });

          // meeting blocks (fixed times)
          const meetingsWithTimes = getMeetingsWithTimes(meetingsForDay);
          meetingsWithTimes.forEach(({ meeting, start, end }, idx) => {
            const id = String((meeting as any).id ?? idx);
            blocks.push({
              id: `${weekdayLabel}-mtg-${id}`,
              kind: "meeting",
              label: meeting.title,
              startMinutes: start,
              endMinutes: end,
              meetingId: id,
              conflict: conflictIds.has(id),
              timeLabel: `${minutesToLabel(start)} – ${minutesToLabel(end)}`,
            });
          });

          blocks.sort((a, b) => a.startMinutes - b.startMinutes);
        }
      }

      const workHours = blocks
        .filter((b) => b.kind === "work")
        .reduce((sum, b) => sum + (b.endMinutes - b.startMinutes) / 60, 0);

      views.push({
        iso,
        dateLabel: formatDateLabel(iso),
        config,
        configIndex: configIndex >= 0 ? configIndex : null,
        blocks,
        workHours,
        hasMeetingConflict: hasAny,
      });
    }

    return views;
  }, [
    weekStartIso,
    days,
    orderedPriorities,
    activeDaysCount,
    projectDoneFromDayIndex,
  ]);

  const totalPlannedWeeklyHours = priorities
    .filter((p) => p.enabled)
    .reduce((sum, p) => sum + p.weeklyHours, 0);

  // DnD handler (per-day) — updates global project order
  function makeHandleDayDragEnd(viewIdx: number) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const dayBlocks = dayViews[viewIdx].blocks;
      const activeBlock = dayBlocks.find((b) => b.id === active.id);
      const overBlock = dayBlocks.find((b) => b.id === over.id);
      if (!activeBlock || !overBlock) return;

      if (
        activeBlock.kind !== "work" ||
        overBlock.kind !== "work" ||
        !activeBlock.projectId ||
        !overBlock.projectId
      ) {
        return;
      }

      const projectIds = orderedPriorities.map((p) => p.projectId);

      const oldIndex = projectIds.indexOf(activeBlock.projectId);
      const newIndex = projectIds.indexOf(overBlock.projectId);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(projectIds, oldIndex, newIndex);
      setProjectOrder(newOrder);
      saveProjectOrder(weekStartIso, newOrder);
    };
  }

  const weekStartDate = parseIsoToLocalDate(weekStartIso);
  const weekEndDate = parseIsoToLocalDate(addDaysIso(weekStartIso, 6));
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

  return (
    <section className="space-y-4">
      {/* Summary header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[13px] font-semibold text-slate-100">
            Proposed daily schedule
          </div>
          <p className="text-[13px] text-slate-400">
            Week of{" "}
            <span className="font-medium text-slate-200">
              {fmt(weekStartDate)}
            </span>{" "}
            –{" "}
            <span className="font-medium text-slate-200">
              {fmt(weekEndDate)}
            </span>
            . Drag projects within a day to change the order for the entire
            week.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="rounded-full bg-slate-900/80 px-3 py-1">
            Planned{" "}
            <span className="font-semibold text-slate-100">
              {totalPlannedWeeklyHours.toFixed(1)}h
            </span>{" "}
            / Available{" "}
            <span className="font-semibold text-slate-100">
              {totalAvailableHours.toFixed(1)}h
            </span>
          </span>
          {hasSavedPlan && (
            <span className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-emerald-300">
              Plan saved
            </span>
          )}
        </div>
      </div>

      {/* Day cards */}
      <div className="grid gap-3 md:grid-cols-2">
        {dayViews.map((view, idx) => {
          const { dateLabel, config, blocks, workHours, hasMeetingConflict } =
            view;
          const isActive = config?.active ?? false;

          return (
            <div
              key={idx}
              className={[
                "flex flex-col rounded-2xl border px-3 py-3 text-xs transition",
                isActive
                  ? "border-slate-700 bg-slate-950/80"
                  : "border-slate-900 bg-slate-950/40 opacity-60",
              ].join(" ")}
            >
              {/* Header */}
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {dateLabel}
                  </div>
                  {!isActive && (
                    <div className="text-[11px] text-slate-500">
                      Non-work day
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {hasMeetingConflict && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-600/15 px-2 py-[2px] text-[10px] font-semibold text-rose-200">
                      <AlertTriangle className="h-3 w-3" />
                      Meeting conflict
                    </span>
                  )}
                  {isActive && (
                    <span className="text-[11px] font-semibold text-emerald-300">
                      {workHours.toFixed(1)}h work
                    </span>
                  )}
                </div>
              </div>

              {!isActive && (
                <p className="text-[11px] text-slate-500">
                  This day is turned off in your weekly planner.
                </p>
              )}

              {isActive && blocks.length === 0 && (
                <p className="text-[11px] text-slate-500">
                  No work blocks generated for this day yet.
                </p>
              )}

              {isActive && blocks.length > 0 && (
                <ul className="space-y-1.5 text-[11px]">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={makeHandleDayDragEnd(idx)}
                  >
                    <SortableContext
                      items={blocks.map((b) => b.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {blocks.map((block) => (
                        <DayBlockRow key={block.id} block={block} />
                      ))}
                    </SortableContext>
                  </DndContext>
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Action row */}
      <footer className="flex flex-col items-start justify-between gap-3 border-t border-slate-800 pt-4 text-[11px] text-slate-400 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSavePlan}
            className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-slate-950 shadow-sm hover:bg-emerald-400"
          >
            Save weekly schedule
          </button>
          {viewMode === "wizard" ? (
            <button
              type="button"
              onClick={() => onViewModeChange("schedule")}
              className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-900"
            >
              View schedule only
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onViewModeChange("wizard")}
              className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-900"
            >
              Back to wizard
            </button>
          )}
        </div>
        <p>
          Drag projects to adjust order; meetings stay fixed at their start
          times. Project order is saved for this week and reused across all
          days.
        </p>
      </footer>
    </section>
  );
}
