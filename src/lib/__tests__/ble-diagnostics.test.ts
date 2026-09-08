import { beforeEach, describe, expect, it } from "vitest";
import {
  BLE_DIAGNOSTIC_STAGES,
  clearBleDiagnosticEvents,
  formatBleDiagnosticReport,
  getBleDiagnosticEvents,
  summarizeBleDiagnosticStages,
  traceBleDiagnostic,
} from "../ble-diagnostics";

describe("BLE diagnostic trace", () => {
  beforeEach(() => clearBleDiagnosticEvents());

  it("keeps the diagnostic chain ordered and waiting until a stage reports", () => {
    traceBleDiagnostic("scan", "passed", "Scan accepted", { rssi: -61 });
    const stages = summarizeBleDiagnosticStages(getBleDiagnosticEvents());

    expect(stages.map((stage) => stage.stage)).toEqual(
      BLE_DIAGNOSTIC_STAGES.map((stage) => stage.id),
    );
    expect(stages.find((stage) => stage.stage === "scan")?.outcome).toBe("passed");
    expect(stages.find((stage) => stage.stage === "bridge")?.outcome).toBe("waiting");
  });

  it("uses the latest result for each stage and produces a copyable report", () => {
    traceBleDiagnostic("match", "failed", "No registration");
    traceBleDiagnostic("match", "passed", "Beacon matched", { beaconKey: "ibeacon:test:1:2" });

    const events = getBleDiagnosticEvents();
    expect(summarizeBleDiagnosticStages(events).find((stage) => stage.stage === "match")?.outcome).toBe(
      "passed",
    );
    expect(formatBleDiagnosticReport(events)).toContain("Registered beacon: PASSED — Beacon matched");
    expect(formatBleDiagnosticReport(events)).toContain("beaconKey: ibeacon:test:1:2");
  });
});
