"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, VALID_EMAIL } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(VALID_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = login(email.trim(), password);
    if (!ok) {
      setError("Invalid credentials");
      return;
    }
    setError(null);
    router.push("/"); // go to dashboard
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/90 p-6 shadow-xl">
        <h1 className="text-lg font-semibold text-slate-50">
          Sign in to Tessera
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Personal Tessera board. Use your private login to continue.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-300">
              Email
            </label>
            <input
              type="email"
              className="w-full rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-300">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 outline-none focus:border-sky-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-[11px] text-rose-300 mt-1">{error}</p>}

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="submit"
              className="rounded-full bg-sky-500 px-3 py-1 text-[11px] font-medium text-slate-950 hover:bg-sky-400"
            >
              Sign in
            </button>
          </div>

          <p className="mt-2 text-[10px] text-slate-500">
            Hint: <span className="font-mono">{VALID_EMAIL}</span> /{" "}
            <span className="font-mono">0okm)OKM</span>
          </p>
        </form>
      </div>
    </div>
  );
}
