import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Activity, BluetoothSearching, CheckCircle2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  type SessionManagerState,
} from "@/lib/ble-session-manager";
import type { CarePlanDomain, RiskType } from "@/lib/care-domains";
import { Link } from "@tanstack/react-router";
import { isNativeShell } from "@/lib/surface";

export const Route = createFileRoute("/_authenticated/carer/capture")({
  head: () => ({ meta: [{ title: "Capture · ForgeAI" }] }),
  component: CapturePage,
});

type ResidentRow = { id: string; full_name: string };
type RoomRow = { id: string; name: string };

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
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);

  // Kick off scanner + session manager on mount
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
      const [res, r] = await Promise.all([
        supabase.from("residents").select("id, full_name"),
        supabase.from("rooms").select("id, name"),
      ]);
      setResidents(new Map(((res.data ?? []) as ResidentRow[]).map((x) => [x.id, x.full_name])));
      setRooms(new Map(((r.data ?? []) as RoomRow[]).map((x) => [x.id, x.name])));
    })();
  }, []);

  const active = sessionState.activeSessions[0] ?? null;
  const residentName = active?.residentId ? (residents.get(active.residentId) ?? "Resident") : null;
  const roomName = active?.roomId ? rooms.get(active.roomId) : null;

  const confidencePct = useMemo(() => {
    if (!active) return 0;
    const rssi = active.lastRssi ?? -100;
    // -55 dBm ≈ 100%, -95 dBm ≈ 0%
    const pct = Math.max(0, Math.min(100, ((rssi + 95) / 40) * 100));
    return Math.round(pct);
  }, [active]);

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
      // Link the note back to the active session so the manager view can join them.
      if (active.sessionId && inserted?.id) {
        await supabase
          .from("care_sessions")
          .update({ note_id: inserted.id })
          .eq("id", active.sessionId);
      }
      return inserted?.id as string;
    },
    onSuccess: (id) => {
      setLastSavedId(id);
      toast.success("Note saved to resident record");
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

      {/* Presence panel */}
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
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-semibold">Resident identified</span>
              </div>
              <div className="text-lg font-semibold">{residentName}</div>
              <div className="text-xs opacity-80">
                {roomName ? `Room: ${roomName} · ` : ""}
                Confidence {confidencePct}% · via {active.rule.replace(/_/g, " ")}
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-200">
                <div
                  className="h-full bg-emerald-600 transition-all"
                  style={{ width: `${confidencePct}%` }}
                />
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

      {/* Recorder */}
      {active?.residentId ? (
        <SessionRecorder
          residentName={residentName ?? undefined}
          autoStart
          onResult={(n) => saveNote.mutate(n)}
        />
      ) : (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Recording will start automatically once a resident is detected.
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
    </div>
  );
}
