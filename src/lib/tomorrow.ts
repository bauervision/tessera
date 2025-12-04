// lib/tomorrow.ts
import type { ProjectId, Session } from "./types";

const ACC_KEY_PREFIX = "tessera:tomorrow:";
const HOURS_KEY_PREFIX = "tessera:tomorrowHours:";
const LOCAL_ARCHIVE_PREFIX = "tessera:tomorrowLocalArchive:";

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
  const cleaned = tasks.map((t) => t.trim()).filter(Boolean);
  if (!cleaned.length) {
    window.localStorage.removeItem(accKey(projectId));
  } else {
    window.localStorage.setItem(accKey(projectId), JSON.stringify(cleaned));
  }
}

// 🔹 Public accumulator helpers (active tomorrow tasks)

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

/* 🔹 Hours per tomorrow task (by label) */

type HoursMap = Record<string, number>;

function hoursKey(projectId: ProjectId) {
  return `${HOURS_KEY_PREFIX}${projectId}`;
}

function readHours(projectId: ProjectId): HoursMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(hoursKey(projectId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: HoursMap = {};
    for (const [k, v] of Object.entries(parsed as any)) {
      const num = Number(v);
      if (!Number.isNaN(num) && num >= 0) out[String(k)] = num;
    }
    return out;
  } catch {
    return {};
  }
}

function writeHours(projectId: ProjectId, map: HoursMap) {
  if (typeof window === "undefined") return;
  const cleaned: HoursMap = {};
  for (const [k, v] of Object.entries(map)) {
    if (v > 0) cleaned[k] = v;
  }
  if (Object.keys(cleaned).length === 0) {
    window.localStorage.removeItem(hoursKey(projectId));
  } else {
    window.localStorage.setItem(hoursKey(projectId), JSON.stringify(cleaned));
  }
}

export function getTomorrowTaskHours(projectId: ProjectId): HoursMap {
  return readHours(projectId);
}

/**
 * Set hours for a specific tomorrow task label.
 * Returns the updated map so callers can sync local state.
 */
export function setTomorrowTaskHours(
  projectId: ProjectId,
  task: string,
  hours: number
): HoursMap {
  const map = readHours(projectId);
  const label = task.trim();
  if (!label) return map;
  if (hours <= 0) {
    delete map[label];
  } else {
    map[label] = hours;
  }
  writeHours(projectId, map);
  return map;
}

export function removeTomorrowTaskHours(
  projectId: ProjectId,
  task: string
): HoursMap {
  const map = readHours(projectId);
  const label = task.trim();
  if (!label) return map;
  delete map[label];
  writeHours(projectId, map);
  return map;
}

/* 🔹 Local archive overrides (for quick "Done?" without waiting for sessions) */

function localArchiveKey(projectId: ProjectId) {
  return `${LOCAL_ARCHIVE_PREFIX}${projectId}`;
}

function readLocalArchive(projectId: ProjectId): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(localArchiveKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t) => String(t)).filter(Boolean);
  } catch {
    return [];
  }
}

function writeLocalArchive(projectId: ProjectId, tasks: string[]) {
  if (typeof window === "undefined") return;
  const cleaned = tasks.map((t) => t.trim()).filter(Boolean);
  if (!cleaned.length) {
    window.localStorage.removeItem(localArchiveKey(projectId));
  } else {
    window.localStorage.setItem(
      localArchiveKey(projectId),
      JSON.stringify(cleaned)
    );
  }
}

export function getLocalTomorrowArchive(projectId: ProjectId): string[] {
  return readLocalArchive(projectId);
}

export function addToLocalTomorrowArchive(
  projectId: ProjectId,
  task: string
): string[] {
  const existing = readLocalArchive(projectId);
  const label = task.trim();
  if (!label) return existing;
  if (!existing.includes(label)) existing.push(label);
  writeLocalArchive(projectId, existing);
  return existing;
}
