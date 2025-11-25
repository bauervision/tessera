// src/lib/weeklyPlanner.ts

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
        hours,
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
