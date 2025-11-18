// src/app/project/ProjectWorkspaceClient.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { jobsSeed, projectsSeed } from "../../lib/seed";
import { priorityVisual } from "../../lib/ui";
import { getSessionsForProject, addSession } from "../../lib/storage";
import type { Session } from "../../lib/types";
import { useEffect, useState } from "react";

export default function ProjectWorkspaceClient() {
  const params = useSearchParams();
  const id = params.get("id") || "";

  const project = projectsSeed.find((p) => p.id === id);
  const job = project ? jobsSeed.find((j) => j.id === project.jobId) : null;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [whatIDid, setWhatIDid] = useState("");
  const [whereLeftOff, setWhereLeftOff] = useState("");
  const [nextMovesText, setNextMovesText] = useState("");

  useEffect(() => {
    if (!project) return;
    setSessions(getSessionsForProject(project.id));
  }, [project?.id]);

  const lastSession = sessions[0];

  const lastLoggedLabel =
    lastSession &&
    new Date(lastSession.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const pri = project
    ? priorityVisual(project.priority)
    : { icon: "🟢", label: "Low priority" };

  if (!project) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-400">
          No project selected or invalid project id.
        </p>
        <Link
          href="/"
          className="inline-flex items-center text-xs rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-sky-200 hover:bg-sky-500/20"
        >
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/" className="hover:text-sky-300">
          Tessera
        </Link>
        <span className="text-slate-600">/</span>
        {job && (
          <>
            <span>{job.name}</span>
            <span className="text-slate-600">/</span>
          </>
        )}
        <span className="text-slate-200">{project.name}</span>
      </div>

      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.name}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Workspace for this project. Sessions, “Where I left off”, and “Next
            3 moves” will live here.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {job && (
            <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-slate-300">
              {job.label}
            </span>
          )}
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-200">
            Status: {project.status}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/40 bg-slate-800/80 px-3 py-1 text-slate-200">
            <span>{pri.icon}</span>
            <span>{pri.label}</span>
          </span>
        </div>
      </header>

      {/* Layout placeholders (same as before) */}
      <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
        {/* Left: current focus + last session */}
        <div className="space-y-4">
          {/* Current focus / resume */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <h2 className="text-sm font-semibold text-slate-200">
              Current focus
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Use the session log below to capture where you left off and your
              next 3 moves. Tessera will surface the latest here.
            </p>

            <div className="mt-3 text-xs text-slate-300">
              {lastSession ? (
                <>
                  <div className="mb-1">
                    <span className="font-semibold text-slate-100">
                      Last logged:
                    </span>{" "}
                    <span>{lastLoggedLabel}</span>
                  </div>
                  <div className="text-slate-400">
                    <span className="font-semibold text-slate-200">
                      Where you left off:
                    </span>
                    <div className="mt-1 whitespace-pre-wrap">
                      {lastSession.whereLeftOff}
                    </div>
                  </div>
                </>
              ) : (
                <span className="text-slate-500">
                  No sessions logged yet for this project.
                </span>
              )}
            </div>
          </div>

          {/* Log a new session */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <h2 className="text-sm font-semibold text-slate-200">
              Log a new session
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Capture what you did, where you&apos;re leaving things, and up to
              three next moves (one per line).
            </p>

            <form
              className="mt-3 space-y-3 text-xs"
              onSubmit={(e) => {
                e.preventDefault();
                if (!project) return;

                const nextMoves = nextMovesText
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .slice(0, 3);

                const created = addSession({
                  projectId: project.id,
                  whatIDid,
                  whereLeftOff,
                  nextMoves,
                });

                setSessions((prev) => [created, ...prev]);
                setWhatIDid("");
                setWhereLeftOff("");
                setNextMovesText("");
              }}
            >
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-300">
                  What did you work on?
                </label>
                <textarea
                  className="min-h-[60px] w-full rounded-md border border-white/10 bg-slate-950/60 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
                  value={whatIDid}
                  onChange={(e) => setWhatIDid(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-300">
                  Where are you leaving things?
                </label>
                <textarea
                  className="min-h-[60px] w-full rounded-md border border-white/10 bg-slate-950/60 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
                  value={whereLeftOff}
                  onChange={(e) => setWhereLeftOff(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-300">
                  Next 3 moves (one per line)
                </label>
                <textarea
                  className="min-h-[48px] w-full rounded-md border border-white/10 bg-slate-950/60 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
                  value={nextMovesText}
                  onChange={(e) => setNextMovesText(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="mt-1 rounded-full bg-sky-500/90 px-4 py-1.5 text-xs font-medium text-slate-950 hover:bg-sky-400"
              >
                Save session
              </button>
            </form>
          </div>
        </div>

        {/* Right: upcoming sessions / timeline placeholder */}
        <div className="mt-2 space-y-2 text-xs">
          {sessions.length === 0 && (
            <p className="text-slate-500">
              No sessions yet. Once you log work, your recent activity will
              appear here.
            </p>
          )}

          {sessions.slice(0, 5).map((s) => (
            <div
              key={s.id}
              className="rounded-lg border border-white/5 bg-slate-950/40 px-3 py-2"
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  {new Date(s.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-300 line-clamp-3">
                {s.whatIDid || "(no summary)"}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
