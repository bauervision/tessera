import { Priority } from "./types";

export const priorityFromLastActivity = (
  lastActivityIso: string | null | undefined,
  now: Date = new Date()
): Priority => {
  // No activity yet? Treat as hot: it's a risk/no-progress item.
  if (!lastActivityIso) return "hot";

  const last = new Date(lastActivityIso);
  if (Number.isNaN(last.getTime())) return "hot";

  const diffMs = now.getTime() - last.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 7) return "cool"; // recently touched
  if (diffDays <= 14) return "warm"; // starting to age
  return "hot"; // stale
};
