// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

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
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold tracking-[0.25em] uppercase">
                  Tessera
                </span>
                <span className="text-xs text-slate-400">
                  Context for every tile of your work
                </span>
              </div>
              {/* Theme toggle placeholder for later */}
              <div className="h-6 w-16 rounded-full border border-white/10 bg-slate-900/80" />
            </div>
          </header>

          <main className="flex-1">
            <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
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
