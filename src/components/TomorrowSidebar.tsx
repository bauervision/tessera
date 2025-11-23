// components/TomorrowSidebar.tsx
"use client";

import { useMemo, useState } from "react";
import type { ProjectBrief, Session } from "@/lib/types";
import {
  collectNextMoveTasksFromSessions,
  extractTomorrowTasks,
} from "@/lib/tomorrow";

export function TomorrowSidebar({
  brief,
  lastSession,
  completed,
  onToggle,
  sessions,
}: {
  brief: ProjectBrief | null;
  lastSession?: Session | null;
  completed: string[];
  onToggle: (task: string) => void;
  sessions?: Session[];
}) {
  const workPlan = brief?.workPlan ?? "";
  const [tab, setTab] = useState<"tomorrow" | "archive">("tomorrow");
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
  const isEmpty = !hasBriefTasks && !hasNextMoves;

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
          <div className="mt-3 flex justify-between items-center gap-2">
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

      {tab === "tomorrow" && isEmpty && (
        <p className="mt-3 text-xs text-slate-500">
          No &quot;Tomorrow&apos;s work plan&quot; section or next moves yet.
          Add them in the brief or your next session log and they&apos;ll show
          up here.
        </p>
      )}

      {tab === "tomorrow" && !isEmpty && (
        <div className="mt-3 space-y-3 text-xs">
          {hasBriefTasks && (
            <section>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                From Arden brief
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {briefActiveTasks.map((task, i) => {
                  const isDone = completed.includes(task);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onToggle(task)}
                      className={
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors " +
                        (isDone
                          ? "border-emerald-400 bg-emerald-500/15 text-emerald-100"
                          : "border-slate-600 bg-slate-950/70 text-slate-100")
                      }
                    >
                      <span
                        className={
                          "h-1.5 w-1.5 rounded-full " +
                          (isDone ? "bg-emerald-400" : "bg-emerald-300")
                        }
                      />
                      <span
                        className={
                          "line-clamp-2 " +
                          (isDone ? "line-through opacity-80" : "")
                        }
                      >
                        {task}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {hasNextMoves && (
            <section>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                From session next moves
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {activeNextMoves.map((task, i) => {
                  const isDone = completed.includes(task);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onToggle(task)}
                      className={
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors " +
                        (isDone
                          ? "border-emerald-400 bg-emerald-500/15 text-emerald-100"
                          : "border-slate-600 bg-slate-950/70 text-emerald-200")
                      }
                    >
                      <span
                        className={
                          "h-1.5 w-1.5 rounded-full " +
                          (isDone ? "bg-emerald-400" : "bg-emerald-300")
                        }
                      />
                      <span
                        className={
                          "line-clamp-2 " +
                          (isDone ? "line-through opacity-80" : "")
                        }
                      >
                        {task}
                      </span>
                    </button>
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
