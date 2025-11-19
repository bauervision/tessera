import { useState } from "react";

function fromYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const currentDate = value && value.trim() ? fromYmdLocal(value) : new Date();

  const [month, setMonth] = useState<Date>(() =>
    value && value.trim() ? fromYmdLocal(value) : new Date()
  );

  const todayYmd = new Date().toISOString().slice(0, 10);
  const selectedYmd = value;

  const monthLabel = month.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });

  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = firstOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate();

  // Build weeks grid with nulls for leading/trailing blanks
  const weeks: (number | null)[][] = [];
  let day = 1 - startOffset;
  while (day <= daysInMonth) {
    const week: (number | null)[] = [];
    for (let i = 0; i < 7; i++, day++) {
      week.push(day >= 1 && day <= daysInMonth ? day : null);
    }
    weeks.push(week);
  }

  const buttonLabel = value
    ? currentDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Today";

  const pickDay = (d: number | null) => {
    if (!d) return;
    const picked = new Date(month.getFullYear(), month.getMonth(), d);
    const ymd = picked.toISOString().slice(0, 10);
    onChange(ymd);
    setOpen(false);
  };

  const goPrevMonth = () => {
    setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  };

  const goNextMonth = () => {
    setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-left text-xs text-slate-100 outline-none hover:border-sky-400"
      >
        <span className="flex items-center gap-2">
          <span className="text-base">📅</span>
          <span>{buttonLabel}</span>
        </span>
        <span className="text-[10px] text-slate-500 ml-4">
          {value === todayYmd ? "Today" : "Pick date"}
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-64 rounded-xl border border-white/10 bg-slate-900/95 p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-100">
            <button
              type="button"
              onClick={goPrevMonth}
              className="rounded-full px-2 py-1 text-slate-300 hover:bg-slate-800"
            >
              ‹
            </button>
            <span className="font-medium">{monthLabel}</span>
            <button
              type="button"
              onClick={goNextMonth}
              className="rounded-full px-2 py-1 text-slate-300 hover:bg-slate-800"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1 text-center text-xs">
            {weeks.map((week, wi) =>
              week.map((d, di) => {
                if (!d) {
                  return (
                    <div
                      key={`${wi}-${di}`}
                      className="h-7 w-7 rounded-md text-[11px]"
                    />
                  );
                }

                const dateObj = new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  d
                );
                const ymd = dateObj.toISOString().slice(0, 10);
                const isToday = ymd === todayYmd;
                const isSelected = ymd === selectedYmd;

                const baseClasses =
                  "h-7 w-7 rounded-md flex items-center justify-center cursor-pointer text-[11px]";
                const selectedClasses = isSelected
                  ? "bg-sky-500 text-slate-950"
                  : isToday
                  ? "border border-sky-400 text-slate-100"
                  : "text-slate-200 hover:bg-slate-800";

                return (
                  <button
                    key={`${wi}-${di}`}
                    type="button"
                    onClick={() => pickDay(d)}
                    className={`${baseClasses} ${selectedClasses}`}
                  >
                    {d}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
