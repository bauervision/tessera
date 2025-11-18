import type { Priority } from "@/lib/types";

export const priorityVisual = (priority: Priority) => {
  switch (priority) {
    case "hot":
      return {
        icon: "🔥",
        label: "High priority",
        borderGradient: "from-orange-500/70 via-orange-400/30 to-slate-800/0",
        bgGradient: "from-orange-500/10 via-slate-950 to-slate-950",
        stripeGradient: "from-orange-400 to-red-500",
        stripeGlow: "group-hover:shadow-[0_0_22px_rgba(249,115,22,0.65)]",
        overlay:
          "bg-[radial-gradient(circle_at_left,rgba(249,115,22,0.45)_0,rgba(249,115,22,0)_55%)]",
      };
    case "warm":
      return {
        icon: "🟡",
        label: "Medium priority",
        borderGradient: "from-amber-400/70 via-amber-300/25 to-slate-800/0",
        bgGradient: "from-amber-400/10 via-slate-950 to-slate-950",
        stripeGradient: "from-amber-300 to-yellow-500",
        stripeGlow: "group-hover:shadow-[0_0_22px_rgba(245,158,11,0.65)]",
        overlay:
          "bg-[radial-gradient(circle_at_left,rgba(245,158,11,0.45)_0,rgba(245,158,11,0)_55%)]",
      };
    case "cool":
    default:
      return {
        icon: "🟢",
        label: "Low priority",
        borderGradient: "from-emerald-400/70 via-emerald-300/25 to-slate-800/0",
        bgGradient: "from-emerald-400/10 via-slate-950 to-slate-950",
        stripeGradient: "from-emerald-300 to-emerald-500",
        stripeGlow: "group-hover:shadow-[0_0_22px_rgba(16,185,129,0.65)]",
        overlay:
          "bg-[radial-gradient(circle_at_left,rgba(16,185,129,0.45)_0,rgba(16,185,129,0)_55%)]",
      };
  }
};
