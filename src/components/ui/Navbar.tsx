"use client";

import { useRouter, usePathname } from "next/navigation";
import { logout } from "@/lib/auth";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogoClick = () => {
    if (pathname === "/") {
      // On home: treat click as logout
      logout();
      router.push("/login");
    } else {
      // Anywhere else: go back to dashboard
      router.push("/");
    }
  };

  return (
    <nav>
      <div className="flex justify-center pt-4">
        <button
          type="button"
          onClick={handleLogoClick}
          className="flex items-center group"
          title={pathname === "/" ? "← Logout" : "← Dashboard"}
        >
          <div className="flex h-26 w-26 rounded-4xl items-center justify-center transition group-hover:ring-sky-400/80 group-hover:bg-slate-900/60">
            <img
              src="/TesseraIcon.png"
              alt="Tessera logo"
              className="h-24 w-24 object-contain transform transition-transform duration-200 group-hover:scale-105"
            />
          </div>
        </button>
      </div>
    </nav>
  );
}
