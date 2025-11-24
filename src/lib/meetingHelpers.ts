import { TimeParts } from "./types";

export function parseTimeToParts(value: string): TimeParts {
  if (!value) {
    // default to next quarter hour from now
    const now = new Date();
    let h = now.getHours();
    let m = now.getMinutes();
    const snapped = Math.round(m / 15) * 15;
    if (snapped === 60) {
      h = (h + 1) % 24;
      m = 0;
    } else {
      m = snapped;
    }

    const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
    let hour12 = h % 12;
    if (hour12 === 0) hour12 = 12;

    const minute = (
      m === 0 ? "00" : m === 15 ? "15" : m === 30 ? "30" : "45"
    ) as "00" | "15" | "30" | "45";

    return { hour12: String(hour12), minute, period };
  }

  const [hStr, mStr] = value.split(":");
  let h = Number(hStr) || 0;
  let m = Number(mStr) || 0;

  // snap minute to nearest quarter
  const snapped = Math.round(m / 15) * 15;
  m = snapped >= 60 ? 45 : snapped;

  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;

  const minute = (m === 0 ? "00" : m === 15 ? "15" : m === 30 ? "30" : "45") as
    | "00"
    | "15"
    | "30"
    | "45";

  return { hour12: String(hour12), minute, period };
}

export function partsToTime(parts: TimeParts): string {
  let h = Number(parts.hour12) % 12;
  if (parts.period === "PM") {
    h = (h + 12) % 24;
  }
  const hh = String(h).padStart(2, "0");
  return `${hh}:${parts.minute}`;
}
