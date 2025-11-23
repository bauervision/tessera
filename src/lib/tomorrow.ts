// lib/tomorrow.ts
import type { ProjectId, Session } from "./types";

const ACC_KEY_PREFIX = "tessera:tomorrow:";

function accKey(projectId: ProjectId) {
  return `${ACC_KEY_PREFIX}${projectId}`;
}

function readAccumulator(projectId: ProjectId): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(accKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t) => String(t)).filter(Boolean);
  } catch {
    return [];
  }
}

function writeAccumulator(projectId: ProjectId, tasks: string[]) {
  if (typeof window === "undefined") return;
  if (!tasks.length) {
    window.localStorage.removeItem(accKey(projectId));
  } else {
    window.localStorage.setItem(accKey(projectId), JSON.stringify(tasks));
  }
}

// 🔹 Public helpers

export function getTomorrowAccumulator(projectId: ProjectId): string[] {
  return readAccumulator(projectId);
}

export function addTomorrowTasks(
  projectId: ProjectId,
  rawTasks: string[]
): string[] {
  const existing = readAccumulator(projectId);
  const cleaned = rawTasks.map((t) => t.trim()).filter(Boolean);

  const merged = [...existing];
  for (const t of cleaned) {
    if (!merged.includes(t)) merged.push(t);
  }
  writeAccumulator(projectId, merged);
  return merged;
}

export function removeTomorrowTask(
  projectId: ProjectId,
  task: string
): string[] {
  const existing = readAccumulator(projectId);
  const next = existing.filter((t) => t !== task);
  writeAccumulator(projectId, next);
  return next;
}

// 🔹 Your existing header-based parser stays intact
export function extractTomorrowTasks(workPlan: string): string[] {
  if (!workPlan) return [];

  const lines = workPlan.split("\n");
  const tasks: string[] = [];

  let inTomorrow = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const lower = line.toLowerCase();
    if (
      lower.startsWith("tomorrow's work plan") ||
      lower.startsWith("tomorrows work plan") ||
      lower.startsWith("tomorrow")
    ) {
      inTomorrow = true;
      continue;
    }

    if (inTomorrow && !line.startsWith("-") && !line.startsWith("•")) {
      break;
    }

    if (inTomorrow && (line.startsWith("-") || line.startsWith("•"))) {
      const task = line.replace(/^[-•]\s*/, "").trim();
      if (task) tasks.push(task);
    }
  }

  return tasks;
}
function normalizeLines(raw: unknown): string[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return (raw as unknown[]).map((m) => String(m).trim()).filter(Boolean);
  }

  if (typeof raw === "string") {
    return raw
      .split("\n")
      .map((m) => m.trim())
      .filter(Boolean);
  }

  return [];
}

/**
 * Collect next-move tasks across all sessions.
 * Returns:
 *  - active: still-open next moves
 *  - archived: anything that has ever been marked done
 */
export function collectNextMoveTasksFromSessions(sessions: Session[]): {
  active: string[];
  archived: string[];
} {
  const allNextMoves = new Set<string>();
  const completed = new Set<string>();

  for (const s of sessions) {
    const moves = normalizeLines((s as any).nextMoves);
    moves.forEach((m) => allNextMoves.add(m));

    const done = normalizeLines((s as any).completedTomorrowTasks);
    done.forEach((m) => completed.add(m));
  }

  // Active = all nextMoves minus anything we've ever completed
  const active: string[] = [];
  allNextMoves.forEach((m) => {
    if (!completed.has(m)) active.push(m);
  });

  const archived = Array.from(completed);

  return { active, archived };
}
