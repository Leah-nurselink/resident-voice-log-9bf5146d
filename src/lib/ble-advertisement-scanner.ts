// BLE advertisement scanner.
//
// Continuously listens for nearby BLE advertisements using the experimental
// Web Bluetooth `requestLEScan` API (Chrome flag:
// chrome://flags/#enable-experimental-web-platform-features, HTTPS, user
// gesture required). It parses iBeacon (Apple manufacturer data 0x004C) and
// Eddystone-UID (service data UUID 0xFEAA, frame 0x00) frames, plus any
// generic advertisement, and keeps an in-memory store of observations keyed
// by a stable beacon key.
//
// No pairing. No GATT connections. No persistent device handles.
//
// When `requestLEScan` is unavailable (most browsers) a deterministic
// simulator emits advertisements for whatever beacons are already registered
// in the database so the rest of the workflow (registration, threshold-based
// session start, timeout-based session end) is fully exercisable.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { supabase } from "@/integrations/supabase/client";

export type BeaconProtocol = "ibeacon" | "eddystone-uid" | "generic";

export interface BeaconObservation {
  /** Stable key identifying the *beacon* (not the radio handle). */
  key: string;
  protocol: BeaconProtocol;
  uuid: string | null;
  major: number | null;
  minor: number | null;
  /** Eddystone namespace (only set for eddystone-uid). */
  namespace: string | null;
  /** Eddystone instance (only set for eddystone-uid). */
  instance: string | null;
  /** Some browsers do not expose MAC; remains null when not available. */
  mac: string | null;
  rssi: number;
  /** Calibrated transmit power at 1 m, if the advertisement carried it. */
  txPower: number | null;
  /** Friendly name from the GAP local-name field, when present. */
  name: string | null;
  /** True when this observation was produced by the simulator (no real radio). */
  /** True when this observation was produced by the simulator (no real radio). */
  simulated?: boolean;
  firstSeen: string;

  lastSeen: string;
  hits: number;
}


type Listener = (obs: BeaconObservation[]) => void;

export interface ScannerStatus {
  running: boolean;
  mode: "native" | "simulator" | "unavailable";
  lastError?: string;
  startedAt?: string;
}

const observations = new Map<string, BeaconObservation>();
let listeners: Listener[] = [];
let statusListeners: ((s: ScannerStatus) => void)[] = [];
let scanHandle: { stop: () => void } | null = null;
let simHandle: ReturnType<typeof setInterval> | null = null;
let advHandler: ((e: any) => void) | null = null;
let cleanupHandle: ReturnType<typeof setInterval> | null = null;

const status: ScannerStatus = {
  running: false,
  mode: "unavailable",
};

const OBSERVATION_TTL_MS = 180_000; // keep in "nearby" for 3 min after last hit

export function isLEScanAvailable(): boolean {
  if (typeof navigator === "undefined") return false;
  const bt: any = (navigator as any).bluetooth;
  return !!bt && typeof bt.requestLEScan === "function";
}

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

function emit() {
  const snap = getNearby();
  for (const l of listeners) l(snap);
}

function emitStatus() {
  for (const l of statusListeners) l({ ...status });
}

export function subscribe(fn: Listener): () => void {
  listeners.push(fn);
  fn(getNearby());
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function subscribeStatus(fn: (s: ScannerStatus) => void): () => void {
  statusListeners.push(fn);
  fn({ ...status });
  return () => {
    statusListeners = statusListeners.filter((l) => l !== fn);
  };
}

export function getNearby(): BeaconObservation[] {
  const now = Date.now();
  return Array.from(observations.values())
    .filter((o) => now - new Date(o.lastSeen).getTime() < OBSERVATION_TTL_MS)
    .sort((a, b) => b.rssi - a.rssi);
}

export function getObservationByKey(key: string): BeaconObservation | undefined {
  return observations.get(key);
}

// ---------- Parsers ----------

/** Parse an Apple iBeacon advertisement from the 0x004C manufacturer data. */
function parseIBeacon(data: DataView): {
  uuid: string;
  major: number;
  minor: number;
  txPower: number;
} | null {
  // iBeacon prefix: 02 15  then 16-byte UUID, 2-byte major, 2-byte minor,
  // 1-byte calibrated TX power (signed int8 at 1 m).
  if (data.byteLength < 23) return null;
  if (data.getUint8(0) !== 0x02 || data.getUint8(1) !== 0x15) return null;
  const bytes: string[] = [];
  for (let i = 2; i < 18; i++) {
    bytes.push(data.getUint8(i).toString(16).padStart(2, "0"));
  }
  const hex = bytes.join("");
  const uuid =
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`.toLowerCase();
  const major = data.getUint16(18, false);
  const minor = data.getUint16(20, false);
  const txPower = data.getInt8(22);
  return { uuid, major, minor, txPower };
}

/** Parse an Eddystone-UID frame from service data on UUID 0xFEAA. */
function parseEddystoneUid(data: DataView): {
  namespace: string;
  instance: string;
  txPower: number;
} | null {
  if (data.byteLength < 18) return null;
  if (data.getUint8(0) !== 0x00) return null; // frame type
  const txPower = data.getInt8(1);
  const nsBytes: string[] = [];
  for (let i = 2; i < 12; i++) nsBytes.push(data.getUint8(i).toString(16).padStart(2, "0"));
  const instBytes: string[] = [];
  for (let i = 12; i < 18; i++) instBytes.push(data.getUint8(i).toString(16).padStart(2, "0"));
  return { namespace: nsBytes.join(""), instance: instBytes.join(""), txPower };
}

function record(partial: Omit<BeaconObservation, "firstSeen" | "lastSeen" | "hits">) {
  const now = new Date().toISOString();
  const prev = observations.get(partial.key);
  if (prev) {
    prev.rssi = partial.rssi;
    prev.txPower = partial.txPower ?? prev.txPower;
    prev.mac = partial.mac ?? prev.mac;
    prev.name = partial.name ?? prev.name;
    prev.lastSeen = now;
    prev.hits += 1;
  } else {
    observations.set(partial.key, {
      ...partial,
      simulated: partial.simulated ?? false,
      firstSeen: now,
      lastSeen: now,
      hits: 1,
    });
  }

}

function handleAdvertisement(e: any) {
  const rssi: number = typeof e.rssi === "number" ? e.rssi : -100;
  const txPower: number | null = typeof e.txPower === "number" ? e.txPower : null;
  const name: string | null = e.device?.name ?? null;
  // MAC isn't exposed on web — keep null. Some Chromium builds put a
  // platform-issued opaque id on e.device.id, that's what we already use.
  const mac: string | null = null;

  // iBeacon: manufacturer data 0x004C
  try {
    const apple: DataView | undefined = e.manufacturerData?.get?.(0x004c);
    if (apple) {
      const ib = parseIBeacon(apple);
      if (ib) {
        record({
          key: `ibeacon:${ib.uuid}:${ib.major}:${ib.minor}`,
          protocol: "ibeacon",
          uuid: ib.uuid,
          major: ib.major,
          minor: ib.minor,
          namespace: null,
          instance: null,
          mac,
          rssi,
          txPower: ib.txPower,
          name,
        });
        emit();
        return;
      }
    }
  } catch {
    /* malformed manufacturer data — fall through */
  }

  // Eddystone-UID: service data on UUID 0xFEAA (also accept the canonical
  // 128-bit form '0000feaa-0000-1000-8000-00805f9b34fb' that Chromium uses).
  try {
    const serviceData: Map<string, DataView> | undefined = e.serviceData;
    const eddy =
      serviceData?.get?.("feaa") ?? serviceData?.get?.("0000feaa-0000-1000-8000-00805f9b34fb");
    if (eddy) {
      const u = parseEddystoneUid(eddy);
      if (u) {
        record({
          key: `eddystone-uid:${u.namespace}:${u.instance}`,
          protocol: "eddystone-uid",
          uuid: null,
          major: null,
          minor: null,
          namespace: u.namespace,
          instance: u.instance,
          mac,
          rssi,
          txPower: u.txPower,
          name,
        });
        emit();
        return;
      }
    }
  } catch {
    /* not eddystone */
  }

  // Generic advertisement — keep it so admins can still register unknown
  // hardware (e.g. for staff badges that don't transmit iBeacon).
  const id: string | undefined = e.device?.id;
  if (id) {
    record({
      key: `generic:${id}`,
      protocol: "generic",
      uuid: null,
      major: null,
      minor: null,
      namespace: null,
      instance: null,
      mac,
      rssi,
      txPower,
      name,
    });
    emit();
  }
}

// ---------- Simulator ----------

let simulatorTickCount = 0;

async function simulatorTick() {
  simulatorTickCount += 1;
  const { data } = await supabase
    .from("devices")
    .select(
      "id, beacon_protocol, beacon_uuid, beacon_major, beacon_minor, ble_identifier, tx_power, label, status",
    )
    .eq("status", "active");
  if (!data) return;
  for (const d of data as any[]) {
    // 70% of registered beacons "visible" each tick.
    if (Math.random() < 0.3) continue;
    const txPower = (d.tx_power as number | null) ?? -59;
    const rssi = Math.round(txPower - 10 + (Math.random() * 14 - 7));
    if (d.beacon_protocol === "ibeacon" && d.beacon_uuid) {
      record({
        key: `ibeacon:${d.beacon_uuid}:${d.beacon_major ?? 0}:${d.beacon_minor ?? 0}`,
        protocol: "ibeacon",
        uuid: d.beacon_uuid,
        major: d.beacon_major,
        minor: d.beacon_minor,
        namespace: null,
        instance: null,
        mac: null,
        rssi,
        txPower,
        name: d.label,
        simulated: true,
      });
    } else if (d.beacon_protocol === "eddystone-uid" && d.ble_identifier?.startsWith("eddystone-uid:")) {
      const [, ns, inst] = d.ble_identifier.split(":");
      record({
        key: d.ble_identifier,
        protocol: "eddystone-uid",
        uuid: null,
        major: null,
        minor: null,
        namespace: ns ?? null,
        instance: inst ?? null,
        mac: null,
        rssi,
        txPower,
        name: d.label,
        simulated: true,
      });
    } else {
      record({
        key: d.ble_identifier ?? `generic:${d.id}`,
        protocol: "generic",
        uuid: null,
        major: null,
        minor: null,
        namespace: null,
        instance: null,
        mac: null,
        rssi,
        txPower,
        name: d.label,
        simulated: true,
      });
    }
  }

  // Inject a SINGLE stable demo beacon so the registration flow can be
  // exercised end-to-end without real hardware. Keeping the key stable
  // (fixed major/minor) prevents "5 different beacons" confusion.
  if (simulatorTickCount % 4 === 0) {
    const fakeUuid = "f7826da6-4fa2-4e98-8024-bc5b71e0893e";
    record({
      key: `ibeacon:${fakeUuid}:1:1`,
      protocol: "ibeacon",
      uuid: fakeUuid,
      major: 1,
      minor: 1,
      namespace: null,
      instance: null,
      mac: null,
      rssi: -68 + Math.round(Math.random() * 6 - 3),
      txPower: -59,
      name: "DEMO beacon (simulated)",
      simulated: true,
    });
  }
  emit();
}


// ---------- Lifecycle ----------

export async function startScanner(): Promise<void> {
  if (status.running) return;
  status.lastError = undefined;
  status.startedAt = new Date().toISOString();

  if (isLEScanAvailable()) {
    try {
      const bt: any = (navigator as any).bluetooth;
      advHandler = (e: any) => handleAdvertisement(e);
      bt.addEventListener("advertisementreceived", advHandler);
      scanHandle = await bt.requestLEScan({ acceptAllAdvertisements: true, keepRepeatedDevices: true });
      status.running = true;
      status.mode = "native";
    } catch (e) {
      status.lastError = e instanceof Error ? e.message : "requestLEScan failed";
      // Fall back to simulator so the workflow still runs.
      simHandle = setInterval(() => void simulatorTick(), 3_000);
      void simulatorTick();
      status.running = true;
      status.mode = "simulator";
    }
  } else {
    simHandle = setInterval(() => void simulatorTick(), 3_000);
    void simulatorTick();
    status.running = true;
    status.mode = "simulator";
  }

  // Periodically drop stale observations so the UI doesn't show ghosts.
  cleanupHandle = setInterval(() => emit(), 5_000);
  emitStatus();
  emit();
}

export function stopScanner(): void {
  if (!status.running) return;
  if (scanHandle) {
    try {
      scanHandle.stop();
    } catch {
      /* noop */
    }
    scanHandle = null;
  }
  if (advHandler) {
    try {
      const bt: any = (navigator as any).bluetooth;
      bt?.removeEventListener?.("advertisementreceived", advHandler);
    } catch {
      /* noop */
    }
    advHandler = null;
  }
  if (simHandle) {
    clearInterval(simHandle);
    simHandle = null;
  }
  if (cleanupHandle) {
    clearInterval(cleanupHandle);
    cleanupHandle = null;
  }
  status.running = false;
  status.mode = isLEScanAvailable() ? "native" : "unavailable";
  emitStatus();
}

export function getStatus(): ScannerStatus {
  return { ...status };
}

export function clearObservations() {
  observations.clear();
  emit();
}
