"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildDummyProjects,
  buildWeeklyTasks,
  type DummyScenario,
} from "@/lib/weeklyPlanner";
import StepConfigure from "./StepConfigure";
import StepPrioritize from "./StepPrioritize";
import StepFinalize from "./StepFinalize";
import { DayConfig, PlannerPriorityRow, PlannerStep } from "./types";
import {
  getCurrentWeekMondayIso,
  makeDefaultDays,
  scenarioLabels,
  stepLabel,
  stepOrder,
} from "./helpers";

export default function WeeklyPlannerClient() {
  const [scenario, setScenario] = useState<DummyScenario>("normal");
  const [step, setStep] = useState<PlannerStep>("configure");
  const [days, setDays] = useState<DayConfig[]>(() => makeDefaultDays());
  const [defaultStartMinutes, setDefaultStartMinutes] = useState(9 * 60);
  const [defaultEndMinutes, setDefaultEndMinutes] = useState(17 * 60);
  const weekStartIso = getCurrentWeekMondayIso();
  const [manualOrder, setManualOrder] = useState<string[] | null>(null);
  const [priorities, setPriorities] = useState<PlannerPriorityRow[]>([]);

  const { baseTasks, totalWeeklyHoursNeeded } = useMemo(() => {
    const projects = buildDummyProjects(weekStartIso, scenario);
    const baseTasks = buildWeeklyTasks(projects, weekStartIso);
    const totalWeeklyHoursNeeded = baseTasks.reduce(
      (sum, t) => sum + t.weeklyHoursNeeded,
      0
    );
    return { baseTasks, totalWeeklyHoursNeeded };
  }, [scenario, weekStartIso]);

  // Apply manual order if present
  const tasks = useMemo(() => {
    if (!manualOrder) return baseTasks;
    const byId = new Map(baseTasks.map((t) => [t.projectId, t]));
    const ordered = manualOrder
      .map((id) => byId.get(id))
      .filter(Boolean) as typeof baseTasks;
    // include any new tasks not in manualOrder
    const remaining = baseTasks.filter(
      (t) => !manualOrder.includes(t.projectId)
    );
    return [...ordered, ...remaining];
  }, [baseTasks, manualOrder]);

  // Reset manual order whenever scenario or week changes
  // (so dragging doesn't carry across very different sets)
  useEffect(() => {
    setManualOrder(null);
  }, [scenario, weekStartIso]);

  const totalAvailableHours = useMemo(
    () =>
      days.reduce((sum, d) => {
        if (!d.active) return sum;
        const hours = Math.max(0, (d.endMinutes - d.startMinutes) / 60);
        return sum + hours;
      }, 0),
    [days]
  );

  const capacityDelta = totalAvailableHours - totalWeeklyHoursNeeded;
  const overCapacity = capacityDelta < 0;

  const weekStartDate = new Date(weekStartIso);
  const weekEndDate = new Date(weekStartIso);
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  const currentStepIndex = stepOrder.indexOf(step);

  const goNext = () => {
    if (currentStepIndex < stepOrder.length - 1) {
      setStep(stepOrder[currentStepIndex + 1]);
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setStep(stepOrder[currentStepIndex - 1]);
    }
  };

  function handleDefaultsChange(nextStart: number, nextEnd: number) {
    setDefaultStartMinutes(nextStart);
    setDefaultEndMinutes(nextEnd);

    setDays((prev) =>
      prev.map((d) => {
        if (d.custom) return d; // keep overrides
        return {
          ...d,
          startMinutes: nextStart,
          endMinutes: nextEnd,
        };
      })
    );
  }

  const effectiveWeeklyHours = priorities
    .filter((p) => p.enabled)
    .reduce((sum, p) => sum + p.weeklyHours, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            Weekly Planner
          </h1>
          <p className="text-sm text-slate-400">
            Week of{" "}
            <span className="font-medium text-slate-200">
              {fmt(weekStartDate)}
            </span>{" "}
            –{" "}
            <span className="font-medium text-slate-200">
              {fmt(weekEndDate)}
            </span>
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Scenario
            </span>
            <div className="inline-flex overflow-hidden rounded-full border border-slate-700 bg-slate-900/70">
              {scenarioLabels.map((s) => {
                const active = s.value === scenario;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setScenario(s.value)}
                    className={[
                      "px-3 py-1.5 text-xs font-medium transition",
                      active
                        ? "bg-sky-500 text-slate-900"
                        : "text-slate-300 hover:bg-slate-800",
                    ].join(" ")}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Using dummy data. We&apos;ll wire in real projects later.
          </p>
        </div>
      </header>

      {/* Stepper */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3">
            {stepOrder.map((s, index) => {
              const isActive = s === step;
              const isDone = stepOrder.indexOf(s) < currentStepIndex;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStep(s)}
                  className={[
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    isActive
                      ? "border-sky-500 bg-sky-500/10 text-sky-200"
                      : isDone
                      ? "border-emerald-500/50 bg-emerald-500/5 text-emerald-200"
                      : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                      isActive
                        ? "bg-sky-500 text-slate-900"
                        : isDone
                        ? "bg-emerald-500 text-slate-900"
                        : "bg-slate-800 text-slate-200",
                    ].join(" ")}
                  >
                    {index + 1}
                  </span>
                  <span>{stepLabel(s)}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span className="rounded-full bg-slate-900/80 px-2 py-0.5">
              Hours needed:{" "}
              <span className="font-semibold text-slate-200">
                {effectiveWeeklyHours.toFixed(1)}h
              </span>
            </span>
            <span className="rounded-full bg-slate-900/80 px-2 py-0.5">
              Hours available:{" "}
              <span className="font-semibold text-slate-200">
                {totalAvailableHours.toFixed(1)}h
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Step content */}
      {step === "configure" && (
        <StepConfigure
          days={days}
          onChange={setDays}
          totalWeeklyHoursNeeded={totalWeeklyHoursNeeded}
          totalAvailableHours={totalAvailableHours}
          capacityDelta={capacityDelta}
          defaultStartMinutes={defaultStartMinutes}
          defaultEndMinutes={defaultEndMinutes}
          onChangeDefaults={handleDefaultsChange}
        />
      )}

      {step === "prioritize" && (
        <StepPrioritize
          tasks={tasks}
          onReorder={(ids) => setManualOrder(ids)}
          onPrioritiesChange={setPriorities}
        />
      )}

      {step === "finalize" && (
        <StepFinalize
          tasks={tasks}
          days={days}
          totalAvailableHours={totalAvailableHours}
          priorities={priorities}
        />
      )}

      {/* Wizard navigation */}
      <footer className="flex items-center justify-between border-t border-slate-800 pt-4">
        <button
          type="button"
          onClick={goBack}
          disabled={currentStepIndex === 0}
          className={[
            "rounded-full border px-3 py-1.5 text-xs font-medium transition",
            currentStepIndex === 0
              ? "cursor-not-allowed border-slate-800 text-slate-600"
              : "border-slate-700 text-slate-300 hover:bg-slate-800",
          ].join(" ")}
        >
          Back
        </button>

        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          {step !== "finalize" ? (
            <>
              <span>
                Next:{" "}
                {step === "configure"
                  ? "Focus & Priority"
                  : step === "prioritize"
                  ? "Finalize"
                  : ""}
              </span>
              <button
                type="button"
                onClick={goNext}
                className="rounded-full bg-sky-500 px-4 py-1.5 text-xs font-semibold text-slate-950 shadow-sm hover:bg-sky-400"
              >
                Continue
              </button>
            </>
          ) : (
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-300">
              Planner ready – saving will come when wired to real data.
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}
