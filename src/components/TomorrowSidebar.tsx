// components/TomorrowSidebar.tsx
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

type TaskSource = "brief" | "next" | "quick";

type CombinedTask = {
  label: string;
  source: TaskSource;
};

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

  // Local archive to hide tasks immediately after "Done?"
  const [archivedLabels, setArchivedLabels] = useState<string[]>([]);

  const completedSet = useMemo(() => new Set(completed), [completed]);
  const archivedLabelsSet = useMemo(
    () => new Set(archivedLabels),
    [archivedLabels]
  );

  // Load quick tasks + hours whenever project changes
  useEffect(() => {
    const all = loadQuickTasks();
    setQuickTasks(all[projectId] ?? []);
    setHoursByTask(getTomorrowTaskHours(projectId));
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
      if (sessions && sessions.length > 0) {
        return collectNextMoveTasksFromSessions(sessions);
      }

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

  const archivedSetFromSessions = useMemo(
    () => new Set(archivedNextMoves),
    [archivedNextMoves]
  );

  // Filter brief tasks against the session-based archive
  const briefActiveTasks = useMemo(
    () => tomorrowFromBrief.filter((t) => !archivedSetFromSessions.has(t)),
    [tomorrowFromBrief, archivedSetFromSessions]
  );

  const tomorrowLabel = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, []);

  // Single unified list of tasks (no visible categories), minus locally archived
  const combinedTasks: CombinedTask[] = useMemo(() => {
    const list: CombinedTask[] = [];
    const seen = new Set<string>();

    const pushUnique = (label: string, source: TaskSource) => {
      const trimmed = label.trim();
      if (!trimmed) return;
      if (archivedLabelsSet.has(trimmed)) return; // hide locally-archived
      if (seen.has(trimmed)) return;
      seen.add(trimmed);
      list.push({ label: trimmed, source });
    };

    briefActiveTasks.forEach((t) => pushUnique(t, "brief"));
    activeNextMoves.forEach((t) => pushUnique(t, "next"));
    quickTasks.forEach((t) => pushUnique(t, "quick"));

    return list;
  }, [briefActiveTasks, activeNextMoves, quickTasks, archivedLabelsSet]);

  const isEmpty = combinedTasks.length === 0;

  // All active task labels (used to seed 0.5h)
  const allActiveTaskLabels = useMemo(
    () =>
      combinedTasks
        .map((t) => t.label)
        .filter((label) => !completedSet.has(label)),
    [combinedTasks, completedSet]
  );

  // Seed hours for any active task that doesn't have an entry yet (default 0.5h)
  useEffect(() => {
    if (allActiveTaskLabels.length === 0) return;

    setHoursByTask((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const raw of allActiveTaskLabels) {
        const label = raw.trim();
        if (!label) continue;
        if (next[label] === undefined) {
          next[label] = 0.5;
          setTomorrowTaskHours(projectId, label, 0.5);
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [projectId, allActiveTaskLabels]);

  // Slider behavior: adjust hours + auto-mark/unmark when crossing 0
  const handleHoursChange = (task: string, newHours: number) => {
    if (Number.isNaN(newHours) || newHours < 0) return;

    const prevHours = hoursByTask[task] ?? 0.5;
    const nextHours = newHours;

    // Slider moves to 0 from >0 → mark as done (strike + "Done?")
    if (prevHours > 0 && nextHours <= 0 && !completedSet.has(task)) {
      onToggle(task);
    }

    // Slider moves back above 0 while currently marked done → unmark
    if (prevHours <= 0 && nextHours > 0 && completedSet.has(task)) {
      onToggle(task);
    }

    setHoursByTask((prev) => {
      const next = { ...prev };
      if (nextHours <= 0) {
        delete next[task];
        removeTomorrowTaskHours(projectId, task);
      } else {
        next[task] = nextHours;
        setTomorrowTaskHours(projectId, task, nextHours);
      }
      return next;
    });
  };

  // Confirm archive for a task (clicking "Done?")
  const confirmArchive = (task: CombinedTask) => {
    const label = task.label;

    // 1) Remove from parent's completed set (so it doesn't stay "done" forever)
    if (completedSet.has(label)) {
      onToggle(label);
    }

    // 2) Hide locally from Tomorrow list
    setArchivedLabels((prev) =>
      prev.includes(label) ? prev : [...prev, label]
    );

    // 3) Persist archive + cleanup
    addToLocalTomorrowArchive(projectId, label);
    removeTomorrowTask(projectId, label);
    removeTomorrowTaskHours(projectId, label);

    if (task.source === "quick") {
      removeQuickTask(label);
    }
  };

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

      {/* Quick-add input */}
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
          No tasks for tomorrow yet. Add quick tasks above or log a session to
          create next moves.
        </p>
      )}

      {tab === "tomorrow" && !isEmpty && (
        <div className="mt-3 space-y-2 text-xs">
          {combinedTasks.map((task) => {
            const label = task.label;
            const isMarkedDone = completedSet.has(label);
            const currentHours = hoursByTask[label] ?? 0.5;

            return (
              <TomorrowTaskRow
                key={label}
                task={label}
                isMarkedDone={isMarkedDone}
                currentHours={currentHours}
                onLabelToggle={() => {
                  if (isMarkedDone) {
                    // UNMARK: hide "Done?" and restore default 0.5h if we were at 0
                    onToggle(label);

                    setHoursByTask((prev) => {
                      const prevHours = prev[label] ?? 0;
                      const nextHours = prevHours > 0 ? prevHours : 0.5;
                      const next = { ...prev, [label]: nextHours };
                      setTomorrowTaskHours(projectId, label, nextHours);
                      return next;
                    });
                  } else {
                    // MARK DONE: strike-through + show "Done?"
                    onToggle(label);
                  }
                }}
                onConfirmDone={() => {
                  confirmArchive(task);
                }}
                onHoursChange={(h) => {
                  handleHoursChange(label, h);
                }}
              />
            );
          })}
        </div>
      )}

      {tab === "archive" && (
        <div className="mt-3 space-y-2 text-xs">
          {archivedNextMoves.length === 0 && archivedLabels.length === 0 ? (
            <p className="text-slate-500">
              No archived tasks yet. Mark items complete and confirm to send
              them here.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {archivedNextMoves.map((task, i) => (
                <span
                  key={`sess-${i}`}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-[11px] text-slate-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                  <span className="line-clamp-2">{task}</span>
                </span>
              ))}
              {archivedLabels.map((task, i) => (
                <span
                  key={`local-${i}`}
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
  task,
  isMarkedDone,
  currentHours,
  onLabelToggle,
  onConfirmDone,
  onHoursChange,
}: {
  task: string;
  isMarkedDone: boolean;
  currentHours: number;
  onLabelToggle: () => void;
  onConfirmDone: () => void;
  onHoursChange: (n: number) => void;
}) {
  return (
    <div
      className={
        "flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] " +
        (isMarkedDone
          ? "border-emerald-400 bg-emerald-500/15 text-emerald-100"
          : "border-slate-600 bg-slate-950/70 text-slate-100")
      }
    >
      {/* Label / toggle */}
      <button
        type="button"
        onClick={onLabelToggle}
        className="flex flex-1 items-center gap-1"
      >
        <span
          className={
            "h-1.5 w-1.5 rounded-full " +
            (isMarkedDone ? "bg-emerald-400" : "bg-emerald-300")
          }
        />
        <span
          className={
            "line-clamp-2 text-left " +
            (isMarkedDone ? "line-through opacity-80" : "")
          }
        >
          {task}
        </span>
      </button>

      {/* Hours slider */}
      {!isMarkedDone && (
        <>
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
          <span className="w-8 text-right text-[10px] text-slate-400">
            {currentHours.toFixed(1)}h
          </span>
        </>
      )}

      {/* Done? confirmation */}
      {isMarkedDone && (
        <button
          type="button"
          onClick={onConfirmDone}
          className="ml-2 text-[10px] text-emerald-300 hover:text-emerald-200"
        >
          Done?
        </button>
      )}
    </div>
  );
}
