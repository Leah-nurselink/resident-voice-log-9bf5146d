// Native beacon bridge.
//
// The web build runs unchanged. When the page is loaded inside our
// Capacitor Android shell or Electron macOS shell, a small piece of
// native code sets `window.__nativeBleAdapter` with a start/stop/subscribe
// API and a runtime label. This module exposes a typed accessor and a
// Capacitor plugin bootstrapper that installs the bridge on Android.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type NativeRuntime =
  | "capacitor-android"
  | "electron-mac"
  | "electron-win"
  | "electron"
  | "capacitor"
  | null;

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
  /** Which radio path produced this advertisement. */
  source: "capacitor" | "web-bluetooth";
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
  bluetoothEnabled: boolean | null;
  locationEnabled: boolean | null;
  scanCallbacksReceived: number;
}

let lastBridgeError: string | null = null;
let bluetoothEnabled: boolean | null = null;
let locationEnabled: boolean | null = null;
let scanCallbacksReceived = 0;
const rawAdvertisements = new Map<string, RawNativeAdvertisement>();
let rawAdvertisementListeners: Array<(items: RawNativeAdvertisement[]) => void> = [];

// Track the last install attempt so diagnostics can show whether we even tried.
let lastInstallAttempt: { at: string; result: "installed" | "skipped" | "error"; detail: string } | null = null;

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

export function getLastInstallAttempt(): { at: string; result: "installed" | "skipped" | "error"; detail: string } | null {
  return lastInstallAttempt;
}

function emitRawAdvertisements(): void {
  const snapshot = getRawNativeAdvertisements();
  for (const listener of rawAdvertisementListeners) listener(snapshot);
}

function getInjectedCapacitor(): any {
  if (typeof window === "undefined") return null;
  return (window as any).Capacitor ?? null;
}

function isNativeCapacitorDetected(): boolean {
  const cap = getInjectedCapacitor();
  if (!cap) return false;
  if (cap.isNativePlatform?.()) return true;
  const platform = cap.getPlatform?.() ?? null;
  return platform === "android" || platform === "ios";
}

function dataViewToHex(value: unknown): string | null {
  if (!(value instanceof DataView)) return null;
  return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function byteSourceToHex(value: unknown): string | null {
  if (value instanceof DataView) return dataViewToHex(value);
  if (value instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(value))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  if (value instanceof Uint8Array || value instanceof Int8Array) {
    return Array.from(value as Uint8Array)
      .map((b) => (b & 0xff).toString(16).padStart(2, "0"))
      .join("");
  }
  if (typeof value === "string") {
    // Native plugin payloads are base64, but diagnostics may already supply hex.
    if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) return value.toLowerCase();
    try {
      const decoded = atob(value);
      return Array.from(decoded)
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("");
    } catch {
      return null;
    }
  }
  return null;
}

function byteSourceToDataView(value: unknown): DataView | null {
  if (value instanceof DataView) return value;
  const hex = byteSourceToHex(value);
  if (!hex || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return new DataView(bytes.buffer);
}

function dataObjectToHex(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const output: Record<string, string> = {};
  for (const [key, bytes] of Object.entries(value)) {
    const hex = byteSourceToHex(bytes);
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
  scanCallbacksReceived += 1;
  const now = new Date().toISOString();
  const deviceId =
    result.device?.deviceId ?? result.device?.id ?? result.device?.name ?? `unknown-${rawAdvertisements.size + 1}`;
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
    rawAdvertisement: byteSourceToHex(result.rawAdvertisement),
    uuid: parsed.uuid,
    major: parsed.major,
    minor: parsed.minor,
    source: "capacitor",
    firstSeen: previous?.firstSeen ?? now,
    lastSeen: now,
    hits: (previous?.hits ?? 0) + 1,
  });
  emitRawAdvertisements();
}

/**
 * Record an advertisement received through the browser's Web Bluetooth
 * `advertisementreceived` event (e.g. laptop Chrome with the experimental
 * web platform flag enabled). Web Bluetooth hides the MAC address for
 * privacy, so the opaque per-origin `device.id` is used as the key instead.
 */
export function recordRawWebBluetoothAdvertisement(event: any): void {
  scanCallbacksReceived += 1;
  const now = new Date().toISOString();
  const deviceId = event.device?.id ?? `web-${rawAdvertisements.size + 1}`;

  const manufacturerData: Record<string, string> = {};
  const mfrMap: Map<number, DataView> | undefined = event.manufacturerData;
  if (mfrMap && typeof mfrMap.forEach === "function") {
    mfrMap.forEach((value, key) => {
      manufacturerData[String(key)] = byteSourceToHex(value) ?? "[unreadable]";
    });
  }
  const serviceData: Record<string, string> = {};
  const svcMap: Map<string, DataView> | undefined = event.serviceData;
  if (svcMap && typeof svcMap.forEach === "function") {
    svcMap.forEach((value, key) => {
      serviceData[key] = byteSourceToHex(value) ?? "[unreadable]";
    });
  }

  const parsed = parseRawIBeacon(manufacturerData);
  const previous = rawAdvertisements.get(deviceId);
  rawAdvertisements.set(deviceId, {
    deviceId,
    name: event.device?.name ?? null,
    localName: event.device?.name ?? null,
    rssi: typeof event.rssi === "number" ? event.rssi : null,
    txPower: typeof event.txPower === "number" ? event.txPower : null,
    manufacturerData,
    serviceData,
    serviceUuids: Array.isArray(event.uuids) ? event.uuids : [],
    rawAdvertisement: null, // Web Bluetooth does not expose the raw PDU
    uuid: parsed.uuid,
    major: parsed.major,
    minor: parsed.minor,
    source: "web-bluetooth",
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
      bluetoothEnabled,
      locationEnabled,
      scanCallbacksReceived,
    };
  }

  const cap = getInjectedCapacitor();
  const platform = cap?.getPlatform?.() ?? null;
  return {
    detected: isNativeCapacitorDetected(),
    platform,
    adapterInstalled: Boolean(window.__nativeBleAdapter),
    lastError: lastBridgeError,
    bluetoothEnabled,
    locationEnabled,
    scanCallbacksReceived,
  };
}

function booleanPluginResult(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && "value" in value) {
    const result = (value as { value?: unknown }).value;
    return typeof result === "boolean" ? result : null;
  }
  return null;
}

function setBridgeError(message: string): void {
  lastBridgeError = message;
  console.warn("[native-beacon-bridge]", message);
}

/**
 * Build a native BLE adapter using the global `window.Capacitor.Plugins.BluetoothLe`
 * plugin object. This bypasses any bundling or platform-detection issues with the
 * `BleClient` wrapper and should work as long as the Capacitor native shell injected
 * the bridge and the BluetoothLe plugin was registered in the Android project.
 */
async function buildDirectCapacitorAdapter(platform: string): Promise<NativeBleAdapter> {
  const cap = getInjectedCapacitor();
  if (!cap) throw new Error("window.Capacitor is not available");

  const plugin = (window as any).Capacitor?.Plugins?.BluetoothLe;
  if (!plugin) {
    throw new Error(
      "BluetoothLe plugin is not registered. Ensure 'npx cap sync android' ran and the APK was rebuilt.",
    );
  }

  let listenerHandle: any = null;
  let scanning = false;

  return {
    runtime: platform === "android" ? "capacitor-android" : "capacitor",
    async start(handler) {
      await plugin.initialize({ androidNeverForLocation: false });

      try {
        bluetoothEnabled = booleanPluginResult(await plugin.isEnabled());
        if (bluetoothEnabled === false) {
          try {
            await plugin.requestEnable();
            bluetoothEnabled = true;
          } catch {
            throw new Error("Bluetooth is off. Turn on Bluetooth to scan for beacons.");
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("Bluetooth is off")) throw err;
        // isEnabled can fail on some OEMs — continue and let the scan fail loudly.
      }

      if (platform === "android" && typeof plugin.isLocationEnabled === "function") {
        try {
          locationEnabled = booleanPluginResult(await plugin.isLocationEnabled());
          if (locationEnabled === false) {
            if (typeof plugin.openLocationSettings === "function") await plugin.openLocationSettings();
            throw new Error(
              "Android Location is off. Turn Location on in the screen that opened, then return and press Start again.",
            );
          }
        } catch (err) {
          if (err instanceof Error && err.message.startsWith("Android Location is off")) throw err;
        }
      }

      listenerHandle = await plugin.addListener("onScanResult", (result: any) => {
        recordRawNativeAdvertisement(result);
        const mfr = new Map<number, DataView>();
        if (result.manufacturerData) {
          for (const [k, v] of Object.entries(result.manufacturerData)) {
            const id = Number(k);
            const bytes = byteSourceToDataView(v);
            if (bytes) mfr.set(id, bytes);
          }
        }
        const svc = new Map<string, DataView>();
        if (result.serviceData) {
          for (const [k, v] of Object.entries(result.serviceData)) {
            const bytes = byteSourceToDataView(v);
            if (bytes) svc.set(k.toLowerCase(), bytes);
          }
        }
        handler({
          rssi: result.rssi,
          txPower: result.txPower ?? null,
          mac: result.device?.deviceId ?? result.device?.id ?? null,
          device: {
            id: result.device?.deviceId ?? result.device?.id ?? result.device?.name ?? "unknown",
            name: result.localName ?? result.device?.name ?? null,
          },
          manufacturerData: mfr,
          serviceData: svc,
        });
      });

      try {
        await plugin.requestLEScan({ allowDuplicates: true, scanMode: 2 });
      } catch (err) {
        if (listenerHandle) {
          try {
            await listenerHandle.remove();
          } catch {
            /* noop */
          }
        }
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Bluetooth permission denied. Grant Nearby devices permission and try again.";
        throw new Error(message);
      }
      scanning = true;
    },
    async stop() {
      if (listenerHandle) {
        try {
          await listenerHandle.remove();
        } catch {
          /* noop */
        }
        listenerHandle = null;
      }
      if (!scanning) return;
      try {
        await plugin.stopLEScan();
      } catch {
        /* noop */
      }
      scanning = false;
    },
  };
}

/**
 * If we're running inside Capacitor, dynamically load the community BLE
 * plugin and install a native adapter that mimics Web Bluetooth's
 * `advertisementreceived` event shape. Safe no-op in the browser and in
 * Electron (Electron installs its own bridge via preload script).
 */
export async function installCapacitorBridgeIfNeeded(): Promise<void> {
  if (typeof window === "undefined") {
    lastInstallAttempt = { at: new Date().toISOString(), result: "skipped", detail: "window undefined" };
    return;
  }
  if (window.__nativeBleAdapter) {
    lastInstallAttempt = {
      at: new Date().toISOString(),
      result: "installed",
      detail: "adapter already present",
    };
    return; // already installed (Electron preload)
  }

  const cap = getInjectedCapacitor();
  const platform = cap?.getPlatform?.() ?? null;

  if (!isNativeCapacitorDetected()) {
    lastInstallAttempt = {
      at: new Date().toISOString(),
      result: "skipped",
      detail: `not a native Capacitor shell (platform=${platform ?? "null"})`,
    };
    return;
  }

  try {
    // Import Capacitor rather than depending only on window.Capacitor. The
    // native bridge is injected into the remote page at document start, while
    // this API also gives us a reliable platform check across Android WebView
    // versions.
    const { Capacitor } = await import("@capacitor/core");
    const mod = await import("@capacitor-community/bluetooth-le");
    const BleClient = (mod as any).BleClient;
    const runtimePlatform =
      Capacitor.getPlatform() !== "web" ? Capacitor.getPlatform() : platform;

    let scanning = false;

    const adapter: NativeBleAdapter = {
      runtime: runtimePlatform === "android" ? "capacitor-android" : "capacitor",
      async start(handler) {
        // Beacon observations are used to infer room/resident proximity, so
        // do not assert neverForLocation: Android may otherwise filter beacon
        // advertisements from scan results.
        await BleClient.initialize({ androidNeverForLocation: false });

        if (runtimePlatform === "android") {
          try {
            locationEnabled = await BleClient.isLocationEnabled();
            if (!locationEnabled) {
              await BleClient.openLocationSettings();
              throw new Error(
                "Android Location is off. Turn Location on in the screen that opened, then return and press Start again.",
              );
            }
          } catch (err) {
            if (err instanceof Error && err.message.startsWith("Android Location is off")) throw err;
            locationEnabled = null;
          }
        }

        // Preflight: ensure the Bluetooth radio is actually on. If it isn't,
        // prompt the user to enable it (Android shows a system dialog).
        try {
          bluetoothEnabled = await BleClient.isEnabled();
          if (!bluetoothEnabled) {
            try {
              await BleClient.requestEnable();
              bluetoothEnabled = true;
            } catch {
              throw new Error("Bluetooth is off. Turn on Bluetooth to scan for beacons.");
            }
          }
        } catch (err) {
          // isEnabled() itself can reject on some OEMs — surface the raw error.
          if (err instanceof Error && err.message.includes("Bluetooth is off")) throw err;
        }

        try {
          await BleClient.requestLEScan({ allowDuplicates: true, scanMode: 2 }, (result: any) => {
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
    lastInstallAttempt = {
      at: new Date().toISOString(),
      result: "installed",
      detail: `BleClient adapter installed (${adapter.runtime})`,
    };
  } catch (err) {
    // The BleClient wrapper can fail if the module bundle doesn't match the
    // native shell (e.g. remote web build with a Capacitor WebView). Fall back
    // to calling the plugin directly through the global bridge.
    const detail = err instanceof Error ? err.message : String(err);
    console.warn("[native-beacon-bridge] BleClient install failed, trying direct plugin:", detail);

    try {
      const directAdapter = await buildDirectCapacitorAdapter(platform);
      window.__nativeBleAdapter = directAdapter;
      lastBridgeError = null;
      lastInstallAttempt = {
        at: new Date().toISOString(),
        result: "installed",
        detail: `Direct plugin adapter installed (${directAdapter.runtime})`,
      };
    } catch (directErr) {
      const directDetail = directErr instanceof Error ? directErr.message : String(directErr);
      lastBridgeError = `BleClient: ${detail}; Direct plugin: ${directDetail}`;
      lastInstallAttempt = {
        at: new Date().toISOString(),
        result: "error",
        detail: lastBridgeError,
      };
      console.warn("[native-beacon-bridge] Direct plugin install failed:", directDetail);
      throw new Error(lastBridgeError);
    }
  }
}
