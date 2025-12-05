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
  hours?: number;
  meetingId?: string;
};

export type TodaySlot = {
  id: string;
  startMinutes: number;
  endMinutes: number;
  block: TodayBlock | null; // null = empty “free” slot
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

export function getBlockDurationMinutes(block: TodayBlock): number {
  return block.endMinutes - block.startMinutes;
}

export function isLockedBlock(block: TodayBlock): boolean {
  return block.kind === "meeting" || block.kind === "lunch";
}

export function enforceWindowCapacityByPosition(
  blocks: TodayBlock[],
  dayStart: number,
  dayEnd: number
): TodayBlock[] {
  if (dayEnd <= dayStart) return blocks;

  const lockedInfos = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => isLockedBlock(block))
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

    let usedSlots = 0;

    for (const idx of flexIndices) {
      const b = blocks[idx];
      const duration = Math.max(SLOT_MINUTES, getBlockDurationMinutes(b));
      const neededSlots = Math.ceil(duration / SLOT_MINUTES);

      if (usedSlots + neededSlots <= totalSlots) {
        usedSlots += neededSlots;
      } else {
        // This block no longer fits in this window -> pop it out
        poppedIds.add(b.id);
      }
    }
  }

  if (poppedIds.size === 0) {
    return blocks;
  }

  const kept: TodayBlock[] = [];
  const popped: TodayBlock[] = [];

  for (const b of blocks) {
    if (poppedIds.has(b.id)) {
      popped.push(b);
    } else {
      kept.push(b);
    }
  }

  // Popped blocks move to the very end of the list as requested
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

  const lockedInfos = blocks
    .map((b, index) => ({ block: b, index }))
    .filter(({ block }) => isLockedBlock(block))
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

    let cursor = win.start;
    let remainingSlots = totalSlots;

    for (const idx of flexIndices) {
      const prev = updated[idx];

      const requestedDuration = Math.max(
        SLOT_MINUTES,
        getBlockDurationMinutes(prev)
      );
      let neededSlots = Math.ceil(requestedDuration / SLOT_MINUTES);

      if (neededSlots > remainingSlots) {
        if (remainingSlots <= 0) {
          // No space left in this window; collapse to a zero-length block at cursor
          updated[idx] = {
            ...prev,
            startMinutes: cursor,
            endMinutes: cursor,
          };
          continue;
        }
        neededSlots = remainingSlots;
      }

      const start = cursor;
      const end = Math.min(win.end, start + neededSlots * SLOT_MINUTES);

      updated[idx] = {
        ...prev,
        startMinutes: start,
        endMinutes: end,
      };

      cursor = end;
      remainingSlots -= neededSlots;
    }
  }

  return updated;
}

export function buildBaseSlots(
  dayStartMinutes: number,
  dayEndMinutes: number,
  slotMinutes = 30
): TodaySlot[] {
  const slots: TodaySlot[] = [];
  for (let t = dayStartMinutes; t < dayEndMinutes; t += slotMinutes) {
    slots.push({
      id: `slot-${t}`,
      startMinutes: t,
      endMinutes: t + slotMinutes,
      block: null,
    });
  }
  return slots;
}
