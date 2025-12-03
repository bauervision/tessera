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
import {
  DayBlock,
  DaySlotsByIndex,
  formatDateLabelFromLabel,
  formatMinutes,
  isoForDayLabel,
  makeInitialSlots,
  FinalizeProps,
  timeToMinutes,
} from "./helpers";
import { todayIso } from "@/lib/calendarHelpers";
import { TimeSlotRowContent } from "@/components/ui/TimeSlotRowContent";

// --- Small UI Row components ---

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
    <li ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TimeSlotRowContent
        variant="work"
        label={block.label}
        timeLabel={timeLabel}
        hours={block.hours}
      />
    </li>
  );
}

function MeetingBlockRow({ block }: { block: DayBlock }) {
  const timeLabel = `${formatMinutes(block.startMinutes)} – ${formatMinutes(
    block.endMinutes
  )}`;

  return (
    <li>
      <TimeSlotRowContent
        variant="meeting"
        label={block.label}
        timeLabel={timeLabel}
      />
    </li>
  );
}

const END_OF_DAY_ID = "__finalize-end__";

function EndOfDayDropZone({ id }: { id: string }) {
  const { setNodeRef, isOver, transform, transition } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`h-3 rounded border border-dashed border-slate-700/0 ${
        isOver ? "border-sky-500/60 bg-sky-500/10" : ""
      }`}
    />
  );
}

export default function StepFinalize(props: FinalizeProps) {
  const { tasks, days, totalAvailableHours, priorities, weekStartIso } = props;

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
    if (!daySlots.length) return;

    const ids = [...daySlots.map((s) => s.id), END_OF_DAY_ID];

    const oldIndex = ids.indexOf(String(active.id));
    let newIndex = ids.indexOf(String(over.id));

    if (oldIndex === -1 || newIndex === -1) return;

    // If dropped on the synthetic end-of-day target,
    // move to the last real slot.
    if (over.id === END_OF_DAY_ID) {
      newIndex = ids.length - 2; // index of last real item
    }

    const reordered = arrayMove(daySlots, oldIndex, newIndex);
    setSlotsByDay((prev) => ({
      ...prev,
      [dayIndex]: reordered,
    }));
  }

  const today = todayIso();

  return (
    <section className="space-y-4">
      {/* Day grid – ONLY active days */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {days
          .map((day, dayIndex) => ({ day, dayIndex }))
          .filter(({ day, dayIndex }) => {
            if (!day.active) return false;

            // Map this label to an ISO date in the current week
            const dayIso = isoForDayLabel(weekStartIso, day.label);

            // Keep only today and future days
            return dayIso >= today;
          })
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
                        items={[...slots.map((s) => s.id), END_OF_DAY_ID]}
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
                          <EndOfDayDropZone id={END_OF_DAY_ID} />
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
