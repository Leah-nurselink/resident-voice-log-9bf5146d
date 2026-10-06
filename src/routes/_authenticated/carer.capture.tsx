import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Activity,
  BluetoothSearching,
  Check,
  CheckCircle2,
  Hand,
  Pencil,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SessionRecorder, type StructuredNote } from "@/components/SessionRecorder";
import {
  isLEScanAvailable,
  startScanner,
  stopScanner,
  subscribe as subscribeObservations,
  subscribeStatus,
  type BeaconObservation,
  type ScannerStatus,
} from "@/lib/ble-advertisement-scanner";
import {
  startSessionManager,
  stopSessionManager,
  subscribeSessionManager,
  manuallyAssignDevice,
  endTriggerManually,
  type SessionManagerState,
} from "@/lib/ble-session-manager";
import { domainLabel, type CarePlanDomain, type RiskType } from "@/lib/care-domains";
import { Link } from "@tanstack/react-router";
import { isNativeShell } from "@/lib/surface";

export const Route = createFileRoute("/_authenticated/carer/capture")({
  head: () => ({ meta: [{ title: "Capture · ForgeAI" }] }),
  component: CapturePage,
});

type ResidentRow = { id: string; full_name: string };
type RoomRow = { id: string; name: string };

type RegisteredDevice = {
  id: string;
  device_type: "room_beacon" | "wearable_tag" | "staff_badge";
  label: string;
  ble_identifier: string;
  beacon_protocol: "ibeacon" | "eddystone-uid" | "generic";
  beacon_uuid: string | null;
  beacon_major: number | null;
  beacon_minor: number | null;
  room_id: string | null;
  resident_id: string | null;
};

// Same key logic as the Devices page and the session manager — must match
// exactly so a live observation and its registration line up.
function deviceKey(d: RegisteredDevice): string {
  if (d.beacon_protocol === "ibeacon" && d.beacon_uuid) {
    return `ibeacon:${d.beacon_uuid}:${d.beacon_major ?? 0}:${d.beacon_minor ?? 0}`;
  }
  return d.ble_identifier;
}

function CapturePage() {
  const [obs, setObs] = useState<BeaconObservation[]>([]);
  const [scanner, setScanner] = useState<ScannerStatus>({
    running: false,
    mode: isLEScanAvailable() ? "native" : "unavailable",
  });
  const [sessionState, setSessionState] = useState<SessionManagerState>({
    running: false,
    registeredCount: 0,
    activeSessions: [],
    lastTickAt: null,
  });
  const [residents, setResidents] = useState<Map<string, string>>(new Map());
  const [rooms, setRooms] = useState<Map<string, string>>(new Map());
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [savedDomain, setSavedDomain] = useState<string | null>(null);

  // Manual selection UI state only — the actual session lives in the
  // session manager once chosen, same as any auto-detected one.
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [ambiguous, setAmbiguous] = useState<{ device: RegisteredDevice; candidates: string[] } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await startScanner();
        await startSessionManager();
        if (!mounted) return;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to start scanner");
      }
    })();
    return () => {
      mounted = false;
      stopScanner();
      void stopSessionManager();
    };
  }, []);

  useEffect(() => subscribeObservations(setObs), []);
  useEffect(() => subscribeStatus(setScanner), []);
  useEffect(() => subscribeSessionManager(setSessionState), []);

  useEffect(() => {
    void (async () => {
      const [res, r, dev] = await Promise.all([
        supabase.from("residents").select("id, full_name"),
        supabase.from("rooms").select("id, name"),
        supabase
          .from("devices")
          .select(
            "id, device_type, label, ble_identifier, beacon_protocol, beacon_uuid, beacon_major, beacon_minor, room_id, resident_id",
          )
          .eq("status", "active"),
      ]);
      setResidents(new Map(((res.data ?? []) as ResidentRow[]).map((x) => [x.id, x.full_name])));
      setRooms(new Map(((r.data ?? []) as RoomRow[]).map((x) => [x.id, x.name])));
      setDevices((dev.data ?? []) as RegisteredDevice[]);
    })();
  }, []);

  // Registered beacons currently in range, for the manual picker.
  const nearbyRegisteredDevices = useMemo(() => {
    return devices
      .map((d) => {
        const o = obs.find((x) => x.key === deviceKey(d));
        return o ? { device: d, obs: o } : null;
      })
      .filter((x): x is { device: RegisteredDevice; obs: BeaconObservation } => x !== null)
      .sort((a, b) => b.obs.rssi - a.obs.rssi);
  }, [devices, obs]);

  // The carer decides who they're recording for. Only auto-pick when exactly
  // one beacon/session is around; with several beacons heard, wait for a choice.
  const [chosenResidentId, setChosenResidentId] = useState<string | null>(null);
  const sessionsList = sessionState.activeSessions;
  const active =
    (chosenResidentId ? sessionsList.find((s) => s.residentId === chosenResidentId) : null) ??
    (!chosenResidentId && sessionsList.length === 1 && nearbyRegisteredDevices.length <= 1
      ? sessionsList[0]
      : null) ??
    null;
  const isManual = active?.rule === "manual_resolution" || (!!active && !!chosenResidentId);

  const residentName = active?.residentId ? (residents.get(active.residentId) ?? "Resident") : null;
  const roomName = active?.roomId ? rooms.get(active.roomId) : null;

  const confidencePct = useMemo(() => {
    if (!active) return 0;
    const rssi = active.lastRssi ?? -100;
    const pct = Math.max(0, Math.min(100, ((rssi + 95) / 40) * 100));
    return Math.round(pct);
  }, [active]);

  async function selectDevice(device: RegisteredDevice) {
    setSelectingId(device.id);
    const result = await manuallyAssignDevice(device.id);
    setSelectingId(null);
    if (result.ok) {
      setAmbiguous(null);
      setChosenResidentId(result.residentId);
      toast.success(`Recording set for ${residents.get(result.residentId) ?? device.label}`);
      return;
    }
    if (result.candidates) {
      setAmbiguous({ device, candidates: result.candidates });
      return;
    }
    toast.error(result.error);
  }

  async function pickCandidate(device: RegisteredDevice, residentId: string) {
    setSelectingId(device.id);
    const result = await manuallyAssignDevice(device.id, residentId);
    setSelectingId(null);
    if (result.ok) {
      setAmbiguous(null);
      setChosenResidentId(result.residentId);
      toast.success(`Recording set for ${residents.get(result.residentId) ?? device.label}`);
    } else {
      toast.error(result.error);
    }
  }

  async function endManualSession() {
    if (!active?.deviceId) return;
    await endTriggerManually(active.deviceId);
    setChosenResidentId(null);
    toast.message("Session ended");
  }

  const [pending, setPending] = useState<StructuredNote | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");

  const saveNote = useMutation({
    mutationFn: async (n: StructuredNote) => {
      if (!active?.residentId) throw new Error("No active session");
      const { data: u } = await supabase.auth.getUser();
      const { data: inserted, error } = await supabase
        .from("daily_notes")
        .insert({
          resident_id: active.residentId,
          author_id: u.user!.id,
          transcript: n.transcript,
          content: n.content,
          domain: (n.domain as CarePlanDomain) || null,
          category: n.category ?? null,
          risks: n.risks as RiskType[],
          flags: n.flags,
          status: "approved",
          source: "voice",
          audio_quality: n.audioQuality ?? null,
          transcript_confidence: n.transcriptConfidence ?? null,
          signal_level: n.signal ?? null,
          noise_level: n.noise ?? null,
          duration_sec: n.durationSec ?? null,
          segments: n.segments ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (active.sessionId && inserted?.id) {
        await supabase
          .from("care_sessions")
          .update({ note_id: inserted.id })
          .eq("id", active.sessionId);
      }
      return inserted?.id as string;
    },
    onSuccess: (id, n) => {
      setLastSavedId(id);
      setSavedDomain(n.domain || null);
      setPending(null);
      setEditing(false);
      toast.success("Note approved and saved to resident record");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const registeredNearby = obs.filter((o) => o.rssi > -95).length;

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">Care capture</h1>
        <p className="text-sm text-muted-foreground">
          Bluetooth identifies who and where; you just speak.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BluetoothSearching className="h-4 w-4 text-primary" />
              {scanner.running ? "Listening for beacons" : "Scanner paused"}
            </div>
            <Badge variant="outline" className="text-[10px]">
              {scanner.mode === "native-bridge"
                ? "Native BLE"
                : scanner.mode === "native"
                  ? "Web BLE"
                  : "Simulator"}
            </Badge>
          </div>

          {active ? (
            <div className="space-y-2 rounded-xl border bg-emerald-50 p-3 text-emerald-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  {isManual ? <Hand className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  <span className="font-semibold">Resident identified</span>
                </div>
                <Badge variant="outline" className="border-emerald-400 text-[10px] text-emerald-900">
                  {isManual ? "Manually selected" : "Auto-detected"}
                </Badge>
              </div>
              <div className="text-lg font-semibold">{residentName}</div>
              <div className="text-xs opacity-80">
                {roomName ? `Room: ${roomName} · ` : ""}
                Confidence {confidencePct}% · via {active.rule.replace(/_/g, " ")}
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-200">
                <div className="h-full bg-emerald-600 transition-all" style={{ width: `${confidencePct}%` }} />
              </div>
              <div className="flex flex-wrap gap-1">
                {nearbyRegisteredDevices.length > 1 && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setChosenResidentId(null)}>
                    Change resident
                  </Button>
                )}
                {isManual && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={endManualSession}>
                    End session
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Waiting for a nearby resident wearable or room beacon…
              </div>
              <div className="mt-1 text-xs">
                {registeredNearby} beacon{registeredNearby === 1 ? "" : "s"} heard nearby.
              </div>
            </div>
          )}

          {!active && ambiguous && (
            <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-900">
                More than one resident is assigned to {ambiguous.device.label}. Who is this for?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ambiguous.candidates.map((rid) => (
                  <Button
                    key={rid}
                    size="sm"
                    variant="outline"
                    disabled={selectingId === ambiguous.device.id}
                    onClick={() => pickCandidate(ambiguous.device, rid)}
                  >
                    {residents.get(rid) ?? rid}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setAmbiguous(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!active && !ambiguous && nearbyRegisteredDevices.length > 0 && (
            <div className="space-y-2 rounded-xl border border-dashed p-3">
              <p className="text-xs font-medium text-muted-foreground">Choose who you're recording for:</p>
              <ul className="space-y-1.5">
                {nearbyRegisteredDevices.map(({ device, obs: o }) => {
                  const assigned = device.resident_id
                    ? (residents.get(device.resident_id) ?? "Resident")
                    : device.room_id
                      ? (rooms.get(device.room_id) ?? "Room")
                      : device.label;
                  return (
                    <li key={device.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1 text-xs">
                        <span className="font-medium">{assigned}</span>
                        <span className="ml-1 text-muted-foreground">
                          {device.label} · {o.rssi} dBm
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 px-2 text-xs"
                        disabled={selectingId === device.id}
                        onClick={() => selectDevice(device)}
                      >
                        {selectingId === device.id ? "Selecting…" : "Select"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {scanner.mode === "simulator" && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              <WifiOff className="mr-1 inline h-3 w-3" />
              {isNativeShell()
                ? "Native Bluetooth did not connect. Allow Nearby devices and Location permissions, then reopen CareCore."
                : "No real Bluetooth available here. Install the Android app for live scanning."}
            </div>
          )}
        </CardContent>
      </Card>

      {active?.residentId ? (
        <SessionRecorder
          key={active.residentId}
          residentName={residentName ?? undefined}
          autoStart
          onResult={(n) => { setPending(n); setEditing(false); setEditText(n.content); }}
        />
      ) : (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Recording will start automatically once a resident is detected, or you can pick
            someone from the nearby beacons list above.
          </CardContent>
        </Card>
      )}

      {pending && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              AI-generated documentation — review before saving
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[10px]">Observation</Badge>
              {pending.domain && <Badge variant="secondary" className="text-[10px]">{pending.domain}</Badge>}
              {pending.risks.map((r) => <Badge key={r} variant="outline" className="text-[10px]">Risk: {r}</Badge>)}
              {pending.flags.map((f) => <Badge key={f} variant="destructive" className="text-[10px]">{f}</Badge>)}
            </div>
            {editing ? (
              <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={6} className="resize-none" />
            ) : (
              <p className="rounded-xl border bg-muted/30 p-3 text-sm">{pending.content}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Suggested action: review and approve, edit the wording, or reject. Nothing is saved until you approve.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => saveNote.mutate(editing ? { ...pending, content: editText.trim() } : pending)} disabled={saveNote.isPending || (editing && !editText.trim())}>
                <Check className="mr-1 h-3.5 w-3.5" /> Approve &amp; save
              </Button>
              <Button size="sm" variant="outline" onClick={() => { if (editing) { setPending({ ...pending, content: editText.trim() }); } setEditing(!editing); }}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> {editing ? "Done editing" : "Edit"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setPending(null); setEditing(false); toast.info("Note discarded — nothing saved"); }}>
                <X className="mr-1 h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {lastSavedId && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center justify-between p-3 text-sm text-emerald-900">
            <span>Note saved</span>
            <Button asChild size="sm" variant="ghost">
              <Link to="/notes">View</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {lastSavedId && savedDomain && active?.residentId && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="space-y-2 p-3">
            <p className="text-sm">
              This approved information may be relevant to the{" "}
              <span className="font-semibold">{domainLabel(savedDomain as CarePlanDomain)}</span> care plan.
            </p>
            <p className="text-xs text-muted-foreground">
              Nothing has been changed — a person decides whether the plan needs updating.
            </p>
            <div className="flex gap-2">
              <Button asChild size="sm">
                <Link to="/residents/$id" params={{ id: active.residentId }}>Review care plan</Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSavedDomain(null)}>Not now</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
