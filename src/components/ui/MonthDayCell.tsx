import { formatTimeLabel } from "@/lib/calendarHelpers";
import { Job, Meeting } from "@/lib/types";

type MonthDayCellProps = {
  date: Date;
  iso: string;
  meetings: Meeting[];
  jobsById: Map<string, Job>;
  onClick: () => void;
};

export function MonthDayCell({
  date,
  iso,
  meetings,
  jobsById,
  onClick,
}: MonthDayCellProps) {
  const companyNames = [
    ...new Set(
      meetings
        .map((m) => (m.jobId ? jobsById.get(m.jobId)?.name : undefined))
        .filter((name): name is string => Boolean(name))
    ),
  ];

  return (
    <div
      key={iso}
      onClick={onClick}
      className="flex h-full cursor-pointer flex-col rounded-lg border border-slate-800 bg-slate-950/80 p-1 transition hover:border-sky-500/70 hover:bg-slate-900/80"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] text-slate-300">{date.getDate()}</span>
        {meetings.length > 0 && (
          <span className="text-[9px] text-sky-300">{meetings.length} mtg</span>
        )}
      </div>

      {meetings.length > 0 && (
        <div className="mt-0.5 space-y-0.5">
          {meetings.slice(0, 2).map((m) => (
            <div key={m.id} className="truncate text-[9px] text-slate-100">
              {m.time ? `${formatTimeLabel(m.time)} ` : ""}· {m.title}
            </div>
          ))}
          {meetings.length > 2 && (
            <div className="text-[9px] text-slate-500">
              +{meetings.length - 2} more
            </div>
          )}
          {companyNames.length > 0 && (
            <div className="text-[9px] text-slate-500 line-clamp-1">
              {companyNames.join(" · ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
