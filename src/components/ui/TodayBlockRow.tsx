// components/ui/TodayBlockRow.tsx
import type React from "react";
import { TodayBlock } from "@/lib/dailyRunDownHelpers";
import { useDndContext, useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";

type Props = {
  block: TodayBlock;
  timeLabel: string;
  onEdit: (block: TodayBlock) => void;
  onResize: (blockId: string, nextDurationMinutes: number) => void;
  onCancelMeeting?: (meetingId: string) => void;
};

export function TodayBlockRow({
  block,
  timeLabel,
  onEdit,
  onResize,
  onCancelMeeting,
}: Props) {
  const isLocked = block.kind === "meeting" || block.kind === "lunch";

  const durationMinutes = Math.max(
    30,
    (block.endMinutes ?? 0) - (block.startMinutes ?? 0)
  );

  const slotMinutes = 30;
  const baseSlotHeight = 28; // keep in sync with TodayEmptyDropSlot
  const slots = Math.max(1, Math.round(durationMinutes / slotMinutes));
  const minHeight = slots * baseSlotHeight;

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: block.id,
      disabled: isLocked,
      data: {
        durationMinutes,
      },
    });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    minHeight,
  };

  const [hovered, setHovered] = useState(false);

  const sliderHours = Math.max(0.5, durationMinutes / 60);

  const handleSliderResize = (hours: number) => {
    const nextMinutes = Math.max(30, Math.round(hours * 60));
    onResize(block.id, nextMinutes);
  };

  const showCancelButton =
    block.kind === "meeting" && !!block.meetingId && !!onCancelMeeting;

  const variantClasses =
    block.kind === "meeting"
      ? "border-amber-500/40 bg-amber-500/10"
      : block.kind === "lunch"
      ? "border-emerald-500/40 bg-emerald-500/10"
      : "border-sky-500/35 bg-sky-500/10";

  // Helper to stop drag from starting when using the slider
  const stopDragPropagation = (
    e:
      | React.PointerEvent<HTMLInputElement>
      | React.MouseEvent<HTMLInputElement>
      | React.TouchEvent<HTMLInputElement>
  ) => {
    e.stopPropagation();
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...(!isLocked ? { ...attributes, ...listeners } : {})}
      className={`group flex items-stretch rounded-md border px-2 py-1.5 text-[11px] ${variantClasses}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Left: time + total hours */}
      <div className="flex min-w-[82px] flex-col justify-center text-[10px] text-slate-400">
        <span>{timeLabel}</span>
        {block.hours != null && (
          <span className="text-[10px] text-slate-500">
            {block.hours.toFixed(1)}h
          </span>
        )}
      </div>

      {/* Middle: label + (for work) duration slider */}
      <div className="ml-3 flex flex-1 flex-col justify-center gap-0.5">
        <button
          type="button"
          disabled={isLocked}
          onClick={() => {
            if (!isLocked) onEdit(block);
          }}
          className="text-left"
        >
          <span className="text-[11px] font-medium text-slate-50">
            {block.label}
          </span>
        </button>

        {block.kind === "work" && (
          <div className="flex items-center gap-2 pt-0.5">
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.5}
              value={sliderHours}
              onChange={(e) => handleSliderResize(Number(e.target.value))}
              // 🔹 Prevent starting a drag while interacting with slider
              onPointerDown={stopDragPropagation}
              onMouseDown={stopDragPropagation}
              onTouchStart={stopDragPropagation}
              className="flex-1 accent-emerald-500"
            />
            <span className="w-8 text-right text-[10px] text-slate-400">
              {sliderHours.toFixed(1)}h
            </span>
          </div>
        )}
      </div>

      {/* Right: meeting cancel X (hover only) */}
      {showCancelButton && hovered && (
        <div className="ml-3 flex items-start">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (block.meetingId) {
                onCancelMeeting(block.meetingId);
              }
            }}
            className="rounded-full border border-rose-500/60 bg-rose-500/15 px-2 py-0.5 text-[10px] text-rose-100 hover:bg-rose-500/25"
          >
            ✕
          </button>
        </div>
      )}
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

  const baseSlotHeight = 28; // keep in sync with TodayBlockRow
  const minHeight = isOver ? previewSlots * baseSlotHeight : baseSlotHeight;

  return (
    <li
      ref={setNodeRef}
      style={{ minHeight }}
      className={`flex items-center gap-2 rounded-md px-2 py-1 transition-colors ${
        isOver
          ? "border border-sky-400/80 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.7)]"
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
