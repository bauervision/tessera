"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Job, Project, Priority } from "@/lib/types";
import {
  loadJobsAndProjects,
  addCustomJob,
  addCustomProject,
  getSessionsForProject,
  getTotalHoursForProject,
  updateCustomJob,
  isProjectArchived,
  archiveProject,
  unarchiveProject,
} from "@/lib/storage";
import LastLoggedBadge from "@/components/LastLoggedBadge";
import {
  daysSinceLastActivity,
  priorityFromLastActivity,
} from "@/lib/priority";
import { useRouter } from "next/navigation";
import { isLoggedIn, logout } from "@/lib/auth";
import DashboardMeetingsPanel from "@/components/DashboardMeetingPanel";
import { priorityVisual } from "@/lib/ui";

export default function DashboardClient() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isLoggedIn()) {
      router.replace("/login");
    } else {
      setAuthReady(true);
    }
  }, [router]);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [showJobDialog, setShowJobDialog] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyLabel, setCompanyLabel] = useState("");

  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [projectJobId, setProjectJobId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [projectPriority, setProjectPriority] = useState<Priority>("warm");
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [showArchivedDropdown, setShowArchivedDropdown] = useState(false);
  const [selectedArchivedProject, setSelectedArchivedProject] =
    useState<Project | null>(null);

  useEffect(() => {
    const { jobs, projects } = loadJobsAndProjects();
    setJobs(jobs);
    setProjects(projects);
  }, []);

  const refreshJobsProjects = () => {
    const { jobs, projects } = loadJobsAndProjects();
    setJobs(jobs);
    setProjects(projects);
  };

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    const name = companyName.trim();
    const label = companyLabel.trim();
    if (!name) return;

    if (editingJob) {
      // Update existing custom company
      updateCustomJob(editingJob.id, {
        name,
        label: label || editingJob.label,
      });
    } else {
      // Create new company
      addCustomJob({
        name,
        label: label || "New company",
      });
    }

    setCompanyName("");
    setCompanyLabel("");
    setEditingJob(null);
    setShowJobDialog(false);
    refreshJobsProjects();
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectJobId || !projectName.trim() || !projectCode.trim()) return;
    addCustomProject({
      jobId: projectJobId,
      name: projectName.trim(),
      code: projectCode.trim(),
      priority: projectPriority,
    });
    setProjectName("");
    setProjectCode("");
    setProjectPriority("warm");
    setShowProjectDialog(false);
    setProjectJobId(null);
    refreshJobsProjects();
  };

  if (!authReady) {
    // simple guard to avoid flicker
    return null;
  }
  return (
    <>
      <div className="mx-auto max-w-6xl">
        <div className="px-6 pb-8 pt-4">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Today in Tessera
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                High-level view of your jobs and active projects. Sessions and
                &ldquo;Resume work&rdquo; live on each workspace.
              </p>
            </div>

            <div className="flex flex-col items-start gap-2 sm:items-end">
              <Link
                href="/planner"
                className="flex items-center justify-center rounded-full border border-sky-400/60 bg-sky-500/10 px-4 py-1.5 text-sm font-medium text-sky-100 shadow-sm transition hover:bg-sky-500/20 hover:border-sky-300/80"
              >
                Weekly planner
              </Link>

              {/* Archived projects (moved up from footer) */}
              <div className="text-xs text-slate-400">
                {projects.some((p) => isProjectArchived(p.id)) && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowArchivedDropdown((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-3 py-1 text-[11px] font-medium text-slate-200 ring-1 ring-slate-700/70 hover:bg-slate-800"
                    >
                      <span>Archived projects</span>
                      <span className="text-[10px] opacity-80">
                        (
                        {projects.filter((p) => isProjectArchived(p.id)).length}
                        )
                      </span>
                      <span className="ml-1 text-[9px]">
                        {showArchivedDropdown ? "▲" : "▼"}
                      </span>
                    </button>

                    {showArchivedDropdown && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {projects
                          .filter((p) => isProjectArchived(p.id))
                          .map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setSelectedArchivedProject(p)}
                              className="rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-200 ring-1 ring-slate-700/70 hover:bg-slate-800"
                            >
                              {p.code || p.name}
                            </button>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-4">
            {/* left calendar panel */}
            <DashboardMeetingsPanel />

            {/* Center Panel */}
            <div className="grid gap-4 md:grid-cols-2">
              {jobs.map((job) => {
                const jobProjects = projects.filter(
                  (p) => p.jobId === job.id && !isProjectArchived(p.id)
                );

                return (
                  <section
                    key={job.id}
                    className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"
                  >
                    <header className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                          {job.name}
                        </h2>
                        <p className="text-xs text-slate-500">{job.label}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingJob(job);
                          setCompanyName(job.name);
                          setCompanyLabel(job.label ?? "");
                          setShowJobDialog(true);
                        }}
                        aria-label="Edit company"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-500/40 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:border-slate-300/70"
                      >
                        {/* simple pencil icon */}
                        <svg
                          viewBox="0 0 20 20"
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        >
                          <path
                            d="M4 13.5 12.5 5a1 1 0 0 1 1.4 0l1.1 1.1a1 1 0 0 1 0 1.4L6.5 16H4v-2.5Z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    </header>

                    <ul className="space-y-1.5 text-sm">
                      {jobProjects.map((p) => {
                        // Look at sessions first, then fall back to seeded lastActivityAt
                        const sessions = getSessionsForProject(p.id);
                        const latestSession = sessions[0];
                        const effectiveLastActivityIso =
                          latestSession?.createdAt || p.lastActivityAt || null;

                        const days = daysSinceLastActivity(
                          effectiveLastActivityIso
                        );
                        const priority = priorityFromLastActivity(
                          effectiveLastActivityIso
                        );
                        const visuals = priorityVisual(priority, days);
                        const totalHours = getTotalHoursForProject(p.id);
                        const archived = isProjectArchived(p.id);

                        return (
                          <li key={p.id} className="relative">
                            {/* Archive? button — only when hot and not already archived */}
                            {priority === "hot" && !archived && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  archiveProject(p.id);
                                  refreshJobsProjects();
                                }}
                                className="absolute right-2 top-2 z-20 rounded-full bg-slate-900/90 px-2.5 py-1 text-[10px] font-medium text-amber-200 shadow-sm ring-1 ring-amber-400/70 hover:bg-amber-500 hover:text-slate-950 transition"
                              >
                                Archive?
                              </button>
                            )}

                            <Link
                              href={`/project?id=${p.id}`}
                              className={`group block rounded-2xl bg-linear-to-r ${visuals.borderGradient} p-px`}
                            >
                              <div
                                className={`relative flex items-stretch justify-between rounded-2xl bg-linear-to-r ${visuals.bgGradient} transition-transform duration-200 ease-out group-hover:-translate-y-px`}
                              >
                                <div
                                  className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${visuals.overlay}`}
                                />

                                <div className="relative z-10 flex flex-1 items-center justify-between gap-3 px-3 py-2">
                                  <div className="flex gap-4">
                                    <span className="font-medium text-slate-50">
                                      {p.name}
                                    </span>

                                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                      <LastLoggedBadge projectId={p.id} />
                                      {totalHours > 0 && (
                                        <span className="text-slate-300">
                                          •{" "}
                                          <span className="text-emerald-300 font-medium">
                                            {totalHours}h
                                          </span>{" "}
                                          logged
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          </li>
                        );
                      })}

                      {/* Add project button as the “next item” */}
                      <li>
                        <button
                          type="button"
                          onClick={() => {
                            setProjectJobId(job.id);
                            setShowProjectDialog(true);
                          }}
                          className="group flex w-full items-center justify-center rounded-2xl border border-dashed border-sky-500/60 bg-sky-500/5 px-3 py-2 text-[12px] font-medium text-sky-100 hover:bg-sky-500/15 hover:border-sky-300/80"
                        >
                          <span className="mr-1 text-base leading-none">+</span>
                          <span className="tracking-wide">Add project</span>
                        </button>
                      </li>
                    </ul>
                  </section>
                );
              })}

              {/* Edit Company tile */}
              <button
                type="button"
                onClick={() => setShowJobDialog(true)}
                className="flex min-h-[150px] items-center justify-center rounded-2xl border border-dashed border-sky-400/40 bg-slate-900/40 px-4 py-6 text-sm text-sky-200 hover:border-sky-300 hover:bg-slate-900/70"
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl">＋</span>
                  <span className="font-medium">Company Name</span>
                  <span className="text-[11px] text-slate-400">
                    Add another job / employer to your Tessera board.
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* New Company dialog */}
      {showJobDialog && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 p-4">
            <h2 className="text-sm font-semibold text-slate-100">
              {editingJob ? "Edit company" : "New company"}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {editingJob
                ? "Update this company’s name or label."
                : "This will add a new job section to your dashboard."}
            </p>

            <form
              className="mt-3 space-y-3 text-xs"
              onSubmit={handleCreateCompany}
            >
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-300">
                  Company name
                </label>
                <input
                  className="w-full rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-300">
                  Subtitle / label
                </label>
                <input
                  className="w-full rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
                  value={companyLabel}
                  onChange={(e) => setCompanyLabel(e.target.value)}
                  placeholder="e.g., UX Lead · Defense products"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowJobDialog(false)}
                  className="rounded-full border border-slate-500/40 bg-slate-900 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-sky-500 px-3 py-1 text-[11px] font-medium text-slate-950 hover:bg-sky-400"
                >
                  Save company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Project dialog */}
      {showProjectDialog && projectJobId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 p-4">
            <h2 className="text-sm font-semibold text-slate-100">
              New project
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              This project will be added under the selected company.
            </p>

            <form
              className="mt-3 space-y-3 text-xs"
              onSubmit={handleCreateProject}
            >
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-300">
                  Project name
                </label>
                <input
                  className="w-full rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-300">
                  Short code
                </label>
                <input
                  className="w-full rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value)}
                  placeholder="e.g., GF, KP, JV"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-slate-300">
                  Priority
                </label>
                <select
                  className="w-full rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
                  value={projectPriority}
                  onChange={(e) =>
                    setProjectPriority(e.target.value as Priority)
                  }
                >
                  <option value="hot">🔥 High</option>
                  <option value="warm">🟡 Medium</option>
                  <option value="cool">🟢 Low</option>
                </select>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowProjectDialog(false);
                    setProjectJobId(null);
                  }}
                  className="rounded-full border border-slate-500/40 bg-slate-900 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-sky-500 px-3 py-1 text-[11px] font-medium text-slate-950 hover:bg-sky-400"
                >
                  Save project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {selectedArchivedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-950/95 p-4 text-xs text-slate-200">
            <h2 className="text-sm font-semibold text-slate-50">
              Reopen archived project
            </h2>
            <p className="mt-2 text-[11px] text-slate-400">
              <span className="font-medium text-slate-100">
                {selectedArchivedProject.name}
              </span>{" "}
              will be moved back into its company section.
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedArchivedProject(null)}
                className="rounded-full px-3 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  unarchiveProject(selectedArchivedProject.id);
                  setSelectedArchivedProject(null);
                  refreshJobsProjects();
                }}
                className="rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Reopen project
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
