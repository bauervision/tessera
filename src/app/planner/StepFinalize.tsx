// app/planner/StepFinalize.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { PlannerPriorityRow } from "./types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  useDroppable,
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

// ----------------- Timeline helpers -----------------

type TimelineRow =
  | {
      key: string;
      type: "empty";
      startMinutes: number;
      endMinutes: number;
    }
  | {
      key: string;
      type: "block";
      startMinutes: number;
      endMinutes: number;
      block: DayBlock;
    };

function buildTimelineRowsForDay(
  blocks: DayBlock[],
  dayStart: number,
  dayEnd: number
): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const sorted = [...blocks].sort((a, b) => a.startMinutes - b.startMinutes);

  const SLOT = 30; // minutes
  let t = dayStart;
  let i = 0;

  while (t < dayEnd) {
    const block = sorted[i];

    if (block && block.startMinutes === t) {
      const rowEnd = Math.min(block.endMinutes, dayEnd);
      rows.push({
        key: block.id,
        type: "block",
        startMinutes: t,
        endMinutes: rowEnd,
        block,
      });
      t = rowEnd;
      i++;
      continue;
    }

    const rowEnd = Math.min(t + SLOT, dayEnd);
    rows.push({
      key: `empty-${t}`,
      type: "empty",
      startMinutes: t,
      endMinutes: rowEnd,
    });
    t = rowEnd;
  }

  return rows;
}

type ScheduledWork = {
  slotIndex: number;
  block: DayBlock;
};

type OverflowItem = {
  id: string;
  projectName: string;
  hours: number;
};

function scheduleWorkBlocksForDay(
  slots: DaySlotsByIndex[number] | undefined,
  dayStart: number,
  dayEnd: number
): { scheduled: ScheduledWork[]; overflow: OverflowItem[] } {
  const scheduled: ScheduledWork[] = [];
  const overflow: OverflowItem[] = [];

  if (!slots || !slots.length) return { scheduled, overflow };

  const dayCapacityMinutes = Math.max(dayEnd - dayStart, 0);
  let usedMinutes = 0;

  slots.forEach((slot, slotIndex) => {
    const rawHours = slot.hours ?? 0;
    const rawMinutes = Math.round(rawHours * 60);
    const snappedMinutes = Math.max(30, Math.round(rawMinutes / 30) * 30); // 30-min caps
    if (snappedMinutes <= 0) return;

    if (usedMinutes + snappedMinutes > dayCapacityMinutes) {
      overflow.push({
        id: slot.id,
        projectName: slot.projectName,
        hours: snappedMinutes / 60, // derived from snap
      });
      return;
    }

    const start = dayStart + usedMinutes;
    const end = start + snappedMinutes;
    if (end <= start) return;

    const blockHours = snappedMinutes / 60;

    scheduled.push({
      slotIndex,
      block: {
        id: slot.id,
        kind: "work",
        label: slot.projectName,
        startMinutes: start,
        endMinutes: end,
        projectName: slot.projectName,
        hours: blockHours,
      },
    });

    usedMinutes += snappedMinutes;
  });

  return { scheduled, overflow };
}

// ----------------- Row components -----------------

type WorkBlockRowProps = {
  block: DayBlock;
  timeLabel: string;
  onResize?: (nextDurationMinutes: number) => void;
};

function WorkBlockRow({ block, timeLabel, onResize }: WorkBlockRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: "grab",
  };

  const durationMinutes = block.endMinutes - block.startMinutes;

  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TimeSlotRowContent
        variant="work"
        label={block.label}
        timeLabel={timeLabel}
        hours={block.hours}
        durationMinutes={durationMinutes}
        onResize={onResize}
      />
    </li>
  );
}

function MeetingBlockRow({
  block,
  timeLabel,
}: {
  block: DayBlock;
  timeLabel: string;
}) {
  return (
    <li>
      <TimeSlotRowContent
        variant="meeting"
        label={block.label}
        timeLabel={timeLabel}
        isLocked
      />
    </li>
  );
}

function FinalizeEmptyDropSlot({
  id,
  timeLabel,
}: {
  id: string;
  timeLabel: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <li
      ref={setNodeRef}
      className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-[11px] ${
        isOver
          ? "border-sky-500/70 bg-sky-500/10 text-sky-100"
          : "border-dashed border-slate-800/70 bg-slate-950/60 text-slate-400"
      }`}
    >
      <span>{timeLabel}</span>
      <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
        Open
      </span>
    </li>
  );
}

const END_OF_DAY_ID = "__finalize-end__";

function FinalizeEndDropZone({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <li
      ref={setNodeRef}
      className={`mt-1 h-3 rounded border border-dashed border-slate-700/0 ${
        isOver ? "border-sky-500/60 bg-sky-500/10" : ""
      }`}
    />
  );
}

// ----------------- Main component -----------------

export default function StepFinalize(props: FinalizeProps) {
  const { tasks, days, totalAvailableHours, priorities, weekStartIso } = props;

  const totalPlannedHours = useMemo(
    () =>
      priorities
        .filter((p) => p.enabled && p.weeklyHours > 0)
        .reduce((sum, p) => sum + p.weeklyHours, 0),
    [priorities]
  );

  const capacityDelta = totalAvailableHours - totalPlannedHours;
  const overCapacity = capacityDelta < 0;

  const initialSlots = useMemo(
    () => makeInitialSlots(tasks, days, priorities),
    [tasks, days, priorities]
  );

  const [slotsByDay, setSlotsByDay] = useState<DaySlotsByIndex>(initialSlots);

  useEffect(() => {
    setSlotsByDay(initialSlots);
  }, [initialSlots]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  function handleResize(
    dayIndex: number,
    blockId: string,
    nextDurationMinutes: number
  ) {
    setSlotsByDay((prev) => {
      const daySlots = prev[dayIndex] ?? [];

      const snappedMinutes = Math.max(
        30,
        Math.round(nextDurationMinutes / 30) * 30
      );
      const nextHours = snappedMinutes / 60;

      const updated = daySlots.map((slot) =>
        slot.id === blockId ? { ...slot, hours: nextHours } : slot
      );

      return {
        ...prev,
        [dayIndex]: updated,
      };
    });
  }

  function handleDragEnd(dayIndex: number, event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const daySlots = slotsByDay[dayIndex] ?? [];
    if (!daySlots.length) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const fromIndex = daySlots.findIndex((s) => s.id === activeId);
    if (fromIndex === -1) return;

    // Drop on another block → reorder to that block's position
    const toIndexBlock = daySlots.findIndex((s) => s.id === overId);
    if (toIndexBlock !== -1 && toIndexBlock !== fromIndex) {
      const reordered = arrayMove(daySlots, fromIndex, toIndexBlock);
      setSlotsByDay((prev) => ({
        ...prev,
        [dayIndex]: reordered,
      }));
      return;
    }

    const day = days[dayIndex];
    const dayStart = day.startMinutes;
    const dayEnd = day.endMinutes;

    const { scheduled } = scheduleWorkBlocksForDay(daySlots, dayStart, dayEnd);

    // Drop on empty slot → insert before first block that starts at/after that time
    if (overId.startsWith("empty-")) {
      const targetStart = Number.parseInt(overId.replace("empty-", ""), 10);
      if (Number.isNaN(targetStart)) return;

      let insertSlotIndex = daySlots.length - 1;
      for (const sw of scheduled) {
        if (sw.block.startMinutes >= targetStart) {
          insertSlotIndex = sw.slotIndex;
          break;
        }
      }

      const reordered = arrayMove(daySlots, fromIndex, insertSlotIndex);
      setSlotsByDay((prev) => ({
        ...prev,
        [dayIndex]: reordered,
      }));
      return;
    }

    // Drop on end-of-day strip → move to end
    if (overId === END_OF_DAY_ID) {
      const reordered = arrayMove(daySlots, fromIndex, daySlots.length - 1);
      setSlotsByDay((prev) => ({
        ...prev,
        [dayIndex]: reordered,
      }));
    }
  }

  const today = todayIso();

  return (
    <section className="space-y-4">
      {overCapacity && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
          You&apos;re planning{" "}
          <span className="font-semibold">
            {Math.abs(capacityDelta).toFixed(1)}h
          </span>{" "}
          more than your available work time this week. Some blocks may not fit
          into the daily schedules below.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {days
          .map((day, dayIndex) => ({ day, dayIndex }))
          .filter(({ day }) => {
            if (!day.active) return false;
            const dayIso = isoForDayLabel(weekStartIso, day.label);
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

            const { scheduled, overflow: overflowBlocks } =
              scheduleWorkBlocksForDay(slots, dayStart, dayEnd);
            const workBlocks = scheduled.map((s) => s.block);

            // Meetings for this date (30-min each)
            const meetings: Meeting[] = getMeetingsForDate(dayIso);
            const meetingBlocks: DayBlock[] = meetings
              .map((m, index) => {
                const startMinutes = timeToMinutes(m.time);
                if (startMinutes == null) return null;
                const endMinutes = startMinutes + 30;
                return {
                  id: `mtg-${m.id ?? index}`,
                  kind: "meeting" as const,
                  label: m.title,
                  startMinutes,
                  endMinutes,
                  hours: 0.5,
                  projectName: m.title,
                };
              })
              .filter(Boolean) as DayBlock[];

            const allBlocks: DayBlock[] = [
              ...workBlocks,
              ...meetingBlocks,
            ].sort((a, b) => a.startMinutes - b.startMinutes);

            const focusCount = workBlocks.length;
            const meetingCount = meetingBlocks.length;
            const overflowCount = overflowBlocks.length;

            const timelineRows = buildTimelineRowsForDay(
              allBlocks,
              dayStart,
              dayEnd
            );

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
                    {overflowCount > 0 && (
                      <div className="mt-0.5 text-[10px] text-amber-300">
                        {overflowCount === 1
                          ? "1 block doesn’t fit this day."
                          : `${overflowCount} blocks don’t fit this day.`}
                      </div>
                    )}
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
                  <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/90">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleDragEnd(dayIndex, event)}
                    >
                      <SortableContext
                        items={slots.map((s) => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="space-y-1.5 p-2 text-[11px]">
                          {timelineRows.map((row) => {
                            const label = `${formatMinutes(
                              row.startMinutes
                            )} – ${formatMinutes(row.endMinutes)}`;

                            if (row.type === "empty") {
                              return (
                                <FinalizeEmptyDropSlot
                                  key={row.key}
                                  id={row.key}
                                  timeLabel={label}
                                />
                              );
                            }

                            const block = row.block;
                            if (block.kind === "work") {
                              return (
                                <WorkBlockRow
                                  key={row.key}
                                  block={block}
                                  timeLabel={label}
                                  onResize={(nextMinutes) =>
                                    handleResize(
                                      dayIndex,
                                      block.id,
                                      nextMinutes
                                    )
                                  }
                                />
                              );
                            }

                            return (
                              <MeetingBlockRow
                                key={row.key}
                                block={block}
                                timeLabel={label}
                              />
                            );
                          })}

                          <FinalizeEndDropZone id={END_OF_DAY_ID} />
                        </ul>
                      </SortableContext>
                    </DndContext>

                    {overflowCount > 0 && (
                      <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[10px] text-amber-100">
                        <div className="mb-0.5 font-medium">
                          Overflow for this day
                        </div>
                        <ul className="space-y-0.5">
                          {overflowBlocks.map((b) => (
                            <li
                              key={b.id}
                              className="flex items-center justify-between gap-1"
                            >
                              <span className="truncate">{b.projectName}</span>
                              <span className="shrink-0 tabular-nums text-amber-200/90">
                                {b.hours.toFixed(1)}h
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-0.5 text-[9px] text-amber-200/80">
                          Reduce weekly hours or move this work to another day
                          in{" "}
                          <span className="font-medium">
                            Focus &amp; Priority
                          </span>
                          .
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </section>
  );
}
