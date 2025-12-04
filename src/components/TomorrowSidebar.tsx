"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectBrief, Session, ProjectId } from "@/lib/types";
import {
  addToLocalTomorrowArchive,
  collectNextMoveTasksFromSessions,
  extractTomorrowTasks,
  getTomorrowTaskHours,
  removeTomorrowTask,
  removeTomorrowTaskHours,
  setTomorrowTaskHours,
} from "@/lib/tomorrow";
import { Plus } from "lucide-react";

const QUICK_TOMORROW_KEY = "tessera:tomorrowQuickTasks";

type QuickTasksMap = Record<ProjectId, string[]>;

function loadQuickTasks(): QuickTasksMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(QUICK_TOMORROW_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as QuickTasksMap;
    if (parsed && typeof parsed === "object") return parsed;
    return {};
  } catch {
    return {};
  }
}

function saveQuickTasks(map: QuickTasksMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUICK_TOMORROW_KEY, JSON.stringify(map));
}

export function TomorrowSidebar({
  projectId,
  brief,
  lastSession,
  completed,
  onToggle,
  sessions,
}: {
  projectId: ProjectId;
  brief: ProjectBrief | null;
  lastSession?: Session | null;
  completed: string[];
  onToggle: (task: string) => void;
  sessions?: Session[];
}) {
  const workPlan = brief?.workPlan ?? "";
  const [tab, setTab] = useState<"tomorrow" | "archive">("tomorrow");

  // Quick ad-hoc tasks for this project
  const [quickTasks, setQuickTasks] = useState<string[]>([]);
  const [quickInput, setQuickInput] = useState("");

  // Per-task estimated hours for this project (by task label)
  const [hoursByTask, setHoursByTask] = useState<Record<string, number>>({});

  useEffect(() => {
    // Load hours whenever project changes
    setHoursByTask(getTomorrowTaskHours(projectId));
  }, [projectId]);

  const handleHoursChange = (task: string, raw: number | string) => {
    const n =
      typeof raw === "number" ? raw : Number((raw as string).trim() || "0");
    if (Number.isNaN(n) || n < 0) return;

    const next = setTomorrowTaskHours(projectId, task, n);
    setHoursByTask(next);
  };

  useEffect(() => {
    const all = loadQuickTasks();
    setQuickTasks(all[projectId] ?? []);
  }, [projectId]);

  const setQuickTasksForProject = (next: string[]) => {
    setQuickTasks(next);
    const all = loadQuickTasks();
    all[projectId] = next;
    saveQuickTasks(all);
  };

  const addQuickTask = () => {
    const text = quickInput.trim();
    if (!text) return;
    if (quickTasks.includes(text)) {
      setQuickInput("");
      return;
    }
    const next = [...quickTasks, text];
    setQuickTasksForProject(next);
    setQuickInput("");
  };

  const removeQuickTask = (task: string) => {
    const next = quickTasks.filter((t) => t !== task);
    setQuickTasksForProject(next);
    removeTomorrowTaskHours(projectId, task);
  };

  const tomorrowFromBrief = useMemo(
    () => extractTomorrowTasks(workPlan),
    [workPlan]
  );

  const { active: activeNextMoves, archived: archivedNextMoves } =
    useMemo(() => {
      // Preferred: accumulator across all sessions
      if (sessions && sessions.length > 0) {
        return collectNextMoveTasksFromSessions(sessions);
      }

      // Fallback: legacy behavior when we only have lastSession
      if (!lastSession) {
        return { active: [] as string[], archived: [] as string[] };
      }

      const raw: any = (lastSession as any).nextMoves;
      const active = (() => {
        if (!raw) return [];
        if (Array.isArray(raw)) {
          return raw.map((m) => String(m).trim()).filter(Boolean);
        }
        if (typeof raw === "string") {
          return raw
            .split("\n")
            .map((m) => m.trim())
            .filter(Boolean);
        }
        return [];
      })();

      return { active, archived: [] as string[] };
    }, [sessions, lastSession]);

  const archivedSet = useMemo(
    () => new Set(archivedNextMoves),
    [archivedNextMoves]
  );

  const briefActiveTasks = useMemo(
    () => tomorrowFromBrief.filter((t) => !archivedSet.has(t)),
    [tomorrowFromBrief, archivedSet]
  );

  const hasBriefTasks = briefActiveTasks.length > 0;
  const hasNextMoves = activeNextMoves.length > 0;
  const hasQuickTasks = quickTasks.length > 0;
  const isEmpty = !hasBriefTasks && !hasNextMoves && !hasQuickTasks;

  const tomorrowLabel = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            Tomorrow&apos;s focus
          </h2>
          <div className="mt-3 flex items-center gap-2">
            <div className="inline-flex rounded-full bg-slate-950/70 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setTab("tomorrow")}
                className={
                  "px-2.5 py-1 rounded-full transition-colors " +
                  (tab === "tomorrow"
                    ? "bg-emerald-500/20 text-emerald-100"
                    : "text-slate-400")
                }
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setTab("archive")}
                className={
                  "px-2.5 py-1 rounded-full transition-colors " +
                  (tab === "archive"
                    ? "bg-slate-700/60 text-slate-100"
                    : "text-slate-400")
                }
              >
                Archived
              </button>
            </div>
          </div>
        </div>
        <span className="rounded-full border border-slate-600 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300">
          {tomorrowLabel}
        </span>
      </div>

      {/* Quick-add input (meeting notes → tomorrow tasks) */}
      {tab === "tomorrow" && (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addQuickTask();
          }}
        >
          <input
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            className="flex-1 rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-500"
            placeholder="Add quick task for tomorrow…"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </form>
      )}

      {tab === "tomorrow" && isEmpty && (
        <p className="mt-3 text-xs text-slate-500">
          No &quot;Tomorrow&apos;s work plan&quot; section, session next moves,
          or quick tasks yet. You can add quick tasks above or log a session.
        </p>
      )}

      {tab === "tomorrow" && !isEmpty && (
        <div className="mt-3 space-y-3 text-xs">
          {/* From Arden brief */}
          {hasBriefTasks && (
            <section>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                From Arden brief
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {briefActiveTasks.map((task) => {
                  const isDone = completed.includes(task);
                  const currentHours = hoursByTask[task] ?? 0.5;

                  return (
                    <TomorrowTaskRow
                      key={task}
                      projectId={projectId}
                      task={task}
                      isDone={isDone}
                      currentHours={currentHours}
                      onToggleDone={() => {
                        if (!isDone) {
                          // First click → mark as done
                          onToggle(task);
                          return;
                        }

                        // Second click ("Done?") → archive + clean up
                        onToggle(task);
                        addToLocalTomorrowArchive(projectId, task);
                        removeTomorrowTask(projectId, task);
                        removeTomorrowTaskHours(projectId, task);
                      }}
                      onHoursChange={(h) => {
                        if (h <= 0) {
                          if (!isDone) {
                            onToggle(task);
                          }
                          handleHoursChange(task, 0);
                          return;
                        }
                        handleHoursChange(task, h);
                      }}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* From session next moves */}
          {hasNextMoves && (
            <section>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                From session next moves
              </div>
              <div className="mt-1 flex flex-col gap-2">
                {activeNextMoves.map((task) => {
                  const isDone = completed.includes(task);
                  const currentHours = hoursByTask[task] ?? 0.5;

                  return (
                    <TomorrowTaskRow
                      key={task}
                      projectId={projectId}
                      task={task}
                      isDone={isDone}
                      currentHours={currentHours}
                      onToggleDone={() => {
                        if (!isDone) {
                          // First click → mark as done
                          onToggle(task);
                          return;
                        }

                        // Second click ("Done?") → archive + clean up
                        onToggle(task);
                        addToLocalTomorrowArchive(projectId, task);
                        removeTomorrowTask(projectId, task);
                        removeTomorrowTaskHours(projectId, task);
                      }}
                      onHoursChange={(h) => {
                        if (h <= 0) {
                          if (!isDone) {
                            onToggle(task);
                          }
                          handleHoursChange(task, 0);
                          return;
                        }
                        handleHoursChange(task, h);
                      }}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {/* Quick notes */}
          {hasQuickTasks && (
            <section>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                Quick notes
              </div>
              <div className="mt-1 flex flex-col gap-2">
                {quickTasks.map((task) => {
                  const isDone = completed.includes(task);
                  const currentHours = hoursByTask[task] ?? 0.5;

                  return (
                    <TomorrowTaskRow
                      key={task}
                      projectId={projectId}
                      task={task}
                      isDone={isDone}
                      currentHours={currentHours}
                      onToggleDone={() => {
                        if (!isDone) {
                          // First click → mark as done
                          onToggle(task);
                          return;
                        }

                        // Second click ("Done?") → archive + clean up
                        onToggle(task);
                        addToLocalTomorrowArchive(projectId, task);
                        removeTomorrowTask(projectId, task);
                        removeTomorrowTaskHours(projectId, task);
                      }}
                      onHoursChange={(h) => {
                        if (h <= 0) {
                          if (!isDone) {
                            onToggle(task);
                          }
                          handleHoursChange(task, 0);
                          return;
                        }
                        handleHoursChange(task, h);
                      }}
                    />
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === "archive" && (
        <div className="mt-3 space-y-2 text-xs">
          {archivedNextMoves.length === 0 ? (
            <p className="text-slate-500">
              No archived tasks yet. Mark items complete and save your session
              to see them here.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {archivedNextMoves.map((task, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-[11px] text-slate-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                  <span className="line-clamp-2">{task}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TomorrowTaskRow({
  projectId,
  task,
  isDone,
  onToggleDone,
  currentHours,
  onHoursChange,
}: {
  projectId: ProjectId;
  task: string;
  isDone: boolean;
  onToggleDone: () => void;
  currentHours: number;
  onHoursChange: (n: number) => void;
}) {
  return (
    <div
      className={
        "flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] " +
        (isDone
          ? "border-emerald-400 bg-emerald-500/15 text-emerald-100"
          : "border-slate-600 bg-slate-950/70 text-slate-100")
      }
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={onToggleDone}
        className="flex items-center gap-1"
      >
        <span
          className={
            "h-1.5 w-1.5 rounded-full " +
            (isDone ? "bg-emerald-400" : "bg-emerald-300")
          }
        />
        <span
          className={
            "line-clamp-2 text-left " +
            (isDone ? "line-through opacity-80" : "")
          }
        >
          {task}
        </span>
      </button>

      {/* Hours slider */}
      {!isDone && (
        <input
          type="range"
          min={0}
          max={6}
          step={0.5}
          value={currentHours}
          onChange={(e) => {
            const num = Number(e.target.value);
            onHoursChange(num);
          }}
          className="w-20 accent-emerald-500"
        />
      )}

      {/* Hours label */}
      {!isDone && (
        <span className="text-[10px] text-slate-400 w-8 text-right">
          {currentHours.toFixed(1)}h
        </span>
      )}

      {/* Done? button */}
      {isDone && (
        <button
          type="button"
          onClick={onToggleDone}
          className="ml-2 text-[10px] text-emerald-300 hover:text-emerald-200"
        >
          Done?
        </button>
      )}
    </div>
  );
}
