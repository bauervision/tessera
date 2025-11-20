// components/SavedBriefAside.tsx
"use client";

import type { ProjectBrief } from "@/lib/types";

export function SavedBrief({ brief }: { brief: ProjectBrief | null }) {
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Saved brief</h2>
          <p className="mt-1 text-xs text-slate-400">
            Read-only snapshot of the last saved project brief.
          </p>
        </div>
        <div className="text-right text-[11px] text-slate-400">
          {brief?.updatedAt ? (
            <>
              <span className="font-medium text-slate-200">Last updated:</span>{" "}
              {new Date(brief.updatedAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </>
          ) : (
            <span className="italic text-slate-500">Not saved yet</span>
          )}
        </div>
      </div>

      {brief ? (
        <div className="mt-3 space-y-2 text-xs">
          {[
            { key: "purpose", label: "Purpose" },
            { key: "capabilities", label: "Current capabilities" },
            { key: "workPlan", label: "Tomorrow's work plan" },
            { key: "vision", label: "Long-term vision" },
            { key: "checklist", label: "Actionable checklist" },
          ].map((sec) => {
            const value = (brief as any)[sec.key] as string;
            if (!value) return null;
            return (
              <details
                key={sec.key}
                className="group rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] text-slate-100">
                  <span>{sec.label}</span>
                  <span className="ml-2 text-[10px] text-slate-500 group-open:hidden">
                    ▼
                  </span>
                  <span className="ml-2 hidden text-[10px] text-slate-500 group-open:inline">
                    ▲
                  </span>
                </summary>
                <div className="mt-2 whitespace-pre-wrap text-[11px] text-slate-200">
                  {value}
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          No brief saved yet. Paste a brief or write one in the editor and click{" "}
          <span className="font-semibold">Save brief</span>.
        </p>
      )}
    </div>
  );
}
