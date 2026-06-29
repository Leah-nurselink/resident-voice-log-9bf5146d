// Session manager.
//
// Watches the in-memory scanner observations and the registered `devices`
// rows. When a registered beacon is observed at or above its configured
// RSSI threshold, we open a care_session attributed to whatever entity that
// device is linked to (resident, room, or staff). When the beacon falls out
// of range for longer than its configured timeout, we close the session.

import { supabase } from "@/integrations/supabase/client";
import {
  subscribe as subscribeObservations,
  type BeaconObservation,
} from "./ble-advertisement-scanner";

export interface RegisteredBeacon {
  id: string;
  device_type: "room_beacon" | "wearable_tag" | "staff_badge";
  label: string;
  beacon_protocol: "ibeacon" | "eddystone-uid" | "generic";
  beacon_uuid: string | null;
  beacon_major: number | null;
  beacon_minor: number | null;
  ble_identifier: string;
  rssi_threshold: number;
  session_timeout_seconds: number;
  room_id: string | null;
  resident_id: string | null;
  staff_user_id: string | null;
}

export interface ActiveTrigger {
  deviceId: string;
  sessionId: string | null;
  lastRssi: number;
  lastSeen: string;
  startedAt: string;
}

type Listener = (state: SessionManagerState) => void;

export interface SessionManagerState {
  running: boolean;
  registeredCount: number;
  activeSessions: ActiveTrigger[];
  lastTickAt: string | null;
  lastError?: string;
}

const state: SessionManagerState = {
  running: false,
  registeredCount: 0,
  activeSessions: [],
  lastTickAt: null,
};

let listeners: Listener[] = [];
let registered: RegisteredBeacon[] = [];
let lastObservations: BeaconObservation[] = [];
let tickHandle: ReturnType<typeof setInterval> | null = null;
let unsubscribeScanner: (() => void) | null = null;
// deviceId -> open trigger state (kept across ticks)
const triggers = new Map<string, ActiveTrigger>();

function emit() {
  state.activeSessions = Array.from(triggers.values());
  for (const l of listeners) l({ ...state, activeSessions: [...state.activeSessions] });
}

export function subscribeSessionManager(fn: Listener): () => void {
  listeners.push(fn);
  fn({ ...state, activeSessions: [...state.activeSessions] });
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function getSessionManagerState(): SessionManagerState {
  return { ...state, activeSessions: [...state.activeSessions] };
}

function keyForDevice(d: RegisteredBeacon): string {
  if (d.beacon_protocol === "ibeacon" && d.beacon_uuid != null) {
    return `ibeacon:${d.beacon_uuid}:${d.beacon_major ?? 0}:${d.beacon_minor ?? 0}`;
  }
  return d.ble_identifier;
}

async function reloadRegistered() {
  const { data, error } = await supabase
    .from("devices")
    .select(
      "id, device_type, label, beacon_protocol, beacon_uuid, beacon_major, beacon_minor, ble_identifier, rssi_threshold, session_timeout_seconds, room_id, resident_id, staff_user_id",
    )
    .eq("status", "active");
  if (error) {
    state.lastError = error.message;
    return;
  }
  registered = (data ?? []) as RegisteredBeacon[];
  state.registeredCount = registered.length;

  // Rehydrate any care_sessions left open after a reload.
  const { data: open } = await supabase
    .from("care_sessions")
    .select("id, triggering_device_id, started_at")
    .is("ended_at", null);
  if (open) {
    for (const row of open as any[]) {
      if (!row.triggering_device_id) continue;
      if (!triggers.has(row.triggering_device_id)) {
        triggers.set(row.triggering_device_id, {
          deviceId: row.triggering_device_id,
          sessionId: row.id,
          lastRssi: -100,
          lastSeen: row.started_at,
          startedAt: row.started_at,
        });
      }
    }
  }
}

async function openSession(device: RegisteredBeacon, obs: BeaconObservation): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("care_sessions")
    .insert({
      resident_id: device.resident_id,
      room_id: device.room_id,
      staff_user_id: device.staff_user_id ?? u?.user?.id ?? null,
      confidence: 1,
      auto_initiated: true,
      triggering_device_id: device.id,
      signals: {
        beacon_key: obs.key,
        rssi: obs.rssi,
        threshold: device.rssi_threshold,
        protocol: obs.protocol,
      },
    })
    .select("id")
    .single();
  if (error) {
    state.lastError = error.message;
    return null;
  }
  await supabase.from("device_events").insert({
    device_id: device.id,
    event_type: "session_started",
    rssi: obs.rssi,
  });
  return data.id;
}

async function closeSession(
  deviceId: string,
  sessionId: string | null,
  reason: "out_of_range" | "timeout" | "manual",
) {
  if (sessionId) {
    await supabase
      .from("care_sessions")
      .update({ ended_at: new Date().toISOString(), end_reason: reason })
      .eq("id", sessionId);
  }
  await supabase.from("device_events").insert({
    device_id: deviceId,
    event_type: `session_ended:${reason}`,
  });
}

async function tick() {
  state.lastTickAt = new Date().toISOString();
  const now = Date.now();

  // Build a quick lookup of observations keyed by stable beacon key.
  const obsByKey = new Map<string, BeaconObservation>();
  for (const o of lastObservations) obsByKey.set(o.key, o);

  for (const d of registered) {
    const key = keyForDevice(d);
    const obs = obsByKey.get(key);
    const existing = triggers.get(d.id);

    if (obs && obs.rssi >= d.rssi_threshold) {
      // In range and strong enough.
      if (!existing) {
        const sessionId = await openSession(d, obs);
        triggers.set(d.id, {
          deviceId: d.id,
          sessionId,
          lastRssi: obs.rssi,
          lastSeen: obs.lastSeen,
          startedAt: new Date().toISOString(),
        });
      } else {
        existing.lastRssi = obs.rssi;
        existing.lastSeen = obs.lastSeen;
      }
      // Refresh device last-seen.
      void supabase
        .from("devices")
        .update({ last_seen_at: obs.lastSeen, last_rssi: obs.rssi })
        .eq("id", d.id);
    } else if (existing) {
      const lastSeenMs = new Date(existing.lastSeen).getTime();
      if (now - lastSeenMs > d.session_timeout_seconds * 1000) {
        await closeSession(d.id, existing.sessionId, "timeout");
        triggers.delete(d.id);
      }
    }
  }

  emit();
}

export async function startSessionManager() {
  if (state.running) return;
  await reloadRegistered();
  unsubscribeScanner = subscribeObservations((obs) => {
    lastObservations = obs;
  });
  tickHandle = setInterval(() => void tick(), 4_000);
  state.running = true;
  void tick();
  emit();
}

export async function stopSessionManager() {
  if (!state.running) return;
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
  if (unsubscribeScanner) {
    unsubscribeScanner();
    unsubscribeScanner = null;
  }
  // End every open session gracefully.
  for (const t of triggers.values()) {
    await closeSession(t.deviceId, t.sessionId, "manual");
  }
  triggers.clear();
  state.running = false;
  emit();
}

export async function refreshRegisteredDevices() {
  await reloadRegistered();
  emit();
}

export async function endTriggerManually(deviceId: string) {
  const t = triggers.get(deviceId);
  if (!t) return;
  await closeSession(deviceId, t.sessionId, "manual");
  triggers.delete(deviceId);
  emit();
}
