// src/lib/weeklyPlanner.ts

import { DayConfig, PlannerPriorityRow } from "@/app/planner/types";
import {
  getAllMilestones,
  getMeetingsForDate,
  loadJobsAndProjects,
} from "./storage";
import { Meeting, Milestone, StoredJob, StoredProject } from "./types";

export type DummyScenario = "light" | "normal" | "heavy";

export type WeeklyMilestone = {
  id: string;
  title: string;
  dueIso: string; // YYYY-MM-DD
  hours: number;
};

export type WeeklyMeeting = {
  id: string;
  title: string;
  dateIso: string; // YYYY-MM-DD
  time?: string | null; // "HH:MM" 24h, from Meeting.time
  hours: number;
};

// This is what StepPrioritize & StepFinalize work with
export type WeeklyPlannerTask = {
  projectId: string;
  projectName: string;
  companyName?: string;
  priorityScore: number;

  // Engine's suggested total hours for the week (can be overridden in UI)
  weeklyHoursNeeded: number;

  milestones: WeeklyMilestone[];
  tomorrowTasksCount: number;
  meetings: WeeklyMeeting[];

  // Auto-expanded tasks based on milestones / tomorrow tasks / meetings / staleness
  autoTasks: {
    id: string;
    label: string;
    estimatedHours: number;
    included: boolean; // default true
  }[];
};

// Internal dummy project type
type DummyProject = {
  id: string;
  name: string;
  company?: string;
  baseWeeklyHours: number;
  lastTouchedDaysAgo: number; // higher = staler
  milestoneCount: number;
  tomorrowTasksCount: number;
  meetingCount: number;
};

// ----- helpers -----

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// ----- dummy scenario projects -----

/**
 * Creates a stable list of dummy projects for a given scenario.
 * You can tweak baseWeeklyHours / counts to explode or shrink the week.
 */
export function buildDummyProjects(
  weekStartIso: string,
  scenario: DummyScenario
): DummyProject[] {
  // scenario multiplier: light < normal < heavy
  const mult = scenario === "light" ? 0.6 : scenario === "heavy" ? 1.4 : 1.0;

  const base: DummyProject[] = [
    {
      id: "tessera",
      name: "Tessera Weekly Planner",
      company: "BauerVision",
      baseWeeklyHours: 10,
      lastTouchedDaysAgo: 1,
      milestoneCount: 2,
      tomorrowTasksCount: 3,
      meetingCount: 1,
    },
    {
      id: "sonus",
      name: "Sonus Web Rebuild",
      company: "IBM R&D",
      baseWeeklyHours: 8,
      lastTouchedDaysAgo: 5,
      milestoneCount: 2,
      tomorrowTasksCount: 2,
      meetingCount: 1,
    },
    {
      id: "gailforce",
      name: "Gailforce Workspace & Control Panel",
      company: "Knexus / DLA",
      baseWeeklyHours: 12,
      lastTouchedDaysAgo: 3,
      milestoneCount: 3,
      tomorrowTasksCount: 4,
      meetingCount: 2,
    },
    {
      id: "knexplan",
      name: "KnexPlan Route Visualizer",
      company: "Knexus",
      baseWeeklyHours: 6,
      lastTouchedDaysAgo: 10,
      milestoneCount: 1,
      tomorrowTasksCount: 1,
      meetingCount: 0,
    },
    {
      id: "mentrogress",
      name: "Mentrogress Session Engine",
      company: "BauerVision",
      baseWeeklyHours: 4,
      lastTouchedDaysAgo: 7,
      milestoneCount: 1,
      tomorrowTasksCount: 2,
      meetingCount: 0,
    },
  ];

  // Scale hours and counts by scenario
  return base.map((p) => ({
    ...p,
    baseWeeklyHours: p.baseWeeklyHours * mult,
    milestoneCount: Math.max(0, Math.round(p.milestoneCount * mult)),
    tomorrowTasksCount: Math.max(0, Math.round(p.tomorrowTasksCount * mult)),
    meetingCount: Math.max(0, Math.round(p.meetingCount * mult)),
  }));
}

// ----- core builder: DummyProject[] -> WeeklyPlannerTask[] -----

export function buildWeeklyTasks(
  projects: DummyProject[],
  weekStartIso: string
): WeeklyPlannerTask[] {
  const tasks: WeeklyPlannerTask[] = [];

  for (const p of projects) {
    const milestones: WeeklyMilestone[] = [];
    const meetings: WeeklyMeeting[] = [];
    const autoTasks: WeeklyPlannerTask["autoTasks"] = [];

    // Milestones distributed across Mon–Fri
    for (let i = 0; i < p.milestoneCount; i++) {
      const dayOffset = clamp(1 + i * 2, 0, 4); // 0–4 days into week
      const dueIso = addDays(weekStartIso, dayOffset);
      const hours = clamp(
        (p.baseWeeklyHours / (p.milestoneCount || 1)) * 0.6,
        1,
        6
      );

      const m: WeeklyMilestone = {
        id: makeId(`ms_${p.id}_${i}`),
        title: `Milestone ${i + 1}`,
        dueIso,
        hours,
      };

      milestones.push(m);
      autoTasks.push({
        id: m.id,
        label: `Milestone: ${m.title} (due ${m.dueIso})`,
        estimatedHours: m.hours,
        included: true,
      });
    }

    // Tomorrow tasks collapsed into 1–2 auto entries
    if (p.tomorrowTasksCount > 0) {
      const chunkSize = p.tomorrowTasksCount > 3 ? 2 : 1;
      let remaining = p.tomorrowTasksCount;
      let chunkIndex = 1;
      while (remaining > 0) {
        const thisChunk = Math.min(chunkSize, remaining);
        const estHours = clamp(thisChunk * 1, 0.5, 4); // ~1h per task
        const id = makeId(`tom_${p.id}_${chunkIndex}`);
        const label =
          thisChunk === 1
            ? "Tomorrow task cleanup"
            : `Tomorrow task bundle (${thisChunk} items)`;

        autoTasks.push({
          id,
          label,
          estimatedHours: estHours,
          included: true,
        });

        remaining -= thisChunk;
        chunkIndex++;
      }
    }

    // Meetings spread across the week
    for (let i = 0; i < p.meetingCount; i++) {
      const dayOffset = clamp(1 + i * 2, 0, 4);
      const dateIso = addDays(weekStartIso, dayOffset);
      const hours = 1; // 1h per meeting for now

      const meet: WeeklyMeeting = {
        id: makeId(`mtg_${p.id}_${i}`),
        title: `Sync ${i + 1}`,
        dateIso,
        time: null,
        hours: 1,
      };

      meetings.push(meet);
      autoTasks.push({
        id: meet.id,
        label: `Meeting: ${meet.title} (${meet.dateIso})`,
        estimatedHours: meet.hours,
        included: true,
      });
    }

    // Staleness catch-up if project hasn't been touched in a while
    if (p.lastTouchedDaysAgo >= 5) {
      const intensity =
        p.lastTouchedDaysAgo >= 14
          ? 1.5
          : p.lastTouchedDaysAgo >= 7
          ? 1.2
          : 1.0;
      const hours = clamp(p.baseWeeklyHours * 0.4 * intensity, 1, 6);

      autoTasks.push({
        id: makeId(`stale_${p.id}`),
        label: `Catch-up: project hasn’t been touched in ${p.lastTouchedDaysAgo} days`,
        estimatedHours: hours,
        included: true,
      });
    }

    // Compute suggested weekly hours as sum of autoTasks
    const weeklyHoursNeeded = autoTasks.reduce(
      (sum, t) => sum + (t.included ? t.estimatedHours : 0),
      0
    );

    // Priority score: blend milestones, staleness, tomorrow tasks, meetings
    const milestoneUrgency = p.milestoneCount > 0 ? 1.0 : 0.3; // very rough for now
    const staleness = clamp(p.lastTouchedDaysAgo / 10, 0, 1.5);
    const tomorrowWeight = clamp(p.tomorrowTasksCount / 4, 0, 1.5);
    const meetingWeight = clamp(p.meetingCount / 3, 0, 1.0);

    const priorityScore =
      milestoneUrgency * 2.0 +
      staleness * 1.5 +
      tomorrowWeight * 1.2 +
      meetingWeight * 0.8;

    tasks.push({
      projectId: p.id,
      projectName: p.name,
      companyName: p.company,
      priorityScore,
      weeklyHoursNeeded,
      milestones,
      tomorrowTasksCount: p.tomorrowTasksCount,
      meetings,
      autoTasks,
    });
  }

  // Sort by priority descending
  tasks.sort((a, b) => b.priorityScore - a.priorityScore);

  return tasks;
}

const WEEKLY_PLANNER_KEY = "tessera:weeklyPlanner";

export type SavedWeeklyPlan = {
  weekStartIso: string;
  scenario: DummyScenario;
  days: DayConfig[];
  defaultStartMinutes: number;
  defaultEndMinutes: number;
  manualOrder: string[] | null;
  priorities: PlannerPriorityRow[];
  projectDoneFromDayIndex: Record<string, number>;
  savedAt: string;
};

type WeeklyPlannerStore = Record<string, SavedWeeklyPlan>;

export function loadSavedWeeklyPlan(
  weekStartIso: string
): SavedWeeklyPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WEEKLY_PLANNER_KEY);
    if (!raw) return null;
    const store = JSON.parse(raw) as WeeklyPlannerStore;
    const plan = store[weekStartIso];
    if (!plan) return null;
    return plan;
  } catch (err) {
    console.error("Failed to load weekly planner plan", err);
    return null;
  }
}

export function saveWeeklyPlan(plan: SavedWeeklyPlan) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(WEEKLY_PLANNER_KEY);
    const store: WeeklyPlannerStore = raw ? JSON.parse(raw) : {};
    store[plan.weekStartIso] = plan;
    window.localStorage.setItem(WEEKLY_PLANNER_KEY, JSON.stringify(store));
  } catch (err) {
    console.error("Failed to save weekly planner plan", err);
  }
}

/**
 * Build WeeklyPlannerTask[] from real Tessera projects.
 * v1 is intentionally simple: one core block per project, hours scaled by scenario.
 */
export function buildRealWeeklyTasks(
  weekStartIso: string,
  scenario: DummyScenario
): WeeklyPlannerTask[] {
  const { jobs, projects } = loadJobsAndProjects() as {
    jobs: StoredJob[];
    projects: StoredProject[];
  };

  const jobsById = new Map<string, StoredJob>();
  jobs.forEach((j) => jobsById.set(j.id, j));

  // Week range helpers
  function isInWeek(dateIso: string): boolean {
    const start = new Date(weekStartIso);
    const end = new Date(weekStartIso);
    end.setDate(end.getDate() + 6);

    const [y, m, d] = dateIso.split("-").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    return dt >= start && dt <= end;
  }

  // Scenario multiplier (light/normal/heavy)
  const mult = scenario === "light" ? 0.6 : scenario === "heavy" ? 1.4 : 1.0;

  // ----- Milestones (real) -----
  const allMilestones = getAllMilestones() as Milestone[];
  const milestonesByProject = new Map<string, WeeklyMilestone[]>();

  allMilestones.forEach((ms) => {
    if (!ms.projectId || !ms.dueDateIso) return;
    if (!isInWeek(ms.dueDateIso)) return;

    const hours = (ms.estimatedHours ?? 2) * mult;

    const entry: WeeklyMilestone = {
      id: ms.id,
      title: ms.title,
      dueIso: ms.dueDateIso,
      hours,
    };

    const list = milestonesByProject.get(ms.projectId) ?? [];
    list.push(entry);
    milestonesByProject.set(ms.projectId, list);
  });

  // ----- Meetings (real, per week, grouped by job) -----
  const meetingsByJob = new Map<string, WeeklyMeeting[]>();

  for (let offset = 0; offset < 7; offset++) {
    const dateIso = addDays(weekStartIso, offset);
    const dayMeetings = getMeetingsForDate(dateIso) as Meeting[];

    dayMeetings.forEach((m) => {
      if (!m.jobId) return;

      const list = meetingsByJob.get(m.jobId) ?? [];
      list.push({
        id: m.id,
        title: m.title,
        dateIso,
        time: m.time ?? null,
        hours: 0.5, // v1: assume 1h per meeting (matches DRD behavior)
      });
      meetingsByJob.set(m.jobId, list);
    });
  }

  const tasks: WeeklyPlannerTask[] = projects.map((p) => {
    const job = p.jobId ? jobsById.get(p.jobId) : undefined;

    const milestones = milestonesByProject.get(p.id) ?? [];
    const meetings = p.jobId ? meetingsByJob.get(p.jobId) ?? [] : [];

    // Base "core work" hours for this project
    const baseHours = 2 * mult;

    // Extra hours from milestones + a light buffer for meetings
    const milestoneHours = milestones.reduce((sum, ms) => sum + ms.hours, 0);
    const meetingHours = meetings.length * 0.5 * mult; // 0.5h per meeting buffer

    const coreBlockHours = baseHours + milestoneHours + meetingHours;

    const autoTasks: WeeklyPlannerTask["autoTasks"] = [];

    if (coreBlockHours > 0) {
      autoTasks.push({
        id: makeId(`base_${p.id}`),
        label: "Core work block for this project",
        estimatedHours: coreBlockHours,
        included: true,
      });
    }

    milestones.forEach((ms) => {
      autoTasks.push({
        id: ms.id,
        label: `Milestone: ${ms.title} (due ${ms.dueIso})`,
        estimatedHours: ms.hours,
        included: true,
      });
    });

    meetings.forEach((mtg) => {
      autoTasks.push({
        id: mtg.id,
        label: `Meeting: ${mtg.title} (${mtg.dateIso})`,
        estimatedHours: mtg.hours,
        included: true,
      });
    });

    const weeklyHoursNeeded = autoTasks.reduce(
      (sum, t) => sum + (t.included ? t.estimatedHours : 0),
      0
    );

    // Very simple priority for now: milestones > meetings > core
    const milestoneWeight = milestones.length;
    const meetingWeight = meetings.length * 0.5;

    const priorityScore = 1 + milestoneWeight * 2 + meetingWeight;

    return {
      projectId: p.id,
      projectName: p.name,
      companyName: job?.name,
      priorityScore,
      weeklyHoursNeeded,
      milestones,
      tomorrowTasksCount: 0, // we'll wire Tomorrow later
      meetings,
      autoTasks,
    };
  });

  // Stable order: highest priority first, then name
  tasks.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return a.projectName.localeCompare(b.projectName);
  });

  return tasks;
}
