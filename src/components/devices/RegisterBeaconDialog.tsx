// Register a detected (or manually entered) BLE beacon and assign it to a
// room, resident, or staff member. No pairing — this is metadata only.

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Radio, Tag, IdCard, CheckCircle2, XCircle, Loader2, SignalHigh } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { subscribe, type BeaconObservation } from "@/lib/ble-advertisement-scanner";
import { refreshRegisteredDevices } from "@/lib/ble-session-manager";
import { createVerifyTracker } from "@/lib/ble-verify";

type Step = "details" | "verify" | "assign";

type DeviceType = "room_beacon" | "wearable_tag" | "staff_badge";
type Room = { id: string; name: string; floor: string | null };
type Resident = { id: string; full_name: string };
type StaffProfile = { id: string; full_name: string | null };

const TYPE_LABEL: Record<DeviceType, string> = {
  room_beacon: "Room beacon",
  wearable_tag: "Wearable tag",
  staff_badge: "Staff badge",
};

const TYPE_ICON: Record<DeviceType, typeof Radio> = {
  room_beacon: Radio,
  wearable_tag: Tag,
  staff_badge: IdCard,
};

export function RegisterBeaconDialog({
  rooms,
  residents,
  staff,
  detected,
  trigger,
  onSaved,
}: {
  rooms: Room[];
  residents: Resident[];
  staff: StaffProfile[];
  detected?: BeaconObservation;
  trigger?: React.ReactNode;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DeviceType>("room_beacon");
  const [label, setLabel] = useState("");
  const [protocol, setProtocol] = useState<BeaconObservation["protocol"]>("ibeacon");
  const [uuid, setUuid] = useState("");
  const [major, setMajor] = useState("");
  const [minor, setMinor] = useState("");
  const [mac, setMac] = useState("");
  const [txPower, setTxPower] = useState("");
  const [rssiThreshold, setRssiThreshold] = useState("-75");
  const [timeoutSec, setTimeoutSec] = useState("60");
  const [ambiguityStrategy, setAmbiguityStrategy] = useState<"skip" | "prompt" | "open_all">(
    "prompt",
  );
  const [assignmentId, setAssignmentId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // ---- Verification state ----
  const [step, setStep] = useState<Step>("details");
  const [verified, setVerified] = useState(false);
  const [skipVerify, setSkipVerify] = useState(false);
  const [liveObs, setLiveObs] = useState<BeaconObservation | null>(null);
  const verifyHitsRef = useRef(0);
  const verifyStartedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!detected) return;
    setProtocol(detected.protocol);
    setUuid(detected.uuid ?? "");
    setMajor(detected.major != null ? String(detected.major) : "");
    setMinor(detected.minor != null ? String(detected.minor) : "");
    setMac(detected.mac ?? "");
    setTxPower(detected.txPower != null ? String(detected.txPower) : "");
    if (!label) setLabel(detected.name ?? "");
  }, [detected, label]);

  // Reset all state when the dialog closes.
  useEffect(() => {
    if (open) return;
    setStep("details");
    setVerified(false);
    setSkipVerify(false);
    setLiveObs(null);
    verifyHitsRef.current = 0;
    verifyStartedRef.current = null;
  }, [open]);

  // The key the scanner uses for this beacon — must match
  // ble-advertisement-scanner.ts `record()` keys.
  const expectedKey = useMemo(() => {
    if (protocol === "ibeacon" && uuid.trim()) {
      return `ibeacon:${uuid.trim().toLowerCase()}:${major || 0}:${minor || 0}`;
    }
    if (protocol === "eddystone-uid" && uuid.trim()) {
      return `eddystone-uid:${uuid.trim().toLowerCase()}:${minor.trim().toLowerCase()}`;
    }
    return detected?.key ?? null;
  }, [protocol, uuid, major, minor, detected?.key]);

  const inRangeThreshold = parseInt(rssiThreshold, 10) || -75;
  const VERIFY_HITS_REQUIRED = 3;
  const VERIFY_WINDOW_MS = 15_000;

  // While on the verify step, subscribe to live observations and watch for
  // matching hits at or above the threshold. The actual gating logic lives
  // in createVerifyTracker so it can be unit-tested in isolation.
  useEffect(() => {
    if (step !== "verify" || !expectedKey) return;
    verifyHitsRef.current = 0;
    verifyStartedRef.current = Date.now();
    setVerified(false);
    setLiveObs(null);
    const tracker = createVerifyTracker({
      expectedKey,
      threshold: inRangeThreshold,
      hitsRequired: VERIFY_HITS_REQUIRED,
      windowMs: VERIFY_WINDOW_MS,
    });
    const unsub = subscribe((nearby) => {
      const state = tracker.observe(nearby);
      verifyHitsRef.current = state.hits;
      verifyStartedRef.current = state.windowStartedAt;
      const match = nearby.find((o) => o.key === expectedKey) ?? null;
      setLiveObs(match);
      if (state.verified) setVerified(true);
    });
    return () => unsub();
  }, [step, expectedKey, inRangeThreshold]);

  const assignmentOptions =
    type === "room_beacon"
      ? rooms.map((r) => ({ id: r.id, label: r.name + (r.floor ? ` · ${r.floor}` : "") }))
      : type === "wearable_tag"
        ? residents.map((r) => ({ id: r.id, label: r.full_name }))
        : staff.map((s) => ({ id: s.id, label: s.full_name ?? "Unnamed staff" }));

  const save = async () => {
    if (!label.trim()) {
      toast.error("Give the beacon a label");
      return;
    }
    if (!assignmentId) {
      toast.error(`Assign the beacon to a ${TYPE_LABEL[type].toLowerCase()}`);
      return;
    }
    let bleIdentifier = "";
    if (protocol === "ibeacon") {
      if (!uuid.trim()) {
        toast.error("UUID is required for iBeacon");
        return;
      }
      bleIdentifier = `ibeacon:${uuid.trim().toLowerCase()}:${major || 0}:${minor || 0}`;
    } else if (protocol === "eddystone-uid") {
      if (!uuid.trim()) {
        toast.error("Namespace is required for Eddystone-UID");
        return;
      }
      bleIdentifier = `eddystone-uid:${uuid.trim().toLowerCase()}:${minor.trim().toLowerCase()}`;
    } else {
      bleIdentifier = detected?.key ?? `generic:${crypto.randomUUID()}`;
    }

    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("devices").insert({
      device_type: type,
      label: label.trim(),
      ble_identifier: bleIdentifier,
      mac_address: mac || null,
      beacon_protocol: protocol,
      beacon_uuid: protocol === "ibeacon" ? uuid.trim().toLowerCase() : null,
      beacon_major: protocol === "ibeacon" && major ? parseInt(major, 10) : null,
      beacon_minor: protocol === "ibeacon" && minor ? parseInt(minor, 10) : null,
      tx_power: txPower ? parseInt(txPower, 10) : null,
      rssi_threshold: parseInt(rssiThreshold, 10) || -75,
      session_timeout_seconds: parseInt(timeoutSec, 10) || 60,
      ambiguity_strategy: type === "room_beacon" ? ambiguityStrategy : "skip",
      status: "active",
      room_id: type === "room_beacon" ? assignmentId : null,
      resident_id: type === "wearable_tag" ? assignmentId : null,
      staff_user_id: type === "staff_badge" ? assignmentId : null,
      notes: notes || null,
      paired_at: new Date().toISOString(),
      paired_by: u?.user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${TYPE_LABEL[type]} registered`);
    await refreshRegisteredDevices();
    onSaved();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4" />
            Register beacon
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{detected ? "Register detected beacon" : "Register beacon"}</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs">
          {(["details", "verify", "assign"] as Step[]).map((s, i) => {
            const active = step === s;
            const done =
              (s === "details" && step !== "details") ||
              (s === "verify" && step === "assign");
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-medium ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-muted bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={active ? "font-medium" : "text-muted-foreground"}>
                  {s === "details" ? "Details" : s === "verify" ? "Verify signal" : "Assign"}
                </span>
                {i < 2 && <span className="text-muted-foreground">›</span>}
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          {step === "details" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Role</Label>
                  <Select value={type} onValueChange={(v) => setType(v as DeviceType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABEL) as DeviceType[]).map((t) => {
                        const Icon = TYPE_ICON[t];
                        return (
                          <SelectItem key={t} value={t}>
                            <span className="inline-flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5" />
                              {TYPE_LABEL[t]}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Protocol</Label>
                  <Select value={protocol} onValueChange={(v) => setProtocol(v as typeof protocol)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ibeacon">iBeacon</SelectItem>
                      <SelectItem value="eddystone-uid">Eddystone-UID</SelectItem>
                      <SelectItem value="generic">Generic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Label *</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={
                    type === "room_beacon"
                      ? "Room 12 beacon"
                      : type === "wearable_tag"
                        ? "Wristband #A23"
                        : "Badge — N. Smith"
                  }
                />
              </div>

              {protocol === "ibeacon" && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3">
                    <Label>UUID *</Label>
                    <Input
                      value={uuid}
                      onChange={(e) => setUuid(e.target.value)}
                      placeholder="f7826da6-4fa2-4e98-8024-bc5b71e0893e"
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label>Major</Label>
                    <Input value={major} onChange={(e) => setMajor(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label>Minor</Label>
                    <Input value={minor} onChange={(e) => setMinor(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label>Tx power (1m)</Label>
                    <Input value={txPower} onChange={(e) => setTxPower(e.target.value)} placeholder="-59" />
                  </div>
                </div>
              )}

              {protocol === "eddystone-uid" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Namespace *</Label>
                    <Input value={uuid} onChange={(e) => setUuid(e.target.value)} placeholder="10 bytes hex" className="font-mono text-xs" />
                  </div>
                  <div>
                    <Label>Instance</Label>
                    <Input value={minor} onChange={(e) => setMinor(e.target.value)} placeholder="6 bytes hex" className="font-mono text-xs" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>MAC</Label>
                  <Input value={mac} onChange={(e) => setMac(e.target.value)} placeholder="optional" />
                </div>
                <div>
                  <Label>RSSI threshold (dBm)</Label>
                  <Input
                    value={rssiThreshold}
                    onChange={(e) => setRssiThreshold(e.target.value)}
                    placeholder="-75"
                  />
                </div>
                <div>
                  <Label>Timeout (s)</Label>
                  <Input
                    value={timeoutSec}
                    onChange={(e) => setTimeoutSec(e.target.value)}
                    placeholder="60"
                  />
                </div>
              </div>
            </>
          )}

          {step === "verify" && (
            <VerifyPanel
              expectedKey={expectedKey}
              expectedSignature={
                protocol === "ibeacon"
                  ? `iBeacon · ${uuid.trim().toLowerCase() || "—"} · ${major || 0}/${minor || 0}`
                  : protocol === "eddystone-uid"
                    ? `Eddystone-UID · ${uuid.trim().toLowerCase() || "—"} / ${minor.trim().toLowerCase() || "—"}`
                    : `Generic · ${detected?.key ?? "—"}`
              }
              liveObs={liveObs}
              threshold={inRangeThreshold}
              hits={verifyHitsRef.current}
              hitsRequired={VERIFY_HITS_REQUIRED}
              verified={verified}
              skipVerify={skipVerify}
              onToggleSkip={setSkipVerify}
            />
          )}

          {step === "assign" && (
            <>
              <div>
                <Label>Assign to {TYPE_LABEL[type].toLowerCase()} *</Label>
                <Select value={assignmentId} onValueChange={setAssignmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select a ${TYPE_LABEL[type].toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {assignmentOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {type === "room_beacon" && (
                <div>
                  <Label>If room has multiple residents</Label>
                  <Select
                    value={ambiguityStrategy}
                    onValueChange={(v) => setAmbiguityStrategy(v as typeof ambiguityStrategy)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip — don't open a session, just log</SelectItem>
                      <SelectItem value="prompt">Prompt — queue for manual confirmation</SelectItem>
                      <SelectItem value="open_all">
                        Open all — low-confidence session per resident
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Wearable tags always override this — if a wearable identifies the resident, no
                    ambiguity arises.
                  </p>
                </div>
              )}

              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>

              <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="mb-1 font-medium text-foreground">How sessions auto-start</div>
                {type === "wearable_tag" && (
                  <p>
                    A care session opens for this resident whenever the wearable is heard at or above
                    the threshold. Room is set from the strongest room beacon nearby; staff is set
                    from the strongest staff badge nearby.
                  </p>
                )}
                {type === "room_beacon" && (
                  <p>
                    When this beacon clears the threshold and the assigned room has{" "}
                    <span className="font-medium">exactly one</span> active resident, a session opens
                    for that resident. If a wearable identifies someone else first, the wearable
                    wins. For rooms with multiple residents, the strategy above decides what happens.
                  </p>
                )}
                {type === "staff_badge" && (
                  <p>
                    Staff badges never open a session on their own — they mark which carer is
                    present. When this badge is the strongest in a room with an open session, the
                    session's staff member is set to this user.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          {step !== "details" && (
            <Button
              variant="outline"
              onClick={() => setStep(step === "assign" ? "verify" : "details")}
              disabled={saving}
            >
              Back
            </Button>
          )}
          {step === "details" && (
            <Button
              onClick={() => {
                if (!label.trim()) {
                  toast.error("Give the beacon a label");
                  return;
                }
                if ((protocol === "ibeacon" || protocol === "eddystone-uid") && !uuid.trim()) {
                  toast.error(
                    protocol === "ibeacon" ? "UUID is required" : "Namespace is required",
                  );
                  return;
                }
                setStep("verify");
              }}
            >
              Next: verify signal
            </Button>
          )}
          {step === "verify" && (
            <Button
              onClick={() => setStep("assign")}
              disabled={!verified && !skipVerify}
            >
              {verified ? "Continue" : skipVerify ? "Continue without verifying" : "Waiting for signal…"}
            </Button>
          )}
          {step === "assign" && (
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Register"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----- Verify panel -----

function VerifyPanel({
  expectedKey,
  expectedSignature,
  liveObs,
  threshold,
  hits,
  hitsRequired,
  verified,
  skipVerify,
  onToggleSkip,
}: {
  expectedKey: string | null;
  expectedSignature: string;
  liveObs: BeaconObservation | null;
  threshold: number;
  hits: number;
  hitsRequired: number;
  verified: boolean;
  skipVerify: boolean;
  onToggleSkip: (v: boolean) => void;
}) {
  // Map RSSI (-100 weak … -40 strong) to a 0-100 bar.
  const rssiPct = liveObs
    ? Math.max(0, Math.min(100, Math.round(((liveObs.rssi + 100) / 60) * 100)))
    : 0;
  const inRange = liveObs ? liveObs.rssi >= threshold : false;

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/40 p-3 text-xs">
        <div className="font-medium text-foreground">Expected signature</div>
        <div className="mt-1 font-mono break-all text-muted-foreground">{expectedSignature}</div>
      </div>

      <div
        className={`rounded-md border p-3 ${
          verified
            ? "border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20"
            : liveObs
              ? "border-amber-300 bg-amber-50/60 dark:bg-amber-950/20"
              : "border-muted bg-muted/30"
        }`}
      >
        <div className="flex items-center justify-between text-sm">
          <div className="inline-flex items-center gap-2 font-medium">
            {verified ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : liveObs ? (
              <SignalHigh className="h-4 w-4 text-amber-600" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {verified
              ? inRange
                ? "Verified — signature matches and in range"
                : "Verified — signature matches (signal weak, may not trigger sessions)"
              : liveObs
                ? `Matching · ${hits}/${hitsRequired} hits${inRange ? "" : " (weak signal)"}`
                : "Scanning for matching advertisement…"}
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            {liveObs ? `${liveObs.rssi} dBm` : "—"}
          </div>
        </div>

        <div className="mt-2">
          <Progress value={rssiPct} className="h-1.5" />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>-100</span>
            <span>threshold {threshold} dBm</span>
            <span>-40</span>
          </div>
        </div>

        {liveObs && (
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <div>Hits: {liveObs.hits}</div>
            <div>Tx power: {liveObs.txPower ?? "—"}</div>
            <div>First seen: {new Date(liveObs.firstSeen).toLocaleTimeString()}</div>
            <div>Last seen: {new Date(liveObs.lastSeen).toLocaleTimeString()}</div>
          </div>
        )}

        {!expectedKey && (
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-destructive">
            <XCircle className="h-3.5 w-3.5" />
            No identifier to match — go back and enter a UUID/namespace.
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Hold the beacon near this device until you see {hitsRequired} confirmed hits at or above the
        threshold. Walk closer if the bar stays below the threshold marker.
      </p>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={skipVerify}
          onChange={(e) => onToggleSkip(e.target.checked)}
        />
        Skip verification (only if the beacon isn't transmitting yet)
      </label>
    </div>
  );
}
