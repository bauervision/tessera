// src/app/project/page.tsx
import { Suspense } from "react";
import ProjectWorkspaceClient from "./ProjectWorkspaceClient";

export default function ProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-4 w-40 rounded bg-slate-800/70" />
          <div className="h-6 w-64 rounded bg-slate-800/70" />
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
            <div className="h-40 rounded-2xl bg-slate-900/70" />
            <div className="h-40 rounded-2xl bg-slate-900/70" />
          </div>
        </div>
      }
    >
      <ProjectWorkspaceClient />
    </Suspense>
  );
}
