import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Battery,
  BatteryLow,
  Bluetooth,
  BluetoothSearching,
  CheckCircle2,
  Plus,
  Radio,
  Tag,
  IdCard,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  isWebBluetoothAvailable,
  recordScanEvents,
  scanOnce,
  type ScanHit,
} from "@/lib/ble-scanner";
import { inferInteraction, startCareSessionIfConfident } from "@/lib/confidence-engine";
import {
  startAutoConnect,
  stopAutoConnect,
  subscribeAutoConnect,
  type AutoConnectStatus,
} from "@/lib/ble-auto-connect";
import { Switch } from "@/components/ui/switch";
import { PairDeviceWizard } from "@/components/devices/PairDeviceWizard";

export const Route = createFileRoute("/_authenticated/devices")({
  head: () => ({ meta: [{ title: "Devices · CareCore" }] }),
  component: DevicesPage,
});

type DeviceRow = {
  id: string;
  device_type: "room_beacon" | "wearable_tag" | "staff_badge";
  label: string;
  ble_identifier: string;
  mac_address: string | null;
  manufacturer: string | null;
  model: string | null;
  status: string;
  battery_level: number | null;
  last_seen_at: string | null;
  last_rssi: number | null;
  room_id: string | null;
  resident_id: string | null;
  staff_user_id: string | null;
  paired_at: string | null;
  notes: string | null;
};

type Room = { id: string; name: string; floor: string | null };
type Resident = { id: string; full_name: string };
type StaffProfile = { id: string; full_name: string | null };

function typeIcon(t: DeviceRow["device_type"]) {
  if (t === "room_beacon") return Radio;
  if (t === "wearable_tag") return Tag;
  return IdCard;
}

function typeLabel(t: DeviceRow["device_type"]) {
  return t === "room_beacon" ? "Room beacon" : t === "wearable_tag" ? "Wearable tag" : "Staff badge";
}

function relTime(iso: string | null) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function DevicesPage() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<ScanHit[]>([]);
  const [history, setHistory] = useState<
    { id: string; device_id: string; event_type: string; rssi: number | null; created_at: string }[]
  >([]);
  const [guessResult, setGuessResult] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<AutoConnectStatus | null>(null);

  useEffect(() => subscribeAutoConnect(setAutoStatus), []);

  const toggleAutoConnect = async (on: boolean) => {
    if (on) {
      await startAutoConnect();
      toast.success("Auto-connect on — paired devices will reconnect automatically");
    } else {
      stopAutoConnect();
      toast.message("Auto-connect off");
    }
  };

  const load = async () => {
    setLoading(true);
    const [d, r, res, p, ev] = await Promise.all([
      supabase
        .from("devices")
        .select(
          "id, device_type, label, ble_identifier, mac_address, manufacturer, model, status, battery_level, last_seen_at, last_rssi, room_id, resident_id, staff_user_id, paired_at, notes",
        )
        .order("device_type"),
      supabase.from("rooms").select("id, name, floor").order("name"),
      supabase.from("residents").select("id, full_name").order("full_name"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      supabase
        .from("device_events")
        .select("id, device_id, event_type, rssi, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setDevices((d.data ?? []) as DeviceRow[]);
    setRooms((r.data ?? []) as Room[]);
    setResidents((res.data ?? []) as Resident[]);
    setStaff((p.data ?? []) as StaffProfile[]);
    setHistory(ev.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const beacons = devices.filter((d) => d.device_type === "room_beacon");
  const wearables = devices.filter((d) => d.device_type === "wearable_tag");
  const badges = devices.filter((d) => d.device_type === "staff_badge");

  const lowBattery = devices.filter((d) => (d.battery_level ?? 100) < 20).length;
  const online = devices.filter(
    (d) => d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 10 * 60_000,
  ).length;

  const residentName = (id: string | null) => {
    if (!id) return "—";
    const r = residents.find((x) => x.id === id);
    return r ? r.full_name : "—";
  };
  const roomName = (id: string | null) => rooms.find((x) => x.id === id)?.name ?? "—";
  const staffName = (id: string | null) =>
    staff.find((x) => x.id === id)?.full_name ?? (id ? "Staff" : "—");

  const runScan = async () => {
    setScanning(true);
    setGuessResult(null);
    try {
      const hits = await scanOnce();
      setLastScan(hits);
      await recordScanEvents(hits);
      const { data: u } = await supabase.auth.getUser();
      const guess = inferInteraction(hits, { signedInStaffUserId: u?.user?.id });
      const sid = await startCareSessionIfConfident(guess, 0.6);
      if (sid && guess.residentId) {
        setGuessResult(
          `Started care session with ${residentName(guess.residentId)} in ${roomName(guess.roomId)} (confidence ${(guess.confidence * 100).toFixed(0)}%)`,
        );
        toast.success("Care session auto-started");
      } else if (guess.residentId) {
        setGuessResult(
          `Best guess: ${residentName(guess.residentId)} — confidence ${(guess.confidence * 100).toFixed(0)}% (below 60% threshold)`,
        );
      } else {
        setGuessResult("No resident interaction detected");
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  return (
    <AppShell
      title="Device Management"
      subtitle="BLE beacons, wearables and staff badges"
      action={
        <div className="flex gap-2">
          <Button onClick={runScan} disabled={scanning} variant="outline">
            <BluetoothSearching className="h-4 w-4" />
            {scanning ? "Scanning…" : "Scan now"}
          </Button>
          <AddDeviceDialog rooms={rooms} residents={residents} staff={staff} onSaved={load} />
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total devices" value={devices.length} icon={Bluetooth} />
        <StatCard label="Online (10m)" value={online} icon={CheckCircle2} />
        <StatCard label="Low battery" value={lowBattery} icon={BatteryLow} />
        <StatCard label="Last scan hits" value={lastScan.length} icon={Sparkles} />
      </div>

      {!isWebBluetoothAvailable() && (
        <Card className="mt-4 border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm text-amber-900">
            Web Bluetooth isn't available in this browser — scans run in simulator mode so you can
            still test the confidence engine and care-session flow.
          </CardContent>
        </Card>
      )}

      <Card className="mt-4">
        <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Bluetooth className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <div className="font-medium">Auto-connect</div>
              <div className="text-sm text-muted-foreground">
                {autoStatus?.enabled
                  ? `On · ${autoStatus.mode === "native" ? "live BLE" : autoStatus.mode === "simulator" ? "simulator" : "unavailable"} · ${autoStatus.pairedCount} paired · ${autoStatus.connectedCount} connected${autoStatus.lastTickAt ? ` · last check ${new Date(autoStatus.lastTickAt).toLocaleTimeString()}` : ""}`
                  : "Reconnect paired beacons, wearables and badges automatically whenever they're in range."}
              </div>
              {autoStatus?.lastError && (
                <div className="mt-1 text-xs text-amber-700">{autoStatus.lastError}</div>
              )}
            </div>
          </div>
          <Switch
            checked={!!autoStatus?.enabled}
            onCheckedChange={(v) => void toggleAutoConnect(v)}
          />
        </CardContent>
      </Card>

      {guessResult && (
        <Card className="mt-4 border-primary/30">
          <CardContent className="py-3 text-sm">{guessResult}</CardContent>
        </Card>
      )}

      <Tabs defaultValue="all" className="mt-6">
        <TabsList>
          <TabsTrigger value="all">All ({devices.length})</TabsTrigger>
          <TabsTrigger value="beacons">Room beacons ({beacons.length})</TabsTrigger>
          <TabsTrigger value="wearables">Wearables ({wearables.length})</TabsTrigger>
          <TabsTrigger value="badges">Staff badges ({badges.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <DeviceList
            devices={devices}
            loading={loading}
            residentName={residentName}
            roomName={roomName}
            staffName={staffName}
            rooms={rooms}
            residents={residents}
            staff={staff}
            onChanged={load}
          />
        </TabsContent>
        <TabsContent value="beacons" className="mt-4">
          <DeviceList
            devices={beacons}
            loading={loading}
            residentName={residentName}
            roomName={roomName}
            staffName={staffName}
            rooms={rooms}
            residents={residents}
            staff={staff}
            onChanged={load}
          />
        </TabsContent>
        <TabsContent value="wearables" className="mt-4">
          <DeviceList
            devices={wearables}
            loading={loading}
            residentName={residentName}
            roomName={roomName}
            staffName={staffName}
            rooms={rooms}
            residents={residents}
            staff={staff}
            onChanged={load}
          />
        </TabsContent>
        <TabsContent value="badges" className="mt-4">
          <DeviceList
            devices={badges}
            loading={loading}
            residentName={residentName}
            roomName={roomName}
            staffName={staffName}
            rooms={rooms}
            residents={residents}
            staff={staff}
            onChanged={load}
          />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent device events</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet — run a scan.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {history.map((h) => {
                    const dev = devices.find((d) => d.id === h.device_id);
                    return (
                      <li key={h.id} className="flex items-center justify-between py-2">
                        <div>
                          <span className="font-medium">{dev?.label ?? "Unknown device"}</span>{" "}
                          <span className="text-muted-foreground">· {h.event_type}</span>
                          {h.rssi != null && (
                            <span className="text-muted-foreground"> · {h.rssi} dBm</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {relTime(h.created_at)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
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
  value: number;
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

function DeviceList({
  devices,
  loading,
  residentName,
  roomName,
  staffName,
  rooms,
  residents,
  staff,
  onChanged,
}: {
  devices: DeviceRow[];
  loading: boolean;
  residentName: (id: string | null) => string;
  roomName: (id: string | null) => string;
  staffName: (id: string | null) => string;
  rooms: Room[];
  residents: Resident[];
  staff: StaffProfile[];
  onChanged: () => void;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (devices.length === 0)
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No devices registered yet.
        </CardContent>
      </Card>
    );
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {devices.map((d) => {
        const Icon = typeIcon(d.device_type);
        const assignedLabel =
          d.device_type === "room_beacon"
            ? roomName(d.room_id)
            : d.device_type === "wearable_tag"
              ? residentName(d.resident_id)
              : staffName(d.staff_user_id);
        const isOnline =
          d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 10 * 60_000;
        const battery = d.battery_level ?? null;
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
                      {typeLabel(d.device_type)} · {d.ble_identifier}
                    </div>
                    <div className="mt-1 text-sm">
                      Assigned to: <span className="font-medium">{assignedLabel}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={isOnline ? "default" : "secondary"}>
                    {isOnline ? "Online" : "Offline"}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    seen {relTime(d.last_seen_at)}
                  </span>
                </div>
              </div>
              {battery != null && (
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Battery className="h-3 w-3" /> Battery
                    </span>
                    <span>{battery}%</span>
                  </div>
                  <Progress value={battery} />
                </div>
              )}
              <div className="mt-3 flex justify-end">
                <EditDeviceDialog
                  device={d}
                  rooms={rooms}
                  residents={residents}
                  staff={staff}
                  onSaved={onChanged}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AddDeviceDialog({
  rooms,
  residents,
  staff,
  onSaved,
}: {
  rooms: Room[];
  residents: Resident[];
  staff: StaffProfile[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Pair device
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pair a BLE device</DialogTitle>
        </DialogHeader>
        <DeviceForm
          rooms={rooms}
          residents={residents}
          staff={staff}
          onSaved={() => {
            setOpen(false);
            onSaved();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditDeviceDialog({
  device,
  rooms,
  residents,
  staff,
  onSaved,
}: {
  device: DeviceRow;
  rooms: Room[];
  residents: Resident[];
  staff: StaffProfile[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{device.label}</DialogTitle>
        </DialogHeader>
        <DeviceForm
          device={device}
          rooms={rooms}
          residents={residents}
          staff={staff}
          onSaved={() => {
            setOpen(false);
            onSaved();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function DeviceForm({
  device,
  rooms,
  residents,
  staff,
  onSaved,
}: {
  device?: DeviceRow;
  rooms: Room[];
  residents: Resident[];
  staff: StaffProfile[];
  onSaved: () => void;
}) {
  const [type, setType] = useState<DeviceRow["device_type"]>(device?.device_type ?? "room_beacon");
  const [label, setLabel] = useState(device?.label ?? "");
  const [bleId, setBleId] = useState(device?.ble_identifier ?? "");
  const [mac, setMac] = useState(device?.mac_address ?? "");
  const [manufacturer, setManufacturer] = useState(device?.manufacturer ?? "");
  const [model, setModel] = useState(device?.model ?? "");
  const [battery, setBattery] = useState<string>(device?.battery_level?.toString() ?? "100");
  const [status, setStatus] = useState<"active" | "inactive" | "lost" | "maintenance">(
    (device?.status as "active" | "inactive" | "lost" | "maintenance") ?? "active",
  );
  const [roomId, setRoomId] = useState<string>(device?.room_id ?? "");
  const [residentId, setResidentId] = useState<string>(device?.resident_id ?? "");
  const [staffId, setStaffId] = useState<string>(device?.staff_user_id ?? "");
  const [notes, setNotes] = useState(device?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!label || !bleId) {
      toast.error("Label and BLE identifier are required");
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = {
      device_type: type,
      label,
      ble_identifier: bleId,
      mac_address: mac || null,
      manufacturer: manufacturer || null,
      model: model || null,
      battery_level: battery ? Math.min(100, Math.max(0, parseInt(battery, 10))) : null,
      status,
      room_id: type === "room_beacon" ? roomId || null : null,
      resident_id: type === "wearable_tag" ? residentId || null : null,
      staff_user_id: type === "staff_badge" ? staffId || null : null,
      notes: notes || null,
      paired_at: device?.paired_at ?? new Date().toISOString(),
      paired_by: device?.paired_at ? undefined : u?.user?.id,
    };
    const res = device
      ? await supabase.from("devices").update(payload).eq("id", device.id)
      : await supabase.from("devices").insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(device ? "Device updated" : "Device paired");
    onSaved();
  };

  const remove = async () => {
    if (!device) return;
    if (!confirm("Remove this device?")) return;
    const { error } = await supabase.from("devices").delete().eq("id", device.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Device removed");
      onSaved();
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Device type</Label>
          <Select value={type} onValueChange={(v) => setType(v as DeviceRow["device_type"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="room_beacon">Room beacon</SelectItem>
              <SelectItem value="wearable_tag">Wearable tag</SelectItem>
              <SelectItem value="staff_badge">Staff badge</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Label</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Room 12 beacon" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>BLE identifier</Label>
          <Input value={bleId} onChange={(e) => setBleId(e.target.value)} placeholder="UUID or device id" />
        </div>
        <div>
          <Label>MAC address</Label>
          <Input value={mac} onChange={(e) => setMac(e.target.value)} placeholder="optional" />
        </div>
        <div>
          <Label>Manufacturer</Label>
          <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
        </div>
        <div>
          <Label>Model</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
        <div>
          <Label>Battery %</Label>
          <Input type="number" min={0} max={100} value={battery} onChange={(e) => setBattery(e.target.value)} />
        </div>
      </div>

      {type === "room_beacon" && (
        <div>
          <Label>Assign to room</Label>
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a room" />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {rooms.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Add a room first in the History → Rooms section.
            </p>
          )}
        </div>
      )}
      {type === "wearable_tag" && (
        <div>
          <Label>Assign to resident</Label>
          <Select value={residentId} onValueChange={setResidentId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a resident" />
            </SelectTrigger>
            <SelectContent>
              {residents.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {type === "staff_badge" && (
        <div>
          <Label>Assign to staff member</Label>
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a staff member" />
            </SelectTrigger>
            <SelectContent>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.full_name ?? "Unnamed"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <DialogFooter className="gap-2">
        {device && (
          <Button variant="destructive" onClick={remove} type="button">
            Remove
          </Button>
        )}
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : device ? "Save changes" : "Pair device"}
        </Button>
      </DialogFooter>
    </div>
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
      <Input placeholder="Floor" value={floor} onChange={(e) => setFloor(e.target.value)} className="w-24" />
      <Button onClick={add} size="sm">Add</Button>
    </div>
  );
}
