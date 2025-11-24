// components/ui/MonthDayCell.tsx
import type { Meeting, Milestone, Job } from "@/lib/types";

export function MonthDayCell({
  date,
  iso,
  meetings,
  milestones,
  jobsById,
  onClick,
}: {
  date: Date;
  iso: string;
  meetings: Meeting[];
  milestones: Milestone[];
  jobsById: Map<string, Job>;
  onClick?: () => void;
}) {
  const hasMeetings = meetings.length > 0;
  const hasMilestones = milestones.length > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full flex-col rounded-lg border border-slate-800 bg-slate-950/70 p-1.5 text-left hover:border-sky-500/70 hover:bg-slate-900/80"
    >
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-medium text-slate-100">{date.getDate()}</span>
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
                <span className="font-mono text-[9px] text-sky-300 mr-1">
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
