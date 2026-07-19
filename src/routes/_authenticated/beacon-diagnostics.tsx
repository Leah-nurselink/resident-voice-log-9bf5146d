import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  getNativeBridgeDiagnostic,
  getNativeAdapter,
  getNativeRuntime,
  installCapacitorBridgeIfNeeded,
} from "@/lib/native-beacon-bridge";
import { isNativeShell } from "@/lib/surface";

export const Route = createFileRoute("/_authenticated/beacon-diagnostics")({
  head: () => ({ meta: [{ title: "Beacon diagnostics · CareCore" }] }),
  component: BeaconDiagnosticsPage,
});

function BeaconDiagnosticsPage() {
  const [status, setStatus] = useState<ScannerStatus>(() => getStatus());
  const [obs, setObs] = useState<BeaconObservation[]>(() => getNearby());
  const [bridgeInstalled, setBridgeInstalled] = useState<boolean>(
    () => !!getNativeAdapter(),
  );
  const [nativeRuntime, setNativeRuntime] = useState(() => getNativeRuntime());
  const [now, setNow] = useState(() => Date.now());
  const [bridgeDiagnostic, setBridgeDiagnostic] = useState(() =>
    getNativeBridgeDiagnostic(),
  );
  const diag = getLEScanSupportDiagnostic();

  useEffect(() => subscribeStatus(setStatus), []);
  useEffect(() => subscribeObs(setObs), []);
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      setBridgeInstalled(!!getNativeAdapter());
      setNativeRuntime(getNativeRuntime());
      setBridgeDiagnostic(getNativeBridgeDiagnostic());
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

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Beacon diagnostics</h1>
          <p className="text-sm text-muted-foreground">
            Live BLE bridge status and detected advertisements.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await installCapacitorBridgeIfNeeded();
              await startScanner();
            }}
          >
            Start
          </Button>
          <Button size="sm" variant="outline" onClick={() => stopScanner()}>
            Stop
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              clearObservations();
              setObs([]);
            }}
          >
            Clear
          </Button>
        </div>
      </header>

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
          {bridgeDiagnostic.lastError && (
            <Row label="Bridge error">
              <span className="text-xs text-destructive">
                {bridgeDiagnostic.lastError}
              </span>
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
              <span className="text-xs">
                {new Date(status.startedAt).toLocaleTimeString()}
              </span>
            </Row>
          )}
          {status.lastError && (
            <Row label="Last error">
              <span className="text-xs text-destructive">{status.lastError}</span>
            </Row>
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
          <Row label="Platform">
            <code className="text-xs">{diag.platform || "?"}</code>
          </Row>
          <div className="pt-1 text-xs text-muted-foreground break-all">
            UA: {diag.userAgent}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Detected beacons ({sorted.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No advertisements yet. If the mode above is "Simulator", the phone
              is not exposing real BLE to the app.
            </p>
          ) : (
            <ul className="divide-y">
              {sorted.map((o) => {
                const age = Math.max(
                  0,
                  Math.round((now - new Date(o.lastSeen).getTime()) / 1000),
                );
                return (
                  <li key={o.key} className="space-y-1 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {o.protocol}
                        </Badge>
                        <span className="font-medium">
                          {o.name ?? o.key.slice(0, 24)}
                        </span>
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}
