// Runtime "surface" detection.
//
// carer  = Android/iOS Capacitor shell, or the mobile browser opting into
//          the field-worker UI. BLE, voice, one-tap capture.
// manager = classic web dashboard for managers/admin.
//
// The choice is a hint; users can always navigate between /carer and
// /dashboard manually.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Surface = "carer" | "manager";

export function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export function detectSurface(): Surface {
  if (typeof window === "undefined") return "manager";
  if (isNativeShell()) return "carer";
  // Small screen + touch → default carer, but user can navigate away.
  const isSmall = window.matchMedia?.("(max-width: 768px)").matches ?? false;
  const isTouch = "ontouchstart" in window;
  return isSmall && isTouch ? "carer" : "manager";
}
