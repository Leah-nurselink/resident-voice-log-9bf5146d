// Native beacon bridge.
//
// The web build runs unchanged. When the page is loaded inside our
// Capacitor Android shell or Electron macOS shell, a small piece of
// native code sets `window.__nativeBleAdapter` with a start/stop/subscribe
// API and a runtime label. This module exposes a typed accessor and a
// Capacitor plugin bootstrapper that installs the bridge on Android.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type NativeRuntime = "capacitor-android" | "electron-mac" | "electron" | "capacitor" | null;

export interface NativeAdvertisement {
  rssi?: number;
  txPower?: number | null;
  /** Android exposes the BLE device address here; browsers may not. */
  mac?: string | null;
  device?: { id?: string; name?: string | null };
  /** Map<companyId, DataView> — same shape as Web Bluetooth. */
  manufacturerData?: Map<number, DataView>;
  /** Map<uuid, DataView> — same shape as Web Bluetooth. */
  serviceData?: Map<string, DataView>;
}

export interface RawNativeAdvertisement {
  deviceId: string;
  name: string | null;
  localName: string | null;
  rssi: number | null;
  txPower: number | null;
  manufacturerData: Record<string, string>;
  serviceData: Record<string, string>;
  serviceUuids: string[];
  rawAdvertisement: string | null;
  uuid: string | null;
  major: number | null;
  minor: number | null;
  firstSeen: string;
  lastSeen: string;
  hits: number;
}

export interface NativeBleAdapter {
  runtime: NativeRuntime;
  start(handler: (adv: NativeAdvertisement) => void): Promise<void>;
  stop(): Promise<void> | void;
}

export interface NativeBridgeDiagnostic {
  detected: boolean;
  platform: string | null;
  adapterInstalled: boolean;
  lastError: string | null;
}

let lastBridgeError: string | null = null;
const rawAdvertisements = new Map<string, RawNativeAdvertisement>();
let rawAdvertisementListeners: Array<(items: RawNativeAdvertisement[]) => void> = [];

declare global {
  interface Window {
    __nativeBleAdapter?: NativeBleAdapter;
  }
}

export function getNativeAdapter(): NativeBleAdapter | null {
  if (typeof window === "undefined") return null;
  return window.__nativeBleAdapter ?? null;
}

export function getNativeRuntime(): NativeRuntime {
  return getNativeAdapter()?.runtime ?? null;
}

export function getRawNativeAdvertisements(): RawNativeAdvertisement[] {
  return Array.from(rawAdvertisements.values()).sort((a, b) =>
    b.lastSeen.localeCompare(a.lastSeen),
  );
}

export function subscribeRawNativeAdvertisements(
  listener: (items: RawNativeAdvertisement[]) => void,
): () => void {
  rawAdvertisementListeners.push(listener);
  listener(getRawNativeAdvertisements());
  return () => {
    rawAdvertisementListeners = rawAdvertisementListeners.filter((item) => item !== listener);
  };
}

export function clearRawNativeAdvertisements(): void {
  rawAdvertisements.clear();
  emitRawAdvertisements();
}

function emitRawAdvertisements(): void {
  const snapshot = getRawNativeAdvertisements();
  for (const listener of rawAdvertisementListeners) listener(snapshot);
}

function dataViewToHex(value: unknown): string | null {
  if (!(value instanceof DataView)) return null;
  return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function dataObjectToHex(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const output: Record<string, string> = {};
  for (const [key, bytes] of Object.entries(value)) {
    const hex = dataViewToHex(bytes);
    output[key] = hex ?? `[unreadable ${Object.prototype.toString.call(bytes)}]`;
  }
  return output;
}

function parseRawIBeacon(manufacturerData: Record<string, string>): {
  uuid: string | null;
  major: number | null;
  minor: number | null;
} {
  const apple = manufacturerData["76"] ?? manufacturerData["0x004c"] ?? manufacturerData["004c"];
  if (!apple || !apple.toLowerCase().startsWith("0215") || apple.length < 46) {
    return { uuid: null, major: null, minor: null };
  }
  const payload = apple.toLowerCase();
  const compactUuid = payload.slice(4, 36);
  const uuid = `${compactUuid.slice(0, 8)}-${compactUuid.slice(8, 12)}-${compactUuid.slice(12, 16)}-${compactUuid.slice(16, 20)}-${compactUuid.slice(20, 32)}`;
  return {
    uuid,
    major: Number.parseInt(payload.slice(36, 40), 16),
    minor: Number.parseInt(payload.slice(40, 44), 16),
  };
}

function recordRawNativeAdvertisement(result: any): void {
  const now = new Date().toISOString();
  const deviceId =
    result.device?.deviceId ?? result.device?.name ?? `unknown-${rawAdvertisements.size + 1}`;
  const manufacturerData = dataObjectToHex(result.manufacturerData);
  const parsed = parseRawIBeacon(manufacturerData);
  const previous = rawAdvertisements.get(deviceId);
  rawAdvertisements.set(deviceId, {
    deviceId,
    name: result.device?.name ?? null,
    localName: result.localName ?? null,
    rssi: typeof result.rssi === "number" ? result.rssi : null,
    txPower: typeof result.txPower === "number" && result.txPower !== 127 ? result.txPower : null,
    manufacturerData,
    serviceData: dataObjectToHex(result.serviceData),
    serviceUuids: Array.isArray(result.uuids) ? result.uuids : [],
    rawAdvertisement: dataViewToHex(result.rawAdvertisement),
    uuid: parsed.uuid,
    major: parsed.major,
    minor: parsed.minor,
    firstSeen: previous?.firstSeen ?? now,
    lastSeen: now,
    hits: (previous?.hits ?? 0) + 1,
  });
  emitRawAdvertisements();
}

export function getNativeBridgeDiagnostic(): NativeBridgeDiagnostic {
  if (typeof window === "undefined") {
    return {
      detected: false,
      platform: null,
      adapterInstalled: false,
      lastError: lastBridgeError,
    };
  }

  const cap: any = (window as any).Capacitor;
  const platform = cap?.getPlatform?.() ?? null;
  return {
    detected: Boolean(cap?.isNativePlatform?.() || platform === "android" || platform === "ios"),
    platform,
    adapterInstalled: Boolean(window.__nativeBleAdapter),
    lastError: lastBridgeError,
  };
}

/**
 * If we're running inside Capacitor, dynamically load the community BLE
 * plugin and install a native adapter that mimics Web Bluetooth's
 * `advertisementreceived` event shape. Safe no-op in the browser and in
 * Electron (Electron installs its own bridge via preload script).
 */
export async function installCapacitorBridgeIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.__nativeBleAdapter) return; // already installed (Electron preload)

  try {
    // Import Capacitor rather than depending only on window.Capacitor. The
    // native bridge is injected into the remote page at document start, while
    // this API also gives us a reliable platform check across Android WebView
    // versions.
    const { Capacitor } = await import("@capacitor/core");
    const injectedCap: any = (window as any).Capacitor;
    const isNative =
      Capacitor.isNativePlatform() ||
      injectedCap?.isNativePlatform?.() ||
      injectedCap?.getPlatform?.() === "android";
    if (!isNative) {
      lastBridgeError = null;
      return;
    }

    const mod = await import("@capacitor-community/bluetooth-le");
    const BleClient = (mod as any).BleClient;
    const platform =
      Capacitor.getPlatform() !== "web" ? Capacitor.getPlatform() : injectedCap?.getPlatform?.();

    let scanning = false;

    const adapter: NativeBleAdapter = {
      runtime: platform === "android" ? "capacitor-android" : "capacitor",
      async start(handler) {
        // Beacon observations are used to infer room/resident proximity, so
        // do not assert neverForLocation: Android may otherwise filter beacon
        // advertisements from scan results.
        await BleClient.initialize({ androidNeverForLocation: false });

        // Preflight: ensure the Bluetooth radio is actually on. If it isn't,
        // prompt the user to enable it (Android shows a system dialog).
        try {
          const enabled = await BleClient.isEnabled();
          if (!enabled) {
            try {
              await BleClient.requestEnable();
            } catch {
              throw new Error("Bluetooth is off. Turn on Bluetooth to scan for beacons.");
            }
          }
        } catch (err) {
          // isEnabled() itself can reject on some OEMs — surface the raw error.
          if (err instanceof Error && err.message.includes("Bluetooth is off")) throw err;
        }

        try {
          await BleClient.requestLEScan({ allowDuplicates: true }, (result: any) => {
            // Diagnostics tap: capture every native result before protocol
            // parsing, registration matching, or any CareCore filtering.
            recordRawNativeAdvertisement(result);
            const mfr = new Map<number, DataView>();
            if (result.manufacturerData) {
              for (const [k, v] of Object.entries(result.manufacturerData)) {
                const id = Number(k);
                if (v instanceof DataView) mfr.set(id, v);
              }
            }
            const svc = new Map<string, DataView>();
            if (result.serviceData) {
              for (const [k, v] of Object.entries(result.serviceData)) {
                if (v instanceof DataView) svc.set(k.toLowerCase(), v);
              }
            }
            handler({
              rssi: result.rssi,
              txPower: result.txPower ?? null,
              mac: result.device?.deviceId ?? null,
              device: {
                id: result.device?.deviceId ?? result.device?.name ?? "unknown",
                name: result.localName ?? result.device?.name ?? null,
              },
              manufacturerData: mfr,
              serviceData: svc,
            });
          });
        } catch (err) {
          // Most commonly a denied BLUETOOTH_SCAN / location permission.
          const message =
            err instanceof Error && err.message
              ? err.message
              : "Bluetooth permission denied. Grant Nearby devices permission and try again.";
          throw new Error(message);
        }
        scanning = true;
      },
      async stop() {
        if (!scanning) return;
        try {
          await BleClient.stopLEScan();
        } catch {
          /* noop */
        }
        scanning = false;
      },
    };

    window.__nativeBleAdapter = adapter;
    lastBridgeError = null;
  } catch (err) {
    lastBridgeError =
      err instanceof Error && err.message
        ? err.message
        : "The native Bluetooth bridge could not be initialized.";
    console.warn("[native-beacon-bridge] Capacitor BLE plugin unavailable:", err);
    throw new Error(lastBridgeError);
  }
}
