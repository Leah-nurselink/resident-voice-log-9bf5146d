// Real Web Bluetooth helpers.
//
// Browsers don't expose passive BLE scanning without a flag, but they DO let
// the user pick a device via a chooser (user-gesture required), and once
// granted we can call gatt.connect() on demand. This module is the honest
// path used by the Pair wizard and the per-device Test button.

/* eslint-disable @typescript-eslint/no-explicit-any */

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export interface PairedHandle {
  id: string;
  name: string | null;
}

/**
 * Open the browser's BLE chooser. Must be called inside a user gesture
 * (button click). Returns the picked device id + name on success.
 */
export async function requestAndPair(): Promise<PairedHandle> {
  if (!isWebBluetoothAvailable()) {
    throw new Error(
      "Web Bluetooth isn't available in this browser. Use Chrome or Edge on Android/Windows/macOS over HTTPS.",
    );
  }
  const bt: any = (navigator as any).bluetooth;
  const device: any = await bt.requestDevice({
    acceptAllDevices: true,
    optionalServices: ["battery_service", "device_information"],
  });
  return { id: device.id, name: device.name ?? null };
}

/**
 * Try to reach a previously-paired device by its browser-issued id.
 * Returns the measured RSSI when an advertisement is heard, otherwise
 * resolves with `connected: true` if a GATT connection succeeds.
 */
export async function testConnectById(deviceId: string, timeoutMs = 6000): Promise<{
  connected: boolean;
  rssi: number | null;
  name: string | null;
}> {
  if (!isWebBluetoothAvailable()) {
    throw new Error("Web Bluetooth not available in this browser.");
  }
  const bt: any = (navigator as any).bluetooth;
  if (typeof bt.getDevices !== "function") {
    throw new Error(
      "This browser can't recall paired devices. Re-pair using 'Scan with browser' so we can connect.",
    );
  }
  const devices: any[] = await bt.getDevices();
  const dev = devices.find((d) => d.id === deviceId);
  if (!dev) {
    throw new Error(
      "This BLE id isn't paired with the browser. Click 'Scan with browser' on the device and pick it from the chooser.",
    );
  }

  // Try to hear an advertisement first (best signal of "in range").
  let rssi: number | null = null;
  if (typeof dev.watchAdvertisements === "function") {
    try {
      const ac = new AbortController();
      const heard = new Promise<number | null>((resolve) => {
        const onAdv = (e: any) => {
          dev.removeEventListener?.("advertisementreceived", onAdv);
          resolve(typeof e.rssi === "number" ? e.rssi : null);
        };
        dev.addEventListener?.("advertisementreceived", onAdv);
        setTimeout(() => {
          dev.removeEventListener?.("advertisementreceived", onAdv);
          resolve(null);
        }, timeoutMs);
      });
      await dev.watchAdvertisements({ signal: ac.signal });
      rssi = await heard;
      try {
        ac.abort();
      } catch {
        /* noop */
      }
    } catch {
      // Advertisement watching not supported — fall back to gatt.
    }
  }

  // Attempt a real GATT connection. If the device isn't in range / powered on
  // this throws — we report that honestly instead of faking success.
  let connected = false;
  try {
    if (dev.gatt) {
      await dev.gatt.connect();
      connected = dev.gatt.connected === true;
      // Disconnect right away — this is just a probe.
      try {
        dev.gatt.disconnect();
      } catch {
        /* noop */
      }
    }
  } catch (e) {
    if (rssi === null) {
      throw new Error(
        `Couldn't reach device: ${e instanceof Error ? e.message : "GATT connection failed"}. Make sure it's powered on and in range.`,
      );
    }
    // We at least heard an advertisement — treat as reachable.
  }

  return { connected, rssi, name: dev.name ?? null };
}
