// app/planner/StepConfigure.tsx
"use client";

import { useState } from "react";
import type { DayConfig, StepConfigureProps } from "./types";

const MINUTES_IN_DAY = 24 * 60;

export default function StepConfigure({
  days,
  onChange,
  totalWeeklyHoursNeeded,
  totalAvailableHours,
  capacityDelta,
  defaultStartMinutes,
  defaultEndMinutes,
  onChangeDefaults,
}: StepConfigureProps) {
  const [showInactive, setShowInactive] = useState(false);
  const overCapacity = capacityDelta < 0;

  const activeDays = days.filter((d) => d.active);
  const activeDaysCount = activeDays.length;

  const defaultDailyHours = Math.max(
    0,
    (defaultEndMinutes - defaultStartMinutes) / 60
  );
  const baseWeeklyHours = defaultDailyHours * activeDaysCount;

  const visibleDays = showInactive ? days : activeDays;

  const updateDay = (id: number, updater: (day: DayConfig) => DayConfig) => {
    const next = days.map((d) => (d.id === id ? updater(d) : d));
    onChange(next);
  };

  const toTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const pad = (x: number) => x.toString().padStart(2, "0");
    return `${pad(h)}:${pad(m)}`;
  };

  const parseTime = (value: string) => {
    const [hStr, mStr] = value.split(":");
    const h = Number(hStr);
    const m = Number(mStr ?? "0");
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const handleDefaultStartChange = (value: string) => {
    const mins = parseTime(value);
    if (mins == null) return;
    const clamped = Math.max(0, Math.min(mins, MINUTES_IN_DAY));
    onChangeDefaults(clamped, defaultEndMinutes);
  };

  const handleDefaultEndChange = (value: string) => {
    const mins = parseTime(value);
    if (mins == null) return;
    let clamped = Math.max(0, Math.min(mins, MINUTES_IN_DAY));
    if (clamped <= defaultStartMinutes) {
      clamped = Math.min(MINUTES_IN_DAY, defaultStartMinutes + 60);
    }
    onChangeDefaults(defaultStartMinutes, clamped);
  };

  const gridClass = showInactive
    ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    : "grid gap-2 grid-cols-1 sm:grid-cols-5";

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-200">
          Step 1: Weekly Configuration
        </h2>
        <p className="text-xs text-slate-400">
          Choose which days you&apos;re working this week and set start / end
          times for each. Adjust the weekly default first, then fine-tune
          individual days as overrides. The green band shows your working hours
          per day.
        </p>
      </div>

      {/* Weekly defaults + high-level breakdown */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-xs text-slate-300">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Defaults on Left */}
          <div>
            <span className="text-[15px] font-semibold text-slate-200">
              Weekly default
            </span>
            <p className="text-[13px] text-slate-400">
              Applied to all non-custom days.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[13px] text-slate-400">
                  Default start
                </span>
                <input
                  type="time"
                  value={toTime(defaultStartMinutes)}
                  onChange={(e) => handleDefaultStartChange(e.target.value)}
                  className="mt-0.5 w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[14px] text-slate-100"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] text-slate-400">Default end</span>
                <input
                  type="time"
                  value={toTime(defaultEndMinutes)}
                  onChange={(e) => handleDefaultEndChange(e.target.value)}
                  className="mt-0.5 w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[14px] text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Breakdown on the right */}
          <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-[14px] text-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 mr-4">Active days</span>
              <span className="font-semibold">
                {activeDaysCount} day{activeDaysCount === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Hours per day</span>
              <span className="font-semibold">
                {defaultDailyHours.toFixed(1)}h
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Weekly hours</span>
              <span className="font-semibold">
                {baseWeeklyHours.toFixed(1)}h
              </span>
            </div>
            <div className="mt-1 border-t border-slate-800 pt-1 flex items-center justify-between">
              <span className="text-slate-500">Current </span>
              <span className="font-semibold">
                {totalAvailableHours.toFixed(1)}h
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle + per-day grid */}
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>Per-day configuration</span>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-slate-300 focus:ring-slate-500"
          />
          <span>Show inactive days</span>
        </label>
      </div>

      {/* Per-day grid */}
      <div className="flex flex-wrap gap-2">
        {visibleDays.map((day) => {
          const spanMinutes = Math.max(
            0,
            Math.min(day.endMinutes, MINUTES_IN_DAY) -
              Math.max(0, day.startMinutes)
          );
          const hours = spanMinutes / 60;

          const startPct = Math.max(
            0,
            Math.min(100, (day.startMinutes / MINUTES_IN_DAY) * 100)
          );
          const endPct = Math.max(
            0,
            Math.min(100, (day.endMinutes / MINUTES_IN_DAY) * 100)
          );

          const barStyle = {
            backgroundImage: `linear-gradient(to right,
              rgba(15,23,42,1) 0%,
              rgba(15,23,42,1) ${startPct}%,
              rgba(34,197,94,0.45) ${startPct}%,
              rgba(34,197,94,0.45) ${endPct}%,
              rgba(15,23,42,1) ${endPct}%,
              rgba(15,23,42,1) 100%)`,
          };

          const isCustom = !!day.custom;

          return (
            <div
              key={day.id}
              className={[
                "flex-1 min-w-[180px]",
                "flex flex-col gap-2 rounded-xl border px-2 py-2 text-xs transition",
                day.active
                  ? "border-emerald-500/60 bg-slate-900/80"
                  : "border-slate-800 bg-slate-950/70 opacity-70",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={day.active}
                    onChange={(e) =>
                      updateDay(day.id, (d) => ({
                        ...d,
                        active: e.target.checked,
                      }))
                    }
                    className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-[14px] font-semibold text-slate-100">
                    {day.label}
                  </span>
                </label>
                <span className="text-[11px] text-slate-300">
                  {hours.toFixed(1)}h
                  {isCustom && (
                    <span className="ml-1 text-[10px] text-emerald-400">
                      • custom
                    </span>
                  )}
                </span>
              </div>

              <div
                className="h-2 w-full rounded-full border border-slate-700 bg-slate-900"
                style={barStyle}
              />

              <div className="mt-1 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-slate-400">Start</span>
                  <input
                    type="time"
                    value={toTime(day.startMinutes)}
                    onChange={(e) => {
                      const mins = parseTime(e.target.value);
                      if (mins == null) return;
                      updateDay(day.id, (d) => {
                        let start = Math.max(0, Math.min(mins, MINUTES_IN_DAY));
                        let end = d.endMinutes;
                        if (start >= end) {
                          end = Math.min(MINUTES_IN_DAY, start + 60);
                        }
                        return {
                          ...d,
                          startMinutes: start,
                          endMinutes: end,
                          custom: true,
                        };
                      });
                    }}
                    className="w-24 rounded-md border border-slate-700 bg-slate-900 px-1 py-0.5 text-[14px] text-slate-100"
                    disabled={!day.active}
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-slate-400">End</span>
                  <input
                    type="time"
                    value={toTime(day.endMinutes)}
                    onChange={(e) => {
                      const mins = parseTime(e.target.value);
                      if (mins == null) return;
                      updateDay(day.id, (d) => {
                        let end = Math.max(0, Math.min(mins, MINUTES_IN_DAY));
                        let start = d.startMinutes;
                        if (end <= start) {
                          start = Math.max(0, end - 60);
                        }
                        return {
                          ...d,
                          startMinutes: start,
                          endMinutes: end,
                          custom: true,
                        };
                      });
                    }}
                    className="w-24 rounded-md border border-slate-700 bg-slate-900 px-1 py-0.5 text-[14px] text-slate-100"
                    disabled={!day.active}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/70 px-3 py-2 text-[11px] text-slate-300">
        {overCapacity ? (
          <p className="text-rose-300">
            You&apos;re over capacity by{" "}
            <span className="font-semibold">
              {Math.abs(capacityDelta).toFixed(1)}h
            </span>{" "}
            (needed {totalWeeklyHoursNeeded.toFixed(1)}h, available{" "}
            {totalAvailableHours.toFixed(1)}h). You&apos;ll see overflow in red
            when we generate the detailed calendar.
          </p>
        ) : (
          <p className="text-emerald-300">
            You&apos;re within capacity. Needed{" "}
            <span className="font-semibold">
              {totalWeeklyHoursNeeded.toFixed(1)}h
            </span>
            , available{" "}
            <span className="font-semibold">
              {totalAvailableHours.toFixed(1)}h
            </span>
            . You have{" "}
            <span className="font-semibold">{capacityDelta.toFixed(1)}h</span>{" "}
            of slack.
          </p>
        )}
      </div>
    </section>
  );
}
