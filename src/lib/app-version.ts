// Injected at build time by vite.config.ts
declare const __APP_COMMIT__: string;
declare const __APP_BUILD_TIME__: string;

export const APP_COMMIT: string =
  typeof __APP_COMMIT__ !== "undefined" ? __APP_COMMIT__ : "dev";
export const APP_BUILD_TIME: string =
  typeof __APP_BUILD_TIME__ !== "undefined" ? __APP_BUILD_TIME__ : new Date().toISOString();

/** Short human-friendly version: YYYY.MM.DD-<shortsha> */
export function getAppVersion(): string {
  const d = new Date(APP_BUILD_TIME);
  if (Number.isNaN(d.getTime())) return APP_COMMIT;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}.${m}.${day}-${APP_COMMIT}`;
}

export function getAppBuildTimeLocal(): string {
  const d = new Date(APP_BUILD_TIME);
  return Number.isNaN(d.getTime()) ? APP_BUILD_TIME : d.toLocaleString();
}
