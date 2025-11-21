// components/meetings/MeetingCard.tsx
"use client";

import type { Meeting, Job } from "@/lib/types";
import { formatTimeLabel, formatTimeUntil } from "@/lib/calendarHelpers";

type MeetingCardProps = {
  meeting: Meeting;
  company?: Job;
  /** Show the "In 2 hours / In 3 days" line if applicable */
  showRelative?: boolean;
  /** Optional extra className on the outer card container */
  className?: string;
  onCancel?: (m: Meeting) => void;
  onReschedule?: (m: Meeting) => void;
};

export function MeetingCard({
  meeting,
  company,
  showRelative = true,
  className = "",
  onCancel,
  onReschedule,
}: MeetingCardProps) {
  const rel = showRelative ? formatTimeUntil(meeting) : null;

  return (
    <div
      className={` group relative overflow-visible rounded-xl border border-slate-800 bg-slate-950/90 ${className}`}
    >
      <div className="m-2">
        {/* Fieldset / legend around meeting content */}
        <fieldset className="relative rounded-xl border border-slate-700 p-2">
          {company && (
            <legend className="px-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {company.name}
            </legend>
          )}

          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold text-slate-50">
                {meeting.title}
              </div>
              {rel && (
                <div className="mt-0.5 text-[10px] text-sky-300">{rel}</div>
              )}
              {meeting.location && (
                <div className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">
                  {meeting.location}
                </div>
              )}
            </div>
            {meeting.time && (
              <div className="shrink-0 font-mono text-[11px] text-sky-300 text-right">
                {formatTimeLabel(meeting.time)}
              </div>
            )}
          </div>
        </fieldset>

        {/* Hover overlay with blur + centered actions */}
        {(onCancel || onReschedule) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/0 opacity-0 backdrop-blur-none transition-all duration-150 group-hover:pointer-events-auto group-hover:bg-slate-950/70 group-hover:opacity-100 group-hover:backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-center gap-2 text-[10px]">
              {onCancel && (
                <button
                  type="button"
                  className="rounded-full border border-slate-400 bg-slate-900/80 px-3 py-1 text-slate-100 hover:bg-slate-800"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel(meeting);
                  }}
                >
                  Cancel
                </button>
              )}
              {onReschedule && (
                <button
                  type="button"
                  className="rounded-full border border-sky-500/80 bg-sky-500/20 px-3 py-1 text-sky-100 hover:bg-sky-500/30"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReschedule(meeting);
                  }}
                >
                  Reschedule
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
