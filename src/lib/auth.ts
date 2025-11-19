// lib/auth.ts
"use client";

const AUTH_KEY = "tessera:auth";

export const VALID_EMAIL = "mike@bauer.com";
export const VALID_PASSWORD = "0okm)OKM";

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUTH_KEY) === "true";
}

export function login(email: string, password: string): boolean {
  if (email === VALID_EMAIL && password === VALID_PASSWORD) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(AUTH_KEY, "true");
    }
    return true;
  }
  return false;
}

export function logout() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_KEY);
}
