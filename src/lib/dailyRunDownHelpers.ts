// lib/dailyRunDownHelpers.ts

import { SavedWeeklyPlan } from "./weeklyPlanner";

export function saveDailyOverridesForDate(
  dateIso: string,
  overridesForDay: Record<string, DailyTimeOverride>
) {
  if (typeof window === "undefined") return;
  try {
    const map = loadDailyTimeOverrides();
    map[dateIso] = overridesForDay;
    window.localStorage.setItem(DAILY_TIME_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getCurrentWeekMondayIsoLocal(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

// --- Local-storage helpers for daily DRD order ---
const DAILY_ORDER_KEY = "tessera:dailyRundownOrder";
type DailyOrderMap = Record<string, string[]>; // dateIso -> block IDs

export function loadDailyOrderMap(): DailyOrderMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DAILY_ORDER_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as DailyOrderMap;
  } catch {
    return {};
  }
}

export function saveDailyOrder(dateIso: string, order: string[]) {
  if (typeof window === "undefined") return;
  try {
    const map = loadDailyOrderMap();
    map[dateIso] = order;
    window.localStorage.setItem(DAILY_ORDER_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

const PROJECT_ORDER_KEY_PREFIX = "tessera:plannerProjectOrder:";

export function loadProjectOrder(weekStartIso: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      PROJECT_ORDER_KEY_PREFIX + weekStartIso
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

// --- Local-storage helpers for per-block time overrides (per day) ---
const DAILY_TIME_OVERRIDES_KEY = "tessera:dailyRundownOverrides";

export type DailyTimeOverride = {
  startMinutes: number;
  endMinutes: number;
};

export type DailyTimeOverridesMap = Record<
  string, // dateIso
  Record<string, DailyTimeOverride> // blockId -> override
>;

export function loadDailyTimeOverrides(): DailyTimeOverridesMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DAILY_TIME_OVERRIDES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as DailyTimeOverridesMap;
  } catch {
    return {};
  }
}

export function saveDailyTimeOverride(
  dateIso: string,
  blockId: string,
  override: DailyTimeOverride
) {
  if (typeof window === "undefined") return;
  try {
    const map = loadDailyTimeOverrides();
    const dayOverrides = map[dateIso] ?? {};
    dayOverrides[blockId] = override;
    map[dateIso] = dayOverrides;
    window.localStorage.setItem(DAILY_TIME_OVERRIDES_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function formatMinutes(mins: number): string {
  const total = Math.round(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const [hh, mm] = t.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

export type TodayBlock = {
  id: string;
  kind: "work" | "lunch" | "meeting" | "free";
  label: string;
  startMinutes: number;
  endMinutes: number;
};

export function getProjectLabel(
  projectId: string,
  savedPlan: SavedWeeklyPlan
): string {
  const row = savedPlan.priorities.find(
    (p) => p.projectId === projectId
  ) as any;
  return row?.label ?? row?.name ?? projectId;
}

const SLOT_MINUTES = 30;

export function isLockedBlock(block: TodayBlock): boolean {
  return block.kind === "meeting" || block.kind === "lunch";
}

export function enforceWindowCapacityByPosition(
  blocks: TodayBlock[],
  dayStart: number,
  dayEnd: number
): TodayBlock[] {
  if (dayEnd <= dayStart) return blocks;

  // Pair each block with its index so we know where it sits in the list
  const lockedInfos = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => isLockedBlock(block))
    // sort locked by start time
    .sort((a, b) => a.block.startMinutes - b.block.startMinutes);

  type Window = {
    start: number;
    end: number;
    startIndex: number;
    endIndex: number;
  };

  const windows: Window[] = [];

  let prevLockedEndTime = dayStart;
  let prevLockedIndex = -1;

  // Windows between meetings/lunch blocks
  for (let i = 0; i < lockedInfos.length; i++) {
    const lock = lockedInfos[i];

    const windowStart = prevLockedEndTime;
    const windowEnd = Math.min(lock.block.startMinutes, dayEnd);
    const startIndex = prevLockedIndex + 1;
    const endIndex = lock.index - 1;

    if (windowEnd > windowStart && endIndex >= startIndex) {
      windows.push({
        start: windowStart,
        end: windowEnd,
        startIndex,
        endIndex,
      });
    }

    prevLockedEndTime = Math.max(prevLockedEndTime, lock.block.endMinutes);
    prevLockedIndex = lock.index;
  }

  // Tail window after the last meeting
  const lastStartIndex = prevLockedIndex + 1;
  const lastWindowStart = prevLockedEndTime;
  const lastWindowEnd = dayEnd;

  if (lastWindowEnd > lastWindowStart && lastStartIndex <= blocks.length - 1) {
    windows.push({
      start: lastWindowStart,
      end: lastWindowEnd,
      startIndex: lastStartIndex,
      endIndex: blocks.length - 1,
    });
  }

  // Collect IDs that should be "popped out" of their window
  const poppedIds = new Set<string>();

  for (const win of windows) {
    const span = win.end - win.start;
    const totalSlots = Math.floor(span / SLOT_MINUTES);
    if (totalSlots <= 0) continue;

    const flexIndices: number[] = [];
    for (let i = win.startIndex; i <= win.endIndex; i++) {
      const b = blocks[i];
      if (!isLockedBlock(b)) {
        flexIndices.push(i);
      }
    }

    if (!flexIndices.length) continue;

    const maxFlex = totalSlots;

    if (flexIndices.length > maxFlex) {
      const overflowCount = flexIndices.length - maxFlex;
      // Pop the *last* flexible blocks in this segment
      const popIndices = flexIndices.slice(-overflowCount);
      for (const idx of popIndices) {
        poppedIds.add(blocks[idx].id);
      }
    }
  }

  if (poppedIds.size === 0) {
    return blocks;
  }

  // Rebuild: keep non-popped in place, append popped at the very end
  const kept: TodayBlock[] = [];
  const popped: TodayBlock[] = [];

  for (const b of blocks) {
    if (poppedIds.has(b.id)) {
      popped.push(b);
    } else {
      kept.push(b);
    }
  }

  return [...kept, ...popped];
}

/**
 * Rebalance flexible blocks ("work" / "free") into 30-minute slots
 * based on their *position* in the list:
 *
 * - We look at locked blocks (meetings/lunch) as anchors in time.
 * - The segments of the list between locked blocks map to
 *   time windows between those meetings.
 * - Within each window, we slice flexible blocks into 30-min chunks.
 */
export function rebalanceDayBlocksByPosition(
  blocks: TodayBlock[],
  dayStart: number,
  dayEnd: number
): TodayBlock[] {
  if (dayEnd <= dayStart) return blocks;

  const updated = blocks.map((b) => ({ ...b }));

  // Pair each block with its index so we know where it lives in the list
  const lockedInfos = blocks
    .map((b, index) => ({ block: b, index }))
    .filter(({ block }) => isLockedBlock(block))
    // sort locked by time to get the correct windows
    .sort((a, b) => a.block.startMinutes - b.block.startMinutes);

  type Window = {
    start: number;
    end: number;
    startIndex: number;
    endIndex: number;
  };

  const windows: Window[] = [];

  let prevLockedEndTime = dayStart;
  let prevLockedIndex = -1;

  // Build windows between locked blocks
  for (let i = 0; i < lockedInfos.length; i++) {
    const lock = lockedInfos[i];

    const windowStart = prevLockedEndTime;
    const windowEnd = Math.min(lock.block.startMinutes, dayEnd);
    const startIndex = prevLockedIndex + 1;
    const endIndex = lock.index - 1;

    if (windowEnd > windowStart && endIndex >= startIndex) {
      windows.push({
        start: windowStart,
        end: windowEnd,
        startIndex,
        endIndex,
      });
    }

    prevLockedEndTime = Math.max(prevLockedEndTime, lock.block.endMinutes);
    prevLockedIndex = lock.index;
  }

  // Tail window after the last meeting
  const lastStartIndex = prevLockedIndex + 1;
  const lastWindowStart = prevLockedEndTime;
  const lastWindowEnd = dayEnd;

  if (lastWindowEnd > lastWindowStart && lastStartIndex <= blocks.length - 1) {
    windows.push({
      start: lastWindowStart,
      end: lastWindowEnd,
      startIndex: lastStartIndex,
      endIndex: blocks.length - 1,
    });
  }

  // For each window, distribute flexible blocks into 30-min slices
  for (const win of windows) {
    const span = win.end - win.start;
    const totalSlots = Math.floor(span / SLOT_MINUTES);
    if (totalSlots <= 0) continue;

    const flexIndices: number[] = [];
    for (let i = win.startIndex; i <= win.endIndex; i++) {
      const b = blocks[i];
      if (!isLockedBlock(b)) {
        flexIndices.push(i);
      }
    }

    const n = flexIndices.length;
    if (n === 0) continue;

    const count = Math.min(n, totalSlots);

    let baseSlots = Math.floor(totalSlots / count);
    if (baseSlots < 1) baseSlots = 1;

    let usedBase = baseSlots * count;
    if (usedBase > totalSlots) usedBase = totalSlots;

    let remainingSlots = totalSlots - usedBase;

    let cursor = win.start;
    for (let i = 0; i < count; i++) {
      const blockIndex = flexIndices[i];

      let slots = baseSlots;
      if (remainingSlots > 0) {
        slots += 1;
        remainingSlots -= 1;
      }

      const start = cursor;
      const end = Math.min(win.end, start + slots * SLOT_MINUTES);
      cursor = end;

      const prev = updated[blockIndex];
      updated[blockIndex] = {
        ...prev,
        startMinutes: start,
        endMinutes: end,
      };
    }
  }

  // Keep the same list order; just updated times
  return updated;
}
