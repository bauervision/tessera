//app/planner/types.ts

import { WeeklyMeeting } from "@/lib/weeklyPlanner";

export type DayConfig = {
  id: number;
  label: string;
  active: boolean;
  startMinutes: number;
  endMinutes: number;
  custom?: boolean; // parent may track this more strictly
};

export type StepConfigureProps = {
  days: DayConfig[];
  onChange: (next: DayConfig[]) => void;
  totalWeeklyHoursNeeded: number;
  totalAvailableHours: number;
  capacityDelta: number;
  defaultStartMinutes: number;
  defaultEndMinutes: number;
  onChangeDefaults: (startMinutes: number, endMinutes: number) => void;
};

export type PlannerStep = "configure" | "prioritize" | "finalize";

export type PlannerPriorityRow = {
  projectId: string;
  enabled: boolean;
  weeklyHours: number;
};

export type DayScheduleBlock = {
  id: string;
  kind: "work" | "lunch" | "meeting";
  label: string;
  projectId?: string;
  meetingId?: string;
  startMinutes: number;
  endMinutes: number;
  cumulativeMinutesAfter?: number;
  totalMinutesPlanned?: number;
  hasConflict?: boolean;
};

export type DaySchedule = {
  dayId: string;
  label: string;
  blocks: DayScheduleBlock[];
  dayEndMinutes: number;
  hasConflicts?: boolean;
};

type FinalizeTask = {
  projectId: string;
  projectName: string;
  companyName?: string;
  weeklyHoursNeeded: number;
  meetings?: WeeklyMeeting[];
};

export type StepFinalizeProps = {
  tasks: FinalizeTask[];
  days: DayConfig[];
  totalAvailableHours: number;
  priorities: PlannerPriorityRow[];
  projectDoneFromDayIndex: Record<string, number>;
  onProjectDoneFromDayIndexChange: (
    updater: (prev: Record<string, number>) => Record<string, number>
  ) => void;
  onSavePlan?: () => void;
  weekStartIso: string;
  hasSavedPlan?: boolean;
  viewMode?: "schedule" | "wizard";
  onViewModeChange?: (mode: "schedule" | "wizard") => void;
};
