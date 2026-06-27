// Auto-connect service for BLE devices.
//
// Once a device has been paired (granted permission via a user gesture), modern
// Chromium browsers expose it via `navigator.bluetooth.getDevices()` without
// re-prompting. We keep a list of paired device IDs in localStorage, and on
// app load we:
//   1. Re-acquire the BluetoothDevice handles
//   2. Subscribe to `advertisementreceived` (watchAdvertisements) so the device
//      reconnects the moment it comes in range
//   3. Re-attach a `gattserverdisconnected` listener that retries with backoff
//
// When Web Bluetooth isn't available (Safari/Firefox or non-secure context) we
// fall back to a periodic scan loop using the existing simulator so the rest of
// the app keeps working end-to-end.

import { scanOnce, recordScanEvents, isWebBluetoothAvailable, type ScanHit } from "./ble-scanner";
import { inferInteraction, startCareSessionIfConfident } from "./confidence-engine";
import { supabase } from "@/integrations/supabase/client";

const ENABLED_KEY = "forgeai.ble.autoconnect.enabled";
const PAIRED_KEY = "forgeai.ble.autoconnect.paired";
const POLL_MS = 15_000;

type Listener = (status: AutoConnectStatus) => void;

export interface AutoConnectStatus {
  enabled: boolean;
  mode: "native" | "simulator" | "unavailable";
  pairedCount: number;
  connectedCount: number;
  lastHits: ScanHit[];
  lastError?: string;
  lastTickAt?: string;
}

let listeners: Listener[] = [];
let pollHandle: ReturnType<typeof setInterval> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tracked = new Map<string, any>(); // BluetoothDevice by id

const status: AutoConnectStatus = {
  enabled: false,
  mode: isWebBluetoothAvailable() ? "native" : "unavailable",
  pairedCount: 0,
  connectedCount: 0,
  lastHits: [],
};

function emit() {
  for (const l of listeners) l(status);
}

function loadPairedIds(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PAIRED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function savePairedIds(ids: string[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PAIRED_KEY, JSON.stringify(Array.from(new Set(ids))));
}

export function rememberPairedDevice(deviceId: string) {
  const ids = loadPairedIds();
  ids.push(deviceId);
  savePairedIds(ids);
  status.pairedCount = new Set(ids).size;
  emit();
}

export function forgetPairedDevice(deviceId: string) {
  const ids = loadPairedIds().filter((id) => id !== deviceId);
  savePairedIds(ids);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dev: any = tracked.get(deviceId);
  if (dev?.gatt?.connected) {
    try {
      dev.gatt.disconnect();
    } catch {
      // ignore
    }
  }
  tracked.delete(deviceId);
  status.pairedCount = new Set(ids).size;
  status.connectedCount = Array.from(tracked.values()).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (d: any) => d?.gatt?.connected,
  ).length;
  emit();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function attachDevice(device: any) {
  if (tracked.has(device.id)) return;
  tracked.set(device.id, device);

  const reconnect = async () => {
    try {
      if (device.gatt && !device.gatt.connected) {
        await device.gatt.connect();
      }
      status.connectedCount = Array.from(tracked.values()).filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (d: any) => d?.gatt?.connected,
      ).length;
      emit();
    } catch {
      // backoff & retry while still tracked
      setTimeout(() => {
        if (tracked.has(device.id) && status.enabled) void reconnect();
      }, 5_000);
    }
  };

  device.addEventListener?.("gattserverdisconnected", () => {
    if (status.enabled) void reconnect();
  });

  // watchAdvertisements lets the browser reconnect automatically when the
  // device comes back into range (Chrome flag: experimental web platform).
  try {
    if (typeof device.watchAdvertisements === "function") {
      await device.watchAdvertisements();
    }
  } catch {
    // not supported — fine, gattserverdisconnected handler still retries
  }

  void reconnect();
}

async function reattachPairedDevices() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bt: any = (navigator as any).bluetooth;
  if (!bt?.getDevices) return;
  try {
    const devices = await bt.getDevices();
    const paired = new Set(loadPairedIds());
    for (const d of devices) {
      if (paired.has(d.id)) void attachDevice(d);
    }
  } catch (e) {
    status.lastError = e instanceof Error ? e.message : "getDevices failed";
    emit();
  }
}

async function tick() {
  try {
    const hits = await scanOnce();
    status.lastHits = hits;
    status.lastTickAt = new Date().toISOString();
    if (hits.length > 0) {
      await recordScanEvents(hits);
      const { data: u } = await supabase.auth.getUser();
      const guess = inferInteraction(hits, { signedInStaffUserId: u?.user?.id });
      await startCareSessionIfConfident(guess, 0.6);
    }
    status.lastError = undefined;
  } catch (e) {
    status.lastError = e instanceof Error ? e.message : "scan failed";
  }
  emit();
}

export function getAutoConnectStatus(): AutoConnectStatus {
  return { ...status, lastHits: [...status.lastHits] };
}

export function subscribeAutoConnect(fn: Listener): () => void {
  listeners.push(fn);
  fn(status);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export async function startAutoConnect() {
  status.enabled = true;
  status.mode = isWebBluetoothAvailable() ? "native" : "simulator";
  status.pairedCount = loadPairedIds().length;
  if (typeof localStorage !== "undefined") localStorage.setItem(ENABLED_KEY, "1");

  if (isWebBluetoothAvailable()) {
    await reattachPairedDevices();
  }

  if (pollHandle) clearInterval(pollHandle);
  pollHandle = setInterval(() => void tick(), POLL_MS);
  void tick();
  emit();
}

export function stopAutoConnect() {
  status.enabled = false;
  if (typeof localStorage !== "undefined") localStorage.removeItem(ENABLED_KEY);
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
  emit();
}

export function isAutoConnectPersisted(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(ENABLED_KEY) === "1";
}

// Auto-resume on app load if user previously enabled it.
if (typeof window !== "undefined" && isAutoConnectPersisted()) {
  // Defer so the rest of the app boots first.
  setTimeout(() => void startAutoConnect(), 1000);
}
