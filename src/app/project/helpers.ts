import { Priority } from "@/lib/types";

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "Never";

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  let diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Guard against future dates
  if (diffDays < 0) diffDays = 0;

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  const weeks = Math.floor(diffDays / 7);
  if (weeks === 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;

  const months = Math.floor(diffDays / 30);
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}

export function priorityLabel(p: Priority) {
  switch (p) {
    case "hot":
      return "🔥 Abandoned";
    case "warm":
      return "🟡 Needs Attention";
    case "cool":
    default:
      return "🟢 Recent Progress";
  }
}

export function parseBriefFromText(raw: string) {
  const text = raw.replace(/\r\n/g, "\n").replace(/\u2019/g, "'");
  const lines = text.split("\n");

  type SectionKey =
    | "purpose"
    | "capabilities"
    | "workPlan"
    | "vision"
    | "checklist";

  const sections: Record<SectionKey, string> = {
    purpose: "",
    capabilities: "",
    workPlan: "",
    vision: "",
    checklist: "",
  };

  let currentKey: SectionKey | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

    if (trimmed.startsWith("🎯") || lower.includes("project purpose")) {
      currentKey = "purpose";
      continue;
    }

    if (trimmed.startsWith("✨") || lower.includes("current capabilities")) {
      currentKey = "capabilities";
      continue;
    }

    if (
      trimmed.startsWith("🚀") ||
      (lower.includes("tomorrow") && lower.includes("work plan"))
    ) {
      currentKey = "workPlan";
      continue;
    }

    if (trimmed.startsWith("🧩") || lower.includes("longer-term vision")) {
      currentKey = "vision";
      continue;
    }

    if (
      trimmed.startsWith("📝") ||
      lower.includes("actionable tomorrow checklist")
    ) {
      currentKey = "checklist";
      continue;
    }

    if (currentKey) {
      sections[currentKey] += (sections[currentKey] ? "\n" : "") + line;
    }
  }

  (Object.keys(sections) as SectionKey[]).forEach((k) => {
    sections[k] = sections[k].trim();
  });

  return sections;
}
