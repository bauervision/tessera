//app/planner/types.ts
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
