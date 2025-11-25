// app/planner/StepPrioritize.tsx
"use client";

import { useEffect, useState } from "react";
import type { WeeklyPlannerTask } from "@/lib/weeklyPlanner";
import { ProjectCard, type SubTask } from "./ProjectCard";
import type { PlannerPriorityRow } from "./types";

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

  const [enabledById, setEnabledById] = useState<Record<string, boolean>>({});
  const [subtasksById, setSubtasksById] = useState<Record<string, SubTask[]>>(
    {}
  );
  const [autoTasksById, setAutoTasksById] = useState<
    Record<string, AutoTask[]>
  >({});

  // Initialize local maps when tasks change
  useEffect(() => {
    setEnabledById((prev) => {
      const next: Record<string, boolean> = {};
      for (const t of tasks) {
        next[t.projectId] = prev[t.projectId] ?? true;
      }
      return next;
    });

    setSubtasksById((prev) => {
      const next: Record<string, SubTask[]> = {};
      for (const t of tasks) {
        next[t.projectId] = prev[t.projectId] ?? [];
      }
      return next;
    });

    setAutoTasksById((prev) => {
      const next: Record<string, AutoTask[]> = {};
      for (const t of tasks) {
        next[t.projectId] = prev[t.projectId] ?? t.autoTasks;
      }
      return next;
    });
  }, [tasks]);

  // Emit snapshot of priorities (enabled + computed weekly hours)
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

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIndex == null || dragIndex === index) return;
    const newOrder = reorder(tasks, dragIndex, index).map((t) => t.projectId);
    onReorder(newOrder);
    setDragIndex(null);
  };

  const handleDragEnd = () => {
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

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-200">
        Step 2: Focus & Priority
      </h2>
      <p className="text-xs text-slate-400">
        These focus projects are ordered by milestone urgency, staleness,
        tomorrow tasks, and meetings. Drag to rearrange, toggle items out of
        this week, and refine the task breakdown and estimates for each project.
      </p>

      {tasks.length === 0 ? (
        <p className="text-sm text-slate-400">
          No tasks generated for this scenario.
        </p>
      ) : (
        <ol className="space-y-3">
          {tasks.map((t, index) => {
            const enabled = enabledById[t.projectId] ?? true;
            const subtasks = subtasksById[t.projectId] ?? [];
            const autoTasks = autoTasksById[t.projectId] ?? t.autoTasks;
            const expanded = expandedId === t.projectId;

            return (
              <ProjectCard
                key={t.projectId}
                task={t}
                index={index}
                isDragging={dragIndex === index}
                enabled={enabled}
                autoTasks={autoTasks}
                subtasks={subtasks}
                expanded={expanded}
                onToggleExpanded={() => toggleExpanded(t.projectId)}
                onToggleEnabled={() => toggleEnabled(t.projectId)}
                onAutoTasksChange={(next) => setAutoTasks(t.projectId, next)}
                onSubtasksChange={(next) => setSubtasks(t.projectId, next)}
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver(index)}
                onDrop={handleDrop(index)}
                onDragEnd={handleDragEnd}
              />
            );
          })}
        </ol>
      )}
    </section>
  );
}
