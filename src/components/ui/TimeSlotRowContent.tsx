"use client";

import type React from "react";

export type TimeSlotVariant = "work" | "meeting" | "lunch";

type Props = {
  variant: TimeSlotVariant;
  label: string;
  timeLabel: string;
  hours?: number;
  isLocked?: boolean;
  durationMinutes?: number;
  onResize?: (nextDurationMinutes: number) => void;
};

export function TimeSlotRowContent({
  variant,
  label,
  timeLabel,
  hours,
  isLocked = false,
  durationMinutes,
  onResize,
}: Props) {
  const baseClasses = "flex items-center gap-3 rounded-md border px-2 py-1.5";

  const variantClasses =
    variant === "meeting"
      ? "border-amber-500/40 bg-amber-500/10"
      : variant === "lunch"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : "border-sky-500/30 bg-sky-500/5";

  const displayHours =
    typeof hours === "number" ? hours : (durationMinutes ?? 30) / 60;

  const slotMinutes = 30;
  const currentSlots = Math.max(
    1,
    Math.round((durationMinutes ?? slotMinutes) / slotMinutes)
  );

  return (
    <div className={`${baseClasses} ${variantClasses}`}>
      {/* Time label */}
      <div className="w-28 text-[10px] font-mono text-slate-400">
        {timeLabel}
      </div>

      {/* Main label */}
      <div className="flex-1">
        <div className="text-[11px] font-medium text-slate-50">{label}</div>
        <div className="text-[10px] text-slate-400">
          {displayHours > 0 && (
            <span className="ml-1 text-[10px] text-slate-500">
              {displayHours.toFixed(1)}h
            </span>
          )}
        </div>
      </div>

      {/* Duration slider – only for non-locked blocks */}
      {!isLocked && onResize && (
        <div className="ml-2 flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={8} // 8 * 30min = 4 hours
            step={1}
            value={currentSlots}
            onChange={(e) => {
              const nextSlots = Number(e.target.value) || 1;
              const nextDuration = nextSlots * slotMinutes;
              onResize(nextDuration);
            }}
            // ⬇️ Prevent dnd-kit from seeing these events
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="h-1 w-28 cursor-pointer rounded-full bg-slate-800 accent-emerald-400"
          />

          <span className="w-10 text-right text-[10px] text-slate-300">
            {((currentSlots * slotMinutes) / 60).toFixed(1)}h
          </span>
        </div>
      )}
    </div>
  );
}
