//app/planner/helpers.ts
import { DummyScenario, WeeklyPlannerTask } from "@/lib/weeklyPlanner";
import { DayConfig, PlannerPriorityRow, PlannerStep } from "./types";

export function getCurrentWeekMondayIso(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = (day + 6) % 7; // 0 if Monday
  d.setDate(d.getDate() - diffToMonday);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export const scenarioLabels: { value: DummyScenario; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "normal", label: "Normal" },
  { value: "heavy", label: "Heavy" },
];

export const stepOrder: PlannerStep[] = ["configure", "prioritize", "finalize"];

export function stepLabel(step: PlannerStep): string {
  switch (step) {
    case "configure":
      return "Weekly Configuration";
    case "prioritize":
      return "Focus & Priority";
    case "finalize":
      return "Finalize";
  }
}

export function makeDefaultDays(): DayConfig[] {
  const baseStart = 9 * 60;
  const baseEnd = 17 * 60;
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return labels.map((label, idx) => ({
    id: idx,
    label,
    active: idx >= 1 && idx <= 5, // Mon–Fri active
    startMinutes: baseStart,
    endMinutes: baseEnd,
    custom: false,
  }));
}

export type ViewMode = "wizard" | "schedule";

export type FinalizeProps = {
  tasks: WeeklyPlannerTask[];
  days: DayConfig[];
  totalAvailableHours: number;
  priorities: PlannerPriorityRow[];
  projectDoneFromDayIndex: Record<string, number>;
  onProjectDoneFromDayIndexChange: (next: Record<string, number>) => void;
  onSavePlan: () => void;
  weekStartIso: string;
  hasSavedPlan: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
};

export type DaySlot = {
  id: string;
  projectId: string;
  projectName: string;
  hours: number; // per-day hours already
};

export type DaySlotsByIndex = Record<number, DaySlot[]>;

export type DayBlockKind = "work" | "meeting";

export type DayBlock = {
  id: string;
  kind: DayBlockKind;
  label: string;
  startMinutes: number;
  endMinutes: number;
  projectName?: string;
  hours?: number;
};

// --- Weekday helpers (lock mapping to Monday-start week) ---

export const WEEKDAY_LABELS: string[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

export function getDateForDayLabel(
  weekStartIso: string,
  dayLabel: string
): Date {
  const [y, m, d] = weekStartIso.split("-").map(Number);
  const monday = new Date(y, (m || 1) - 1, d || 1); // weekStartIso is Monday
  const idx = WEEKDAY_LABELS.indexOf(dayLabel);
  if (idx === -1) {
    return monday;
  }
  const date = new Date(monday);
  date.setDate(monday.getDate() + idx);
  return date;
}

export function isoForDayLabel(weekStartIso: string, dayLabel: string): string {
  const date = getDateForDayLabel(weekStartIso, dayLabel);
  return date.toISOString().slice(0, 10);
}

export function formatDateLabelFromLabel(
  weekStartIso: string,
  dayLabel: string
) {
  const date = getDateForDayLabel(weekStartIso, dayLabel);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatMinutes(mins: number): string {
  const total = Math.round(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const [hh, mm] = t.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

// --- Slots builder ---

export function makeInitialSlots(
  tasks: WeeklyPlannerTask[],
  days: DayConfig[],
  priorities: PlannerPriorityRow[]
): DaySlotsByIndex {
  const result: DaySlotsByIndex = {};

  const activeDayIndexes = days
    .map((day, idx) => (day.active ? idx : -1))
    .filter((idx) => idx !== -1);

  if (activeDayIndexes.length === 0) {
    days.forEach((_, idx) => {
      result[idx] = [];
    });
    return result;
  }

  const enabledRows = priorities.filter((p) => p.enabled && p.weeklyHours > 0);

  if (!enabledRows.length) {
    days.forEach((_, idx) => {
      result[idx] = [];
    });
    return result;
  }

  // Per-day hours for each project: weeklyHours / activeDayCount
  const perDayRows = enabledRows.map((row) => {
    const task = tasks.find((t) => t.projectId === row.projectId);
    const projectName = task?.projectName ?? "Project";
    const perDayHours = row.weeklyHours / activeDayIndexes.length;
    return {
      projectId: row.projectId,
      projectName,
      perDayHours,
    };
  });

  days.forEach((day, idx) => {
    if (!day.active) {
      result[idx] = [];
      return;
    }

    const slots: DaySlot[] = perDayRows.map((row) => ({
      id: `${idx}-${row.projectId}`,
      projectId: row.projectId,
      projectName: row.projectName,
      hours: row.perDayHours,
    }));

    result[idx] = slots;
  });

  return result;
}

// Simple helper: add N days to an ISO date (local)
export function addDaysToIso(baseIso: string, offset: number): string {
  const [year, month, day] = baseIso.split("-").map(Number);
  const d = new Date(year, month - 1, day + offset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
