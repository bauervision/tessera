"use client";

import { useEffect, useState } from "react";

import type { ProjectId } from "../lib/types";
import { getSessionsForProject } from "@/lib/storage";

export default function LastLoggedBadge({
  projectId,
}: {
  projectId: ProjectId;
}) {
  const [label, setLabel] = useState<string>("Never logged");

  useEffect(() => {
    const sessions = getSessionsForProject(projectId);
    const last = sessions[0];
    if (!last) {
      setLabel("Never logged");
      return;
    }

    const d = new Date(last.createdAt);
    const today = new Date();
    const diffMs = today.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) setLabel("Today");
    else if (diffDays === 1) setLabel("Yesterday");
    else setLabel(`${diffDays} days ago`);
  }, [projectId]);

  return (
    <span className="text-[11px] ">
      <span className="font-medium text-slate-200/50">{label}</span>
    </span>
  );
}
