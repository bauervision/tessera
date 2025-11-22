// lib/priority.ts

import { Priority } from "./types";

export const daysSinceLastActivity = (
  lastActivityIso: string | null | undefined,
  now: Date = new Date()
): number | null => {
  if (!lastActivityIso) return null;
  const last = new Date(lastActivityIso);
  if (Number.isNaN(last.getTime())) return null;

  const diffMs = now.getTime() - last.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
};

export const priorityFromLastActivity = (
  lastActivityIso: string | null | undefined,
  now: Date = new Date()
): Priority => {
  if (!lastActivityIso) return "hot";

  const last = new Date(lastActivityIso);
  if (Number.isNaN(last.getTime())) return "hot";

  const diffMs = now.getTime() - last.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 14) return "cool"; // 0–14 days
  if (diffDays <= 21) return "warm"; // 14–21 days
  return "hot"; // >21 days
};
