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
