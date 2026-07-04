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
  device?: { id?: string; name?: string | null };
  /** Map<companyId, DataView> — same shape as Web Bluetooth. */
  manufacturerData?: Map<number, DataView>;
  /** Map<uuid, DataView> — same shape as Web Bluetooth. */
  serviceData?: Map<string, DataView>;
}

export interface NativeBleAdapter {
  runtime: NativeRuntime;
  start(handler: (adv: NativeAdvertisement) => void): Promise<void>;
  stop(): Promise<void> | void;
}

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

/**
 * If we're running inside Capacitor, dynamically load the community BLE
 * plugin and install a native adapter that mimics Web Bluetooth's
 * `advertisementreceived` event shape. Safe no-op in the browser and in
 * Electron (Electron installs its own bridge via preload script).
 */
export async function installCapacitorBridgeIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.__nativeBleAdapter) return; // already installed (Electron preload)

  // Capacitor exposes `window.Capacitor` when running inside the shell.
  const cap: any = (window as any).Capacitor;
  if (!cap?.isNativePlatform?.()) return;

  try {
    const mod = await import("@capacitor-community/bluetooth-le");
    const BleClient = (mod as any).BleClient;
    const numbersToDataView = (mod as any).numbersToDataView as
      | ((arr: number[]) => DataView)
      | undefined;

    let scanning = false;

    const adapter: NativeBleAdapter = {
      runtime: cap.getPlatform?.() === "android" ? "capacitor-android" : "capacitor",
      async start(handler) {
        await BleClient.initialize({ androidNeverForLocation: true });
        await BleClient.requestLEScan({ allowDuplicates: true }, (result: any) => {
          const mfr = new Map<number, DataView>();
          if (result.manufacturerData && numbersToDataView) {
            for (const [k, v] of Object.entries(result.manufacturerData)) {
              const id = Number(k);
              if (Array.isArray(v)) mfr.set(id, numbersToDataView(v as number[]));
              else if (v instanceof DataView) mfr.set(id, v);
            }
          }
          const svc = new Map<string, DataView>();
          if (result.serviceData && numbersToDataView) {
            for (const [k, v] of Object.entries(result.serviceData)) {
              if (Array.isArray(v)) svc.set(k.toLowerCase(), numbersToDataView(v as number[]));
              else if (v instanceof DataView) svc.set(k.toLowerCase(), v);
            }
          }
          handler({
            rssi: result.rssi,
            txPower: result.txPower ?? null,
            device: {
              id: result.device?.deviceId ?? result.device?.name ?? "unknown",
              name: result.localName ?? result.device?.name ?? null,
            },
            manufacturerData: mfr,
            serviceData: svc,
          });
        });
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
  } catch (err) {
    console.warn("[native-beacon-bridge] Capacitor BLE plugin unavailable:", err);
  }
}
