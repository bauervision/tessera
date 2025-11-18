"use client";

import { jobsSeed, projectsSeed } from "./seed";
import type {
  Session,
  ProjectId,
  JobId,
  Priority,
  Project,
  Job,
} from "./types";

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

export function addSession(input: Omit<Session, "id" | "createdAt">): Session {
  if (typeof window === "undefined") {
    throw new Error("addSession must run in the browser");
  }

  const now = new Date().toISOString();
  const newSession: Session = {
    id: `sess_${now}_${Math.random().toString(36).slice(2)}`,
    createdAt: now,
    ...input,
  };

  const existing = getAllSessions();
  const next = [newSession, ...existing];

  window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(next));

  return newSession;
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
  const newProj: Project = {
    id,
    jobId: input.jobId,
    name: input.name,
    code: input.code,
    status: "active",
    priority: input.priority,
  };

  const current = getCustomProjects();
  const next = [...current, newProj];
  saveCustomProjects(next);

  return newProj;
}
