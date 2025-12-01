//components/ui/TodayBlockRow.tsx
import type React from "react";
import { CSS } from "@dnd-kit/utilities";

import { TodayBlock } from "@/lib/dailyRunDownHelpers";
import { useSortable } from "@dnd-kit/sortable";
import { CalendarDays } from "lucide-react";

export function TodayBlockRow({
  block,
  timeLabel,
  onEdit,
}: {
  block: TodayBlock;
  timeLabel: string;
  onEdit: (block: TodayBlock) => void;
}) {
  const isLocked = block.kind === "meeting" || block.kind === "lunch";

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: block.id,
      disabled: isLocked,
    });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: isLocked ? "default" : "grab",
  };

  const tone =
    block.kind === "work"
      ? "bg-sky-500/10 text-sky-100"
      : block.kind === "meeting"
      ? "bg-violet-500/15 text-violet-100 border border-violet-400/60"
      : block.kind === "lunch"
      ? "bg-amber-500/10 text-amber-100 border border-amber-400/60"
      : "bg-emerald-500/5 text-emerald-100 border border-emerald-400/40";

  const labelText =
    block.kind === "lunch"
      ? "Lunch break"
      : block.kind === "free"
      ? "Free time (personal)"
      : block.label;

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(!isLocked ? listeners : {})}
      onClick={() => {
        if (!isLocked) onEdit(block);
      }}
      className={[
        "flex items-center justify-between rounded-lg px-2 py-1",
        tone,
      ].join(" ")}
    >
      <div>
        <div className="text-[15px]">{labelText}</div>
        <div className="text-[13px] text-slate-300/50">{timeLabel}</div>
      </div>

      {block.kind === "meeting" && (
        <div className="ml-3 flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20">
          <CalendarDays className="h-3.5 w-3.5 text-violet-100" />
        </div>
      )}
    </li>
  );
}
