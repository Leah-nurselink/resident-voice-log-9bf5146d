import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bluetooth,
  BluetoothSearching,
  CheckCircle2,
  IdCard,
  Pause,
  Play,
  Radio,
  Tag,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  clearObservations,
  getNearby,
  isLEScanAvailable,
  isWebBluetoothAvailable,
  startScanner,
  stopScanner,
  subscribe as subscribeObservations,
  subscribeStatus,
  type BeaconObservation,
  type ScannerStatus,
} from "@/lib/ble-advertisement-scanner";
import {
  endTriggerManually,
  refreshRegisteredDevices,
  resolvePendingDecision,
  startSessionManager,
  stopSessionManager,
  subscribeSessionManager,
  type ActiveTrigger,
  type SessionManagerState,
} from "@/lib/ble-session-manager";
import { RegisterBeaconDialog } from "@/components/devices/RegisterBeaconDialog";

export const Route = createFileRoute("/_authenticated/devices")({
  head: () => ({ meta: [{ title: "Nearby Devices · CareCore" }] }),
  component: DevicesPage,
});

type DeviceRow = {
  id: string;
  device_type: "room_beacon" | "wearable_tag" | "staff_badge";
  label: string;
  ble_identifier: string;
  mac_address: string | null;
  status: string;
  last_seen_at: string | null;
  last_rssi: number | null;
  beacon_protocol: "ibeacon" | "eddystone-uid" | "generic";
  beacon_uuid: string | null;
  beacon_major: number | null;
  beacon_minor: number | null;
  tx_power: number | null;
  rssi_threshold: number;
  session_timeout_seconds: number;
  room_id: string | null;
  resident_id: string | null;
  staff_user_id: string | null;
};

type Room = { id: string; name: string; floor: string | null };
type Resident = { id: string; full_name: string };
type StaffProfile = { id: string; full_name: string | null };

function typeIcon(t: DeviceRow["device_type"]) {
  return t === "room_beacon" ? Radio : t === "wearable_tag" ? Tag : IdCard;
}

function typeLabel(t: DeviceRow["device_type"]) {
  return t === "room_beacon" ? "Room" : t === "wearable_tag" ? "Wearable" : "Staff badge";
}

function relTime(iso: string | null) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

function rssiBar(rssi: number) {
  // Map -100..-30 dBm to 0..100%.
  const pct = Math.max(0, Math.min(100, ((rssi + 100) / 70) * 100));
  return Math.round(pct);
}

function deviceKey(d: DeviceRow): string {
  if (d.beacon_protocol === "ibeacon" && d.beacon_uuid) {
    return `ibeacon:${d.beacon_uuid}:${d.beacon_major ?? 0}:${d.beacon_minor ?? 0}`;
  }
  return d.ble_identifier;
}

function DevicesPage() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [observations, setObservations] = useState<BeaconObservation[]>([]);
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>({
    running: false,
    mode: isLEScanAvailable() ? "native" : "unavailable",
  });
  const [sessionState, setSessionState] = useState<SessionManagerState>({
    running: false,
    registeredCount: 0,
    activeSessions: [],
    lastTickAt: null,
  });

  const load = async () => {
    const [d, r, res, p] = await Promise.all([
      supabase
        .from("devices")
        .select(
          "id, device_type, label, ble_identifier, mac_address, status, last_seen_at, last_rssi, beacon_protocol, beacon_uuid, beacon_major, beacon_minor, tx_power, rssi_threshold, session_timeout_seconds, room_id, resident_id, staff_user_id",
        )
        .order("device_type"),
      supabase.from("rooms").select("id, name, floor").order("name"),
      supabase.from("residents").select("id, full_name").order("full_name"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
    ]);
    setDevices((d.data ?? []) as DeviceRow[]);
    setRooms((r.data ?? []) as Room[]);
    setResidents((res.data ?? []) as Resident[]);
    setStaff((p.data ?? []) as StaffProfile[]);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => subscribeObservations(setObservations), []);
  useEffect(() => subscribeStatus(setScannerStatus), []);
  useEffect(() => subscribeSessionManager(setSessionState), []);

  const toggleScanner = async () => {
    if (scannerStatus.running) {
      stopScanner();
      await stopSessionManager();
      toast.message("Scanning paused");
    } else {
      try {
        await startScanner();
        await startSessionManager();
        toast.success(
          scannerStatus.mode === "native"
            ? "Listening for BLE advertisements"
            : "Scanning in simulator mode — registered beacons will appear",
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to start scanner");
      }
    }
  };

  const residentName = (id: string | null) =>
    id ? (residents.find((x) => x.id === id)?.full_name ?? "—") : "—";
  const roomName = (id: string | null) =>
    id ? (rooms.find((x) => x.id === id)?.name ?? "—") : "—";
  const staffName = (id: string | null) =>
    id ? (staff.find((x) => x.id === id)?.full_name ?? "Staff") : "—";

  const registeredKeys = useMemo(() => {
    const m = new Map<string, DeviceRow>();
    for (const d of devices) m.set(deviceKey(d), d);
    return m;
  }, [devices]);

  const nearbyRegistered = observations.filter((o) => registeredKeys.has(o.key));
  const nearbyUnknown = observations.filter((o) => !registeredKeys.has(o.key));

  return (
    <AppShell
      title="Nearby Devices"
      subtitle="Live BLE advertisement scanning — no pairing required"
      action={
        <div className="flex gap-2">
          <Button onClick={() => clearObservations()} variant="ghost" size="sm">
            <Trash2 className="h-4 w-4" />
            Clear list
          </Button>
          <Button onClick={() => void toggleScanner()} variant="outline">
            {scannerStatus.running ? (
              <>
                <Pause className="h-4 w-4" /> Pause scan
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Start scan
              </>
            )}
          </Button>
          <RegisterBeaconDialog
            rooms={rooms}
            residents={residents}
            staff={staff}
            onSaved={() => void load()}
          />
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Scanner"
          value={scannerStatus.running ? "Running" : "Paused"}
          icon={scannerStatus.running ? Wifi : WifiOff}
        />
        <StatCard label="Nearby beacons" value={observations.length} icon={BluetoothSearching} />
        <StatCard label="Registered" value={devices.length} icon={Bluetooth} />
        <StatCard
          label="Active sessions"
          value={sessionState.activeSessions.length}
          icon={CheckCircle2}
        />
      </div>

      {!isWebBluetoothAvailable() && (
        <Card className="mt-4 border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-900">
            Web Bluetooth isn't available in this browser. Scanning runs in simulator mode so you
            can still register beacons and exercise the session workflow. For real BLE, open in
            Chrome / Edge on Android, Windows or macOS over HTTPS.
          </CardContent>
        </Card>
      )}

      {isWebBluetoothAvailable() && !isLEScanAvailable() && (
        <Card className="mt-4 border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-900">
            Passive BLE scanning requires the experimental Web Platform features flag in your
            browser (chrome://flags/#enable-experimental-web-platform-features). Running in
            simulator mode for now.
          </CardContent>
        </Card>
      )}

      {scannerStatus.lastError && (
        <Card className="mt-4 border-destructive/30">
          <CardContent className="py-3 text-sm text-destructive">
            Scanner error: {scannerStatus.lastError}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="nearby" className="mt-6">
        <TabsList>
          <TabsTrigger value="nearby">Nearby ({observations.length})</TabsTrigger>
          <TabsTrigger value="registered">Registered ({devices.length})</TabsTrigger>
          <TabsTrigger value="sessions">
            Active sessions ({sessionState.activeSessions.length})
          </TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
        </TabsList>

        <TabsContent value="nearby" className="mt-4 space-y-4">
          <NearbySection
            title="Registered beacons in range"
            observations={nearbyRegistered}
            registered={registeredKeys}
            residentName={residentName}
            roomName={roomName}
            staffName={staffName}
            rooms={rooms}
            residents={residents}
            staff={staff}
            onChanged={load}
            emptyHint={
              scannerStatus.running
                ? "No registered beacons are in range yet."
                : "Press Start scan to begin listening."
            }
          />
          <NearbySection
            title="Unknown beacons"
            observations={nearbyUnknown}
            registered={registeredKeys}
            residentName={residentName}
            roomName={roomName}
            staffName={staffName}
            rooms={rooms}
            residents={residents}
            staff={staff}
            onChanged={load}
            emptyHint="No unknown beacons heard. Bring one closer to the device."
          />
        </TabsContent>

        <TabsContent value="registered" className="mt-4">
          <RegisteredList
            devices={devices}
            residentName={residentName}
            roomName={roomName}
            staffName={staffName}
            observations={observations}
            onChanged={load}
          />
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <ActiveSessionsList
            sessions={sessionState.activeSessions}
            devices={devices}
            residentName={residentName}
            roomName={roomName}
            onEnd={async (id) => {
              await endTriggerManually(id);
              toast.message("Session ended");
            }}
          />
        </TabsContent>

        <TabsContent value="rooms" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rooms</CardTitle>
            </CardHeader>
            <CardContent>
              <AddRoomInline onSaved={load} />
              <ul className="mt-3 divide-y text-sm">
                {rooms.map((r) => (
                  <li key={r.id} className="flex justify-between py-2">
                    <span>{r.name}</span>
                    <span className="text-muted-foreground">{r.floor ?? ""}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function NearbySection({
  title,
  observations,
  registered,
  residentName,
  roomName,
  staffName,
  rooms,
  residents,
  staff,
  onChanged,
  emptyHint,
}: {
  title: string;
  observations: BeaconObservation[];
  registered: Map<string, DeviceRow>;
  residentName: (id: string | null) => string;
  roomName: (id: string | null) => string;
  staffName: (id: string | null) => string;
  rooms: Room[];
  residents: Resident[];
  staff: StaffProfile[];
  onChanged: () => void;
  emptyHint: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {observations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyHint}</p>
        ) : (
          <ul className="divide-y">
            {observations.map((o) => {
              const dev = registered.get(o.key);
              const pct = rssiBar(o.rssi);
              const assigned = dev
                ? dev.device_type === "room_beacon"
                  ? roomName(dev.room_id)
                  : dev.device_type === "wearable_tag"
                    ? residentName(dev.resident_id)
                    : staffName(dev.staff_user_id)
                : null;
              return (
                <li key={o.key} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">
                        {o.protocol}
                      </Badge>
                      <span className="font-medium">{o.name ?? dev?.label ?? "Unknown beacon"}</span>
                      {dev && (
                        <Badge variant="secondary">
                          {typeLabel(dev.device_type)} · {assigned}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                      {o.uuid ? `${o.uuid}` : o.key}
                      {o.major != null && ` · M:${o.major}/m:${o.minor}`}
                      {o.mac && ` · MAC ${o.mac}`}
                      {o.txPower != null && ` · TxPwr ${o.txPower}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 md:w-72 md:justify-end">
                    <div className="flex flex-col items-end">
                      <div className="text-sm font-semibold">{o.rssi} dBm</div>
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {o.hits} hit{o.hits === 1 ? "" : "s"} · seen {relTime(o.lastSeen)}
                      </div>
                    </div>
                    {!dev && (
                      <RegisterBeaconDialog
                        rooms={rooms}
                        residents={residents}
                        staff={staff}
                        detected={o}
                        onSaved={onChanged}
                        trigger={<Button size="sm">Register</Button>}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RegisteredList({
  devices,
  residentName,
  roomName,
  staffName,
  observations,
  onChanged,
}: {
  devices: DeviceRow[];
  residentName: (id: string | null) => string;
  roomName: (id: string | null) => string;
  staffName: (id: string | null) => string;
  observations: BeaconObservation[];
  onChanged: () => void;
}) {
  if (devices.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No beacons registered yet. Detected beacons can be registered from the Nearby tab, or use
          the Register beacon button to add one manually.
        </CardContent>
      </Card>
    );
  }
  const obsByKey = new Map(observations.map((o) => [o.key, o]));
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {devices.map((d) => {
        const Icon = typeIcon(d.device_type);
        const k = deviceKey(d);
        const obs = obsByKey.get(k);
        const inRange = obs && obs.rssi >= d.rssi_threshold;
        const assigned =
          d.device_type === "room_beacon"
            ? roomName(d.room_id)
            : d.device_type === "wearable_tag"
              ? residentName(d.resident_id)
              : staffName(d.staff_user_id);
        return (
          <Card key={d.id}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">{d.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {typeLabel(d.device_type)} · {d.beacon_protocol}
                    </div>
                    <div className="mt-1 text-sm">
                      Assigned to: <span className="font-medium">{assigned}</span>
                    </div>
                    <div className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                      {d.beacon_uuid
                        ? `${d.beacon_uuid} · ${d.beacon_major ?? 0}/${d.beacon_minor ?? 0}`
                        : d.ble_identifier}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={inRange ? "default" : "secondary"}>
                    {inRange ? "In range" : "Out of range"}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {obs ? `${obs.rssi} dBm` : "no signal"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    last seen {relTime(d.last_seen_at)}
                  </span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  Threshold: <span className="font-medium text-foreground">{d.rssi_threshold} dBm</span>
                </div>
                <div>
                  Timeout: <span className="font-medium text-foreground">{d.session_timeout_seconds}s</span>
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <EditBeaconDialog device={d} onSaved={onChanged} />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!confirm("Remove this beacon?")) return;
                    const { error } = await supabase.from("devices").delete().eq("id", d.id);
                    if (error) toast.error(error.message);
                    else {
                      toast.success("Beacon removed");
                      await refreshRegisteredDevices();
                      onChanged();
                    }
                  }}
                >
                  Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function EditBeaconDialog({ device, onSaved }: { device: DeviceRow; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(device.label);
  const [threshold, setThreshold] = useState(String(device.rssi_threshold));
  const [timeoutSec, setTimeoutSec] = useState(String(device.session_timeout_seconds));
  const save = async () => {
    const { error } = await supabase
      .from("devices")
      .update({
        label,
        rssi_threshold: parseInt(threshold, 10) || -75,
        session_timeout_seconds: parseInt(timeoutSec, 10) || 60,
      })
      .eq("id", device.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Beacon updated");
    await refreshRegisteredDevices();
    onSaved();
    setOpen(false);
  };
  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Edit
      </Button>
    );
  }
  return (
    <div className="absolute right-2 z-10 mt-8 w-72 rounded-md border bg-background p-3 shadow-lg">
      <div className="space-y-2">
        <div>
          <Label>Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Threshold</Label>
            <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
          <div>
            <Label>Timeout (s)</Label>
            <Input value={timeoutSec} onChange={(e) => setTimeoutSec(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActiveSessionsList({
  sessions,
  devices,
  residentName,
  roomName,
  onEnd,
}: {
  sessions: ActiveTrigger[];
  devices: DeviceRow[];
  residentName: (id: string | null) => string;
  roomName: (id: string | null) => string;
  onEnd: (deviceId: string) => Promise<void>;
}) {
  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No active sessions. Sessions start automatically when a registered beacon clears its
          RSSI threshold and the system can identify a single resident (via wearable tag or a
          room beacon whose room has one occupant).
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {sessions.map((s) => {
            const dev = devices.find((d) => d.id === s.deviceId);
            const subject = s.residentId ? residentName(s.residentId) : (dev?.label ?? "Beacon");
            const ruleLabel =
              s.rule === "wearable" ? "wearable tag" : "room beacon · single occupant";
            return (
              <li key={s.residentId ?? s.deviceId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="font-medium">{subject}</div>
                  <div className="text-xs text-muted-foreground">
                    {dev?.label ?? "—"} · {ruleLabel}
                    {s.roomId ? ` · ${roomName(s.roomId)}` : ""} · last RSSI {s.lastRssi} dBm ·
                    started {relTime(s.startedAt)}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => void onEnd(s.deviceId)}>
                  End session
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function AddRoomInline({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [floor, setFloor] = useState("");
  const add = async () => {
    if (!name) return;
    const { error } = await supabase.from("rooms").insert({ name, floor: floor || null });
    if (error) toast.error(error.message);
    else {
      setName("");
      setFloor("");
      toast.success("Room added");
      onSaved();
    }
  };
  return (
    <div className="flex gap-2">
      <Input placeholder="Room name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input
        placeholder="Floor"
        value={floor}
        onChange={(e) => setFloor(e.target.value)}
        className="w-24"
      />
      <Button onClick={add} size="sm">
        Add
      </Button>
    </div>
  );
}
