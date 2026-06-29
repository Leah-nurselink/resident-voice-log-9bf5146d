// Pure verification tracker for the "verify before register" flow.
//
// Counts confirmed beacon hits for a specific expected key. A hit is
// confirmed when an observation with the matching key has both a *new*
// lastSeen timestamp AND an RSSI at or above the configured threshold.
//
// Verification passes when `hitsRequired` confirmed hits accumulate within
// `windowMs`. If the window expires without enough hits, the counter resets
// and the next observation starts a fresh window.

import type { BeaconObservation } from "@/lib/ble-advertisement-scanner";

export interface VerifyTrackerOptions {
  expectedKey: string;
  threshold: number;
  hitsRequired?: number;
  windowMs?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

export interface VerifyState {
  hits: number;
  verified: boolean;
  lastSeen: string | null;
  windowStartedAt: number | null;
}

export interface VerifyTracker {
  /** Feed the current nearby observations and return the updated state. */
  observe(nearby: BeaconObservation[]): VerifyState;
  /** Read the current state without feeding new data. */
  getState(): VerifyState;
  /** Reset the counter and window. */
  reset(): void;
}

export function createVerifyTracker(opts: VerifyTrackerOptions): VerifyTracker {
  const hitsRequired = opts.hitsRequired ?? 3;
  const windowMs = opts.windowMs ?? 15_000;
  const now = opts.now ?? (() => Date.now());

  let hits = 0;
  let verified = false;
  let lastSeen: string | null = null;
  let windowStartedAt: number | null = null;

  const snapshot = (): VerifyState => ({ hits, verified, lastSeen, windowStartedAt });

  return {
    observe(nearby) {
      const match = nearby.find((o) => o.key === opts.expectedKey);

      // Expire the window first so a stale (no-hit) period resets the count
      // even when the current tick has no matching observation.
      if (
        !verified &&
        windowStartedAt !== null &&
        now() - windowStartedAt > windowMs &&
        hits < hitsRequired
      ) {
        hits = 0;
        windowStartedAt = null;
      }

      if (!match) return snapshot();

      // Only count a hit when the lastSeen advances (a *new* advertisement)
      // and the signal is at/above the threshold. Once verified we lock.
      if (!verified && match.lastSeen !== lastSeen && match.rssi >= opts.threshold) {
        if (windowStartedAt === null) windowStartedAt = now();
        hits += 1;
        if (hits >= hitsRequired) verified = true;
      }
      lastSeen = match.lastSeen;
      return snapshot();
    },
    getState: snapshot,
    reset() {
      hits = 0;
      verified = false;
      lastSeen = null;
      windowStartedAt = null;
    },
  };
}
