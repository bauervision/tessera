// lib/tomorrow.ts
export function extractTomorrowTasks(workPlan: string): string[] {
  if (!workPlan) return [];

  const lines = workPlan.split("\n");
  const tasks: string[] = [];

  let inTomorrow = false;

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) continue;

    // Detect the "Tomorrow" header line
    const lower = line.toLowerCase();
    if (
      lower.startsWith("tomorrow's work plan") ||
      lower.startsWith("tomorrows work plan") ||
      lower.startsWith("tomorrow")
    ) {
      inTomorrow = true;
      continue;
    }

    // Stop if we’ve left the Tomorrow block (hit another top-level heading)
    if (inTomorrow && !line.startsWith("-") && !line.startsWith("•")) {
      break;
    }

    // Collect bullet lines while inTomorrow
    if (inTomorrow && (line.startsWith("-") || line.startsWith("•"))) {
      const task = line.replace(/^[-•]\s*/, "").trim();
      if (task) tasks.push(task);
    }
  }

  return tasks;
}
