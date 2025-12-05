// components/DailyRundown.tsx
"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  getMeetingsForDate,
  getAllMilestones,
  cancelMeeting,
} from "@/lib/storage";
import type { Meeting, Milestone } from "@/lib/types";
import { formatDayShort, todayIso } from "@/lib/calendarHelpers";
import { loadSavedWeeklyPlan, type SavedWeeklyPlan } from "@/lib/weeklyPlanner";
import { CalendarDays } from "lucide-react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DailyTimeOverride,
  enforceWindowCapacityByPosition,
  formatMinutes,
  getCurrentWeekMondayIsoLocal,
  getProjectLabel,
  loadDailyOrderMap,
  loadDailyTimeOverrides,
  loadProjectOrder,
  rebalanceDayBlocksByPosition,
  saveDailyOrder,
  saveDailyOverridesForDate,
  saveDailyTimeOverride,
  timeToMinutes,
  TodayBlock,
} from "@/lib/dailyRunDownHelpers";
import {
  TodayBlockRow,
  TodayEmptyDropSlot,
  TodayEndDropZone,
} from "./ui/TodayBlockRow";

const END_OF_DAY_ID = "__drd-end__";

type TimelineRow =
  | {
      key: string;
      type: "block";
      block: TodayBlock;
      startMinutes: number;
      endMinutes: number;
    }
  | {
      key: string;
      type: "empty";
      startMinutes: number;
      endMinutes: number;
    };

function buildTimelineRows(
  blocks: TodayBlock[],
  dayStart: number,
  dayEnd: number,
  slotMinutes = 30
): TimelineRow[] {
  if (dayEnd <= dayStart) return [];

  const sorted = [...blocks].sort((a, b) => a.startMinutes - b.startMinutes);

  const rows: TimelineRow[] = [];
  let cursor = dayStart;

  for (const block of sorted) {
    // Fill gap before this block with "free" slots
    const gapStart = cursor;
    const gapEnd = Math.min(block.startMinutes, dayEnd);

    for (let t = gapStart; t < gapEnd; t += slotMinutes) {
      const slotEnd = Math.min(gapEnd, t + slotMinutes);
      rows.push({
        key: `empty-${t}`,
        type: "empty",
        startMinutes: t,
        endMinutes: slotEnd,
      });
    }

    // Then the block row itself
    rows.push({
      key: `block-${block.id}-${block.startMinutes}`,
      type: "block",
      block,
      startMinutes: block.startMinutes,
      endMinutes: block.endMinutes,
    });

    cursor = Math.max(cursor, block.endMinutes);
  }

  // Tail gap after last block
  for (let t = cursor; t < dayEnd; t += slotMinutes) {
    const slotEnd = Math.min(dayEnd, t + slotMinutes);
    rows.push({
      key: `empty-${t}`,
      type: "empty",
      startMinutes: t,
      endMinutes: slotEnd,
    });
  }

  return rows;
}

type DailyRundownProps = {
  show: boolean;
  onToggle: () => void;
};

export default function DailyRundown({ show, onToggle }: DailyRundownProps) {
  // We'll always show DRD for "real" today
  const [today] = useState(() => todayIso());

  const [refreshKey, setRefreshKey] = useState(0);
  const [savedPlan, setSavedPlan] = useState<SavedWeeklyPlan | null>(null);
  const [expanded, setExpanded] = useState(false);

  const [projectOrder, setProjectOrder] = useState<string[] | null>(null);

  const [todayOverrides, setTodayOverrides] = useState<Record<
    string,
    DailyTimeOverride
  > | null>(null);
  const [todayOrder, setTodayOrder] = useState<string[] | null>(null);

  // edit-dialog state
  const [editBlock, setEditBlock] = useState<TodayBlock | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Listen for global "meetings updated" so DRD refreshes alongside calendar
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMeetingsUpdated = () => {
      setRefreshKey((k) => k + 1);
    };

    window.addEventListener("tessera:meetings-updated", handleMeetingsUpdated);
    return () => {
      window.removeEventListener(
        "tessera:meetings-updated",
        handleMeetingsUpdated
      );
    };
  }, []);

  // Load weekly plan on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const weekStartIso = getCurrentWeekMondayIsoLocal();
    const plan = loadSavedWeeklyPlan(weekStartIso);
    setSavedPlan(plan);
  }, []);

  // Load project order for this week
  useEffect(() => {
    if (!savedPlan) return;
    const order = loadProjectOrder(savedPlan.weekStartIso);
    setProjectOrder(order);
  }, [savedPlan]);

  // Load saved DRD order + overrides for today
  useEffect(() => {
    if (typeof window === "undefined") return;
    const map = loadDailyOrderMap();
    setTodayOrder(map[today] ?? null);

    const overridesMap = loadDailyTimeOverrides();
    setTodayOverrides(overridesMap[today] ?? null);
  }, [today]);

  const todayMeetings: Meeting[] = useMemo(
    () => getMeetingsForDate(today),
    [today, refreshKey]
  );

  const milestones: Milestone[] = useMemo(
    () => getAllMilestones(),
    [refreshKey]
  );

  const milestonesToday = useMemo(
    () => milestones.filter((ms) => ms.dueDateIso === today),
    [milestones, today]
  );

  const todayPlan = useMemo(() => {
    if (!savedPlan) return null;

    const days = savedPlan.days;
    const activeDays = days.filter((d) => d.active);
    if (!activeDays.length) return null;

    const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const [y, m, d] = today.split("-").map(Number);
    const dateObj = new Date(y, (m || 1) - 1, d || 1);
    const dayIdx = dateObj.getDay();
    const label = weekdayLabels[dayIdx];

    const dayConfig = days.find((d) => d.label === label);
    if (!dayConfig) return null;

    if (!dayConfig.active) {
      return {
        status: "off" as const,
        label,
      };
    }

    const totalPlannedHours = savedPlan.priorities
      .filter((p) => p.enabled && p.weeklyHours > 0)
      .reduce((sum, p) => sum + p.weeklyHours, 0);

    const perDay =
      activeDays.length > 0 ? totalPlannedHours / activeDays.length : 0;

    return {
      status: "work" as const,
      label,
      plannedHours: perDay,
      windowStart: dayConfig.startMinutes,
      windowEnd: dayConfig.endMinutes,
    };
  }, [savedPlan, today]);

  const todayBlocksBase: TodayBlock[] = useMemo(() => {
    if (!savedPlan || !todayPlan || todayPlan.status !== "work") return [];

    const days = savedPlan.days;
    const activeDays = days.filter((d) => d.active);
    if (!activeDays.length) return [];

    const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const [y, m, d] = today.split("-").map(Number);
    const dateObj = new Date(y, (m || 1) - 1, d || 1);
    const dayIdx = dateObj.getDay();
    const label = weekdayLabels[dayIdx];

    const configIndex = days.findIndex((cfg) => cfg.label === label);
    const config = configIndex >= 0 ? days[configIndex] : null;
    if (!config || !config.active) return [];

    const dayStart = config.startMinutes;
    const dayEnd = config.endMinutes;
    if (dayEnd <= dayStart) return [];

    // Enabled priorities from the saved plan
    const enabledPriorities = savedPlan.priorities.filter(
      (p) => p.enabled && p.weeklyHours > 0
    );
    if (!enabledPriorities.length) return [];

    // Respect global project order from Finalize
    const idsInPlan = enabledPriorities.map((p) => p.projectId);
    const baseOrder = projectOrder?.length
      ? projectOrder.filter((id) => idsInPlan.includes(id))
      : idsInPlan;
    const remaining = idsInPlan.filter((id) => !baseOrder.includes(id));
    const orderedIds = [...baseOrder, ...remaining];

    const activeDaysCount = activeDays.length || 1;

    const blocks: TodayBlock[] = [];
    let cursor = dayStart;

    // One block per project for today (same idea as Finalize)
    orderedIds.forEach((projectId) => {
      const row = enabledPriorities.find((p) => p.projectId === projectId);
      if (!row) return;

      const doneFrom = savedPlan.projectDoneFromDayIndex?.[projectId];
      if (
        doneFrom !== undefined &&
        configIndex >= 0 &&
        configIndex >= doneFrom
      ) {
        // This project is marked done from an earlier day onward
        return;
      }

      const minutesPerDay = (row.weeklyHours / activeDaysCount) * 60;
      if (minutesPerDay <= 0) return;
      if (cursor >= dayEnd) return;

      const startMinutes = cursor;
      const endMinutes = Math.min(dayEnd, cursor + Math.round(minutesPerDay));
      if (endMinutes <= startMinutes) return;

      cursor = endMinutes;

      blocks.push({
        id: `work-${projectId}`,
        kind: "work",
        label: getProjectLabel(projectId, savedPlan),
        startMinutes,
        endMinutes,
        hours: (endMinutes - startMinutes) / 60,
      });
    });

    // Meeting blocks (locked in place)
    todayMeetings.forEach((m, idx) => {
      const startMinutes = timeToMinutes(m.time);
      if (startMinutes == null) return;

      const duration = m.durationMinutes ?? 30; // <– NEW
      const start = startMinutes;
      const end = start + duration;

      blocks.push({
        id: `mtg-${m.id ?? idx}`,
        kind: "meeting",
        label: m.title,
        startMinutes: start,
        endMinutes: end,
        hours: (end - start) / 60,
        // optional: carry the meeting id so we can cancel easily
        meetingId: m.id,
      });
    });

    // Sort everything by time
    blocks.sort((a, b) => a.startMinutes - b.startMinutes);

    return blocks;
  }, [savedPlan, todayPlan, today, projectOrder, todayMeetings]);

  // Apply any time overrides for today (now includes meetings as well)
  const todayBlocksWithOverrides: TodayBlock[] = useMemo(() => {
    if (!todayBlocksBase.length) return [];
    const overrides = todayOverrides ?? {};

    return todayBlocksBase.map((b) => {
      const ov = overrides[b.id];
      if (!ov) return b;

      const startMinutes = ov.startMinutes;
      const endMinutes = ov.endMinutes;

      return {
        ...b,
        startMinutes,
        endMinutes,
        // keep hours in sync with actual duration
        hours: (endMinutes - startMinutes) / 60,
      };
    });
  }, [todayBlocksBase, todayOverrides]);

  // Apply saved drag order
  const orderedTodayBlocks: TodayBlock[] = useMemo(() => {
    if (!todayBlocksWithOverrides.length) return [];
    if (!todayOrder) return todayBlocksWithOverrides;

    const byId = new Map(todayBlocksWithOverrides.map((b) => [b.id, b]));
    const ordered: TodayBlock[] = [];

    // First, use saved order where IDs still exist
    for (const id of todayOrder) {
      const b = byId.get(id);
      if (b) {
        ordered.push(b);
        byId.delete(id);
      }
    }

    // Then append any new blocks not in saved order
    byId.forEach((b) => ordered.push(b));

    return ordered;
  }, [todayBlocksWithOverrides, todayOrder]);

  const workMinutesToday = orderedTodayBlocks.reduce((sum, b) => {
    if (b.kind !== "work") return sum;
    return sum + (b.endMinutes - b.startMinutes);
  }, 0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const current = orderedTodayBlocks;
    if (!current.length) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // ────────────────────────────────────────────────
    // 1) Dropped onto a free time slot ("empty-XXX")
    //    → move block to start at that slot's time.
    // ────────────────────────────────────────────────
    if (overId.startsWith("empty-")) {
      if (!todayPlan || todayPlan.status !== "work") return;

      const raw = overId.replace("empty-", "");
      const slotStart = Number.parseInt(raw, 10);
      if (Number.isNaN(slotStart)) return;

      const block = current.find((b) => b.id === activeId);
      if (!block) return;

      const { windowStart, windowEnd } = todayPlan;

      const originalDuration =
        block.endMinutes > block.startMinutes
          ? block.endMinutes - block.startMinutes
          : 30;

      // Clamp start & end into the work window
      let start = Math.max(windowStart, Math.min(slotStart, windowEnd));
      let end = Math.min(windowEnd, start + originalDuration);

      // Ensure at least 30 minutes
      if (end - start < 30) {
        end = Math.min(windowEnd, start + 30);
      }

      const overridesForDay: Record<string, DailyTimeOverride> = {
        ...(todayOverrides ?? {}),
        [block.id]: {
          startMinutes: start,
          endMinutes: end,
        },
      };

      // Apply the new times locally so we can sort by time
      const updatedBlocks = current
        .map((b) =>
          b.id === block.id
            ? {
                ...b,
                startMinutes: start,
                endMinutes: end,
                hours: (end - start) / 60,
              }
            : b
        )
        .slice()
        .sort((a, b) => a.startMinutes - b.startMinutes);

      const newOrder = updatedBlocks.map((b) => b.id);

      setTodayOverrides(overridesForDay);
      saveDailyOverridesForDate(today, overridesForDay);

      setTodayOrder(newOrder);
      saveDailyOrder(today, newOrder);

      return;
    }

    // ────────────────────────────────────────────────
    // 2) Existing behavior: reorder among blocks
    //    (Feed into capacity + rebalance)
    // ────────────────────────────────────────────────

    const ids = [...current.map((b) => b.id), END_OF_DAY_ID];

    const oldIndex = ids.indexOf(activeId);
    let newIndex = ids.indexOf(overId);

    if (oldIndex === -1 || newIndex === -1) return;

    // If dropped on the end-of-day target, move to last real block
    if (overId === END_OF_DAY_ID) {
      newIndex = ids.length - 2; // index of last real item in ids
    }

    // 1) Apply drag reorder
    let moved = arrayMove(current, oldIndex, newIndex);

    if (!todayPlan || todayPlan.status !== "work") {
      const newOrder = moved.map((b) => b.id);
      setTodayOrder(newOrder);
      saveDailyOrder(today, newOrder);
      return;
    }

    const { windowStart, windowEnd } = todayPlan;

    // 2) Enforce capacity per window (pop overflow blocks to end of day)
    moved = enforceWindowCapacityByPosition(moved, windowStart, windowEnd);

    // 3) Persist the new visual order
    const newOrder = moved.map((b) => b.id);
    setTodayOrder(newOrder);
    saveDailyOrder(today, newOrder);

    // 4) Rebalance times into 30-minute slots for flexible blocks
    const rebalanced = rebalanceDayBlocksByPosition(
      moved,
      windowStart,
      windowEnd
    );

    const overridesForDay: Record<string, DailyTimeOverride> = {};

    for (const b of rebalanced) {
      if (b.kind === "meeting" || b.kind === "lunch") continue;
      overridesForDay[b.id] = {
        startMinutes: b.startMinutes,
        endMinutes: b.endMinutes,
      };
    }

    setTodayOverrides(overridesForDay);
    saveDailyOverridesForDate(today, overridesForDay);
  }

  function openEditDialog(block: TodayBlock) {
    // meetings / lunch are already guarded in row, but double-check
    if (block.kind === "meeting" || block.kind === "lunch") return;
    setEditBlock(block);
    setEditStart(formatMinutes(block.startMinutes));
    setEditEnd(formatMinutes(block.endMinutes));
    setEditError(null);
  }

  function closeEditDialog() {
    setEditBlock(null);
    setEditError(null);
  }

  function handleEditSave() {
    if (!editBlock || !todayPlan || todayPlan.status !== "work") return;

    const { windowStart, windowEnd } = todayPlan;

    const start = timeToMinutes(editStart);
    const end = timeToMinutes(editEnd);
    if (start == null || end == null) {
      setEditError("Please enter valid times (HH:MM).");
      return;
    }

    let newStart = Math.max(windowStart, Math.min(start, windowEnd));
    let newEnd = Math.max(windowStart, Math.min(end, windowEnd));

    if (newEnd <= newStart) {
      setEditError("End time must be after start time.");
      return;
    }

    // Prevent overlap with locked blocks (meetings & lunch)
    const locked = orderedTodayBlocks.filter(
      (b) =>
        (b.kind === "meeting" || b.kind === "lunch") && b.id !== editBlock.id
    );
    const overlapsLocked = locked.some((b) => {
      return newStart < b.endMinutes && newEnd > b.startMinutes;
    });
    if (overlapsLocked) {
      setEditError("This range overlaps a meeting or lunch block.");
      return;
    }

    const override: DailyTimeOverride = {
      startMinutes: newStart,
      endMinutes: newEnd,
    };

    setTodayOverrides((prev) => ({
      ...(prev ?? {}),
      [editBlock.id]: override,
    }));
    saveDailyTimeOverride(today, editBlock.id, override);
    closeEditDialog();
  }

  const sensorsExists = sensors; // just to avoid unused warning if TS gets weird

  function handleResizeBlock(blockId: string, nextDurationMinutes: number) {
    if (!todayPlan || todayPlan.status !== "work") return;

    const { windowStart, windowEnd } = todayPlan;

    setTodayOverrides((prev) => {
      const current = prev ?? {};
      const existingBlock = orderedTodayBlocks.find((b) => b.id === blockId);
      if (!existingBlock) return current;

      const start = Math.max(
        windowStart,
        Math.min(existingBlock.startMinutes, windowEnd)
      );

      const duration = Math.max(30, nextDurationMinutes); // clamp to at least 30m
      const end = Math.min(windowEnd, start + duration);

      const override: DailyTimeOverride = {
        startMinutes: start,
        endMinutes: end,
      };

      const next = {
        ...current,
        [blockId]: override,
      };

      saveDailyTimeOverride(today, blockId, override);
      return next;
    });
  }

  function handleCancelMeeting(meetingId: string) {
    cancelMeeting(meetingId);
    // refresh DRD
    setRefreshKey((k) => k + 1);
  }

  return (
    <>
      <div className="flex  min-h-0 flex-col rounded-2xl border border-slate-800 bg-slate-950/90">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between px-3 py-2 text-left"
        >
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Daily rundown
            </div>
            <div className="text-[13px] font-medium text-slate-50">
              {formatDayShort(today)}
            </div>
          </div>
          <div className="text-[11px] text-slate-400">{show ? "▾" : "▸"}</div>
        </button>

        {show && (
          <div className="flex-1 border-t border-slate-800 px-3 pb-3 pt-2 text-[11px] flex flex-col">
            {!savedPlan && (
              <p className="text-slate-400">
                No weekly plan saved yet. Use the{" "}
                <span className="font-medium text-sky-300">Weekly planner</span>{" "}
                to generate your schedule for the week.
              </p>
            )}

            {savedPlan && todayPlan && todayPlan.status === "off" && (
              <p className="text-slate-400">
                Today is configured as a{" "}
                <span className="font-medium text-emerald-300">
                  non-work day
                </span>{" "}
                in your weekly planner.
              </p>
            )}

            {savedPlan &&
              todayPlan &&
              todayPlan.status === "work" &&
              orderedTodayBlocks.length > 0 && (
                <div className="mt-2 flex flex-1 min-h-0 flex-col rounded-xl border border-slate-800 bg-slate-950/85 p-2">
                  {/* Header row: matches StepFinalize day cards */}
                  <div className="mb-1 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-400">
                        Planned {todayPlan.plannedHours.toFixed(1)}h ·{" "}
                        {todayMeetings.length} meeting
                        {todayMeetings.length === 1 ? "" : "s"} ·{" "}
                        {milestonesToday.length} milestone
                        {milestonesToday.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-300">
                      {(workMinutesToday / 60).toFixed(1)}h work
                    </div>
                  </div>

                  {/* Scrollable, 30-min sliced timeline that fills available height */}
                  <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-slate-900/80 bg-slate-950/80">
                    <DndContext
                      sensors={sensorsExists}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={[
                          ...orderedTodayBlocks.map((b) => b.id),
                          END_OF_DAY_ID,
                        ]}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="space-y-1.5 p-2 text-[11px]">
                          {buildTimelineRows(
                            orderedTodayBlocks,
                            todayPlan.windowStart,
                            todayPlan.windowEnd
                          ).map((row) => {
                            const label = `${formatMinutes(
                              row.startMinutes
                            )} – ${formatMinutes(row.endMinutes)}`;

                            if (row.type === "empty") {
                              return (
                                <TodayEmptyDropSlot
                                  key={row.key}
                                  id={row.key} // e.g. "empty-540"
                                  timeLabel={label}
                                />
                              );
                            }

                            return (
                              <TodayBlockRow
                                key={row.key}
                                block={row.block}
                                timeLabel={label}
                                onEdit={openEditDialog}
                                onResize={handleResizeBlock}
                                onCancelMeeting={handleCancelMeeting}
                              />
                            );
                          })}

                          <TodayEndDropZone id={END_OF_DAY_ID} />
                        </ul>
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Time-edit dialog for DRD blocks */}
      {editBlock && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900/95 p-4 text-xs text-slate-100 shadow-xl">
            <h2 className="text-sm font-semibold text-slate-50">
              Adjust block time
            </h2>
            <p className="mt-1 text-[11px] text-slate-400">
              {editBlock.kind === "free"
                ? "Update this free/personal slot for today."
                : editBlock.kind === "work"
                ? "Update this deep-work slot for today."
                : editBlock.label}
            </p>

            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleEditSave();
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[11px] text-slate-400">Start</span>
                  <input
                    type="time"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[13px] text-slate-100"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-[11px] text-slate-400">End</span>
                  <input
                    type="time"
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[13px] text-slate-100"
                  />
                </label>
              </div>

              {editError && (
                <p className="text-[11px] text-rose-300">{editError}</p>
              )}

              <div className="mt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditDialog}
                  className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-sky-500 px-4 py-1 text-[11px] font-semibold text-slate-950 hover:bg-sky-400"
                >
                  Update time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
