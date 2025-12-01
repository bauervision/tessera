// app/planner/StepFinalize.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { WeeklyPlannerTask } from "@/lib/weeklyPlanner";
import type { DayConfig, PlannerPriorityRow } from "./types";

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

import { getMeetingsForDate } from "@/lib/storage";
import type { Meeting } from "@/lib/types";

type ViewMode = "wizard" | "schedule";

type Props = {
  tasks: WeeklyPlannerTask[];
  days: DayConfig[];
  totalAvailableHours: number;
  priorities: PlannerPriorityRow[];
  projectDoneFromDayIndex: Record<string, number>;
  onProjectDoneFromDayIndexChange: (next: Record<string, number>) => void;
  onSavePlan: () => void;
  weekStartIso: string;
  hasSavedPlan: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
};

type DaySlot = {
  id: string;
  projectId: string;
  projectName: string;
  hours: number; // per-day hours already
};

type DaySlotsByIndex = Record<number, DaySlot[]>;

type DayBlockKind = "work" | "meeting";

type DayBlock = {
  id: string;
  kind: DayBlockKind;
  label: string;
  startMinutes: number;
  endMinutes: number;
  projectName?: string;
  hours?: number;
};

// --- Weekday helpers (lock mapping to Monday-start week) ---

const WEEKDAY_LABELS: string[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

function getDateForDayLabel(weekStartIso: string, dayLabel: string): Date {
  const [y, m, d] = weekStartIso.split("-").map(Number);
  const monday = new Date(y, (m || 1) - 1, d || 1); // weekStartIso is Monday
  const idx = WEEKDAY_LABELS.indexOf(dayLabel);
  if (idx === -1) {
    return monday;
  }
  const date = new Date(monday);
  date.setDate(monday.getDate() + idx);
  return date;
}

function isoForDayLabel(weekStartIso: string, dayLabel: string): string {
  const date = getDateForDayLabel(weekStartIso, dayLabel);
  return date.toISOString().slice(0, 10);
}

function formatDateLabelFromLabel(weekStartIso: string, dayLabel: string) {
  const date = getDateForDayLabel(weekStartIso, dayLabel);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
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

// --- Slots builder ---

function makeInitialSlots(
  tasks: WeeklyPlannerTask[],
  days: DayConfig[],
  priorities: PlannerPriorityRow[]
): DaySlotsByIndex {
  const result: DaySlotsByIndex = {};

  const activeDayIndexes = days
    .map((day, idx) => (day.active ? idx : -1))
    .filter((idx) => idx !== -1);

  if (activeDayIndexes.length === 0) {
    days.forEach((_, idx) => {
      result[idx] = [];
    });
    return result;
  }

  const enabledRows = priorities.filter((p) => p.enabled && p.weeklyHours > 0);

  if (!enabledRows.length) {
    days.forEach((_, idx) => {
      result[idx] = [];
    });
    return result;
  }

  // Per-day hours for each project: weeklyHours / activeDayCount
  const perDayRows = enabledRows.map((row) => {
    const task = tasks.find((t) => t.projectId === row.projectId);
    const projectName = task?.projectName ?? "Project";
    const perDayHours = row.weeklyHours / activeDayIndexes.length;
    return {
      projectId: row.projectId,
      projectName,
      perDayHours,
    };
  });

  days.forEach((day, idx) => {
    if (!day.active) {
      result[idx] = [];
      return;
    }

    const slots: DaySlot[] = perDayRows.map((row) => ({
      id: `${idx}-${row.projectId}`,
      projectId: row.projectId,
      projectName: row.projectName,
      hours: row.perDayHours,
    }));

    result[idx] = slots;
  });

  return result;
}

// --- Row components ---

function WorkBlockRow({ block }: { block: DayBlock }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: "grab",
  };

  const timeLabel = `${formatMinutes(block.startMinutes)} – ${formatMinutes(
    block.endMinutes
  )}`;

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center justify-between rounded-lg border border-sky-500/50 bg-sky-500/10 px-2 py-1.5 text-[11px] text-sky-100"
    >
      <div className="flex flex-col">
        <span className="text-[13px] font-medium text-sky-100">
          {block.label}
        </span>
        <span className="text-[11px] text-sky-200/90">
          {timeLabel} · {(block.hours ?? 0).toFixed(1)}h focus
        </span>
      </div>
      <span className="ml-2 text-[11px] text-sky-300/80">⠿</span>
    </li>
  );
}

function MeetingBlockRow({ block }: { block: DayBlock }) {
  const timeLabel = `${formatMinutes(block.startMinutes)} – ${formatMinutes(
    block.endMinutes
  )}`;

  return (
    <li className="flex items-center justify-between rounded-lg border border-violet-500/60 bg-violet-500/15 px-2 py-1.5 text-[11px] text-violet-100">
      <div className="flex flex-col">
        <span className="text-[13px] font-medium text-violet-50">
          {block.label}
        </span>
        <span className="text-[11px] text-violet-200/90">{timeLabel}</span>
      </div>
      <span className="ml-2 text-[11px] text-violet-200/90">📅</span>
    </li>
  );
}

export default function StepFinalize(props: Props) {
  const {
    tasks,
    days,
    totalAvailableHours,
    priorities,
    projectDoneFromDayIndex,
    onProjectDoneFromDayIndexChange,
    onSavePlan,
    weekStartIso,
    hasSavedPlan,
    viewMode,
    onViewModeChange,
  } = props;

  // Planner math
  const totalPlannedHours = useMemo(
    () =>
      priorities
        .filter((p) => p.enabled && p.weeklyHours > 0)
        .reduce((sum, p) => sum + p.weeklyHours, 0),
    [priorities]
  );

  const capacityDelta = totalAvailableHours - totalPlannedHours;
  const overCapacity = capacityDelta < 0;

  // Initial per-day slots based on tasks + priorities + active days
  const initialSlots = useMemo(
    () => makeInitialSlots(tasks, days, priorities),
    [tasks, days, priorities]
  );

  const [slotsByDay, setSlotsByDay] = useState<DaySlotsByIndex>(initialSlots);

  // When week / tasks / priorities change, reset DnD layout
  useEffect(() => {
    setSlotsByDay(initialSlots);
  }, [initialSlots]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const activeDays = days.filter((d) => d.active);
  const activeDaysCount = activeDays.length;

  function handleDragEnd(dayIndex: number, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const daySlots = slotsByDay[dayIndex] ?? [];
    const ids = daySlots.map((s) => s.id);

    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(daySlots, oldIndex, newIndex);
    setSlotsByDay((prev) => ({
      ...prev,
      [dayIndex]: reordered,
    }));
  }

  return (
    <section className="space-y-4">
      {/* Day grid – ONLY active days */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {days
          .map((day, dayIndex) => ({ day, dayIndex }))
          .filter(({ day }) => day.active)
          .map(({ day, dayIndex }) => {
            const prettyDate = formatDateLabelFromLabel(
              weekStartIso,
              day.label
            );
            const dayIso = isoForDayLabel(weekStartIso, day.label);

            const slots = slotsByDay[dayIndex] ?? [];

            const dayStart = day.startMinutes;
            const dayEnd = day.endMinutes;

            // Build work blocks in the current slot order
            const workBlocks: DayBlock[] = [];
            let cursor = dayStart;
            slots.forEach((slot) => {
              const minutes = (slot.hours ?? 0) * 60;
              if (minutes <= 0 || cursor >= dayEnd) return;
              const start = cursor;
              const end = Math.min(dayEnd, cursor + minutes);
              if (end <= start) return;

              workBlocks.push({
                id: slot.id,
                kind: "work",
                label: slot.projectName,
                startMinutes: start,
                endMinutes: end,
                projectName: slot.projectName,
                hours: slot.hours,
              });

              cursor = end;
            });

            // Meetings for this date
            const meetings: Meeting[] = getMeetingsForDate(dayIso);
            const meetingBlocks: DayBlock[] = meetings
              .map((m, index) => {
                const startMinutes = timeToMinutes(m.time);
                if (startMinutes == null) return null;
                const endMinutes = startMinutes + 30; // 30m default
                return {
                  id: `mtg-${m.id ?? index}`,
                  kind: "meeting" as const,
                  label: m.title,
                  startMinutes,
                  endMinutes,
                };
              })
              .filter(Boolean) as DayBlock[];

            // Merge into a single timeline, sorted by startMinutes
            const allBlocks: DayBlock[] = [
              ...workBlocks,
              ...meetingBlocks,
            ].sort((a, b) => a.startMinutes - b.startMinutes);

            const focusCount = workBlocks.length;
            const meetingCount = meetingBlocks.length;

            return (
              <div
                key={day.id}
                className="flex flex-col rounded-2xl border border-slate-700 bg-slate-950/85 px-3 py-3 text-xs"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {day.label}
                    </div>
                    <div className="text-[13px] font-medium text-slate-50">
                      {prettyDate}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    <div>
                      {focusCount === 0
                        ? "No focus blocks"
                        : `${focusCount} focus block${
                            focusCount === 1 ? "" : "s"
                          }`}
                    </div>
                    <div className="text-[10px] text-violet-300">
                      {meetingCount === 0
                        ? "No meetings"
                        : `${meetingCount} meeting${
                            meetingCount === 1 ? "" : "s"
                          }`}
                    </div>
                  </div>
                </div>

                {focusCount === 0 && meetingCount === 0 ? (
                  <div className="mt-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/80 px-2 py-2 text-[11px] text-slate-400">
                    No project time or meetings allocated to this day yet.
                    Increase weekly hours in{" "}
                    <span className="font-medium text-sky-300">
                      Focus &amp; Priority
                    </span>{" "}
                    or schedule a meeting.
                  </div>
                ) : (
                  <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/90 px-2 py-2">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleDragEnd(dayIndex, event)}
                    >
                      {/* Only work block IDs are sortable; meetings are static */}
                      <SortableContext
                        items={slots.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="space-y-1.5 text-[11px]">
                          {allBlocks.map((block) =>
                            block.kind === "work" ? (
                              <WorkBlockRow key={block.id} block={block} />
                            ) : (
                              <MeetingBlockRow key={block.id} block={block} />
                            )
                          )}
                        </ul>
                      </SortableContext>
                    </DndContext>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </section>
  );
}
