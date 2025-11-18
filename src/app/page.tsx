import { Suspense } from "react";
import DashboardClient from "./DashboardClient";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-4 w-40 rounded bg-slate-800/70" />
          <div className="h-6 w-64 rounded bg-slate-800/70" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-48 rounded-2xl bg-slate-900/70" />
            <div className="h-48 rounded-2xl bg-slate-900/70" />
          </div>
        </div>
      }
    >
      <DashboardClient />
    </Suspense>
  );
}
