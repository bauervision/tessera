"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Job, Project, Priority } from "@/lib/types";
import {
  loadJobsAndProjects,
  addCustomJob,
  addCustomProject,
} from "@/lib/storage";
import LastLoggedBadge from "@/components/LastLoggedBadge";

const priorityVisual = (priority: Priority) => {
  switch (priority) {
    case "hot":
      return {
        icon: "🔥",
        label: "High priority",
        borderGradient: "from-orange-500/70 via-orange-400/30 to-slate-800/0",
        bgGradient: "from-orange-500/10 via-slate-950 to-slate-950",
        stripeGradient: "from-orange-400 to-red-500",
        stripeGlow: "group-hover:shadow-[0_0_22px_rgba(249,115,22,0.65)]",
        overlay:
          "bg-[radial-gradient(circle_at_left,rgba(249,115,22,0.45)_0,rgba(249,115,22,0)_55%)]",
      };
    case "warm":
      return {
        icon: "🟡",
        label: "Medium priority",
        borderGradient: "from-amber-400/70 via-amber-300/25 to-slate-800/0",
        bgGradient: "from-amber-400/10 via-slate-950 to-slate-950",
        stripeGradient: "from-amber-300 to-yellow-500",
        stripeGlow: "group-hover:shadow-[0_0_22px_rgba(245,158,11,0.65)]",
        overlay:
          "bg-[radial-gradient(circle_at_left,rgba(245,158,11,0.45)_0,rgba(245,158,11,0)_55%)]",
      };
    case "cool":
    default:
      return {
        icon: "🟢",
        label: "Low priority",
        borderGradient: "from-emerald-400/70 via-emerald-300/25 to-slate-800/0",
        bgGradient: "from-emerald-400/10 via-slate-950 to-slate-950",
        stripeGradient: "from-emerald-300 to-emerald-500",
        stripeGlow: "group-hover:shadow-[0_0_22px_rgba(16,185,129,0.65)]",
        overlay:
          "bg-[radial-gradient(circle_at_left,rgba(16,185,129,0.45)_0,rgba(16,185,129,0)_55%)]",
      };
  }
};

export default function DashboardClient() {
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
    if (!companyName.trim()) return;
    addCustomJob({
      name: companyName.trim(),
      label: companyLabel.trim() || "New company",
    });
    setCompanyName("");
    setCompanyLabel("");
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

  return (
    <>
      <div className="mx-auto max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Today in Tessera
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            High-level view of your jobs and active projects. Sessions and
            &ldquo;Resume work&rdquo; live on each workspace.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((job) => {
            const jobProjects = projects.filter((p) => p.jobId === job.id);

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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setProjectJobId(job.id);
                        setShowProjectDialog(true);
                      }}
                      className="text-[11px] rounded-full border border-sky-400/40 bg-sky-500/10 px-2.5 py-1 text-sky-100 hover:bg-sky-500/25"
                    >
                      + New project
                    </button>
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                      {job.status === "active" ? "Active" : "Paused"}
                    </span>
                  </div>
                </header>

                <ul className="space-y-1.5 text-sm">
                  {jobProjects.map((p) => {
                    const pri = priorityVisual(p.priority);

                    return (
                      <li key={p.id}>
                        <Link
                          href={`/project?id=${p.id}`}
                          className={`group block rounded-2xl bg-gradient-to-r ${pri.borderGradient} p-[1px]`}
                        >
                          <div
                            className={`relative flex items-stretch justify-between rounded-[1rem] bg-gradient-to-r ${pri.bgGradient} transition-transform duration-200 ease-out group-hover:-translate-y-[1px]`}
                          >
                            <div
                              className={`pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${pri.overlay}`}
                            />

                            <div
                              className={`relative z-10 flex w-10 items-center justify-center rounded-l-[0.95rem] bg-gradient-to-b ${pri.stripeGradient} text-xl shadow-none transition-shadow duration-200 ${pri.stripeGlow}`}
                            >
                              <span aria-hidden>{pri.icon}</span>
                            </div>

                            <div className="relative z-10 flex flex-1 items-center justify-between gap-3 px-3 py-2">
                              <div className="flex items-center gap-4">
                                <span className="font-medium text-slate-50">
                                  {p.name}
                                </span>
                                <LastLoggedBadge projectId={p.id} />
                              </div>

                              <span className="shrink-0 text-xs rounded-full border border-sky-400/60 bg-sky-500/15 px-3 py-1 text-sky-100 transition-colors group-hover:bg-sky-500/35">
                                Open workspace
                              </span>
                            </div>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          {/* New Company tile */}
          <button
            type="button"
            onClick={() => setShowJobDialog(true)}
            className="flex min-h-[150px] items-center justify-center rounded-2xl border border-dashed border-sky-400/40 bg-slate-900/40 px-4 py-6 text-sm text-sky-200 hover:border-sky-300 hover:bg-slate-900/70"
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl">＋</span>
              <span className="font-medium">New company</span>
              <span className="text-[11px] text-slate-400">
                Add another job / employer to your Tessera board.
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* New Company dialog */}
      {showJobDialog && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 p-4">
            <h2 className="text-sm font-semibold text-slate-100">
              New company
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              This will add a new job section to your dashboard.
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
    </>
  );
}
