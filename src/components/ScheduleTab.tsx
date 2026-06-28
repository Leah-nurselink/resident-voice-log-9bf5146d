import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { CARE_PLAN_DOMAINS, domainLabel, type CarePlanDomain } from "@/lib/care-domains";
import { formatDays } from "@/lib/resident-export";
import { Plus, Pencil, Trash2, Clock, CalendarClock } from "lucide-react";
import { toast } from "sonner";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Suggested ADL activities per domain so staff can pick rather than type.
const SUGGESTED: Partial<Record<CarePlanDomain, string[]>> = {
  personal_care: ["Morning wash", "Shower", "Bed bath", "Oral hygiene", "Hair & grooming", "Shave", "Nail care"],
  nutrition: ["Breakfast", "Mid-morning snack", "Lunch", "Afternoon tea", "Dinner", "Supper", "Fluids round"],
  continence: ["Toileting round", "Pad check / change", "Bowel chart"],
  mobility: ["Transfer to chair", "Assisted walk", "Hoist transfer", "Repositioning"],
  skin_integrity: ["Repositioning", "Pressure area check", "Cream application"],
  medication: ["Morning meds", "Lunchtime meds", "Tea-time meds", "Night meds", "PRN review"],
  sleep: ["Settle to bed", "Night checks", "Wake & dress"],
  social: ["1:1 activity", "Group activity", "Family visit", "Outing"],
  mental_health: ["1:1 wellbeing chat", "Reassurance round"],
  cognition: ["Reorientation", "Memory activity"],
  breathing: ["Inhaler", "Nebuliser", "Oxygen check"],
};

type Schedule = {
  id: string;
  resident_id: string;
  domain: string;
  activity: string;
  notes: string | null;
  days_of_week: number[];
  window_start: string;
  window_end: string;
  specific_time: string | null;
  is_active: boolean;
};

export function ScheduleTab({ residentId }: { residentId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Schedule> | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["care-schedules", residentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_schedules" as never)
        .select("*")
        .eq("resident_id", residentId)
        .order("window_start");
      if (error) throw error;
      return data as unknown as Schedule[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("care_schedules" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Schedule removed");
      qc.invalidateQueries({ queryKey: ["care-schedules", residentId] });
    },
  });

  // Group by domain
  const byDomain = data.reduce<Record<string, Schedule[]>>((acc, s) => {
    (acc[s.domain] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4 text-primary" />
          Daily routine across care plan domains
        </div>
        <Button size="sm" onClick={() => setEditing({ resident_id: residentId, is_active: true, days_of_week: [0,1,2,3,4,5,6] })}>
          <Plus className="mr-1 h-4 w-4" /> Add schedule
        </Button>
      </div>

      {CARE_PLAN_DOMAINS.map((d) => {
        const items = byDomain[d.id] ?? [];
        if (!items.length) return null;
        return (
          <Card key={d.id}>
            <CardContent className="p-3">
              <div className="mb-2 text-xs font-semibold text-foreground">{d.label}</div>
              <div className="space-y-2">
                {items.map((s) => (
                  <div key={s.id} className="flex items-start justify-between gap-2 rounded-lg border bg-background/50 p-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium">{s.activity}</span>
                        {!s.is_active && <Badge variant="outline" className="text-[10px]">Paused</Badge>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {s.window_start.slice(0,5)}–{s.window_end.slice(0,5)}
                          {s.specific_time ? ` · @ ${s.specific_time.slice(0,5)}` : ""}
                        </span>
                        <span>· {formatDays(s.days_of_week)}</span>
                      </div>
                      {s.notes && <p className="mt-1 text-xs text-muted-foreground">{s.notes}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove.mutate(s.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {!data.length && (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No scheduled activities yet. Use “Add schedule” to plan breakfast, meds rounds, repositioning, activities, etc.
        </div>
      )}

      {editing && (
        <ScheduleDialog
          residentId={residentId}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["care-schedules", residentId] })}
        />
      )}
    </div>
  );
}

function ScheduleDialog({
  residentId, existing, onClose, onSaved,
}: { residentId: string; existing: Partial<Schedule>; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<Schedule>>({
    domain: "nutrition",
    activity: "",
    window_start: "06:00",
    window_end: "12:00",
    days_of_week: [0,1,2,3,4,5,6],
    is_active: true,
    notes: "",
    ...existing,
  });
  const set = (k: keyof Schedule, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        resident_id: residentId,
        domain: f.domain!,
        activity: f.activity!,
        notes: f.notes || null,
        days_of_week: f.days_of_week ?? [0,1,2,3,4,5,6],
        window_start: f.window_start!,
        window_end: f.window_end!,
        specific_time: f.specific_time || null,
        is_active: f.is_active ?? true,
      };
      if (f.id) {
        const { error } = await supabase.from("care_schedules" as never).update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("care_schedules" as never).insert({ ...payload, created_by: u.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Schedule saved");
      onSaved();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const suggestions = SUGGESTED[f.domain as CarePlanDomain] ?? [];
  const days = f.days_of_week ?? [];
  const toggleDay = (d: number) =>
    set("days_of_week", days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort());

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{f.id ? "Edit schedule" : "New schedule"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Care plan domain</Label>
            <Select value={f.domain} onValueChange={(v) => { set("domain", v); set("activity", ""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CARE_PLAN_DOMAINS.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Activity</Label>
            <Input value={f.activity ?? ""} onChange={(e) => set("activity", e.target.value)} placeholder="e.g. Breakfast" />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("activity", s)}
                    className="rounded-full border bg-muted/50 px-2 py-0.5 text-[11px] hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Window starts</Label>
              <Input type="time" value={f.window_start ?? ""} onChange={(e) => set("window_start", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Window ends</Label>
              <Input type="time" value={f.window_end ?? ""} onChange={(e) => set("window_end", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Preferred / target time (optional)</Label>
            <Input type="time" value={f.specific_time ?? ""} onChange={(e) => set("specific_time", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Days</Label>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((lbl, i) => (
                <label key={i} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
                  <Checkbox checked={days.includes(i)} onCheckedChange={() => toggleDay(i)} />
                  {lbl}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Likes porridge with honey, prefers tea before food…" />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-2">
            <Label className="text-xs">Active</Label>
            <Switch checked={f.is_active ?? true} onCheckedChange={(v) => set("is_active", v)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!f.activity || !f.domain || save.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

void domainLabel;
