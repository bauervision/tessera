// src/lib/types.ts
export type JobId = string;
export type ProjectId = string;

export type Priority = "hot" | "warm" | "cool";

export type Session = {
  id: string;
  projectId: ProjectId;
  createdAt: string; // ISO timestamp
  whatIDid: string;
  whereLeftOff: string;
  nextMoves: string[]; // up to 3 "next" lines
  createdAtOverride?: string;
  estimatedHours?: number;
  completedTomorrowTasks?: string[];
};

export type Job = {
  id: JobId;
  name: string;
  label: string;
  order: number;
  status: "active" | "paused";
};

export type Project = {
  id: ProjectId;
  jobId: JobId;
  name: string;
  code: string;
  status: "active" | "dormant" | "archived";
  lastActivityAt: string | null;
  notes?: string;
  archived?: boolean;
};

export type ProjectBrief = {
  projectId: ProjectId;
  purpose: string;
  capabilities: string;
  workPlan: string;
  vision: string;
  checklist: string;
  updatedAt: string; // ISO
};

export type MeetingRecurrence = "none" | "weekly" | "biweekly" | "monthly";

export type Meeting = {
  id: string;
  projectId?: string | null; // optional link to a project
  jobId?: string | null; // optional link to a job/client
  title: string;
  dateIso: string; // "2025-11-20"
  time?: string | null; // "14:30" (24h string) or null
  location?: string | null;
  recurrence?: MeetingRecurrence;
};

export type ViewMode = "week" | "month";
export type MonthCell = {
  date: Date;
  iso: string;
  meetings: Meeting[];
  milestones: Milestone[];
} | null;

export type TimeParts = {
  hour12: string; // "1"–"12"
  minute: "00" | "15" | "30" | "45";
  period: "AM" | "PM";
};

export type MilestoneId = string;

export type Milestone = {
  id: MilestoneId;
  projectId: ProjectId;
  title: string;
  notes?: string;
  dueDateIso?: string; // YYYY-MM-DD
  createdAt: string; // ISO timestamp
  completedAt?: string;
  estimatedHours?: number;
};

export type CalendarItemKind = "meeting" | "milestone";

export type CalendarItem = {
  id: string;
  dateIso: string;
  title: string;
  kind: CalendarItemKind;
};

export type StoredJob = { id: string; name: string };
export type StoredProject = { id: string; name: string; jobId?: string | null };
