// app/planner/ProjectCard.tsx
"use client";

import { useMemo, useState } from "react";
import type { WeeklyPlannerTask } from "@/lib/weeklyPlanner";

export type SubTask = {
  id: string;
  label: string;
  estimatedHours: number;
  included: boolean;
};

type AutoTask = WeeklyPlannerTask["autoTasks"][number];

type ProjectCardProps = {
  task: WeeklyPlannerTask;
  index: number;
  isDragging: boolean;
  enabled: boolean;
  autoTasks: AutoTask[];
  subtasks: SubTask[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleEnabled: () => void;
  onAutoTasksChange: (next: AutoTask[]) => void;
  onSubtasksChange: (next: SubTask[]) => void;
  onDragStart: (e: React.DragEvent<HTMLLIElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLLIElement>) => void;
  onDrop: (e: React.DragEvent<HTMLLIElement>) => void;
  onDragEnd: (e: React.DragEvent<HTMLLIElement>) => void;
};

type CombinedTask =
  | (AutoTask & { source: "auto" })
  | (SubTask & { source: "manual" });

export function ProjectCard({
  task: t,
  index,
  isDragging,
  enabled,
  autoTasks,
  subtasks,
  expanded,
  onToggleExpanded,
  onToggleEnabled,
  onAutoTasksChange,
  onSubtasksChange,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: ProjectCardProps) {
  const [newLabel, setNewLabel] = useState("");
  const [newHours, setNewHours] = useState("");

  const combined: CombinedTask[] = useMemo(
    () => [
      ...autoTasks.map((a) => ({ ...a, source: "auto" as const })),
      ...subtasks.map((m) => ({ ...m, source: "manual" as const })),
    ],
    [autoTasks, subtasks]
  );

  const subtotalSubtaskHours = useMemo(
    () =>
      combined
        .filter((s) => s.included)
        .reduce((sum, s) => sum + s.estimatedHours, 0),
    [combined]
  );

  const updateAutoTask = (id: string, updater: (a: AutoTask) => AutoTask) => {
    onAutoTasksChange(autoTasks.map((a) => (a.id === id ? updater(a) : a)));
  };

  const updateSubtask = (id: string, updater: (s: SubTask) => SubTask) => {
    onSubtasksChange(subtasks.map((s) => (s.id === id ? updater(s) : s)));
  };

  const removeSubtask = (id: string) => {
    onSubtasksChange(subtasks.filter((s) => s.id !== id));
  };

  const handleAddSubtask = () => {
    const label = newLabel.trim();
    if (!label) return;

    const n = newHours.trim() === "" ? 1 : Number(newHours.trim());
    const hours = Number.isNaN(n) || n < 0 ? 1 : n;

    const newSub: SubTask = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      estimatedHours: hours,
      included: true,
    };

    onSubtasksChange([...subtasks, newSub]);
    setNewLabel("");
    setNewHours("");
  };

  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={[
        "rounded-xl border border-slate-800 bg-slate-900/70 p-3 shadow-sm transition",
        "hover:border-sky-500/40 hover:bg-slate-900/90 hover:shadow-md hover:shadow-sky-600/10",
        isDragging ? "opacity-60 ring-1 ring-sky-500" : "",
        !enabled ? "opacity-60" : "",
      ].join(" ")}
    >
      {/* Header row */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpanded();
          }
        }}
        className="flex w-full items-start justify-between gap-3 text-left
                   transition hover:bg-slate-800/40 rounded-lg px-1 py-1"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-200">
            {index + 1}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-semibold text-slate-100">
                {t.projectName}
              </div>
              <span className="cursor-grab text-[10px] text-slate-500">⠿</span>
            </div>
            {t.companyName && (
              <div className="text-xs text-slate-400">{t.companyName}</div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[15px] text-slate-300">
              <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5">
                Priority{" "}
                <span className="ml-1 font-semibold">
                  {t.priorityScore.toFixed(2)}
                </span>
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5">
                Suggested weekly hours{" "}
                <span className="ml-1 font-semibold">
                  {t.weeklyHoursNeeded.toFixed(1)}h
                </span>
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5">
                Milestones:{" "}
                <span className="ml-1 font-semibold">
                  {t.milestones.length}
                </span>
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5">
                Tomorrow tasks:{" "}
                <span className="ml-1 font-semibold">
                  {t.tomorrowTasksCount}
                </span>
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5">
                Meetings:{" "}
                <span className="ml-1 font-semibold">{t.meetings.length}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <label
            className="flex items-center gap-2 text-[11px] text-slate-300"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                e.stopPropagation();
                onToggleEnabled();
              }}
              className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
            />
            <span>{enabled ? "In this week" : "Skip this week"}</span>
          </label>

          <div
            className="flex items-center gap-2 text-[15px] text-slate-300"
            onClick={(e) => e.stopPropagation()}
          >
            <span>Hours this week</span>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 font-semibold text-slate-100">
              {subtotalSubtaskHours.toFixed(1)}h
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded();
            }}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-400"
          >
            <span>{expanded ? "Hide details" : "Show details"}</span>
            <span
              className={[
                "transition-transform",
                expanded ? "rotate-180" : "",
              ].join(" ")}
            >
              ▼
            </span>
          </button>
        </div>
      </div>

      {/* Accordion panel */}
      {expanded && (
        <div className="mt-3 border-t border-slate-800 pt-3 text-[15px] text-slate-300">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-slate-200">
              Tasks for this project
            </span>
            <span className="text-slate-400">
              Included tasks total:{" "}
              <span className="font-semibold">
                {subtotalSubtaskHours.toFixed(1)}h
              </span>
            </span>
          </div>

          {combined.length === 0 ? (
            <p className="mb-2 text-slate-500">
              No tasks yet. Use the form below to add things like &quot;Demo
              prep (2h)&quot;, &quot;Refactor forms (1.5h)&quot; or &quot;Write
              documentation (1h)&quot;.
            </p>
          ) : (
            <ul className="mb-3 space-y-2 ">
              {combined.map((s, i) => (
                <li
                  key={`${s.source}-${s.id} - ${i}`}
                  className=" text-[15px] flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1
                             hover:border-sky-500/30 hover:bg-slate-900 hover:shadow-sm hover:shadow-sky-600/10 transition"
                >
                  <input
                    type="checkbox"
                    checked={s.included}
                    onChange={() => {
                      if (s.source === "auto") {
                        updateAutoTask(s.id, (prev) => ({
                          ...prev,
                          included: !prev.included,
                        }));
                      } else {
                        updateSubtask(s.id, (prev) => ({
                          ...prev,
                          included: !prev.included,
                        }));
                      }
                    }}
                    className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                  />

                  <input
                    type="text"
                    value={s.label}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (s.source === "auto") {
                        updateAutoTask(s.id, (prev) => ({
                          ...prev,
                          label: val,
                        }));
                      } else {
                        updateSubtask(s.id, (prev) => ({
                          ...prev,
                          label: val,
                        }));
                      }
                    }}
                    className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 text-[16px] text-slate-100"
                    placeholder="Task description"
                  />

                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={s.estimatedHours}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isNaN(n) || n < 0) return;

                        if (s.source === "auto") {
                          updateAutoTask(s.id, (prev) => ({
                            ...prev,
                            estimatedHours: n,
                          }));
                        } else {
                          updateSubtask(s.id, (prev) => ({
                            ...prev,
                            estimatedHours: n,
                          }));
                        }
                      }}
                      className="w-14 rounded-md border border-slate-700 bg-slate-950 px-1 py-0.5 text-right text-[11px] text-slate-100"
                    />
                    <span className="text-slate-500">h</span>
                  </div>

                  {s.source === "manual" && (
                    <button
                      type="button"
                      onClick={() => removeSubtask(s.id)}
                      className="ml-1 text-slate-500 hover:text-rose-400"
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Add sub-task */}
          <div
            className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-950/70 px-2 py-2
                          hover:border-sky-500/40 hover:bg-slate-900/80 transition"
          >
            <div className="flex min-w-[180px] flex-1 flex-col">
              <span className="text-[10px] text-slate-400">New task</span>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="mt-0.5 rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 text-[11px] text-slate-100"
                placeholder="e.g. Demo prep"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400">Hours</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={newHours}
                onChange={(e) => setNewHours(e.target.value)}
                className="mt-0.5 w-16 rounded-md border border-slate-700 bg-slate-950 px-1 py-0.5 text-right text-[11px] text-slate-100"
                placeholder="1.0"
              />
            </div>
            <button
              type="button"
              onClick={handleAddSubtask}
              className="ml-auto inline-flex items-center rounded-full bg-sky-500 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-sky-400"
            >
              Add task
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
