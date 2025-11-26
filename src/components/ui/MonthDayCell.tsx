// components/ui/MonthDayCell.tsx
import type { Meeting, Milestone, Job } from "@/lib/types";

type MonthDayCellProps = {
  date: Date;
  iso: string;
  meetings: Meeting[];
  milestones: Milestone[];
  jobsById: Map<string, Job>;
  onClick?: () => void;
  isToday?: boolean;
};

export function MonthDayCell({
  date,
  iso,
  meetings,
  milestones,
  jobsById,
  onClick,
  isToday = false,
}: MonthDayCellProps) {
  const hasMeetings = meetings.length > 0;
  const hasMilestones = milestones.length > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex h-full flex-col rounded-lg border p-1.5 text-left transition-shadow",
        isToday
          ? "border-sky-500/80 bg-slate-950 shadow-[0_0_0_1px_rgba(56,189,248,0.4)]"
          : "border-slate-800 bg-slate-950/70 hover:border-sky-500/70 hover:bg-slate-900/80",
      ].join(" ")}
    >
      <div className="flex items-center justify-between text-[10px]">
        <span
          className={
            isToday
              ? "font-semibold text-sky-100"
              : "font-medium text-slate-100"
          }
        >
          {date.getDate()}
        </span>

        <div className="flex items-center gap-1">
          {(hasMeetings || hasMilestones) && (
            <span className="text-[9px] text-slate-500">
              {hasMeetings && `${meetings.length} mtg`}
              {hasMilestones && (
                <>
                  {hasMeetings && " · "}
                  {milestones.length} ms
                </>
              )}
            </span>
          )}

          {isToday && (
            <span className="rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-sky-200">
              Today
            </span>
          )}
        </div>
      </div>

      <div className="mt-1 space-y-0.5">
        {meetings.slice(0, 2).map((m) => {
          const company = m.jobId ? jobsById.get(m.jobId) : undefined;
          return (
            <div
              key={m.id}
              className="truncate rounded-md bg-sky-500/10 px-1 py-0.5 text-[9px] text-sky-100"
            >
              {m.time && (
                <span className="mr-1 font-mono text-[9px] text-sky-300">
                  {m.time}
                </span>
              )}
              {m.title}
              {company && (
                <span className="ml-1 text-[9px] text-slate-400">
                  · {company.name}
                </span>
              )}
            </div>
          );
        })}

        {milestones.length > 0 && (
          <div className="flex flex-wrap gap-0.5">
            {milestones.slice(0, 2).map((ms) => (
              <span
                key={ms.id}
                className="inline-flex items-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-medium text-amber-100"
              >
                {ms.title}
              </span>
            ))}
            {milestones.length > 2 && (
              <span className="text-[9px] text-amber-300">
                +{milestones.length - 2} more
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
