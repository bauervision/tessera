// app/planner/page.tsx
import { Suspense } from "react";
import WeeklyPlannerClient from "./WeeklyPlannerClient";

export default function PlannerPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-400">
          Loading weekly planner…
        </div>
      }
    >
      <WeeklyPlannerClient />
    </Suspense>
  );
}
