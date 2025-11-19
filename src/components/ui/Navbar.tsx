"use client";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth";

export function Navbar() {
  const router = useRouter();
  return (
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
        <div>
          <button
            type="button"
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="rounded-full border border-slate-500/40 bg-slate-900 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
