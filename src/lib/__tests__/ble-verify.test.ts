import { describe, expect, it } from "vitest";
import { createVerifyTracker } from "@/lib/ble-verify";
import type { BeaconObservation } from "@/lib/ble-advertisement-scanner";

const KEY = "ibeacon:f7826da6-4fa2-4e98-8024-bc5b71e0893e:1:100";
const OTHER_KEY = "ibeacon:00000000-0000-0000-0000-000000000000:0:0";

function obs(overrides: Partial<BeaconObservation> & { lastSeen: string; rssi: number }): BeaconObservation {
  return {
    key: KEY,
    protocol: "ibeacon",
    uuid: "f7826da6-4fa2-4e98-8024-bc5b71e0893e",
    major: 1,
    minor: 100,
    namespace: null,
    instance: null,
    mac: null,
    txPower: -59,
    name: null,
    firstSeen: overrides.lastSeen,
    hits: 1,
    ...overrides,
  };
}

describe("createVerifyTracker", () => {
  it("does not verify before reaching the required hit count", () => {
    const t = createVerifyTracker({ expectedKey: KEY, threshold: -75, now: () => 0 });
    const s1 = t.observe([obs({ lastSeen: "t1", rssi: -60 })]);
    expect(s1.hits).toBe(1);
    expect(s1.verified).toBe(false);
    const s2 = t.observe([obs({ lastSeen: "t2", rssi: -60 })]);
    expect(s2.hits).toBe(2);
    expect(s2.verified).toBe(false);
  });

  it("verifies exactly on the third confirmed in-range hit within the window", () => {
    let clock = 0;
    const t = createVerifyTracker({ expectedKey: KEY, threshold: -75, now: () => clock });
    t.observe([obs({ lastSeen: "t1", rssi: -60 })]); clock = 1_000;
    t.observe([obs({ lastSeen: "t2", rssi: -60 })]); clock = 2_000;
    const s = t.observe([obs({ lastSeen: "t3", rssi: -60 })]);
    expect(s.hits).toBe(3);
    expect(s.verified).toBe(true);
  });

  it("counts hits regardless of RSSI (threshold gates sessions, not verification)", () => {
    const t = createVerifyTracker({ expectedKey: KEY, threshold: -70, now: () => 0 });
    t.observe([obs({ lastSeen: "t1", rssi: -85 })]);
    t.observe([obs({ lastSeen: "t2", rssi: -80 })]);
    const s = t.observe([obs({ lastSeen: "t3", rssi: -78 })]);
    expect(s.hits).toBe(3);
    expect(s.verified).toBe(true);
  });

  it("does not double-count repeated observations with the same lastSeen", () => {
    const t = createVerifyTracker({ expectedKey: KEY, threshold: -75, now: () => 0 });
    t.observe([obs({ lastSeen: "t1", rssi: -60 })]);
    t.observe([obs({ lastSeen: "t1", rssi: -60 })]);
    const s = t.observe([obs({ lastSeen: "t1", rssi: -60 })]);
    expect(s.hits).toBe(1);
    expect(s.verified).toBe(false);
  });

  it("ignores observations for non-matching beacon keys", () => {
    const t = createVerifyTracker({ expectedKey: KEY, threshold: -75, now: () => 0 });
    const stranger: BeaconObservation = obs({ lastSeen: "t1", rssi: -50 });
    stranger.key = OTHER_KEY;
    const s = t.observe([stranger]);
    expect(s.hits).toBe(0);
    expect(s.verified).toBe(false);
  });

  it("resets the counter when the window expires without enough hits", () => {
    let clock = 0;
    const t = createVerifyTracker({
      expectedKey: KEY,
      threshold: -75,
      windowMs: 15_000,
      now: () => clock,
    });
    t.observe([obs({ lastSeen: "t1", rssi: -60 })]); // hit 1, window starts at 0
    clock = 5_000;
    t.observe([obs({ lastSeen: "t2", rssi: -60 })]); // hit 2
    clock = 20_000; // past window without third hit
    const expired = t.observe([]); // no match -> only expiry runs
    expect(expired.hits).toBe(0);
    expect(expired.verified).toBe(false);
    // A fresh series of 3 hits inside a new window still verifies.
    clock = 21_000;
    t.observe([obs({ lastSeen: "t3", rssi: -60 })]);
    clock = 22_000;
    t.observe([obs({ lastSeen: "t4", rssi: -60 })]);
    clock = 23_000;
    const s = t.observe([obs({ lastSeen: "t5", rssi: -60 })]);
    expect(s.hits).toBe(3);
    expect(s.verified).toBe(true);
  });

  it("does not verify when only 2 hits land inside the window", () => {
    let clock = 0;
    const t = createVerifyTracker({
      expectedKey: KEY,
      threshold: -75,
      windowMs: 15_000,
      now: () => clock,
    });
    t.observe([obs({ lastSeen: "t1", rssi: -60 })]);
    clock = 14_000;
    const s = t.observe([obs({ lastSeen: "t2", rssi: -60 })]);
    expect(s.hits).toBe(2);
    expect(s.verified).toBe(false);
  });

  it("stays verified once the threshold is crossed", () => {
    const t = createVerifyTracker({ expectedKey: KEY, threshold: -75, now: () => 0 });
    t.observe([obs({ lastSeen: "t1", rssi: -60 })]);
    t.observe([obs({ lastSeen: "t2", rssi: -60 })]);
    t.observe([obs({ lastSeen: "t3", rssi: -60 })]);
    // Subsequent weak / missing observations must not un-verify.
    const weak = t.observe([obs({ lastSeen: "t4", rssi: -95 })]);
    expect(weak.verified).toBe(true);
    const gone = t.observe([]);
    expect(gone.verified).toBe(true);
  });
});
