// components/TomorrowSidebar.tsx
"use client";

import { useMemo } from "react";
import type { ProjectBrief, Session } from "@/lib/types";
import { extractTomorrowTasks } from "@/lib/tomorrow";

export function TomorrowSidebar({
  brief,
  lastSession,
  completed,
  onToggle,
}: {
  brief: ProjectBrief | null;
  lastSession?: Session | null;
  completed: string[];
  onToggle: (task: string) => void;
}) {
  const workPlan = brief?.workPlan ?? "";

  const tomorrowFromBrief = useMemo(
    () => extractTomorrowTasks(workPlan),
    [workPlan]
  );

  const nextMoves: string[] = useMemo(() => {
    if (!lastSession) return [];

    // be tolerant of both string[] and legacy string shapes
    const raw: any = (lastSession as any).nextMoves;
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
  }, [lastSession]);

  const hasBriefTasks = tomorrowFromBrief.length > 0;
  const hasNextMoves = nextMoves.length > 0;
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
          <p className="mt-0.5 text-[11px] text-slate-400">
            Pulled from your brief and last session.
          </p>
        </div>
        <span className="rounded-full border border-slate-600 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300">
          {tomorrowLabel}
        </span>
      </div>

      {isEmpty ? (
        <p className="mt-3 text-xs text-slate-500">
          No &quot;Tomorrow&apos;s work plan&quot; section or next moves yet.
          Add them in the brief or your next session log and they&apos;ll show
          up here.
        </p>
      ) : (
        <div className="mt-3 space-y-3 text-xs">
          {hasBriefTasks && (
            <section>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                From Arden brief
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {tomorrowFromBrief.map((task, i) => {
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
                From last session&apos;s next moves
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {nextMoves.map((task, i) => {
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
    </div>
  );
}
