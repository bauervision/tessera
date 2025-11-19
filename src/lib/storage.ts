//lib/storage.ts
"use client";

import { jobsSeed, projectsSeed } from "./seed";
import type {
  Session,
  ProjectId,
  JobId,
  Priority,
  Project,
  Job,
  ProjectBrief,
} from "./types";

//---------------Sessions--------------

function fromYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const SESSIONS_KEY = "tessera:sessions";

function safeParseSessions(raw: string | null): Session[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Session[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function getAllSessions(): Session[] {
  if (typeof window === "undefined") return [];
  return safeParseSessions(window.localStorage.getItem(SESSIONS_KEY));
}

export function getSessionsForProject(projectId: ProjectId): Session[] {
  return getAllSessions()
    .filter((s) => s.projectId === projectId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function addSession(
  projectId: ProjectId,
  data: {
    whatIDid: string;
    whereLeftOff: string;
    nextMoves: string[];
    createdAtOverride?: string;
    estimatedHours?: number;
  }
): Session {
  if (typeof window === "undefined") {
    throw new Error("addSession must run in the browser");
  }

  const base =
    data.createdAtOverride && data.createdAtOverride.trim()
      ? fromYmdLocal(data.createdAtOverride.trim())
      : new Date();

  const createdAt = base.toISOString();

  const newSession: Session = {
    id: `sess_${createdAt}_${Math.random().toString(36).slice(2)}`,
    projectId,
    createdAt,
    whatIDid: data.whatIDid,
    whereLeftOff: data.whereLeftOff,
    nextMoves: data.nextMoves,
    estimatedHours:
      typeof data.estimatedHours === "number" &&
      !Number.isNaN(data.estimatedHours)
        ? data.estimatedHours
        : undefined,
  };

  const existing = getAllSessions();
  const next = [newSession, ...existing];

  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(next));

  return newSession;
}

export function updateSession(
  sessionId: string,
  changes: Partial<Session>
): Session | null {
  if (typeof window === "undefined") {
    throw new Error("updateSession must run in the browser");
  }

  const all = getAllSessions();
  const idx = all.findIndex((s) => s.id === sessionId);
  if (idx === -1) return null;

  const updated: Session = {
    ...all[idx],
    ...changes,
  };

  const next = [...all];
  next[idx] = updated;

  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
  return updated;
}

//---------------Jobs and Projects --------------

export function getTotalHoursForProject(projectId: ProjectId): number {
  return getSessionsForProject(projectId).reduce((sum, s) => {
    const h =
      typeof s.estimatedHours === "number" && !Number.isNaN(s.estimatedHours)
        ? s.estimatedHours
        : 0;
    return sum + h;
  }, 0);
}

const JOBS_KEY = "tessera:jobsCustom";
const PROJECTS_KEY = "tessera:projectsCustom";

function safeParse<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as T[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function getCustomJobs(): Job[] {
  if (typeof window === "undefined") return [];
  return safeParse<Job>(window.localStorage.getItem(JOBS_KEY));
}

function getCustomProjects(): Project[] {
  if (typeof window === "undefined") return [];
  return safeParse<Project>(window.localStorage.getItem(PROJECTS_KEY));
}

function saveCustomJobs(jobs: Job[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

function saveCustomProjects(projects: Project[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function loadJobsAndProjects(): { jobs: Job[]; projects: Project[] } {
  const customJobs = getCustomJobs();
  const customProjects = getCustomProjects();

  const jobs = [...jobsSeed, ...customJobs].sort((a, b) => a.order - b.order);
  const projects = [...projectsSeed, ...customProjects];

  return { jobs, projects };
}

export function addCustomJob(input: { name: string; label: string }): Job {
  if (typeof window === "undefined") {
    throw new Error("addCustomJob must run in the browser");
  }

  const id: JobId = `job-custom-${Date.now().toString(36)}`;
  const newJob: Job = {
    id,
    name: input.name,
    label: input.label,
    order: 90, // after Constellis, before BauerVision (99)
    status: "active",
  };

  const current = getCustomJobs();
  const next = [...current, newJob];
  saveCustomJobs(next);

  return newJob;
}

export function addCustomProject(input: {
  jobId: JobId;
  name: string;
  code: string;
  priority: Priority;
}): Project {
  if (typeof window === "undefined") {
    throw new Error("addCustomProject must run in the browser");
  }

  const id: ProjectId = `proj-custom-${Date.now().toString(36)}`;
  const todayIso = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  const newProj: Project = {
    id,
    jobId: input.jobId,
    name: input.name,
    code: input.code,
    status: "active",
    lastActivityAt: todayIso,
  };

  const current = getCustomProjects();
  const next = [...current, newProj];
  saveCustomProjects(next);

  return newProj;
}

//---------------Briefs--------------

const BRIEFS_KEY = "tessera:briefs";

function getAllBriefs(): ProjectBrief[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BRIEFS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProjectBrief[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveAllBriefs(briefs: ProjectBrief[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BRIEFS_KEY, JSON.stringify(briefs));
}

export function getBriefForProject(projectId: ProjectId): ProjectBrief | null {
  const all = getAllBriefs();
  return all.find((b) => b.projectId === projectId) ?? null;
}

export function upsertBriefForProject(
  projectId: ProjectId,
  input: Omit<ProjectBrief, "projectId" | "updatedAt">
): ProjectBrief {
  if (typeof window === "undefined") {
    throw new Error("upsertBriefForProject must run in the browser");
  }

  const now = new Date().toISOString();
  const existing = getAllBriefs();
  const rest = existing.filter((b) => b.projectId !== projectId);

  const brief: ProjectBrief = {
    projectId,
    updatedAt: now,
    purpose: input.purpose,
    capabilities: input.capabilities,
    workPlan: input.workPlan,
    vision: input.vision,
    checklist: input.checklist,
  };

  const next = [brief, ...rest];
  saveAllBriefs(next);
  return brief;
}
