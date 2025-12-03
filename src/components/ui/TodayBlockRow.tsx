"use client";

import type React from "react";
import {
  TodayBlock,
  getBlockDurationMinutes,
  isLockedBlock,
} from "@/lib/dailyRunDownHelpers";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  TimeSlotRowContent,
  type TimeSlotVariant,
} from "@/components/ui/TimeSlotRowContent";
import { useDndContext, useDroppable } from "@dnd-kit/core";

type Props = {
  block: TodayBlock;
  timeLabel: string;
  onEdit: (block: TodayBlock) => void;
  onResize?: (blockId: string, nextDurationMinutes: number) => void;
};

export function TodayBlockRow({ block, timeLabel, onEdit, onResize }: Props) {
  const isLocked = isLockedBlock(block);
  const durationMinutes = getBlockDurationMinutes(block);

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: block.id,
      disabled: isLocked,
      data: { durationMinutes },
    });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: isLocked ? "default" : "grab",
  };

  const variant: TimeSlotVariant =
    block.kind === "meeting"
      ? "meeting"
      : block.kind === "lunch"
      ? "lunch"
      : "work";

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(!isLocked ? listeners : {})}
      onDoubleClick={() => onEdit(block)}
    >
      <TimeSlotRowContent
        variant={variant}
        label={block.label}
        timeLabel={timeLabel}
        hours={
          block.hours ?? durationMinutes / 60 // fallback if hours isn't set
        }
        isLocked={isLocked}
        durationMinutes={durationMinutes}
        onResize={
          onResize
            ? (nextDurationMinutes) => onResize(block.id, nextDurationMinutes)
            : undefined
        }
      />
    </li>
  );
}

export function TodayEndDropZone({ id }: { id: string }) {
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

export function TodayEmptyDropSlot({
  id,
  timeLabel,
}: {
  id: string;
  timeLabel: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const { active } = useDndContext();

  const slotMinutes = 30;

  const activeDuration =
    (active?.data?.current?.durationMinutes as number | undefined) ??
    slotMinutes;

  const previewSlots = Math.max(1, Math.round(activeDuration / slotMinutes));

  const baseSlotHeight = 28; // keep in sync with TimeSlotRowContent
  const minHeight = isOver ? previewSlots * baseSlotHeight : baseSlotHeight;

  return (
    <li
      ref={setNodeRef}
      style={{ minHeight }}
      className={`flex items-center gap-2 rounded-md px-2 py-1 transition-colors ${
        isOver
          ? // ⬇️ Stronger outline / ring while hovering
            "border border-sky-400/80 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.7)]"
          : "border border-dashed border-slate-800/80 bg-slate-950/60"
      }`}
    >
      <span
        className={`w-24 text-[10px] font-mono ${
          isOver ? "text-sky-300" : "text-slate-500"
        }`}
      >
        {timeLabel}
      </span>
      <span
        className={`text-[10px] ${isOver ? "text-sky-200" : "text-slate-600"}`}
      >
        {isOver ? "Drop to schedule here" : "Free 30 min"}
      </span>
    </li>
  );
}
