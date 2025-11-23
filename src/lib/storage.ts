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
  MeetingRecurrence,
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
    completedTomorrowTasks?: string[];
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
    completedTomorrowTasks: data.completedTomorrowTasks,
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

  // ---- Jobs: seeds + overrides by id ----
  const jobMap = new Map<JobId, Job>();
  for (const j of jobsSeed) {
    jobMap.set(j.id, j);
  }
  for (const cj of customJobs) {
    const base = jobMap.get(cj.id);
    jobMap.set(cj.id, base ? { ...base, ...cj } : cj);
  }
  const jobs = Array.from(jobMap.values()).sort((a, b) => a.order - b.order);

  // ---- Projects: seeds + overrides by id ----
  const projectMap = new Map<ProjectId, Project>();
  for (const p of projectsSeed) {
    projectMap.set(p.id, p);
  }
  for (const cp of customProjects) {
    const base = projectMap.get(cp.id);
    projectMap.set(cp.id, base ? { ...base, ...cp } : cp);
  }
  const projects = Array.from(projectMap.values());

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

import type { Meeting } from "./types";

const MEETINGS_KEY = "tessera.meetings.v1";

function loadMeetingsInternal(): Meeting[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MEETINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Meeting[];
  } catch {
    return [];
  }
}

function saveMeetingsInternal(meetings: Meeting[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));
}

export function getAllMeetings(): Meeting[] {
  return loadMeetingsInternal().sort((a, b) =>
    (a.dateIso + (a.time || "")).localeCompare(b.dateIso + (b.time || ""))
  );
}

export function getUpcomingMeetings(limit = 10): Meeting[] {
  const all = loadMeetingsInternal();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const horizon = new Date(today.getTime() + 30 * DAY_MS); // next 30 days

  const instances: Meeting[] = [];

  for (const m of all) {
    const rec = normalizedRecurrence(m.recurrence);
    const start = dateFromIso(m.dateIso);
    if (!start) continue;

    if (rec === "none") {
      // one-off meeting in the future (within horizon)
      const d = start;
      if (d >= today && d <= horizon) {
        instances.push(m);
      }
      continue;
    }

    // recurring: find first occurrence >= today
    let stepDays = rec === "weekly" ? 7 : rec === "biweekly" ? 14 : 30; // monthly ≈ 30 days

    let current = new Date(start.getTime());
    // advance to today or later
    while (current < today) {
      current = new Date(current.getTime() + stepDays * DAY_MS);
    }

    // add occurrences until horizon
    while (current <= horizon) {
      instances.push({
        ...m,
        // override dateIso so each instance is dated correctly
        dateIso: current.toISOString().slice(0, 10),
      });

      current = new Date(current.getTime() + stepDays * DAY_MS);
    }
  }

  return instances
    .sort((a, b) => {
      const ad = a.dateIso.localeCompare(b.dateIso);
      if (ad !== 0) return ad;
      return (a.time || "").localeCompare(b.time || "");
    })
    .slice(0, limit);
}

export function getMeetingsForProject(projectId: string): Meeting[] {
  return getAllMeetings().filter((m) => m.projectId === projectId);
}

export function addMeeting(input: {
  title: string;
  dateIso: string;
  time: string | null;
  location: string | null;
  jobId: string;
  recurrence?: MeetingRecurrence;
}): Meeting {
  const existing = loadMeetingsInternal();

  const meeting: Meeting = {
    id: crypto.randomUUID(),
    title: input.title,
    dateIso: input.dateIso,
    time: input.time,
    location: input.location,
    jobId: input.jobId,
    recurrence: input.recurrence ?? "none",
  };

  const next = [...existing, meeting];
  saveMeetingsInternal(next);
  return meeting;
}

export function deleteMeeting(id: string) {
  const existing = loadMeetingsInternal();
  const next = existing.filter((m) => m.id !== id);
  saveMeetingsInternal(next);
}

export function getMeetingsForDate(dateIso: string): Meeting[] {
  const all = loadMeetingsInternal();
  const target = dateFromIso(dateIso);
  if (!target) return [];

  return all
    .filter((m) => {
      const start = dateFromIso(m.dateIso);
      if (!start) return false;

      const rec = normalizedRecurrence(m.recurrence);
      if (rec === "none") {
        return m.dateIso === dateIso;
      }

      // only repeat on or after the start date
      const diffDays = Math.floor(
        (target.getTime() - start.getTime()) / DAY_MS
      );
      if (diffDays < 0) return false;

      switch (rec) {
        case "weekly":
          return diffDays % 7 === 0;
        case "biweekly":
          return diffDays % 14 === 0;
        case "monthly":
          // simple: same day-of-month (you can get fancier later)
          return start.getDate() === target.getDate();
        default:
          return false;
      }
    })
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

function dateFromIso(ymd: string): Date | null {
  const [yStr, mStr, dStr] = ymd.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizedRecurrence(r?: MeetingRecurrence): MeetingRecurrence {
  return r ?? "none";
}

//----------Companies -------------------//

export function updateCustomJob(id: JobId, changes: Partial<Job>): Job | null {
  if (typeof window === "undefined") {
    throw new Error("updateCustomJob must run in the browser");
  }

  const current = getCustomJobs();
  const idx = current.findIndex((j) => j.id === id);

  let updated: Job;
  if (idx === -1) {
    // No existing override yet – start from seed if we can
    const seed = jobsSeed.find((j) => j.id === id);
    if (!seed) return null;

    updated = { ...seed, ...changes };
    const next = [...current, updated];
    saveCustomJobs(next);
    return updated;
  } else {
    // Update existing custom/override record
    updated = { ...current[idx], ...changes };
    const next = [...current];
    next[idx] = updated;
    saveCustomJobs(next);
    return updated;
  }
}

export function updateCustomProject(
  id: ProjectId,
  changes: Partial<Project>
): Project | null {
  if (typeof window === "undefined") {
    throw new Error("updateCustomProject must run in the browser");
  }

  const current = getCustomProjects();
  const idx = current.findIndex((p) => p.id === id);

  let updated: Project;

  if (idx === -1) {
    // No override yet – start from seed (if it exists)
    const seed = projectsSeed.find((p) => p.id === id);
    if (!seed) return null;

    updated = { ...seed, ...changes };
    const next = [...current, updated];
    saveCustomProjects(next);
    return updated;
  } else {
    // Update existing override
    updated = { ...current[idx], ...changes };
    const next = [...current];
    next[idx] = updated;
    saveCustomProjects(next);
    return updated;
  }
}

//-----------Archiving --------------//
const ARCHIVED_PROJECT_IDS_KEY = "tessera:archivedProjects";

function safeParseProjectIds(raw: string | null): ProjectId[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is ProjectId => typeof x === "string");
  } catch {
    return [];
  }
}

export function loadArchivedProjectIds(): ProjectId[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(ARCHIVED_PROJECT_IDS_KEY);
  return safeParseProjectIds(raw);
}

function saveArchivedProjectIds(ids: ProjectId[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ARCHIVED_PROJECT_IDS_KEY, JSON.stringify(ids));
}

export function isProjectArchived(id: ProjectId): boolean {
  const ids = loadArchivedProjectIds();
  return ids.includes(id);
}

export function archiveProject(id: ProjectId) {
  const ids = loadArchivedProjectIds();
  if (ids.includes(id)) return;
  saveArchivedProjectIds([...ids, id]);
}

export function unarchiveProject(id: ProjectId) {
  const ids = loadArchivedProjectIds();
  if (!ids.length) return;
  saveArchivedProjectIds(ids.filter((x) => x !== id));
}
