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
  priority: Priority; // 👈 new
  notes?: string;
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
