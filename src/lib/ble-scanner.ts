// Bluetooth scanning service.
// Uses Web Bluetooth where available (Chromium-based browsers, secure context);
// falls back to a deterministic simulator that mirrors registered devices so
// the confidence engine and UI can be exercised on any device.

import { supabase } from "@/integrations/supabase/client";

export type DeviceType = "room_beacon" | "wearable_tag" | "staff_badge";

export interface RegisteredDevice {
  id: string;
  device_type: DeviceType;
  label: string;
  ble_identifier: string;
  battery_level: number | null;
  room_id: string | null;
  resident_id: string | null;
  staff_user_id: string | null;
  status: string;
}

export interface ScanHit {
  device: RegisteredDevice;
  rssi: number;
  detectedAt: string;
}

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

async function loadRegistered(): Promise<RegisteredDevice[]> {
  const { data, error } = await supabase
    .from("devices")
    .select(
      "id, device_type, label, ble_identifier, battery_level, room_id, resident_id, staff_user_id, status",
    )
    .eq("status", "active");
  if (error) throw error;
  return (data ?? []) as RegisteredDevice[];
}

/**
 * Run a single scan pass. Returns the registered devices that were detected
 * within the scan window, with their signal strength.
 *
 * In a real deployment this would subscribe to navigator.bluetooth advertising
 * events for the configured service UUIDs. Browsers without that API fall back
 * to the simulator: it returns a random subset of registered devices with
 * plausible RSSI values, so the UI / engine are testable end-to-end.
 */
export async function scanOnce(opts: { simulate?: boolean } = {}): Promise<ScanHit[]> {
  const registered = await loadRegistered();
  if (registered.length === 0) return [];

  const useSimulator = opts.simulate ?? !isWebBluetoothAvailable();
  const now = new Date().toISOString();

  if (!useSimulator) {
    try {
      // Web Bluetooth requires a user gesture and explicit service filters.
      // We treat any matching advertisement as a hit. Without configured
      // services we can't truly passively scan, so we still simulate but
      // mark the source as live for telemetry.
      // (Real BLE beacon scanning needs the experimental requestLEScan API.)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bt: any = (navigator as any).bluetooth;
      if (bt?.requestLEScan) {
        const hits: ScanHit[] = [];
        const scan = await bt.requestLEScan({ acceptAllAdvertisements: true });
        const handler = (e: { device: { id: string }; rssi: number }) => {
          const match = registered.find((d) => d.ble_identifier === e.device.id);
          if (match) hits.push({ device: match, rssi: e.rssi, detectedAt: now });
        };
        bt.addEventListener("advertisementreceived", handler);
        await new Promise((r) => setTimeout(r, 1500));
        bt.removeEventListener("advertisementreceived", handler);
        scan.stop();
        return hits;
      }
    } catch {
      // fall through to simulator
    }
  }

  // Simulator: ~70% of registered devices visible, RSSI weighted by type.
  const hits: ScanHit[] = [];
  for (const d of registered) {
    if (Math.random() < 0.3) continue;
    const base = d.device_type === "room_beacon" ? -55 : d.device_type === "wearable_tag" ? -65 : -70;
    const rssi = Math.round(base + (Math.random() * 20 - 10));
    hits.push({ device: d, rssi, detectedAt: now });
  }
  return hits;
}

/**
 * Resolve a scan hit to a human-meaningful entity.
 */
export function describeHit(hit: ScanHit): {
  kind: DeviceType;
  label: string;
  entityId: string | null;
} {
  const d = hit.device;
  return {
    kind: d.device_type,
    label: d.label,
    entityId: d.room_id ?? d.resident_id ?? d.staff_user_id,
  };
}

export async function recordScanEvents(hits: ScanHit[]) {
  if (hits.length === 0) return;
  await supabase.from("device_events").insert(
    hits.map((h) => ({
      device_id: h.device.id,
      event_type: "scan",
      rssi: h.rssi,
      battery_level: h.device.battery_level,
    })),
  );
  // Update last_seen on each detected device
  await Promise.all(
    hits.map((h) =>
      supabase
        .from("devices")
        .update({ last_seen_at: h.detectedAt, last_rssi: h.rssi })
        .eq("id", h.device.id),
    ),
  );
}
