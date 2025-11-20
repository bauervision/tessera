"use client";

import { useEffect, useRef } from "react";
import { getUpcomingMeetings } from "@/lib/storage";
import type { Meeting } from "@/lib/types";

function buildMeetingDate(m: Meeting): Date | null {
  if (!m.dateIso) return null;

  const [yStr, mStr, dStr] = m.dateIso.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  if (!year || !month || !day) return null;

  let hours = 9;
  let minutes = 0;

  if (m.time) {
    const [hStr, minStr] = m.time.split(":");
    hours = Number(hStr) || 0;
    minutes = Number(minStr) || 0;
  }

  // local time (not UTC)
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function MeetingTitleWatcher() {
  const baseTitleRef = useRef<string | null>(null);
  const hasBadgeRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // remember whatever the title is when Tessera loads
    if (!baseTitleRef.current) {
      baseTitleRef.current = document.title || "Tessera";
    }

    const check = () => {
      const meetings = getUpcomingMeetings();
      const now = Date.now();
      const windowMs = 5 * 60 * 1000; // 5 minutes

      let hasSoonMeeting = false;

      for (const m of meetings) {
        const dt = buildMeetingDate(m);
        if (!dt) continue;
        const diff = dt.getTime() - now;

        // 0–5 minutes in the future
        if (diff >= 0 && diff <= windowMs) {
          hasSoonMeeting = true;
          break;
        }
      }

      if (hasSoonMeeting && !hasBadgeRef.current && baseTitleRef.current) {
        document.title = `${baseTitleRef.current} (5 Min Warning!)`;
        hasBadgeRef.current = true;
      } else if (
        !hasSoonMeeting &&
        hasBadgeRef.current &&
        baseTitleRef.current
      ) {
        document.title = baseTitleRef.current;
        hasBadgeRef.current = false;
      }
    };

    // initial check + periodic checks
    check();
    const id = window.setInterval(check, 30_000); // every 30s

    return () => {
      window.clearInterval(id);
      // restore title when unmounting
      if (baseTitleRef.current) {
        document.title = baseTitleRef.current;
      }
    };
  }, []);

  return null;
}
