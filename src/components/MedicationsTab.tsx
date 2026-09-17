import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pill, Plus, Clock, AlertTriangle, Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ROUTES, allergyConflict, describeSchedule, dueDosesForDay, hhmm, statusMeta,
  type Administration, type Medication,
} from "@/lib/medications";
import { RecordDoseDialog } from "@/components/MedicationAdministration";

export function MedicationsTab({ residentId, allergies }: { residentId: string; allergies?: string | null }) {
  const [editing, setEditing] = useState<Medication | "new" | null>(null);
  const [recording, setRecording] = useState<{ med: Medication; time: string | null } | null>(null);
  const today = new Date();
  const dateKey = format(today, "yyyy-MM-dd");

  const meds = useQuery({
    queryKey: ["medications", residentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medications").select("*").eq("resident_id", residentId).order("name");
      if (error) throw error;
      return data as unknown as Medication[];
    },
  });

  const admins = useQuery({
    queryKey: ["med-admins", residentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medication_administrations").select("*").eq("resident_id", residentId)
        .order("administered_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data as unknown as Administration[];
    },
  });

  const active = (meds.data ?? []).filter((m) => m.status === "active");
  const due = useMemo(
    () => dueDosesForDay(active, admins.data ?? [], today),
    [meds.data, admins.data],
  );
  const prn = active.filter((m) => m.is_prn);

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={() => setEditing("new")}>
        <Plus className="mr-1 h-4 w-4" />Add medication
      </Button>

      <Tabs defaultValue="mar">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="mar">Today</TabsTrigger>
          <TabsTrigger value="list">Medications</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="mar" className="mt-3 space-y-3">
          {due.length === 0 && prn.length === 0 && (
            <p className="px-1 text-sm text-muted-foreground">Nothing scheduled today.</p>
          )}
          {due.map((d) => {
            const done = d.administration;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => !done && setRecording({ med: d.medication, time: d.time })}
                className="flex w-full items-center justify-between rounded-2xl border bg-card p-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />{d.time} · {d.medication.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[d.medication.dose, d.medication.route].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {done ? (
                  <Badge className={statusMeta(done.status).tone}>
                    <Check className="mr-1 h-3 w-3" />{statusMeta(done.status).label}
                  </Badge>
                ) : (
                  <Badge variant="outline">Record</Badge>
                )}
              </button>
            );
          })}

          {prn.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">As required (PRN)</p>
              {prn.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setRecording({ med: m, time: null })}
                  className="mb-2 flex w-full items-center justify-between rounded-2xl border bg-card p-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.prn_indication ?? m.indication ?? "As required"}</div>
                  </div>
                  <Badge variant="outline">Record</Badge>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-3 space-y-2">
          {(meds.data ?? []).length === 0 && (
            <p className="px-1 text-sm text-muted-foreground">No medications recorded yet.</p>
          )}
          {(meds.data ?? []).map((m) => {
            const conflict = allergyConflict(allergies, m.name);
            return (
              <button
                key={m.id} type="button" onClick={() => setEditing(m)}
                className="w-full rounded-2xl border bg-card p-3 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Pill className="h-3.5 w-3.5 text-primary" />{m.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[m.dose, m.route, m.form].filter(Boolean).join(" · ") || "No dose recorded"}
                    </div>
                    <div className="mt-1 text-xs">{describeSchedule(m)}</div>
                    {m.indication && <div className="mt-1 text-xs text-muted-foreground">For: {m.indication}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {m.is_prn && <Badge variant="outline" className="text-[10px]">PRN</Badge>}
                    {m.status !== "active" && <Badge variant="secondary" className="text-[10px] capitalize">{m.status}</Badge>}
                    {m.review_date && <span className="text-[10px] text-muted-foreground">Review {format(new Date(m.review_date), "d MMM")}</span>}
                  </div>
                </div>
                {conflict && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-destructive">
                    <AlertTriangle className="h-3 w-3" />{conflict}
                  </div>
                )}
              </button>
            );
          })}
        </TabsContent>

        <TabsContent value="history" className="mt-3 space-y-2">
          {(admins.data ?? []).length === 0 && (
            <p className="px-1 text-sm text-muted-foreground">No doses recorded yet.</p>
          )}
          {(admins.data ?? []).map((a) => {
            const med = (meds.data ?? []).find((m) => m.id === a.medication_id);
            const sm = statusMeta(a.status);
            return (
              <div key={a.id} className="rounded-2xl border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{med?.name ?? "Medication"}</div>
                  <Badge className={sm.tone}>{sm.label}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {format(new Date(a.administered_at), "d MMM yyyy HH:mm")}
                  {a.scheduled_time ? ` · due ${hhmm(a.scheduled_time)}` : " · as required"}
                  {a.dose_given ? ` · ${a.dose_given}` : ""}
                </div>
                {a.reason && <p className="mt-1 text-xs">Reason: {a.reason}</p>}
                {a.action_taken && <p className="text-xs">Action: {a.action_taken}</p>}
                {a.notes && <p className="mt-1 text-xs text-muted-foreground">{a.notes}</p>}
              </div>
            );
          })}
        </TabsContent>
      </Tabs>

      {editing && (
        <MedicationDialog
          residentId={residentId}
          medication={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {recording && (
        <RecordDoseDialog
          medication={recording.med}
          scheduledDate={dateKey}
          scheduledTime={recording.time}
          allergies={allergies}
          priorAdministrations={admins.data ?? []}
          onClose={() => setRecording(null)}
        />
      )}
    </div>
  );
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function MedicationDialog({
  residentId, medication, onClose,
}: { residentId: string; medication: Medication | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: medication?.name ?? "",
    form: medication?.form ?? "",
    dose: medication?.dose ?? "",
    route: medication?.route ?? "",
    frequency_text: medication?.frequency_text ?? "",
    times: (medication?.times ?? []).map(hhmm).join(", "),
    days: medication?.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
    is_prn: medication?.is_prn ?? false,
    prn_indication: medication?.prn_indication ?? "",
    prn_min_interval_minutes: medication?.prn_min_interval_minutes?.toString() ?? "",
    prn_max_doses_24h: medication?.prn_max_doses_24h?.toString() ?? "",
    indication: medication?.indication ?? "",
    instructions: medication?.instructions ?? "",
    start_date: medication?.start_date ?? "",
    review_date: medication?.review_date ?? "",
    prescriber: medication?.prescriber ?? "",
    notes: medication?.notes ?? "",
    status: medication?.status ?? "active",
  });

  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const times = form.times.split(",").map((t) => t.trim()).filter(Boolean);
      const payload = {
        resident_id: residentId,
        name: form.name.trim(),
        form: form.form || null,
        dose: form.dose || null,
        route: form.route || null,
        frequency_text: form.frequency_text || null,
        times,
        days_of_week: form.days,
        is_prn: form.is_prn,
        prn_indication: form.prn_indication || null,
        prn_min_interval_minutes: form.prn_min_interval_minutes ? Number(form.prn_min_interval_minutes) : null,
        prn_max_doses_24h: form.prn_max_doses_24h ? Number(form.prn_max_doses_24h) : null,
        indication: form.indication || null,
        instructions: form.instructions || null,
        start_date: form.start_date || null,
        review_date: form.review_date || null,
        prescriber: form.prescriber || null,
        notes: form.notes || null,
        status: form.status,
      };
      if (medication) {
        const { error } = await supabase.from("medications").update(payload).eq("id", medication.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("medications").insert({ ...payload, created_by: u.user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Medication saved");
      qc.invalidateQueries({ queryKey: ["medications", residentId] });
      qc.invalidateQueries({ queryKey: ["med-round"] });
      qc.invalidateQueries({ queryKey: ["reviews-due"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{medication ? "Edit medication" : "Add medication"}</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Medication name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Paracetamol" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Dose</Label>
              <Input value={form.dose} onChange={(e) => set("dose", e.target.value)} placeholder="500mg" />
            </div>
            <div>
              <Label className="text-xs">Form</Label>
              <Input value={form.form} onChange={(e) => set("form", e.target.value)} placeholder="Tablet" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Route</Label>
            <Select value={form.route} onValueChange={(v) => set("route", v)}>
              <SelectTrigger><SelectValue placeholder="Select route" /></SelectTrigger>
              <SelectContent>{ROUTES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 rounded-lg border p-2 text-sm">
            <Checkbox checked={form.is_prn} onCheckedChange={(v) => set("is_prn", !!v)} />
            As required (PRN)
          </label>

          {form.is_prn ? (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Indication for use</Label>
                <Input value={form.prn_indication} onChange={(e) => set("prn_indication", e.target.value)} placeholder="e.g. mild pain" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Minimum interval (minutes)</Label>
                  <Input inputMode="numeric" value={form.prn_min_interval_minutes}
                    onChange={(e) => set("prn_min_interval_minutes", e.target.value)} placeholder="240" />
                </div>
                <div>
                  <Label className="text-xs">Max doses in 24h</Label>
                  <Input inputMode="numeric" value={form.prn_max_doses_24h}
                    onChange={(e) => set("prn_max_doses_24h", e.target.value)} placeholder="4" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Administration times</Label>
                <Input value={form.times} onChange={(e) => set("times", e.target.value)} placeholder="08:00, 12:00, 18:00" />
                <p className="mt-1 text-[11px] text-muted-foreground">Separate each time with a comma.</p>
              </div>
              <div>
                <Label className="text-xs">Days</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {DAY_LABELS.map((d, i) => {
                    const on = form.days.includes(i);
                    return (
                      <Button key={d} type="button" size="sm" variant={on ? "default" : "outline"}
                        onClick={() => set("days", on ? form.days.filter((x) => x !== i) : [...form.days, i].sort())}>
                        {d}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-xs">Frequency (in words)</Label>
                <Input value={form.frequency_text} onChange={(e) => set("frequency_text", e.target.value)} placeholder="Three times a day" />
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Indication</Label>
            <Input value={form.indication} onChange={(e) => set("indication", e.target.value)} placeholder="What it is for" />
          </div>
          <div>
            <Label className="text-xs">Instructions</Label>
            <Textarea rows={2} value={form.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="e.g. take with food" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Start date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Review date</Label>
              <Input type="date" value={form.review_date} onChange={(e) => set("review_date", e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Prescriber</Label>
            <Input value={form.prescriber} onChange={(e) => set("prescriber", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="stopped">Stopped</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
