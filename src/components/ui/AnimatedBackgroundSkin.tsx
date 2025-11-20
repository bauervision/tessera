// components/ui/AnimatedBackgroundSkin.tsx
"use client";

export function AnimatedBackgroundSkin() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#020617]"
    >
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.52]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.12) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(circle at center, black 0, transparent 70%)",
        }}
      />

      {/* Glow blobs */}
      <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl animate-[pulse_14s_ease-in-out_infinite]" />
      <div className="absolute -bottom-40 -left-32 h-80 w-80 rounded-full bg-emerald-500/18 blur-3xl animate-[pulse_18s_ease-in-out_infinite]" />
      <div className="absolute bottom-0 -right-24 h-72 w-72 rounded-full bg-indigo-500/24 blur-3xl animate-[pulse_20s_ease-in-out_infinite]" />
    </div>
  );
}
