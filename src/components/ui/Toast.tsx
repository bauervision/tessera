"use client";

import { useEffect } from "react";

export type ToastVariant = "success" | "error" | "info";

export function Toast({
  message,
  variant = "info",
  duration = 2500,
  onClose,
}: {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onClose, duration);
    return () => clearTimeout(id);
  }, [message, duration, onClose]);

  const colors =
    variant === "success"
      ? "border-emerald-400 bg-emerald-500/10 text-emerald-100"
      : variant === "error"
      ? "border-rose-400 bg-rose-500/10 text-rose-100"
      : "border-sky-400 bg-sky-500/10 text-sky-100";

  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-lg ${colors}`}
      >
        <span>{message}</span>
        <button
          type="button"
          className="ml-1 text-[10px] opacity-70 hover:opacity-100"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
