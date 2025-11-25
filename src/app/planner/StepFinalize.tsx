// app/planner/StepFinalize.tsx
"use client";

import type { WeeklyPlannerTask } from "@/lib/weeklyPlanner";
import type { DayConfig, PlannerPriorityRow } from "./types";

type Props = {
  tasks: WeeklyPlannerTask[];
  days: DayConfig[];
  totalAvailableHours: number;
  priorities: PlannerPriorityRow[];
};

export default function StepFinalize({
  tasks,
  days,
  totalAvailableHours,
  priorities,
}: Props) {
  const byId = new Map(tasks.map((t) => [t.projectId, t]));

  const effective = priorities
    .map((row) => {
      const base = byId.get(row.projectId);
      if (!base) return null;
      return {
        projectId: row.projectId,
        projectName: base.projectName,
        companyName: base.companyName,
        included: row.enabled,
        weeklyHours: row.weeklyHours,
      };
    })
    .filter(Boolean) as {
    projectId: string;
    projectName: string;
    companyName?: string;
    included: boolean;
    weeklyHours: number;
  }[];

  const includedProjects = effective.filter((p) => p.included);
  const totalPlannedHours = includedProjects.reduce(
    (sum, p) => sum + p.weeklyHours,
    0
  );
  const delta = totalAvailableHours - totalPlannedHours;
  const overCapacity = delta < 0;

  const activeDays = days.filter((d) => d.active);
  const totalActiveHours = activeDays.reduce((sum, d) => {
    const minutes = Math.max(0, d.endMinutes - d.startMinutes);
    return sum + minutes / 60;
  }, 0);
  const avgPerDay = activeDays.length
    ? totalPlannedHours / activeDays.length
    : 0;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-200">
          Step 3: Finalize Weekly Plan
        </h2>
        <p className="text-xs text-slate-400">
          This summary uses your configured week (Step 1) and priorities & hours
          (Step 2). We&apos;ll use this as the basis for slicing work into
          specific day blocks and highlighting overloads.
        </p>
      </div>

      {/* Capacity summary */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-xs text-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] text-slate-400">
              Total available hours (from your weekly config)
            </div>
            <div className="text-lg font-semibold">
              {totalAvailableHours.toFixed(1)}h
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Across {activeDays.length} active day
              {activeDays.length === 1 ? "" : "s"} (
              {totalActiveHours.toFixed(1)}h of configured work time)
            </div>
          </div>

          <div className="sm:text-right">
            <div className="text-[11px] text-slate-400">
              Planned project hours (from priorities)
            </div>
            <div className="text-lg font-semibold">
              {totalPlannedHours.toFixed(1)}h
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Average {avgPerDay.toFixed(1)}h per active day
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/80 px-3 py-2 text-[11px]">
          {overCapacity ? (
            <p className="text-rose-300">
              You are{" "}
              <span className="font-semibold">
                {Math.abs(delta).toFixed(1)}h
              </span>{" "}
              <span>over capacity this week.</span>{" "}
              <span className="text-rose-200">
                Either reduce project hours, skip a project, or expand your day
                windows.
              </span>
            </p>
          ) : (
            <p className="text-emerald-300">
              You are within capacity, with{" "}
              <span className="font-semibold">{delta.toFixed(1)}h</span> of
              slack time available.
            </p>
          )}
        </div>
      </div>

      {/* Project breakdown */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-200">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[12px] font-semibold text-slate-100">
            Projects in this week
          </h3>
          <span className="text-[11px] text-slate-400">
            {includedProjects.length} included / {effective.length} total
          </span>
        </div>

        {effective.length === 0 ? (
          <p className="text-[11px] text-slate-400">
            No projects configured. Go back to Focus & Priority to set up your
            week.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-1 text-left text-[11px]">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-1">Project</th>
                  <th className="px-2 py-1 hidden sm:table-cell">Company</th>
                  <th className="px-2 py-1 text-right">Hours</th>
                  <th className="px-2 py-1 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {effective.map((p) => {
                  const isIncluded = p.included;
                  const tone = isIncluded
                    ? "text-emerald-300 bg-emerald-500/5 border-emerald-500/40"
                    : "text-slate-400 bg-slate-800/40 border-slate-700/70";

                  return (
                    <tr key={p.projectId}>
                      <td className="px-2 py-1 align-top">
                        <div className="font-semibold text-slate-100">
                          {p.projectName}
                        </div>
                        {p.companyName && (
                          <div className="text-[10px] text-slate-400">
                            {p.companyName}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1 align-top hidden sm:table-cell text-slate-400">
                        {p.companyName ?? "—"}
                      </td>
                      <td className="px-2 py-1 align-top text-right text-slate-100">
                        {p.weeklyHours.toFixed(1)}h
                      </td>
                      <td className="px-2 py-1 align-top text-right">
                        <span
                          className={[
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]",
                            tone,
                          ].join(" ")}
                        >
                          {isIncluded ? "Included" : "Skipped"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Placeholder for future calendar layout */}
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-3 py-3 text-[11px] text-slate-400">
        This is where we&apos;ll render the actual per-day schedule heatmap
        next: dividing these hours across your active days, showing overflow
        blocks in red, and letting you tweak start/end times until everything
        fits.
      </div>
    </section>
  );
}
