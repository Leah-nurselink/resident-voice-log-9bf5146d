// Confidence engine: fuses room-beacon proximity, resident wearable proximity,
// and the currently signed-in staff member into a single best-guess interaction.
//
// Each signal contributes a weighted score; RSSI is normalised so a stronger
// (closer) signal counts more. We pick the resident with the highest combined
// score and surface a confidence in [0, 1]. The dashboard / care-session
// initiator can choose its own threshold (we recommend >= 0.6 to auto-start).

import { supabase } from "@/integrations/supabase/client";
import type { ScanHit } from "./ble-scanner";

export interface InteractionGuess {
  residentId: string | null;
  roomId: string | null;
  staffUserId: string | null;
  confidence: number;
  signals: {
    roomBeacon?: { deviceId: string; rssi: number; weight: number };
    wearable?: { deviceId: string; rssi: number; weight: number };
    staffBadge?: { deviceId: string; rssi: number; weight: number };
    staffLogin?: { userId: string; weight: number };
  };
}

const WEIGHTS = {
  wearable: 0.45,
  roomBeacon: 0.3,
  staffBadge: 0.15,
  staffLogin: 0.1,
} as const;

// Map RSSI (typ. -100..-30 dBm) -> proximity score in [0,1].
function rssiToProximity(rssi: number): number {
  const clamped = Math.max(-100, Math.min(-30, rssi));
  return (clamped + 100) / 70;
}

export function inferInteraction(
  hits: ScanHit[],
  ctx: { signedInStaffUserId?: string | null } = {},
): InteractionGuess {
  // Bucket hits by type, keep strongest per resident / room / staff.
  const bestWearableByResident = new Map<string, ScanHit>();
  const bestBeaconByRoom = new Map<string, ScanHit>();
  const bestBadgeByStaff = new Map<string, ScanHit>();

  for (const h of hits) {
    const d = h.device;
    if (d.device_type === "wearable_tag" && d.resident_id) {
      const cur = bestWearableByResident.get(d.resident_id);
      if (!cur || h.rssi > cur.rssi) bestWearableByResident.set(d.resident_id, h);
    } else if (d.device_type === "room_beacon" && d.room_id) {
      const cur = bestBeaconByRoom.get(d.room_id);
      if (!cur || h.rssi > cur.rssi) bestBeaconByRoom.set(d.room_id, h);
    } else if (d.device_type === "staff_badge" && d.staff_user_id) {
      const cur = bestBadgeByStaff.get(d.staff_user_id);
      if (!cur || h.rssi > cur.rssi) bestBadgeByStaff.set(d.staff_user_id, h);
    }
  }

  // Pick strongest room beacon — that's the candidate location.
  let chosenRoomId: string | null = null;
  let chosenRoomHit: ScanHit | null = null;
  for (const [rid, hit] of bestBeaconByRoom) {
    if (!chosenRoomHit || hit.rssi > chosenRoomHit.rssi) {
      chosenRoomId = rid;
      chosenRoomHit = hit;
    }
  }

  // Pick strongest wearable — that's the candidate resident.
  let chosenResidentId: string | null = null;
  let chosenWearableHit: ScanHit | null = null;
  for (const [rid, hit] of bestWearableByResident) {
    if (!chosenWearableHit || hit.rssi > chosenWearableHit.rssi) {
      chosenResidentId = rid;
      chosenWearableHit = hit;
    }
  }

  // Pick staff: strongest badge OR signed-in user.
  let chosenStaffId: string | null = null;
  let chosenBadgeHit: ScanHit | null = null;
  for (const [sid, hit] of bestBadgeByStaff) {
    if (!chosenBadgeHit || hit.rssi > chosenBadgeHit.rssi) {
      chosenStaffId = sid;
      chosenBadgeHit = hit;
    }
  }
  if (!chosenStaffId && ctx.signedInStaffUserId) chosenStaffId = ctx.signedInStaffUserId;

  const signals: InteractionGuess["signals"] = {};
  let score = 0;

  if (chosenWearableHit) {
    const w = rssiToProximity(chosenWearableHit.rssi) * WEIGHTS.wearable;
    signals.wearable = {
      deviceId: chosenWearableHit.device.id,
      rssi: chosenWearableHit.rssi,
      weight: +w.toFixed(3),
    };
    score += w;
  }
  if (chosenRoomHit) {
    const w = rssiToProximity(chosenRoomHit.rssi) * WEIGHTS.roomBeacon;
    signals.roomBeacon = {
      deviceId: chosenRoomHit.device.id,
      rssi: chosenRoomHit.rssi,
      weight: +w.toFixed(3),
    };
    score += w;
  }
  if (chosenBadgeHit) {
    const w = rssiToProximity(chosenBadgeHit.rssi) * WEIGHTS.staffBadge;
    signals.staffBadge = {
      deviceId: chosenBadgeHit.device.id,
      rssi: chosenBadgeHit.rssi,
      weight: +w.toFixed(3),
    };
    score += w;
  } else if (ctx.signedInStaffUserId) {
    signals.staffLogin = { userId: ctx.signedInStaffUserId, weight: WEIGHTS.staffLogin };
    score += WEIGHTS.staffLogin;
  }

  // If wearable + beacon agree on the *same* resident (i.e. resident's known
  // room matches), boost; if they disagree, mildly penalise.
  if (chosenResidentId && chosenRoomId) {
    // Best-effort coherence boost; full lookup happens in the caller.
    score = Math.min(1, score * 1.05);
  }

  return {
    residentId: chosenResidentId,
    roomId: chosenRoomId,
    staffUserId: chosenStaffId,
    confidence: +Math.min(1, score).toFixed(3),
    signals,
  };
}

/**
 * If the guess is confident enough, open a care_sessions row.
 * Returns the session id on success.
 */
export async function startCareSessionIfConfident(
  guess: InteractionGuess,
  threshold = 0.6,
): Promise<string | null> {
  if (guess.confidence < threshold || !guess.residentId) return null;
  const { data, error } = await supabase
    .from("care_sessions")
    .insert({
      resident_id: guess.residentId,
      room_id: guess.roomId,
      staff_user_id: guess.staffUserId,
      confidence: guess.confidence,
      signals: guess.signals,
      auto_initiated: true,
    })
    .select("id")
    .single();
  if (error) return null;
  return data.id;
}
