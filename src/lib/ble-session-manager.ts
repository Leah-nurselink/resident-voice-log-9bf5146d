// Session manager.
//
// Watches scanner observations + registered `devices` rows and decides which
// resident a care session belongs to. Identification is keyed on the resident
// (not the device) so multiple beacons can cooperatively resolve the target.
//
// Auto-identification rules (evaluated each tick):
//
//   1. Wearable tag in range (RSSI >= threshold)
//        → resident_id is known directly from devices.resident_id.
//        Room = strongest in-range room_beacon. Staff = strongest in-range
//        staff_badge OR the currently signed-in user.
//
//   2. Room beacon in range, no wearable for any resident assigned to that
//      room is detected
//        → resolve residents whose residents.room_number == rooms.name and
//          residency_status = 'permanent' | 'respite' | 'temporary'.
//          If EXACTLY ONE resident matches, open a session for them (the
//          beacon disambiguates location). If MORE than one, log
//          `ambiguous_room_occupancy` once and skip — admin must add wearable
//          tags or split the assignment. If ZERO, log `unassigned_room`.
//
//   3. Staff badge in range
//        → never opens a session by itself. If a session is open for any
//          resident in the same room, staff_user_id is attached to that
//          session as the carer-present marker.
//
// Sessions end when the triggering signal (wearable for rule 1, room beacon
// for rule 2) hasn't been seen for `session_timeout_seconds`. Wearable rule
// always wins over room rule: if a wearable later identifies the resident,
// the room-beacon session for the same resident is annotated, not duplicated.

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
  ambiguity_strategy: "skip" | "prompt" | "open_all";
}

export interface ActiveTrigger {
  // Key the active session by resident_id (the care subject), keeping the
  // device that triggered it for UI / audit.
  deviceId: string; // the beacon that most recently asserted presence
  sessionId: string | null;
  residentId: string | null;
  roomId: string | null;
  staffUserId: string | null;
  rule: "wearable" | "room_single_occupant";
  lastRssi: number;
  lastSeen: string; // last time the *triggering* beacon was heard
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
let roomOccupants: Map<string, string[]> = new Map(); // room_id -> resident_ids
let lastObservations: BeaconObservation[] = [];
let tickHandle: ReturnType<typeof setInterval> | null = null;
let unsubscribeScanner: (() => void) | null = null;
// Sessions keyed by resident_id so wearable + room rules can't double-open.
const sessions = new Map<string, ActiveTrigger>();
// Throttle noisy ambiguity logs (room_id -> last log ts).
const ambiguityLogged = new Map<string, number>();

function emit() {
  state.activeSessions = Array.from(sessions.values());
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
      "id, device_type, label, beacon_protocol, beacon_uuid, beacon_major, beacon_minor, ble_identifier, rssi_threshold, session_timeout_seconds, room_id, resident_id, staff_user_id, ambiguity_strategy",
    )
    .eq("status", "active");
  if (error) {
    state.lastError = error.message;
    return;
  }
  registered = (data ?? []) as RegisteredBeacon[];
  state.registeredCount = registered.length;

  // Build room -> residents map (residents.room_number stores the room name).
  const { data: rooms } = await supabase.from("rooms").select("id, name");
  const { data: residents } = await supabase
    .from("residents")
    .select("id, room_number, residency_status")
    .in("residency_status", ["permanent", "respite", "temporary"]);
  const nameToRoomId = new Map<string, string>();
  for (const r of (rooms ?? []) as Array<{ id: string; name: string }>) {
    nameToRoomId.set(r.name, r.id);
  }
  roomOccupants = new Map();
  for (const r of (residents ?? []) as Array<{ id: string; room_number: string | null }>) {
    if (!r.room_number) continue;
    const rid = nameToRoomId.get(r.room_number);
    if (!rid) continue;
    const list = roomOccupants.get(rid) ?? [];
    list.push(r.id);
    roomOccupants.set(rid, list);
  }

  // Rehydrate any care_sessions left open after a reload.
  const { data: open } = await supabase
    .from("care_sessions")
    .select("id, resident_id, room_id, staff_user_id, triggering_device_id, started_at")
    .is("ended_at", null);
  if (open) {
    for (const row of open as any[]) {
      const key = row.resident_id ?? `room:${row.room_id ?? row.id}`;
      if (!sessions.has(key)) {
        sessions.set(key, {
          deviceId: row.triggering_device_id ?? "",
          sessionId: row.id,
          residentId: row.resident_id,
          roomId: row.room_id,
          staffUserId: row.staff_user_id,
          rule: "wearable",
          lastRssi: -100,
          lastSeen: row.started_at,
          startedAt: row.started_at,
        });
      }
    }
  }
}

async function openSession(
  residentId: string,
  roomId: string | null,
  staffUserId: string | null,
  triggeringDevice: RegisteredBeacon,
  obs: BeaconObservation,
  rule: ActiveTrigger["rule"],
): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("care_sessions")
    .insert({
      resident_id: residentId,
      room_id: roomId,
      staff_user_id: staffUserId ?? u?.user?.id ?? null,
      confidence: rule === "wearable" ? 1 : 0.7,
      auto_initiated: true,
      triggering_device_id: triggeringDevice.id,
      signals: {
        rule,
        beacon_key: obs.key,
        rssi: obs.rssi,
        threshold: triggeringDevice.rssi_threshold,
        protocol: obs.protocol,
        device_label: triggeringDevice.label,
      },
    })
    .select("id")
    .single();
  if (error) {
    state.lastError = error.message;
    return null;
  }
  await supabase.from("device_events").insert({
    device_id: triggeringDevice.id,
    event_type: `session_started:${rule}`,
    rssi: obs.rssi,
  });
  return data.id;
}

async function closeSession(
  trigger: ActiveTrigger,
  reason: "out_of_range" | "timeout" | "manual",
) {
  if (trigger.sessionId) {
    await supabase
      .from("care_sessions")
      .update({ ended_at: new Date().toISOString(), end_reason: reason })
      .eq("id", trigger.sessionId);
  }
  if (trigger.deviceId) {
    await supabase.from("device_events").insert({
      device_id: trigger.deviceId,
      event_type: `session_ended:${reason}`,
    });
  }
}

async function attachStaff(sessionId: string, staffUserId: string) {
  await supabase
    .from("care_sessions")
    .update({ staff_user_id: staffUserId })
    .eq("id", sessionId);
}

async function logAmbiguity(deviceId: string, roomId: string, residentIds: string[]) {
  const last = ambiguityLogged.get(roomId) ?? 0;
  if (Date.now() - last < 5 * 60_000) return; // throttle to one per 5 min per room
  ambiguityLogged.set(roomId, Date.now());
  await supabase.from("device_events").insert({
    device_id: deviceId,
    event_type: "ambiguous_room_occupancy",
    payload: { room_id: roomId, candidate_resident_ids: residentIds } as any,
  });
}

async function tick() {
  state.lastTickAt = new Date().toISOString();
  const now = Date.now();

  // Build a quick lookup of observations keyed by stable beacon key.
  const obsByKey = new Map<string, BeaconObservation>();
  for (const o of lastObservations) obsByKey.set(o.key, o);

  // Index registered devices by category and current observation strength.
  type InRange = { device: RegisteredBeacon; obs: BeaconObservation };
  const wearablesInRange: InRange[] = [];
  const roomsInRange: InRange[] = [];
  const badgesInRange: InRange[] = [];

  for (const d of registered) {
    const obs = obsByKey.get(keyForDevice(d));
    if (!obs || obs.rssi < d.rssi_threshold) continue;
    if (d.device_type === "wearable_tag" && d.resident_id) {
      wearablesInRange.push({ device: d, obs });
    } else if (d.device_type === "room_beacon" && d.room_id) {
      roomsInRange.push({ device: d, obs });
    } else if (d.device_type === "staff_badge" && d.staff_user_id) {
      badgesInRange.push({ device: d, obs });
    }
    // Touch device telemetry.
    void supabase
      .from("devices")
      .update({ last_seen_at: obs.lastSeen, last_rssi: obs.rssi })
      .eq("id", d.id);
  }

  // Strongest room beacon overall (for wearable rule's room context).
  const strongestRoom = roomsInRange.reduce<InRange | null>(
    (best, cur) => (best == null || cur.obs.rssi > best.obs.rssi ? cur : best),
    null,
  );
  const strongestBadge = badgesInRange.reduce<InRange | null>(
    (best, cur) => (best == null || cur.obs.rssi > best.obs.rssi ? cur : best),
    null,
  );

  // Track which residents have been freshly identified this tick.
  const refreshed = new Set<string>();

  // ----- Rule 1: wearable tag in range -----
  for (const { device, obs } of wearablesInRange) {
    const residentId = device.resident_id!;
    refreshed.add(residentId);
    const roomId = strongestRoom?.device.room_id ?? null;
    const staffUserId = strongestBadge?.device.staff_user_id ?? null;
    const existing = sessions.get(residentId);
    if (!existing) {
      const sessionId = await openSession(residentId, roomId, staffUserId, device, obs, "wearable");
      sessions.set(residentId, {
        deviceId: device.id,
        sessionId,
        residentId,
        roomId,
        staffUserId,
        rule: "wearable",
        lastRssi: obs.rssi,
        lastSeen: obs.lastSeen,
        startedAt: new Date().toISOString(),
      });
    } else {
      existing.lastRssi = obs.rssi;
      existing.lastSeen = obs.lastSeen;
      existing.deviceId = device.id; // wearable always overrides room-trigger device
      existing.rule = "wearable";
      if (!existing.roomId && roomId) existing.roomId = roomId;
      if (!existing.staffUserId && staffUserId && existing.sessionId) {
        existing.staffUserId = staffUserId;
        await attachStaff(existing.sessionId, staffUserId);
      }
    }
  }

  // ----- Rule 2: room beacon in range, single assigned occupant -----
  for (const { device, obs } of roomsInRange) {
    const roomId = device.room_id!;
    const occupants = roomOccupants.get(roomId) ?? [];
    // Skip if a wearable already accounts for any occupant.
    const occupantAlreadyIdentified = occupants.some((rid) => refreshed.has(rid));
    if (occupantAlreadyIdentified) continue;

    if (occupants.length === 0) {
      // Room with no assigned resident — log occasionally.
      await logAmbiguity(device.id, roomId, []);
      continue;
    }
    if (occupants.length > 1) {
      await logAmbiguity(device.id, roomId, occupants);
      continue;
    }
    const residentId = occupants[0];
    refreshed.add(residentId);
    const staffUserId = strongestBadge?.device.staff_user_id ?? null;
    const existing = sessions.get(residentId);
    if (!existing) {
      const sessionId = await openSession(
        residentId,
        roomId,
        staffUserId,
        device,
        obs,
        "room_single_occupant",
      );
      sessions.set(residentId, {
        deviceId: device.id,
        sessionId,
        residentId,
        roomId,
        staffUserId,
        rule: "room_single_occupant",
        lastRssi: obs.rssi,
        lastSeen: obs.lastSeen,
        startedAt: new Date().toISOString(),
      });
    } else {
      // Don't downgrade a wearable-driven session, but refresh last-seen if
      // the room beacon corroborates the same resident.
      if (existing.rule === "room_single_occupant") {
        existing.lastRssi = obs.rssi;
        existing.lastSeen = obs.lastSeen;
        existing.deviceId = device.id;
      }
      if (!existing.staffUserId && staffUserId && existing.sessionId) {
        existing.staffUserId = staffUserId;
        await attachStaff(existing.sessionId, staffUserId);
      }
    }
  }

  // ----- Rule 3: staff badge alone — attach to any session in same room -----
  if (strongestBadge && strongestRoom) {
    const staffUserId = strongestBadge.device.staff_user_id!;
    const roomId = strongestRoom.device.room_id!;
    for (const t of sessions.values()) {
      if (t.roomId === roomId && !t.staffUserId && t.sessionId) {
        t.staffUserId = staffUserId;
        await attachStaff(t.sessionId, staffUserId);
      }
    }
  }

  // ----- Timeouts: close any session whose triggering signal is stale -----
  for (const [residentId, t] of Array.from(sessions.entries())) {
    const dev = registered.find((d) => d.id === t.deviceId);
    const timeoutMs = (dev?.session_timeout_seconds ?? 60) * 1000;
    const lastSeenMs = new Date(t.lastSeen).getTime();
    if (now - lastSeenMs > timeoutMs) {
      await closeSession(t, "timeout");
      sessions.delete(residentId);
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
  for (const t of sessions.values()) {
    await closeSession(t, "manual");
  }
  sessions.clear();
  state.running = false;
  emit();
}

export async function refreshRegisteredDevices() {
  await reloadRegistered();
  emit();
}

export async function endTriggerManually(deviceId: string) {
  // deviceId here is the triggering device shown in the UI; find the session
  // that currently references it.
  for (const [residentId, t] of Array.from(sessions.entries())) {
    if (t.deviceId === deviceId) {
      await closeSession(t, "manual");
      sessions.delete(residentId);
    }
  }
  emit();
}
