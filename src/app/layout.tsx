// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

import { Navbar } from "@/components/ui/Navbar";
import { AnimatedBackgroundSkin } from "@/components/ui/AnimatedBackgroundSkin";

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
          <Navbar />

          {/* 🔓 Main is now full-width; pages control their own layout */}
          <main className="flex-1">
            <div className="px-4 py-6">{children}</div>
          </main>

          <footer className="border-t border-white/10 bg-slate-950/90">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-xs text-slate-500">
              <span>© {new Date().getFullYear()} Bauervision · Tessera</span>
              <span>Personal mode · v0.1</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
