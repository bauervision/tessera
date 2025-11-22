// lib/ui.ts

import { Priority } from "./types";

export const priorityVisual = (
  priority: Priority,
  daysSince?: number | null
) => {
  const d = daysSince ?? null;

  // Bands for days 0–14: green → lime → amber
  const bandIndex =
    d == null
      ? 0
      : d <= 1
      ? 0
      : d <= 3
      ? 1
      : d <= 5
      ? 2
      : d <= 7
      ? 3
      : d <= 9
      ? 4
      : d <= 11
      ? 5
      : d <= 14
      ? 6
      : 6;

  const coolBands = [
    {
      borderGradient: "from-emerald-400/80 via-emerald-300/30 to-slate-800/0",
      bgGradient: "from-emerald-400/15 via-slate-950 to-slate-950",
      stripeGradient: "from-emerald-300 to-emerald-500",
      overlay:
        "bg-[radial-gradient(circle_at_left,rgba(16,185,129,0.55)_0,rgba(16,185,129,0)_55%)]",
    },
    {
      borderGradient: "from-emerald-400/70 via-emerald-300/25 to-slate-800/0",
      bgGradient: "from-emerald-400/12 via-slate-950 to-slate-950",
      stripeGradient: "from-emerald-300 to-emerald-400",
      overlay:
        "bg-[radial-gradient(circle_at_left,rgba(16,185,129,0.5)_0,rgba(16,185,129,0)_55%)]",
    },
    {
      borderGradient: "from-emerald-300/70 via-emerald-200/25 to-slate-800/0",
      bgGradient: "from-emerald-300/12 via-slate-950 to-slate-950",
      stripeGradient: "from-emerald-200 to-emerald-400",
      overlay:
        "bg-[radial-gradient(circle_at_left,rgba(52,211,153,0.5)_0,rgba(52,211,153,0)_55%)]",
    },
    {
      borderGradient: "from-emerald-300/70 via-lime-300/25 to-slate-800/0",
      bgGradient: "from-lime-300/12 via-slate-950 to-slate-950",
      stripeGradient: "from-emerald-200 to-lime-300",
      overlay:
        "bg-[radial-gradient(circle_at_left,rgba(132,204,22,0.45)_0,rgba(132,204,22,0)_55%)]",
    },
    {
      borderGradient: "from-lime-300/70 via-lime-200/25 to-slate-800/0",
      bgGradient: "from-lime-300/12 via-slate-950 to-slate-950",
      stripeGradient: "from-lime-200 to-amber-200",
      overlay:
        "bg-[radial-gradient(circle_at_left,rgba(234,179,8,0.45)_0,rgba(234,179,8,0)_55%)]",
    },
    {
      borderGradient: "from-amber-300/70 via-amber-200/25 to-slate-800/0",
      bgGradient: "from-amber-300/12 via-slate-950 to-slate-950",
      stripeGradient: "from-lime-200 to-amber-300",
      overlay:
        "bg-[radial-gradient(circle_at_left,rgba(245,158,11,0.45)_0,rgba(245,158,11,0)_55%)]",
    },
    {
      borderGradient: "from-amber-400/70 via-amber-300/25 to-slate-800/0",
      bgGradient: "from-amber-400/12 via-slate-950 to-slate-950",
      stripeGradient: "from-amber-300 to-amber-400",
      overlay:
        "bg-[radial-gradient(circle_at_left,rgba(245,158,11,0.5)_0,rgba(245,158,11,0)_55%)]",
    },
  ] as const;

  const warmBand = {
    borderGradient: "from-amber-400/70 via-amber-300/25 to-slate-800/0",
    bgGradient: "from-amber-400/10 via-slate-950 to-slate-950",
    stripeGradient: "from-amber-300 to-yellow-500",
    overlay:
      "bg-[radial-gradient(circle_at_left,rgba(245,158,11,0.45)_0,rgba(245,158,11,0)_55%)]",
  };

  const hotBand = {
    borderGradient: "from-orange-500/70 via-orange-400/30 to-slate-800/0",
    bgGradient: "from-orange-500/10 via-slate-950 to-slate-950",
    stripeGradient: "from-orange-400 to-red-500",
    overlay:
      "bg-[radial-gradient(circle_at_left,rgba(249,115,22,0.45)_0,rgba(249,115,22,0)_55%)]",
  };

  // If we *don't* know days, fall back to your old behavior
  if (d == null) {
    switch (priority) {
      case "hot":
        return {
          icon: "🔥",
          label: "High priority",
          ...hotBand,
          stripeGlow: "group-hover:shadow-[0_0_22px_rgba(249,115,22,0.65)]",
        };
      case "warm":
        return {
          icon: "🟡",
          label: "Medium priority",
          ...warmBand,
          stripeGlow: "group-hover:shadow-[0_0_22px_rgba(245,158,11,0.65)]",
        };
      case "cool":
      default:
        return {
          icon: "🟢",
          label: "Low priority",
          borderGradient:
            "from-emerald-400/70 via-emerald-300/25 to-slate-800/0",
          bgGradient: "from-emerald-400/10 via-slate-950 to-slate-950",
          stripeGradient: "from-emerald-300 to-emerald-500",
          stripeGlow: "group-hover:shadow-[0_0_22px_rgba(16,185,129,0.65)]",
          overlay:
            "bg-[radial-gradient(circle_at_left,rgba(16,185,129,0.45)_0,rgba(16,185,129,0)_55%)]",
        };
    }
  }

  // If we *do* know days:
  if (d <= 14) {
    const band = coolBands[bandIndex];
    return {
      icon: "🟢",
      label: "Recently active",
      ...band,
      stripeGlow: "group-hover:shadow-[0_0_22px_rgba(16,185,129,0.6)]",
    };
  }

  if (d <= 21) {
    return {
      icon: "🟡",
      label: "Aging",
      ...warmBand,
      stripeGlow: "group-hover:shadow-[0_0_22px_rgba(245,158,11,0.65)]",
    };
  }

  return {
    icon: "🔥",
    label: "Stale / at risk",
    ...hotBand,
    stripeGlow: "group-hover:shadow-[0_0_22px_rgba(249,115,22,0.75)]",
  };
};
