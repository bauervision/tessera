"use client";

import { useEffect, useState } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  deleteMeeting,
  getMeetingsForDate,
  loadJobsAndProjects,
} from "@/lib/storage";
import type { Meeting, Job } from "@/lib/types";
import { Toast, type ToastVariant } from "@/components/ui/Toast";
import { MeetingsOverviewDialog } from "./MeetingsOverviewDialog";

// -----------------Helpers -----------------------

const todayIso = () => new Date().toISOString().slice(0, 10);

function formatTimeLabel(time?: string | null): string {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  let h = Number(hStr) || 0;
  const m = Number(mStr) || 0;
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDateLabel(ymd: string): string {
  if (!ymd) return "";
  const d = new Date(ymd + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function buildMeetingDate(m: Meeting): Date | null {
  if (!m.dateIso) return null;

  const [yStr, mStr, dStr] = m.dateIso.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  if (!year || !month || !day) return null;

  let hours = 9;
  let minutes = 0;

  if (m.time) {
    const [hStr, minStr] = m.time.split(":");
    hours = Number(hStr) || 0;
    minutes = Number(minStr) || 0;
  }

  // local time
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function formatTimeUntil(m: Meeting): string | null {
  const dt = buildMeetingDate(m);
  if (!dt) return null;

  const diffMs = dt.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes <= 0) {
    // already started or in the past – you can tweak this if you want
    return null;
  }

  if (diffMinutes < 60) {
    return `In ${diffMinutes} minute${diffMinutes === 1 ? "" : "s"}`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `In ${diffHours} hour${diffHours === 1 ? "" : "s"}`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `In ${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

//-----------------Component -----------------------------//

export function DashboardMeetingsPanel() {
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showOverview, setShowOverview] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    variant?: ToastVariant;
  } | null>(null);

  const showToast = (message: string, variant: ToastVariant = "info") => {
    setToast({ message, variant });
  };

  // load companies once
  useEffect(() => {
    const { jobs } = loadJobsAndProjects();
    setJobs(jobs);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refresh = () => {
      setMeetings(getMeetingsForDate(selectedDate));
    };

    refresh(); // initial load

    window.addEventListener("tessera:meetings-updated", refresh);
    return () => {
      window.removeEventListener("tessera:meetings-updated", refresh);
    };
  }, [selectedDate]);

  const handleCancel = (meetingId: string) => {
    deleteMeeting(meetingId);

    // local refresh
    setMeetings(getMeetingsForDate(selectedDate));

    // notify other listeners (like the floating widget)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("tessera:meetings-updated"));
    }

    showToast("Meeting cancelled", "info");
  };

  const handleReschedule = (m: Meeting) => {
    // For now, just a placeholder; we can wire a real reschedule flow later.
    showToast("Reschedule flow not implemented yet", "info");
  };

  const selectedLabel = formatDateLabel(selectedDate);

  return (
    <aside className="hidden lg:flex w-[320px] flex-col rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-xs text-slate-200">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Calendar</h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Pick a day and see your meetings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowOverview(true)}
          className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1 text-[11px] text-slate-100 hover:bg-slate-800"
        >
          View all
        </button>
      </div>

      {/* Small calendar */}
      <div className="mt-3">
        <DatePicker value={selectedDate} onChange={setSelectedDate} />
      </div>

      {/* Day agenda */}
      <div className="mt-4 border-t border-white/10 pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            {selectedLabel || "Selected day"}
          </span>
          <span className="text-[11px] text-slate-400">
            {meetings.length === 0
              ? "No meetings"
              : `${meetings.length} meeting${meetings.length > 1 ? "s" : ""}`}
          </span>
        </div>

        {meetings.length === 0 ? (
          <p className="mt-2 text-[11px] text-slate-500">
            Nothing scheduled for this day yet. Use the bottom-right meetings
            button to add one.
          </p>
        ) : (
          <ul className="mt-2 space-y-2 text-[11px]">
            {meetings.map((m) => {
              const company = m.jobId
                ? jobs.find((j) => j.id === m.jobId)
                : undefined;

              return (
                <li
                  key={m.id}
                  className="group relative mt-5 overflow-visible rounded-xl border border-white/12 bg-slate-950/80 px-3 pt-4 pb-3 cursor-pointer"
                >
                  {/* Fieldset-style company label sitting on the border */}
                  <div className="pointer-events-none absolute -top-2 left-4 inline-flex items-center rounded-full border border-slate-600 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-200">
                    {company ? company.name : "No specific company"}
                  </div>

                  {/* Main card content */}
                  <div className="relative space-y-2">
                    <div className="flex min-h-10 items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-slate-50">
                          {m.title}
                        </div>

                        {/* Time-until label */}
                        {formatTimeUntil(m) && (
                          <div className="mt-0.5 text-[10px] text-sky-300">
                            {formatTimeUntil(m)}
                          </div>
                        )}

                        {m.location && (
                          <div className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">
                            {m.location}
                          </div>
                        )}
                      </div>

                      {m.time && (
                        <div className="shrink-0 self-center font-mono text-[15px] text-sky-300">
                          {formatTimeLabel(m.time)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hover veil + centered actions (keep your existing version if you already have it) */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
                    <div className="relative z-10 flex gap-3">
                      <button
                        type="button"
                        className="pointer-events-auto rounded-full border border-slate-500 bg-slate-900 px-3 py-1 text-[11px] text-slate-100 hover:bg-slate-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReschedule(m);
                        }}
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        className="pointer-events-auto rounded-full border border-rose-500/70 bg-rose-500/15 px-3 py-1 text-[11px] text-rose-100 hover:bg-rose-500/40"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel(m.id);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <MeetingsOverviewDialog
        open={showOverview}
        onClose={() => setShowOverview(false)}
        anchorDateIso={selectedDate}
      />

      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </aside>
  );
}
