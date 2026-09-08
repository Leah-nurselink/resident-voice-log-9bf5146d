import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, Clipboard, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  isLEScanAvailable,
  isWebBluetoothAvailable,
  getLEScanSupportDiagnostic,
  startScanner,
  stopScanner,
  subscribe as subscribeObs,
  subscribeStatus,
  getNearby,
  getStatus,
  clearObservations,
  type BeaconObservation,
  type ScannerStatus,
} from "@/lib/ble-advertisement-scanner";
import {
  clearRawNativeAdvertisements,
  getNativeBridgeDiagnostic,
  getNativeAdapter,
  getNativeRuntime,
  getRawNativeAdvertisements,
  getLastInstallAttempt,
  installCapacitorBridgeIfNeeded,
  subscribeRawNativeAdvertisements,
  type RawNativeAdvertisement,
} from "@/lib/native-beacon-bridge";
import {
  clearBleDiagnosticEvents,
  formatBleDiagnosticReport,
  getBleDiagnosticEvents,
  subscribeBleDiagnostics,
  summarizeBleDiagnosticStages,
  type BleDiagnosticEvent,
} from "@/lib/ble-diagnostics";
import { startSessionManager, stopSessionManager } from "@/lib/ble-session-manager";
import { isNativeShell } from "@/lib/surface";

export const Route = createFileRoute("/_authenticated/beacon-diagnostics")({
  head: () => ({
    meta: [
      { title: "Beacon diagnostics · CareCore" },
      {
        name: "description",
        content: "Diagnose Android BLE scanning, beacon matching, and resident identification.",
      },
      { property: "og:title", content: "Beacon diagnostics · CareCore" },
      {
        property: "og:description",
        content: "Diagnose Android BLE scanning, beacon matching, and resident identification.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BeaconDiagnosticsPage,
});

function BeaconDiagnosticsPage() {
  const [status, setStatus] = useState<ScannerStatus>(() => getStatus());
  const [obs, setObs] = useState<BeaconObservation[]>(() => getNearby());
  const [bridgeInstalled, setBridgeInstalled] = useState<boolean>(() => !!getNativeAdapter());
  const [nativeRuntime, setNativeRuntime] = useState(() => getNativeRuntime());
  const [now, setNow] = useState(() => Date.now());
  const [bridgeDiagnostic, setBridgeDiagnostic] = useState(() => getNativeBridgeDiagnostic());
  const [rawAdvertisements, setRawAdvertisements] = useState<RawNativeAdvertisement[]>(() =>
    getRawNativeAdvertisements(),
  );
  const [installAttempt, setInstallAttempt] = useState(() => getLastInstallAttempt());
  const [events, setEvents] = useState<BleDiagnosticEvent[]>(() => getBleDiagnosticEvents());
  const diag = getLEScanSupportDiagnostic();

  useEffect(() => {
    // Try to install the bridge as soon as the diagnostics page mounts, so the
    // user can see whether the native shell is actually detected.
    void installCapacitorBridgeIfNeeded().then(() => {
      setBridgeInstalled(!!getNativeAdapter());
      setNativeRuntime(getNativeRuntime());
      setBridgeDiagnostic(getNativeBridgeDiagnostic());
      setInstallAttempt(getLastInstallAttempt());
    });
  }, []);

  useEffect(() => subscribeStatus(setStatus), []);
  useEffect(() => subscribeObs(setObs), []);
  useEffect(() => subscribeRawNativeAdvertisements(setRawAdvertisements), []);
  useEffect(() => subscribeBleDiagnostics(setEvents), []);
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      setBridgeInstalled(!!getNativeAdapter());
      setNativeRuntime(getNativeRuntime());
      setBridgeDiagnostic(getNativeBridgeDiagnostic());
      setInstallAttempt(getLastInstallAttempt());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const modeLabel =
    status.mode === "native-bridge"
      ? "Native bridge (Capacitor/Electron)"
      : status.mode === "native"
        ? "Web Bluetooth (browser)"
        : status.mode === "simulator"
          ? "Simulator"
          : "Unavailable";

  const modeVariant =
    status.mode === "native-bridge"
      ? "default"
      : status.mode === "native"
        ? "secondary"
        : status.mode === "simulator"
          ? "outline"
          : "destructive";

  const sorted = [...obs].sort((a, b) => b.rssi - a.rssi);
  const stages = summarizeBleDiagnosticStages(events);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Beacon diagnostics</h1>
          <p className="text-sm text-muted-foreground">
            Live BLE bridge status and detected advertisements.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={diag.state === "likely-unsupported-os"}
            onClick={async () => {
              try {
                await startScanner();
                await startSessionManager();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Scan failed to start");
              }
              setBridgeDiagnostic(getNativeBridgeDiagnostic());
            }}
          >
            Start
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              stopScanner();
              void stopSessionManager();
            }}
          >
            Stop
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              clearObservations();
              clearRawNativeAdvertisements();
              clearBleDiagnosticEvents();
              setObs([]);
            }}
          >
            Clear
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">End-to-end BLE check</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(formatBleDiagnosticReport(events));
                  toast.success("Diagnostic report copied");
                } catch {
                  toast.error("Could not copy the diagnostic report");
                }
              }}
            >
              <Clipboard className="h-4 w-4" />
              Copy report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ol className="divide-y">
            {stages.map((stage, index) => (
              <li key={stage.stage} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] gap-3 py-3">
                <div className="pt-0.5">
                  {stage.outcome === "passed" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Passed" />
                  ) : stage.outcome === "failed" ? (
                    <XCircle className="h-5 w-5 text-destructive" aria-label="Failed" />
                  ) : (
                    <CircleDashed className="h-5 w-5 text-muted-foreground" aria-label="Waiting" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {index + 1}. {stage.message}
                  </div>
                  {stage.details && (
                    <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                      {Object.entries(stage.details)
                        .map(([key, value]) => `${key}: ${String(value)}`)
                        .join(" · ")}
                    </div>
                  )}
                </div>
                <Badge
                  variant={
                    stage.outcome === "passed"
                      ? "default"
                      : stage.outcome === "failed"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {stage.outcome}
                </Badge>
              </li>
            ))}
          </ol>
          {status.running && bridgeDiagnostic.scanCallbacksReceived === 0 && status.startedAt && now - new Date(status.startedAt).getTime() > 10_000 && (
            <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              Android accepted the scan, but no advertisement has arrived after 10 seconds. Keep the known beacon close; if this remains unchanged, the earliest failing point is the native Android scan.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bridge & scanner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Native shell (Capacitor/Electron)">
            <Badge variant={isNativeShell() ? "default" : "outline"}>
              {isNativeShell() ? "yes" : "no"}
            </Badge>
          </Row>
          <Row label="Native BLE adapter installed">
            <Badge variant={bridgeInstalled ? "default" : "destructive"}>
              {bridgeInstalled ? "yes" : "no"}
            </Badge>
          </Row>
          <Row label="Native runtime">
            <code className="text-xs">{nativeRuntime ?? "none"}</code>
          </Row>
          <Row label="Capacitor platform">
            <code className="text-xs">{bridgeDiagnostic.platform ?? "none"}</code>
          </Row>
          <Row label="Bluetooth enabled">
            <Badge variant={bridgeDiagnostic.bluetoothEnabled === false ? "destructive" : "outline"}>
              {bridgeDiagnostic.bluetoothEnabled == null
                ? "not checked"
                : bridgeDiagnostic.bluetoothEnabled
                  ? "yes"
                  : "no"}
            </Badge>
          </Row>
          <Row label="Android Location enabled">
            <Badge variant={bridgeDiagnostic.locationEnabled === false ? "destructive" : "outline"}>
              {bridgeDiagnostic.locationEnabled == null
                ? "not checked"
                : bridgeDiagnostic.locationEnabled
                  ? "yes"
                  : "no"}
            </Badge>
          </Row>
          <Row label="Native scan callbacks">
            <code className="text-xs">{bridgeDiagnostic.scanCallbacksReceived}</code>
          </Row>
          <Row label="Install attempt">
            <span className="text-xs">
              {installAttempt
                ? `${installAttempt.result} — ${installAttempt.detail}`
                : "none yet"}
            </span>
          </Row>
          {bridgeDiagnostic.lastError && (
            <Row label="Bridge error">
              <span className="text-xs text-destructive">{bridgeDiagnostic.lastError}</span>
            </Row>
          )}
          <Row label="Scanner mode">
            <Badge variant={modeVariant as never}>{modeLabel}</Badge>
          </Row>
          <Row label="Scanner running">
            <Badge variant={status.running ? "default" : "outline"}>
              {status.running ? "running" : "stopped"}
            </Badge>
          </Row>
          {status.startedAt && (
            <Row label="Started">
              <span className="text-xs">{new Date(status.startedAt).toLocaleTimeString()}</span>
            </Row>
          )}
          {status.lastError && (
            <Row label="Last error">
              <span className="text-xs text-destructive">{status.lastError}</span>
            </Row>
          )}
          {!status.running && diag.state === "ready" && (
            <p className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
              Press <strong>Start</strong> above — Chrome will pop up a Bluetooth permission
              request. You must click <strong>Allow</strong> in that prompt, or the scan cannot
              begin. If you previously blocked it, reset it via the padlock icon in the address
              bar → Site settings → Bluetooth.
            </p>
          )}
          {status.mode === "simulator" && status.lastError && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              Chrome refused the real scan (see "Last error" above), so demo beacons are shown.
              "NotAllowedError" = permission denied; "NotSupportedError" = this laptop/Chrome
              version cannot passively scan — use Chrome on Android, macOS, ChromeOS or Linux.
            </p>
          )}
          {diag.state === "likely-unsupported-os" && (
            <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">{diag.title}</p>
              <p>{diag.message}</p>
              <p>{diag.nextStep}</p>
              <p>
                <Link to="/downloads" className="font-semibold underline">
                  Download the CareCore Windows companion app →
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">
              Raw advertisements ({rawAdvertisements.length})
            </CardTitle>
            <Badge variant="outline">before filtering</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {rawAdvertisements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No scan callbacks received yet. Press Start scan — on a laptop use Chrome with the
              experimental web platform flag enabled, on the phone use the installed Android app —
              and keep this screen open near a transmitting beacon.
            </p>
          ) : (
            <ul className="divide-y">
              {rawAdvertisements.map((advertisement) => (
                <RawAdvertisementRow key={advertisement.deviceId} advertisement={advertisement} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Web Bluetooth available">
            <Badge variant={isWebBluetoothAvailable() ? "default" : "outline"}>
              {String(isWebBluetoothAvailable())}
            </Badge>
          </Row>
          <Row label="requestLEScan available">
            <Badge variant={isLEScanAvailable() ? "default" : "outline"}>
              {String(isLEScanAvailable())}
            </Badge>
          </Row>
          <Row label="Support state">
            <code className="text-xs">{diag.state}</code>
          </Row>
          <Row label="Usable for passive beacon scans">
            <Badge variant={diag.state === "ready" ? "default" : "destructive"}>
              {diag.state === "ready" ? "yes" : "no"}
            </Badge>
          </Row>
          <Row label="Platform">
            <code className="text-xs">{diag.platform || "?"}</code>
          </Row>
          <div className="pt-1 text-xs text-muted-foreground break-all">UA: {diag.userAgent}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detected beacons ({sorted.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No advertisements yet. If the mode above is "Simulator", the phone is not exposing
              real BLE to the app.
            </p>
          ) : (
            <ul className="divide-y">
              {sorted.map((o) => {
                const age = Math.max(0, Math.round((now - new Date(o.lastSeen).getTime()) / 1000));
                return (
                  <li key={o.key} className="space-y-1 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {o.protocol}
                        </Badge>
                        <span className="font-medium">{o.name ?? o.key.slice(0, 24)}</span>
                        {o.simulated && (
                          <Badge variant="secondary" className="text-[10px]">
                            sim
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs tabular-nums">
                        {o.rssi} dBm · {age}s ago
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground break-all">
                      {o.uuid && <>uuid: {o.uuid} </>}
                      {o.major != null && <>maj: {o.major} </>}
                      {o.minor != null && <>min: {o.minor} </>}
                      {o.namespace && <>ns: {o.namespace} </>}
                      {o.instance && <>inst: {o.instance} </>}
                      {o.mac && <>mac: {o.mac} </>}
                      hits: {o.hits}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RawAdvertisementRow({ advertisement }: { advertisement: RawNativeAdvertisement }) {
  return (
    <li className="space-y-2 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          {advertisement.localName ?? advertisement.name ?? "Unnamed BLE device"}
          <Badge variant="secondary" className="text-[10px]">
            {advertisement.source === "web-bluetooth" ? "laptop web bluetooth" : "android native"}
          </Badge>
        </span>
        <span className="tabular-nums">
          {advertisement.rssi == null ? "RSSI unavailable" : `${advertisement.rssi} dBm`} · hits{" "}
          {advertisement.hits}
        </span>
      </div>
      <RawField
        label={advertisement.source === "web-bluetooth" ? "Device ID (no MAC)" : "MAC / device ID"}
        value={advertisement.deviceId}
      />
      <RawField label="Device name" value={advertisement.name} />
      <RawField label="Local name" value={advertisement.localName} />
      <RawField label="UUID" value={advertisement.uuid} />
      <RawField label="Major" value={advertisement.major} />
      <RawField label="Minor" value={advertisement.minor} />
      <RawField label="Manufacturer data" value={formatHexMap(advertisement.manufacturerData)} />
      <RawField label="Service UUIDs" value={advertisement.serviceUuids.join(", ") || null} />
      <RawField label="Service data" value={formatHexMap(advertisement.serviceData)} />
      <RawField label="Raw advertisement" value={advertisement.rawAdvertisement} />
      <RawField
        label="Last received"
        value={new Date(advertisement.lastSeen).toLocaleTimeString()}
      />
    </li>
  );
}

function formatHexMap(value: Record<string, string>): string | null {
  const entries = Object.entries(value);
  if (entries.length === 0) return null;
  return entries.map(([key, bytes]) => `${key}: ${bytes}`).join(" · ");
}

function RawField({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <code className="break-all">{value == null || value === "" ? "—" : value}</code>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}
