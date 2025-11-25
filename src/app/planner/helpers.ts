//app/planner/helpers.ts
import { DummyScenario } from "@/lib/weeklyPlanner";
import { DayConfig, PlannerStep } from "./types";

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
