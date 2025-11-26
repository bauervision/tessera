// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

import { Navbar } from "@/components/ui/Navbar";
import { AnimatedBackgroundSkin } from "@/components/ui/AnimatedBackgroundSkin";
import { QuickMeetingsWidget } from "@/components/QuickMeetingWidget";
import { MeetingTitleWatcher } from "@/components/MeetingTitleWatcher";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Tessera",
  description: "Context manager for multi-job, multi-project work.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <AnimatedBackgroundSkin />

        <div className="flex min-h-screen flex-col">
          <Suspense fallback={null}>
            <Navbar />
          </Suspense>
          {/* 🔓 Main is now full-width; pages control their own layout */}
          <main className="flex-1">
            <div className="px-4 py-6">{children}</div>
          </main>

          <QuickMeetingsWidget />
          <MeetingTitleWatcher />
        </div>
      </body>
    </html>
  );
}
