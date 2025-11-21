"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import {
  loadJobsAndProjects,
  getSessionsForProject,
  addSession,
  getBriefForProject,
  upsertBriefForProject,
  updateSession,
  updateCustomProject,
} from "@/lib/storage";

import type {
  Job,
  Project,
  Session,
  ProjectBrief,
  Priority,
} from "@/lib/types";

import { Toast, type ToastVariant } from "@/components/ui/Toast";
import { priorityFromLastActivity } from "@/lib/priority";
import { formatRelative, parseBriefFromText, priorityLabel } from "./helpers";
import { DatePicker } from "@/components/ui/DatePicker";
import { TomorrowSidebar } from "@/components/TomorrowSidebar";
import { SavedBrief } from "@/components/SavedBrief";

export default function ProjectWorkspaceClient() {
  const params = useSearchParams();
  const router = useRouter();
  const projectId = params.get("id") || "";

  const [jobs, setJobs] = useState<Job[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  const [whatIDid, setWhatIDid] = useState("");

  const [completedTomorrow, setCompletedTomorrow] = useState<string[]>([]);

  const toggleTomorrowItem = (task: string) => {
    setCompletedTomorrow((prev) => {
      const isCurrentlyDone = prev.includes(task);
      const isNowDone = !isCurrentlyDone;

      const next = isNowDone ? [...prev, task] : prev.filter((t) => t !== task);

      // Keep "What did you work on?" in sync with this one task
      setWhatIDid((prevText) => {
        const lines = prevText.split("\n");
        const trimmedTask = task.trim();

        // Remove any line that exactly equals this task
        const filtered = lines.filter((line) => line.trim() !== trimmedTask);

        if (isNowDone) {
          // We're marking it done → append it at the bottom
          const base = filtered.join("\n").replace(/\s+$/g, "");
          if (!base) return trimmedTask;
          return `${base}\n${trimmedTask}`;
        }

        // We're unchecking it → just return the text without that line
        return filtered.join("\n");
      });

      return next;
    });
  };

  const [whereLeftOff, setWhereLeftOff] = useState("");
  const [nextMovesText, setNextMovesText] = useState("");

  const [sessionDate, setSessionDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [sessionHours, setSessionHours] = useState("");

  const [mainTab, setMainTab] = useState<"focus" | "log" | "brief">("focus");

  const [brief, setBrief] = useState<ProjectBrief | null>(null);
  const [briefTab, setBriefTab] = useState<
    "purpose" | "capabilities" | "workPlan" | "vision" | "checklist"
  >("purpose");
  const [rawPaste, setRawPaste] = useState("");

  const [toast, setToast] = useState<{
    message: string;
    variant?: ToastVariant;
  } | null>(null);

  // ---------------Editing State --------------------//
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editWhat, setEditWhat] = useState("");
  const [editWhere, setEditWhere] = useState("");
  const [editNextMoves, setEditNextMoves] = useState("");
  const [editHours, setEditHours] = useState("");
  const [showEditProjectDialog, setShowEditProjectDialog] = useState(false);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectCode, setEditProjectCode] = useState("");

  const showToast = (message: string, variant: ToastVariant = "success") =>
    setToast({ message, variant });

  useEffect(() => {
    const { jobs, projects } = loadJobsAndProjects();
    setJobs(jobs);
    const proj = projects.find((p) => p.id === projectId) || null;
    setProject(proj);

    if (proj) {
      setSessions(getSessionsForProject(proj.id));
      setBrief(getBriefForProject(proj.id));
    }
  }, [projectId]);

  useEffect(() => {
    if (!project) return;
    setSessions(getSessionsForProject(project.id));
    setBrief(getBriefForProject(project.id));
  }, [project?.id]);

  const job = useMemo(
    () => jobs.find((j) => j.id === project?.jobId),
    [jobs, project?.jobId]
  );

  const lastSession = sessions[0];

  // Use the most recent session if it exists; otherwise fall back to seeded lastActivityAt
  const effectiveLastActivityIso =
    lastSession?.createdAt || project?.lastActivityAt || null;

  const priority: Priority = priorityFromLastActivity(effectiveLastActivityIso);

  if (!project) {
    return (
      <div className="space-y-4 px-6 pb-8 pt-4">
        <div className="text-xs text-slate-400">
          <button
            type="button"
            className="rounded-full border border-slate-600 bg-slate-900 px-3 py-1"
            onClick={() => router.push("/")}
          >
            ← Back to dashboard
          </button>
        </div>
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-4 text-sm text-rose-100">
          Project not found. It may have been removed or the link is invalid.
        </div>
      </div>
    );
  }

  const handleLogSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    const hasContent =
      whatIDid.trim() || whereLeftOff.trim() || nextMovesText.trim();
    if (!hasContent) {
      showToast("Nothing to log yet", "info");
      return;
    }
    const nextMovesArray = nextMovesText
      .split("\n")
      .map((m) => m.trim())
      .filter(Boolean);

    const hours =
      sessionHours.trim() === "" ? undefined : Number(sessionHours.trim());

    addSession(project.id, {
      whatIDid: whatIDid.trim(),
      whereLeftOff: whereLeftOff.trim(),
      nextMoves: nextMovesArray,
      createdAtOverride: sessionDate,
      estimatedHours:
        typeof hours === "number" && !Number.isNaN(hours) ? hours : undefined,
    });

    setWhatIDid("");
    setWhereLeftOff("");
    setNextMovesText("");
    setSessionHours("");
    setSessions(getSessionsForProject(project.id));
    showToast("Session logged", "success");
  };

  return (
    <>
      {/* 3-column page layout */}
      <div className="flex gap-4  pb-8 pt-4">
        {/* LEFT COLUMN: real aside, hugging left edge */}
        <aside className="hidden lg:flex w-[360px] h-[calc(100vh-190px)]">
          <TomorrowSidebar
            brief={brief}
            lastSession={lastSession}
            completed={completedTomorrow}
            onToggle={toggleTomorrowItem}
          />
        </aside>

        {/* CENTER COLUMN: main content, centered */}
        <div className="flex min-w-0 flex-1 justify-center">
          <div className="w-full max-w-5xl space-y-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-full border border-slate-600 bg-slate-900 px-2.5 py-0.5 text-[11px] text-slate-200 hover:bg-slate-800"
              >
                ← Tessera dashboard
              </button>
              <span className="text-slate-600">/</span>
              <span className="text-slate-300">Project workspace</span>
            </div>

            {/* Header */}
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-slate-50">
                  {project.name}
                </h1>

                <button
                  type="button"
                  onClick={() => {
                    setEditProjectName(project.name);
                    setEditProjectCode(project.code || "");
                    setShowEditProjectDialog(true);
                  }}
                  className="rounded-full border border-slate-500/40 bg-slate-900 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                >
                  Edit project
                </button>
              </div>

              <div className="flex flex-col items-end gap-2 text-right text-xs">
                <span className="rounded-full border border-sky-500/50 bg-sky-500/15 px-3 py-1 text-[11px] text-sky-100">
                  {priorityLabel(priority)}
                </span>
                {lastSession && (
                  <p className="text-[11px] text-slate-400">
                    Last touched:{" "}
                    <span className="text-slate-100">
                      {formatRelative(effectiveLastActivityIso)}
                    </span>
                  </p>
                )}
              </div>
            </header>

            {/* Tabs + content */}
            <div className="flex flex-col gap-3">
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setMainTab("focus")}
                  className={`rounded-full px-3 py-1 ${
                    mainTab === "focus"
                      ? "bg-sky-500 text-slate-950"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  Focus &amp; sessions
                </button>

                <button
                  type="button"
                  onClick={() => setMainTab("log")}
                  className={`rounded-full px-3 py-1 ${
                    mainTab === "log"
                      ? "bg-sky-500 text-slate-950"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  Log a new session
                </button>

                <button
                  type="button"
                  onClick={() => setMainTab("brief")}
                  className={`rounded-full px-3 py-1 ${
                    mainTab === "brief"
                      ? "bg-sky-500 text-slate-950"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  Project brief
                </button>
              </div>

              {mainTab === "focus" ? (
                // Focus & sessions tab: current focus + recent sessions
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                  {/* Current focus (left) */}
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                    <h2 className="text-sm font-semibold text-slate-100">
                      Current focus
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      Use this as your re-entry point for the next session.
                    </p>
                    {lastSession ? (
                      <div className="mt-3 space-y-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-100">
                            Last session summary
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(lastSession.createdAt).toLocaleString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                        </div>
                        {lastSession.whatIDid && (
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                              What you worked on
                            </div>
                            <p className="whitespace-pre-wrap text-slate-100">
                              {lastSession.whatIDid}
                            </p>
                          </div>
                        )}
                        {lastSession.whereLeftOff && (
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                              Where you left off
                            </div>
                            <p className="whitespace-pre-wrap text-slate-100">
                              {lastSession.whereLeftOff}
                            </p>
                          </div>
                        )}
                        {lastSession.nextMoves && (
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                              Next 3 moves
                            </div>
                            <p className="whitespace-pre-wrap text-emerald-200">
                              {Array.isArray(lastSession.nextMoves)
                                ? lastSession.nextMoves.join("\n")
                                : lastSession.nextMoves}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">
                        No sessions logged yet. Start by logging what you want
                        to do in this project today.
                      </p>
                    )}
                  </div>

                  {/* Recent sessions (right, self-scrolling) */}
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 max-h-[360px] overflow-y-auto">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-slate-100">
                        Recent sessions
                      </h2>
                      <span className="text-[11px] text-slate-400">
                        {sessions.length} logged
                      </span>
                    </div>

                    {sessions.length === 0 ? (
                      <p className="mt-3 text-xs text-slate-500">
                        Once you start logging sessions, they&apos;ll show up
                        here.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2 text-xs">
                        {sessions.map((s) => (
                          <li
                            key={s.id}
                            className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] text-slate-300">
                                {formatRelative(s.createdAt)}
                              </span>

                              <div className="flex items-center gap-2">
                                {typeof s.estimatedHours === "number" &&
                                  !Number.isNaN(s.estimatedHours) && (
                                    <span className="text-[11px] text-emerald-300">
                                      {s.estimatedHours}h
                                    </span>
                                  )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSession(s);
                                    setEditWhat(s.whatIDid || "");
                                    setEditWhere(s.whereLeftOff || "");
                                    setEditNextMoves(
                                      Array.isArray(s.nextMoves)
                                        ? s.nextMoves.join("\n")
                                        : s.nextMoves || ""
                                    );
                                    setEditHours(
                                      typeof s.estimatedHours === "number" &&
                                        !Number.isNaN(s.estimatedHours)
                                        ? String(s.estimatedHours)
                                        : ""
                                    );
                                  }}
                                  className="rounded-full border border-slate-500/40 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-800"
                                >
                                  Edit
                                </button>
                              </div>
                            </div>

                            {s.whatIDid && (
                              <p className="mt-1 line-clamp-2 text-slate-100">
                                {s.whatIDid}
                              </p>
                            )}
                            {s.nextMoves && (
                              <p className="mt-1 line-clamp-2 text-emerald-200">
                                Next:{" "}
                                {Array.isArray(s.nextMoves)
                                  ? s.nextMoves.join(" · ")
                                  : s.nextMoves}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : mainTab === "log" ? (
                // Log a new session tab: just the form, full width
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <h2 className="text-sm font-semibold text-slate-100">
                    Log a new project session
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Capture what you did, where you stopped, and what comes
                    next.
                  </p>

                  <form
                    className="mt-3 space-y-3 text-xs"
                    onSubmit={handleLogSession}
                  >
                    <div className="flex gap-6">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-slate-300">
                          Session date
                        </label>
                        <DatePicker
                          value={sessionDate}
                          onChange={setSessionDate}
                        />
                        <p className="text-[10px] text-slate-500">
                          Defaults to today, but you can backfill earlier work.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-slate-300">
                          Estimated hours spent
                        </label>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          className="w-full rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
                          value={sessionHours}
                          onChange={(e) => setSessionHours(e.target.value)}
                          placeholder="e.g., 1.5"
                        />
                        <p className="text-[10px] text-slate-500">
                          Optional, but helps weekly recap and planning.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-slate-300">
                        What did you work on?
                      </label>
                      <textarea
                        className="w-full rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
                        rows={4}
                        value={whatIDid}
                        onChange={(e) => setWhatIDid(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-slate-300">
                        Where did you leave things?
                      </label>
                      <textarea
                        className="w-full rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
                        rows={3}
                        value={whereLeftOff}
                        onChange={(e) => setWhereLeftOff(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-slate-300">
                        Next 3 moves
                      </label>
                      <textarea
                        className="w-full rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
                        rows={3}
                        value={nextMovesText}
                        onChange={(e) => setNextMovesText(e.target.value)}
                      />
                    </div>

                    <div className="mt-2 flex justify-end">
                      <button
                        type="submit"
                        className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-medium text-slate-950 hover:bg-emerald-400"
                      >
                        Save session
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* PROJECT BRIEF EDITOR */
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-100">
                        Project brief editor
                      </h2>
                      <p className="mt-1 text-xs text-slate-400">
                        Edit each section or paste a full Arden brief and let
                        Tessera split it into the right sections.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!project || !rawPaste.trim()) return;
                        const parsed = parseBriefFromText(rawPaste);
                        const anyParsed = Object.values(parsed).some(
                          (v) => v && v.trim().length > 0
                        );
                        if (!anyParsed) {
                          showToast(
                            "Could not detect sections in pasted text",
                            "error"
                          );
                          return;
                        }
                        const saved = upsertBriefForProject(project.id, {
                          purpose: parsed.purpose || brief?.purpose || "",
                          capabilities:
                            parsed.capabilities || brief?.capabilities || "",
                          workPlan: parsed.workPlan || brief?.workPlan || "",
                          vision: parsed.vision || brief?.vision || "",
                          checklist: parsed.checklist || brief?.checklist || "",
                        });
                        setBrief(saved);
                        setRawPaste("");
                        showToast("Brief parsed and saved", "success");
                      }}
                      className="rounded-full border border-sky-400/50 bg-sky-500/15 px-3 py-1 text-[11px] text-sky-100 hover:bg-sky-500/30"
                    >
                      Paste &amp; parse brief
                    </button>
                  </div>

                  {/* Paste box */}
                  <div className="mt-3 text-xs">
                    <textarea
                      className="w-full rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
                      placeholder='Paste the full end-of-day brief here and click "Paste & parse brief".'
                      value={rawPaste}
                      onChange={(e) => setRawPaste(e.target.value)}
                      rows={4}
                    />
                  </div>

                  {/* Section tabs + editor */}
                  <div className="mt-4">
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {[
                        { id: "purpose", label: "Purpose" },
                        { id: "capabilities", label: "Current capabilities" },
                        { id: "workPlan", label: "Tomorrow's work plan" },
                        { id: "vision", label: "Long-term vision" },
                        { id: "checklist", label: "Actionable checklist" },
                      ].map((tab) => {
                        const active = briefTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() =>
                              setBriefTab(tab.id as typeof briefTab)
                            }
                            className={`rounded-full px-3 py-1 ${
                              active
                                ? "bg-sky-500 text-slate-950"
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3">
                      <textarea
                        className="min-h-[140px] w-full rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
                        value={brief ? brief[briefTab] || "" : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!project) return;
                          setBrief((prev) => {
                            const base: ProjectBrief = prev || {
                              projectId: project.id,
                              updatedAt: new Date().toISOString(),
                              purpose: "",
                              capabilities: "",
                              workPlan: "",
                              vision: "",
                              checklist: "",
                            };
                            return { ...base, [briefTab]: val };
                          });
                        }}
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            if (!project) return;
                            const current = brief || {
                              projectId: project.id,
                              purpose: "",
                              capabilities: "",
                              workPlan: "",
                              vision: "",
                              checklist: "",
                              updatedAt: "",
                            };
                            const saved = upsertBriefForProject(project.id, {
                              purpose: current.purpose,
                              capabilities: current.capabilities,
                              workPlan: current.workPlan,
                              vision: current.vision,
                              checklist: current.checklist,
                            });
                            setBrief(saved);
                            showToast("Brief saved", "success");
                          }}
                          className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-medium text-slate-950 hover:bg-emerald-400"
                        >
                          Save brief
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 xl:hidden">
                <SavedBrief brief={brief} />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Saved brief */}
        <aside className="hidden xl:flex w-[360px] h-[calc(100vh-190px)]">
          <SavedBrief brief={brief} />
        </aside>
      </div>

      {/* Editing Modal */}
      {editingSession && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-100">
                Edit session
              </h2>
              <span className="text-[11px] text-slate-400">
                {formatRelative(editingSession.createdAt)}
              </span>
            </div>

            <p className="mt-1 text-[11px] text-slate-500">
              Update what you did, where you left off, and the time estimate.
            </p>

            <div className="mt-3 space-y-3 text-[11px]">
              <div className="space-y-1">
                <label className="block text-[10px] font-medium text-slate-300">
                  What you worked on
                </label>
                <textarea
                  className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-sky-400"
                  rows={2}
                  value={editWhat}
                  onChange={(e) => setEditWhat(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-medium text-slate-300">
                  Where you left off
                </label>
                <textarea
                  className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-sky-400"
                  rows={2}
                  value={editWhere}
                  onChange={(e) => setEditWhere(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-medium text-slate-300">
                  Next moves
                </label>
                <textarea
                  className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-sky-400"
                  rows={2}
                  value={editNextMoves}
                  onChange={(e) => setEditNextMoves(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-medium text-slate-300">
                  Estimated hours
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1 text-[11px] text-slate-100 outline-none focus:border-sky-400"
                  value={editHours}
                  onChange={(e) => setEditHours(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingSession(null)}
                className="rounded-full border border-slate-500/40 bg-slate-900 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!project || !editingSession) return;

                  const hours =
                    editHours.trim() === ""
                      ? undefined
                      : Number(editHours.trim());

                  updateSession(editingSession.id, {
                    whatIDid: editWhat.trim(),
                    whereLeftOff: editWhere.trim(),
                    nextMoves: editNextMoves
                      .split("\n")
                      .map((m) => m.trim())
                      .filter(Boolean),
                    estimatedHours:
                      typeof hours === "number" && !Number.isNaN(hours)
                        ? hours
                        : undefined,
                  });

                  setEditingSession(null);
                  setSessions(getSessionsForProject(project.id));
                  showToast("Session updated", "success");
                }}
                className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-medium text-slate-950 hover:bg-emerald-400"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditProjectDialog && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 p-4">
            <h2 className="text-sm font-semibold text-slate-100">
              Edit project
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Update the name and short code for this project.
            </p>

            <form
              className="mt-3 space-y-3 text-xs"
              onSubmit={(e) => {
                e.preventDefault();
                if (!project) return;

                const name = editProjectName.trim();
                const code = editProjectCode.trim();
                if (!name) return;

                // Only custom projects are editable; helper only touches those
                updateCustomProject(project.id, { name, code });

                const { projects: allProjects } = loadJobsAndProjects();
                const updated =
                  allProjects.find((p) => p.id === project.id) || null;
                setProject(updated);

                setShowEditProjectDialog(false);
                showToast("Project updated", "success");
              }}
            >
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-300">
                  Project name
                </label>
                <input
                  className="w-full rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-300">
                  Short code
                </label>
                <input
                  className="w-full rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
                  value={editProjectCode}
                  onChange={(e) => setEditProjectCode(e.target.value)}
                  placeholder="e.g., GF, KP, JV"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditProjectDialog(false)}
                  className="rounded-full border border-slate-500/40 bg-slate-900 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-medium text-slate-950 hover:bg-emerald-400"
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
