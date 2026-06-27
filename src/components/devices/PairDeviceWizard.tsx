import { useState } from "react";
import { Plus, Radio, Tag, IdCard, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type DeviceType = "room_beacon" | "wearable_tag" | "staff_badge";
type Room = { id: string; name: string; floor: string | null };
type Resident = { id: string; full_name: string };
type StaffProfile = { id: string; full_name: string | null };

const TYPE_META: Record<
  DeviceType,
  { label: string; icon: typeof Radio; description: string; assignLabel: string }
> = {
  room_beacon: {
    label: "Room beacon",
    icon: Radio,
    description: "Fixed beacon mounted in a room. Identifies location.",
    assignLabel: "Room",
  },
  wearable_tag: {
    label: "Wearable tag",
    icon: Tag,
    description: "Worn by a resident. Identifies who is being cared for.",
    assignLabel: "Resident",
  },
  staff_badge: {
    label: "Staff badge",
    icon: IdCard,
    description: "Worn by staff. Identifies who is delivering care.",
    assignLabel: "Staff member",
  },
};

const STEPS = ["Type", "Identity", "Assignment", "Confirm"] as const;

export function PairDeviceWizard({
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
  const [step, setStep] = useState(0);
  const [type, setType] = useState<DeviceType>("room_beacon");
  const [label, setLabel] = useState("");
  const [bleId, setBleId] = useState("");
  const [mac, setMac] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [battery, setBattery] = useState("100");
  const [assignmentId, setAssignmentId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep(0);
    setType("room_beacon");
    setLabel("");
    setBleId("");
    setMac("");
    setManufacturer("");
    setModel("");
    setBattery("100");
    setAssignmentId("");
    setNotes("");
  };

  const meta = TYPE_META[type];

  const canNext = () => {
    if (step === 0) return !!type;
    if (step === 1) return label.trim().length > 0 && bleId.trim().length > 0;
    if (step === 2) return !!assignmentId;
    return true;
  };

  const assignmentName = () => {
    if (type === "room_beacon") return rooms.find((r) => r.id === assignmentId)?.name ?? "—";
    if (type === "wearable_tag")
      return residents.find((r) => r.id === assignmentId)?.full_name ?? "—";
    return staff.find((s) => s.id === assignmentId)?.full_name ?? "Staff";
  };

  const save = async () => {
    if (!assignmentId) {
      toast.error("Assignment is required before pairing");
      setStep(2);
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = {
      device_type: type,
      label: label.trim(),
      ble_identifier: bleId.trim(),
      mac_address: mac || null,
      manufacturer: manufacturer || null,
      model: model || null,
      battery_level: battery ? Math.min(100, Math.max(0, parseInt(battery, 10))) : null,
      status: "active",
      room_id: type === "room_beacon" ? assignmentId : null,
      resident_id: type === "wearable_tag" ? assignmentId : null,
      staff_user_id: type === "staff_badge" ? assignmentId : null,
      notes: notes || null,
      paired_at: new Date().toISOString(),
      paired_by: u?.user?.id ?? null,
    };
    const { data, error } = await supabase
      .from("devices")
      .insert(payload)
      .select("id")
      .single();
    if (!error && data) {
      await supabase.from("device_events").insert({
        device_id: data.id,
        event_type: "paired",
        battery_level: payload.battery_level,
      });
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${meta.label} paired and assigned to ${assignmentName()}`);
    reset();
    setOpen(false);
    onSaved();
  };

  const assignmentOptions =
    type === "room_beacon"
      ? rooms.map((r) => ({ id: r.id, label: r.name + (r.floor ? ` · ${r.floor}` : "") }))
      : type === "wearable_tag"
        ? residents.map((r) => ({ id: r.id, label: r.full_name }))
        : staff.map((s) => ({ id: s.id, label: s.full_name ?? "Unnamed staff" }));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Pair device
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pair a new BLE device</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <ol className="flex items-center justify-between gap-2 text-xs">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px]",
                  i < step && "border-primary bg-primary text-primary-foreground",
                  i === step && "border-primary text-primary",
                  i > step && "border-muted text-muted-foreground",
                )}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={cn(i === step ? "font-medium" : "text-muted-foreground")}>{s}</span>
              {i < STEPS.length - 1 && <span className="mx-1 h-px flex-1 bg-border" />}
            </li>
          ))}
        </ol>

        <div className="mt-2 min-h-[240px]">
          {step === 0 && (
            <div className="grid gap-2">
              {(Object.keys(TYPE_META) as DeviceType[]).map((t) => {
                const m = TYPE_META[t];
                const Icon = m.icon;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "flex items-start gap-3 rounded-md border p-3 text-left transition-colors",
                      type === t
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium">{m.label}</div>
                      <div className="text-xs text-muted-foreground">{m.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
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
              <div>
                <Label>BLE identifier *</Label>
                <Input
                  value={bleId}
                  onChange={(e) => setBleId(e.target.value)}
                  placeholder="UUID or device id reported during pairing"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Captured automatically when scanning is integrated; enter manually for now.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>MAC address</Label>
                  <Input value={mac} onChange={(e) => setMac(e.target.value)} placeholder="optional" />
                </div>
                <div>
                  <Label>Battery %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={battery}
                    onChange={(e) => setBattery(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Manufacturer</Label>
                  <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
                </div>
                <div>
                  <Label>Model</Label>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Every paired device must be linked to a {meta.assignLabel.toLowerCase()} before it
                can take part in care sessions.
              </p>
              <div>
                <Label>{meta.assignLabel} *</Label>
                <Select value={assignmentId} onValueChange={setAssignmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select a ${meta.assignLabel.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {assignmentOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assignmentOptions.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    No {meta.assignLabel.toLowerCase()}s available. Add one first, then return to
                    pairing.
                  </p>
                )}
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Review before pairing:</p>
              <dl className="grid grid-cols-3 gap-2 rounded-md border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Type</dt>
                <dd className="col-span-2 font-medium">{meta.label}</dd>
                <dt className="text-muted-foreground">Label</dt>
                <dd className="col-span-2 font-medium">{label}</dd>
                <dt className="text-muted-foreground">BLE id</dt>
                <dd className="col-span-2 break-all font-mono text-xs">{bleId}</dd>
                {mac && (
                  <>
                    <dt className="text-muted-foreground">MAC</dt>
                    <dd className="col-span-2 font-mono text-xs">{mac}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">{meta.assignLabel}</dt>
                <dd className="col-span-2 font-medium">{assignmentName()}</dd>
                <dt className="text-muted-foreground">Battery</dt>
                <dd className="col-span-2">{battery}%</dd>
              </dl>
              <Badge variant="secondary">Will be activated immediately</Badge>
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <Button
            variant="ghost"
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || saving}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Pairing…" : "Confirm & pair"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
