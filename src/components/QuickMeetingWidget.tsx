// components/meetings/MeetingsWidget.tsx
"use client";

import { useEffect, useState } from "react";
import {
  addMeeting,
  getUpcomingMeetings,
  loadJobsAndProjects,
} from "@/lib/storage";
import type { Meeting, Job, MeetingRecurrence } from "@/lib/types";
import { DatePicker } from "./ui/DatePicker";

const todayIso = () => new Date().toISOString().slice(0, 10);

type TimeParts = {
  hour12: string; // "1"–"12"
  minute: "00" | "15" | "30" | "45";
  period: "AM" | "PM";
};

function parseTimeToParts(value: string): TimeParts {
  if (!value) {
    // default to next quarter hour from now
    const now = new Date();
    let h = now.getHours();
    let m = now.getMinutes();
    const snapped = Math.round(m / 15) * 15;
    if (snapped === 60) {
      h = (h + 1) % 24;
      m = 0;
    } else {
      m = snapped;
    }

    const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
    let hour12 = h % 12;
    if (hour12 === 0) hour12 = 12;

    const minute = (
      m === 0 ? "00" : m === 15 ? "15" : m === 30 ? "30" : "45"
    ) as "00" | "15" | "30" | "45";

    return { hour12: String(hour12), minute, period };
  }

  const [hStr, mStr] = value.split(":");
  let h = Number(hStr) || 0;
  let m = Number(mStr) || 0;

  // snap minute to nearest quarter
  const snapped = Math.round(m / 15) * 15;
  m = snapped >= 60 ? 45 : snapped;

  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;

  const minute = (m === 0 ? "00" : m === 15 ? "15" : m === 30 ? "30" : "45") as
    | "00"
    | "15"
    | "30"
    | "45";

  return { hour12: String(hour12), minute, period };
}

function partsToTime(parts: TimeParts): string {
  let h = Number(parts.hour12) % 12;
  if (parts.period === "PM") {
    h = (h + 12) % 24;
  }
  const hh = String(h).padStart(2, "0");
  return `${hh}:${parts.minute}`;
}

export function QuickMeetingsWidget() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dateIso, setDateIso] = useState(todayIso);
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [upcoming, setUpcoming] = useState<Meeting[]>([]);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState<string>("");
  const [recurrence, setRecurrence] = useState<MeetingRecurrence>("none");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // load companies (jobs) once
    const { jobs } = loadJobsAndProjects();
    setJobs(jobs);

    const refresh = () => {
      setUpcoming(getUpcomingMeetings());
    };

    // initial load
    refresh();

    window.addEventListener("tessera:meetings-updated", refresh);
    return () => {
      window.removeEventListener("tessera:meetings-updated", refresh);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !jobId) return;

    setSaving(true);

    const meeting = addMeeting({
      title: title.trim(),
      dateIso,
      time: time || null,
      location: location.trim() || null,
      jobId,
      recurrence,
    });

    setTitle("");
    setTime("");
    setLocation("");
    setDateIso(todayIso);
    setJobId("");
    setSaving(false);
    setRecurrence("none");

    // refresh upcoming list
    setUpcoming(getUpcomingMeetings());

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("tessera:meetings-updated"));
    }

    setOpen(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {/* Panel */}
      {open && (
        <div className="w-[320px] rounded-2xl border border-white/15 bg-slate-900/90 p-3 text-xs text-slate-200 shadow-[0_18px_45px_rgba(0,0,0,0.75)] backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold text-slate-50">
                Meetings
              </div>
              <div className="text-[11px] text-slate-400">
                Quick add &amp; see what&apos;s coming.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-slate-600 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          {/* Quick add form */}
          <form
            className="mt-3 space-y-2 border-t border-slate-700/60 pt-3"
            onSubmit={handleSubmit}
          >
            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400">
                Title / purpose
              </label>
              <input
                className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-sky-400"
                placeholder="Design review with WDG"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <label className="block text-[10px] text-slate-400">Date</label>
                <DatePicker value={dateIso} onChange={setDateIso} />
              </div>

              {/* Custom time picker */}
              <div className="w-[150px] space-y-1">
                <label className="block text-[10px] text-slate-400">Time</label>
                {(() => {
                  const parts = parseTimeToParts(time);

                  const update = (patch: Partial<TimeParts>) => {
                    const next = { ...parts, ...patch };
                    setTime(partsToTime(next));
                  };

                  return (
                    <div className="flex gap-1">
                      {/* Hour */}
                      <select
                        className="w-[52px] rounded-md border border-white/10 bg-slate-950/80 px-1 py-1 text-[11px] text-slate-100 outline-none focus:border-sky-400"
                        value={parts.hour12}
                        onChange={(e) => update({ hour12: e.target.value })}
                      >
                        {Array.from({ length: 12 }, (_, i) =>
                          String(i + 1)
                        ).map((h) => (
                          <option key={h} value={h}>
                            {h.padStart(2, "0")}
                          </option>
                        ))}
                      </select>

                      {/* Minutes */}
                      <select
                        className="w-[52px] rounded-md border border-white/10 bg-slate-950/80 px-1 py-1 text-[11px] text-slate-100 outline-none focus:border-sky-400"
                        value={parts.minute}
                        onChange={(e) =>
                          update({
                            minute: e.target.value as TimeParts["minute"],
                          })
                        }
                      >
                        {["00", "15", "30", "45"].map((m) => (
                          <option key={m} value={m}>
                            :{m}
                          </option>
                        ))}
                      </select>

                      {/* AM / PM */}
                      <select
                        className="w-[50px] rounded-md border border-white/10 bg-slate-950/80 px-1 py-1 text-[11px] text-slate-100 outline-none focus:border-sky-400"
                        value={parts.period}
                        onChange={(e) =>
                          update({
                            period: e.target.value as TimeParts["period"],
                          })
                        }
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* NEW: Company dropdown */}
            {/* Company (required) */}
            {jobs.length > 0 && (
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400">
                  Company
                </label>
                <select
                  className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-sky-400"
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                >
                  <option value="" disabled>
                    Select company…
                  </option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Repeats */}
            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400">
                Repeats
              </label>
              <select
                className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-sky-400"
                value={recurrence}
                onChange={(e) =>
                  setRecurrence(e.target.value as MeetingRecurrence)
                }
              >
                <option value="none">Does not repeat</option>
                <option value="weekly">Every week</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Every month</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400">
                Location / link (optional)
              </label>
              <input
                className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-sky-400"
                placeholder="Zoom / Teams / client site..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="mt-1 flex justify-end">
              <button
                type="submit"
                disabled={saving || !title.trim() || !jobId}
                className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save meeting"}
              </button>
            </div>
          </form>

          {/* Upcoming mini-agenda */}
          <div className="mt-3 border-t border-slate-700/60 pt-2">
            <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Upcoming
            </div>
            {upcoming.length === 0 ? (
              <div className="text-[11px] text-slate-500">
                No upcoming meetings logged yet.
              </div>
            ) : (
              <ul className="space-y-1.5 text-[11px]">
                {upcoming.map((m) => {
                  const company = jobs.find((j) => j.id === m.jobId);
                  return (
                    <li
                      key={m.id}
                      className="rounded-lg border border-slate-700/80 bg-slate-950/70 px-2 py-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-100 line-clamp-1">
                          {m.title}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatMeetingDay(m.dateIso)}{" "}
                          {m.time ? `· ${m.time}` : ""}
                        </span>
                      </div>
                      {company && (
                        <div className="mt-0.5 text-[10px] text-slate-400 line-clamp-1">
                          {company.name}
                        </div>
                      )}
                      {m.location && (
                        <div className="mt-0.5 text-[10px] text-slate-500 line-clamp-1">
                          {m.location}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-sky-400/70 bg-sky-500/80 text-slate-950 shadow-[0_12px_35px_rgba(56,189,248,0.55)] hover:bg-sky-400"
      >
        <span className="text-lg leading-none">🗓️</span>
      </button>
    </div>
  );
}

function formatMeetingDay(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
