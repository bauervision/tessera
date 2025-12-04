// app/planner/StepPrioritize.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { WeeklyPlannerTask } from "@/lib/weeklyPlanner";
import { ProjectCard, type SubTask } from "./ProjectCard";
import type { PlannerPriorityRow } from "./types";
import { getTomorrowTaskHours } from "@/lib/tomorrow";

type Props = {
  tasks: WeeklyPlannerTask[];
  onReorder: (projectIds: string[]) => void;
  onPrioritiesChange: (rows: PlannerPriorityRow[]) => void;
};

type AutoTask = WeeklyPlannerTask["autoTasks"][number];

function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

export default function StepPrioritize({
  tasks,
  onReorder,
  onPrioritiesChange,
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const [enabledById, setEnabledById] = useState<Record<string, boolean>>({});
  const [subtasksById, setSubtasksById] = useState<Record<string, SubTask[]>>(
    {}
  );
  const [autoTasksById, setAutoTasksById] = useState<
    Record<string, AutoTask[]>
  >({});

  // -------------------------------------------------------
  // 1) Basic per-project maps
  // -------------------------------------------------------
  useEffect(() => {
    setEnabledById((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const t of tasks) {
        if (next[t.projectId] === undefined) {
          next[t.projectId] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setSubtasksById((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const t of tasks) {
        if (!next[t.projectId]) {
          next[t.projectId] = [];
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setAutoTasksById((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const t of tasks) {
        if (!next[t.projectId]) {
          next[t.projectId] = t.autoTasks;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tasks]);

  // -------------------------------------------------------
  // 2) Auto-import Tomorrow tasks based on saved hours map
  //    (keys = labels, value = hours)
  // -------------------------------------------------------
  useEffect(() => {
    setSubtasksById((prev) => {
      let changedAny = false;
      const next: Record<string, SubTask[]> = { ...prev };

      for (const t of tasks) {
        const projectId = t.projectId;
        const existing = prev[projectId] ?? [];

        const hoursMap = getTomorrowTaskHours(projectId);
        const labels = Object.keys(hoursMap);
        if (labels.length === 0) continue;

        const existingLabels = new Set(existing.map((s) => s.label));
        let merged: SubTask[] = [...existing];

        // Add any missing labels from Tomorrow (using stored hours)
        for (const raw of labels) {
          const label = String(raw).trim();
          if (!label || existingLabels.has(label)) continue;

          merged.push({
            id: `tmr-${projectId}-${label}`,
            label,
            estimatedHours: hoursMap[label] ?? 0.5,
            included: true,
          });
          existingLabels.add(label);
        }

        // Drop imported tasks that no longer exist in the hours map
        const labelSet = new Set(labels.map((l) => l.trim()));
        merged = merged.filter(
          (s) => !s.id.startsWith("tmr-") || labelSet.has(s.label.trim())
        );

        // Compare with existing; only write if changed
        const sameLength = merged.length === existing.length;
        const sameContent =
          sameLength &&
          merged.every((m, i) => {
            const e = existing[i];
            return (
              e &&
              e.id === m.id &&
              e.label === m.label &&
              e.estimatedHours === m.estimatedHours &&
              e.included === m.included
            );
          });

        if (!sameContent) {
          next[projectId] = merged;
          changedAny = true;
        }
      }

      return changedAny ? next : prev;
    });
  }, [tasks]);

  // -------------------------------------------------------
  // 3) Compute priority rows (enabled + weekly hours)
  // -------------------------------------------------------
  useEffect(() => {
    const rows: PlannerPriorityRow[] = tasks.map((t) => {
      const enabled = enabledById[t.projectId] ?? true;
      const manualSubtasks = subtasksById[t.projectId] ?? [];
      const autoTasks = autoTasksById[t.projectId] ?? t.autoTasks;

      const combined = [
        ...autoTasks.map((a) => ({
          estimatedHours: a.estimatedHours,
          included: a.included,
        })),
        ...manualSubtasks.map((m) => ({
          estimatedHours: m.estimatedHours,
          included: m.included,
        })),
      ];

      const weeklyHours = combined
        .filter((s) => s.included)
        .reduce((sum, s) => sum + s.estimatedHours, 0);

      return {
        projectId: t.projectId,
        enabled,
        weeklyHours,
      };
    });

    onPrioritiesChange(rows);
  }, [tasks, enabledById, subtasksById, autoTasksById, onPrioritiesChange]);

  // -------------------------------------------------------
  // 4) Sort: enabled first, then by weekly hours desc
  // -------------------------------------------------------
  const tasksWithMeta = useMemo(() => {
    const meta = tasks.map((t, index) => {
      const manualSubtasks = subtasksById[t.projectId] ?? [];
      const autoTasks = autoTasksById[t.projectId] ?? t.autoTasks;

      const combined = [
        ...autoTasks.map((a) => ({
          estimatedHours: a.estimatedHours,
          included: a.included,
        })),
        ...manualSubtasks.map((m) => ({
          estimatedHours: m.estimatedHours,
          included: m.included,
        })),
      ];

      const weeklyHours = combined
        .filter((s) => s.included)
        .reduce((sum, s) => sum + s.estimatedHours, 0);

      const enabled = enabledById[t.projectId] ?? true;

      return { t, index, weeklyHours, enabled };
    });

    meta.sort((a, b) => {
      // Enabled projects on top
      if (a.enabled !== b.enabled) {
        return a.enabled ? -1 : 1;
      }
      // Then by weekly hours (desc)
      if (b.weeklyHours !== a.weeklyHours) {
        return b.weeklyHours - a.weeklyHours;
      }
      // Stable by original index
      return a.index - b.index;
    });

    return meta;
  }, [tasks, enabledById, subtasksById, autoTasksById]);

  // -------------------------------------------------------
  // 5) Drag & drop using the *sorted* list
  // -------------------------------------------------------
  const handleDragStart =
    (sortedIndex: number) => (e: React.DragEvent<HTMLSpanElement>) => {
      setDragIndex(sortedIndex);
      e.dataTransfer.effectAllowed = "move";
    };

  const handleDragOver =
    (sortedIndex: number) => (e: React.DragEvent<HTMLLIElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    };

  const handleDrop =
    (sortedIndex: number) => (e: React.DragEvent<HTMLLIElement>) => {
      e.preventDefault();
      if (dragIndex == null || dragIndex === sortedIndex) return;

      const ids = tasksWithMeta.map((m) => m.t.projectId);
      const reorderedIds = reorder(ids, dragIndex, sortedIndex);

      onReorder(reorderedIds);
      setDragIndex(null);
    };

  const handleDragEnd = (e: React.DragEvent<HTMLSpanElement>) => {
    e.preventDefault();
    setDragIndex(null);
  };

  const toggleExpanded = (projectId: string) => {
    setExpandedId((prev) => (prev === projectId ? null : projectId));
  };

  const toggleEnabled = (projectId: string) => {
    setEnabledById((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const setSubtasks = (projectId: string, next: SubTask[]) => {
    setSubtasksById((prev) => ({
      ...prev,
      [projectId]: next,
    }));
  };

  const setAutoTasks = (projectId: string, next: AutoTask[]) => {
    setAutoTasksById((prev) => ({
      ...prev,
      [projectId]: next,
    }));
  };

  const handleHoursChanged = (projectId: string) => {
    setHighlightedId(projectId);
    // Clear highlight after a short flash
    window.setTimeout(() => {
      setHighlightedId((prev) => (prev === projectId ? null : prev));
    }, 600);
  };

  // -------------------------------------------------------
  // 6) Render
  // -------------------------------------------------------
  return (
    <section className="space-y-3">
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-400">
          No tasks generated for this scenario.
        </p>
      ) : (
        <ol className="space-y-3">
          {tasksWithMeta.map(({ t, weeklyHours, enabled }, sortedIndex) => {
            const subtasks = subtasksById[t.projectId] ?? [];
            const autoTasks = autoTasksById[t.projectId] ?? t.autoTasks;
            const expanded = expandedId === t.projectId;

            return (
              <ProjectCard
                key={t.projectId}
                task={t}
                index={sortedIndex}
                isDragging={dragIndex === sortedIndex}
                enabled={enabled}
                autoTasks={autoTasks}
                subtasks={subtasks}
                expanded={expanded}
                highlighted={highlightedId === t.projectId}
                onToggleExpanded={() => toggleExpanded(t.projectId)}
                onToggleEnabled={() => toggleEnabled(t.projectId)}
                onAutoTasksChange={(next) => setAutoTasks(t.projectId, next)}
                onSubtasksChange={(next) => setSubtasks(t.projectId, next)}
                onDragStart={handleDragStart(sortedIndex)}
                onDragOver={handleDragOver(sortedIndex)}
                onDrop={handleDrop(sortedIndex)}
                onDragEnd={handleDragEnd}
                onHoursChanged={() => handleHoursChanged(t.projectId)}
              />
            );
          })}
        </ol>
      )}
    </section>
  );
}
