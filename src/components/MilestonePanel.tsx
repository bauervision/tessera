"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Pencil,
  X,
  Save,
} from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  addMilestone,
  getMilestonesForProject,
  toggleMilestoneCompleted,
  deleteMilestone,
  updateMilestone,
} from "@/lib/storage";
import type { Milestone, ProjectId } from "@/lib/types";

export function MilestonesPanel({ projectId }: { projectId: ProjectId }) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDateIso, setDueDateIso] = useState<string>("");

  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDueDateIso, setEditDueDateIso] = useState<string>("");

  const reload = () => {
    setMilestones(getMilestonesForProject(projectId));
  };

  useEffect(() => {
    if (!projectId) return;
    reload();
  }, [projectId]);

  // ------- Create -------

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addMilestone({
      projectId,
      title,
      notes,
      dueDateIso,
    });

    setTitle("");
    setNotes("");
    setDueDateIso("");
    setAdding(false);
    reload();
  };

  // ------- Edit -------

  const beginEdit = (m: Milestone) => {
    setEditingId(m.id);
    setEditTitle(m.title);
    setEditNotes(m.notes ?? "");
    setEditDueDateIso(m.dueDateIso ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditNotes("");
    setEditDueDateIso("");
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    if (!editTitle.trim()) return;

    updateMilestone(projectId, editingId, {
      title: editTitle.trim(),
      notes: editNotes.trim() || undefined,
      dueDateIso: editDueDateIso,
    });

    cancelEdit();
    reload();
  };

  // ------- Toggle / delete -------

  const handleToggle = (m: Milestone) => {
    toggleMilestoneCompleted(projectId, m.id);
    reload();
  };

  const handleDelete = (m: Milestone) => {
    deleteMilestone(projectId, m.id);
    if (editingId === m.id) {
      cancelEdit();
    }
    reload();
  };

  const sorted = [...milestones].sort((a, b) => {
    const aDone = !!a.completedAt;
    const bDone = !!b.completedAt;
    if (aDone !== bDone) return aDone ? 1 : -1;

    const aDate = a.dueDateIso ?? "";
    const bDate = b.dueDateIso ?? "";
    return aDate.localeCompare(bDate);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Track demo-critical dates and checkpoints.
        </p>
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            cancelEdit();
          }}
          className="inline-flex items-center gap-1 rounded-full border border-sky-500/60 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-100 hover:bg-sky-500/20"
        >
          <Plus className="h-3 w-3" />
          Milestone
        </button>
      </div>

      {adding && (
        <form
          onSubmit={handleCreate}
          className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/80 p-3"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
            placeholder="Milestone title (e.g., Dec 15 demo data ready)"
          />

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-16 w-full resize-none rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
            placeholder="Notes (optional)"
          />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Target date</span>
              <DatePicker
                value={dueDateIso}
                onChange={(value) => setDueDateIso(value ?? undefined)}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setTitle("");
                  setNotes("");
                  setDueDateIso("");
                }}
                className="rounded-full px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800/80"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-sky-500 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-sky-400"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      )}

      {sorted.length === 0 && !adding && (
        <p className="text-[11px] text-slate-500">
          No milestones yet. Add one for dates like “Dec 15 – Demo data locked”.
        </p>
      )}

      <ul className="space-y-2">
        {sorted.map((m) => {
          const isDone = !!m.completedAt;
          const isEditing = editingId === m.id;

          if (isEditing) {
            return (
              <li
                key={m.id}
                className="rounded-lg border border-slate-800 bg-slate-950/80 p-3"
              >
                <form onSubmit={handleEditSave} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      Edit milestone
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-semibold text-slate-950 hover:bg-emerald-400"
                      >
                        <Save className="h-3 w-3" />
                        Save
                      </button>
                    </div>
                  </div>

                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
                    placeholder="Milestone title"
                  />

                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="h-16 w-full resize-none rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-500"
                    placeholder="Notes (optional)"
                  />

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">
                      Target date
                    </span>
                    <DatePicker
                      value={editDueDateIso}
                      onChange={(value) =>
                        setEditDueDateIso(value ?? undefined)
                      }
                    />
                  </div>
                </form>
              </li>
            );
          }

          return (
            <li
              key={m.id}
              className="flex items-start justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
            >
              <button
                type="button"
                onClick={() => handleToggle(m)}
                className="flex flex-1 items-start gap-2 text-left"
              >
                {isDone ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 text-sky-400" />
                )}
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        "text-xs font-medium " +
                        (isDone
                          ? "text-emerald-200 line-through"
                          : "text-slate-100")
                      }
                    >
                      {m.title}
                    </span>
                    {m.dueDateIso && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        {m.dueDateIso}
                      </span>
                    )}
                  </div>
                  {m.notes && (
                    <p className="text-[11px] text-slate-400">{m.notes}</p>
                  )}
                </div>
              </button>
              <div className="ml-2 mt-0.5 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => beginEdit(m)}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-sky-300"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(m)}
                  className="rounded-full p-1 text-slate-500 hover:bg-slate-800 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
