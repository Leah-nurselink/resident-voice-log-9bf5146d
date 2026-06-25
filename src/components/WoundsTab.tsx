import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Activity, Plus, Ruler, ChevronRight } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const STATUS_COLOR: Record<string, string> = {
  open: "bg-destructive/15 text-destructive border-destructive/30 border",
  healing: "bg-warning/20 text-warning-foreground border-warning/40 border",
  healed: "bg-success/15 text-success-foreground border-success/30 border",
};

const WOUND_TYPES = ["Pressure ulcer", "Skin tear", "Surgical wound", "Laceration", "Burn", "Moisture lesion", "Diabetic ulcer", "Venous leg ulcer", "Arterial ulcer", "Other"];
const CATEGORIES = ["Category 1", "Category 2", "Category 3", "Category 4", "Unstageable", "Suspected deep tissue injury", "N/A"];
const TISSUE = ["Epithelialising (pink)", "Granulating (red)", "Sloughy (yellow)", "Necrotic (black)", "Mixed"];
const EXUDATE_AMOUNTS = ["None", "Low", "Moderate", "High"];
const EXUDATE_TYPES = ["Serous", "Sero-sanguinous", "Sanguinous", "Purulent"];

export function WoundsTab({ residentId }: { residentId: string }) {
  const [openNew, setOpenNew] = useState(false);
  const [activeWound, setActiveWound] = useState<any | null>(null);

  const wounds = useQuery({
    queryKey: ["wounds", residentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("wounds")
        .select("*").eq("resident_id", residentId)
        .order("status", { ascending: true })
        .order("date_noticed", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mt-4 space-y-2">
      <Button onClick={() => setOpenNew(true)} className="w-full"><Plus className="mr-1 h-4 w-4" />New wound</Button>
      {wounds.data?.length ? wounds.data.map((w) => (
        <button key={w.id} onClick={() => setActiveWound(w)} className="flex w-full items-start justify-between gap-3 rounded-2xl border bg-card p-4 text-left hover:bg-accent/30">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{w.location}{w.side ? ` (${w.side})` : ""}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
              {w.wound_type || "Wound"}{w.category ? ` · ${w.category}` : ""} · noticed {format(new Date(w.date_noticed), "d MMM yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={STATUS_COLOR[w.status] || ""}>{w.status}</Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      )) : <p className="px-1 text-sm text-muted-foreground">No wounds recorded.</p>}

      {openNew && <WoundDialog residentId={residentId} existing={null} onClose={() => setOpenNew(false)} />}
      {activeWound && <WoundDetailDialog wound={activeWound} onClose={() => setActiveWound(null)} />}
    </div>
  );
}

function WoundDialog({ residentId, existing, onClose }: { residentId: string; existing: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [location, setLocation] = useState(existing?.location || "");
  const [side, setSide] = useState(existing?.side || "");
  const [woundType, setWoundType] = useState(existing?.wound_type || WOUND_TYPES[0]);
  const [category, setCategory] = useState(existing?.category || "N/A");
  const [cause, setCause] = useState(existing?.cause || "");
  const [dateNoticed, setDateNoticed] = useState(existing?.date_noticed || new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"open"|"healing"|"healed">(existing?.status || "open");
  const [dateHealed, setDateHealed] = useState(existing?.date_healed || "");

  const save = useMutation({
    mutationFn: async () => {
      if (!location.trim()) throw new Error("Location is required");
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        resident_id: residentId, location, side: side || null, wound_type: woundType,
        category: category || null, cause: cause || null, date_noticed: dateNoticed,
        status, date_healed: status === "healed" ? (dateHealed || new Date().toISOString().slice(0, 10)) : null,
        created_by: u.user!.id,
      };
      const { error } = existing
        ? await supabase.from("wounds").update(payload).eq("id", existing.id)
        : await supabase.from("wounds").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(existing ? "Wound updated" : "Wound recorded"); qc.invalidateQueries({ queryKey: ["wounds", residentId] }); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{existing ? "Edit wound" : "New wound"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Body location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Sacrum, left heel, right forearm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Side</Label>
              <Select value={side || "none"} onValueChange={(v) => setSide(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                  <SelectItem value="midline">Midline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date noticed</Label>
              <Input type="date" value={dateNoticed} onChange={(e) => setDateNoticed(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Wound type</Label>
            <Select value={woundType} onValueChange={setWoundType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{WOUND_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Category / stage</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cause / how it happened</Label>
            <Textarea rows={2} value={cause} onChange={(e) => setCause(e.target.value)} className="resize-none" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="healing">Healing</SelectItem>
                <SelectItem value="healed">Healed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {status === "healed" && (
            <div className="space-y-1.5">
              <Label>Date healed</Label>
              <Input type="date" value={dateHealed} onChange={(e) => setDateHealed(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{existing ? "Update" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WoundDetailDialog({ wound, onClose }: { wound: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [adding, setAdding] = useState(false);

  const assessments = useQuery({
    queryKey: ["wound-assessments", wound.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("wound_assessments").select("*")
        .eq("wound_id", wound.id).order("assessed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            {wound.location}{wound.side ? ` (${wound.side})` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border bg-muted/30 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{wound.wound_type}{wound.category && wound.category !== "N/A" ? ` · ${wound.category}` : ""}</span>
            <Badge className={STATUS_COLOR[wound.status] || ""}>{wound.status}</Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Noticed {format(new Date(wound.date_noticed), "d MMM yyyy")}
            {wound.date_healed ? ` · healed ${format(new Date(wound.date_healed), "d MMM yyyy")}` : ""}
          </div>
          {wound.cause && <p className="mt-2 text-xs">{wound.cause}</p>}
          <div className="mt-2">
            <Button size="sm" variant="outline" onClick={() => setEdit(true)} className="h-7 text-xs">Edit details</Button>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Assessments</h3>
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-1 h-3.5 w-3.5" />New entry</Button>
        </div>

        {assessments.data?.length ? (
          <ul className="space-y-2">
            {assessments.data.map((a) => (
              <li key={a.id} className="rounded-xl border bg-card p-3 text-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{format(new Date(a.assessed_at), "d MMM yyyy HH:mm")}</span>
                  <span>{formatDistanceToNow(new Date(a.assessed_at), { addSuffix: true })}</span>
                </div>
                {(a.length_cm != null || a.width_cm != null || a.depth_cm != null) && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs">
                    <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{a.length_cm ?? "—"} × {a.width_cm ?? "—"} × {a.depth_cm ?? "—"} cm</span>
                  </div>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {a.tissue_type && <Badge variant="secondary" className="text-[10px]">{a.tissue_type}</Badge>}
                  {a.exudate_amount && <Badge variant="outline" className="text-[10px]">Exudate: {a.exudate_amount}{a.exudate_type ? `, ${a.exudate_type}` : ""}</Badge>}
                  {a.odour && <Badge className="bg-warning/20 text-warning-foreground border-warning/40 border text-[10px]">Odour</Badge>}
                  {a.pain_score != null && <Badge variant="outline" className="text-[10px]">Pain {a.pain_score}/10</Badge>}
                </div>
                {a.dressing && <p className="mt-1.5 text-xs"><span className="font-medium">Dressing:</span> {a.dressing}</p>}
                {a.treatment_plan && <p className="mt-1 text-xs"><span className="font-medium">Plan:</span> {a.treatment_plan}</p>}
                {a.observations && <p className="mt-1 text-xs text-muted-foreground">{a.observations}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 text-sm text-muted-foreground">No assessments yet — log one to start charting.</p>
        )}

        {edit && <WoundDialog residentId={wound.resident_id} existing={wound} onClose={() => { setEdit(false); qc.invalidateQueries({ queryKey: ["wounds", wound.resident_id] }); onClose(); }} />}
        {adding && <AssessmentDialog woundId={wound.id} onClose={() => setAdding(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AssessmentDialog({ woundId, onClose }: { woundId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [depth, setDepth] = useState("");
  const [tissue, setTissue] = useState(TISSUE[1]);
  const [exAmount, setExAmount] = useState(EXUDATE_AMOUNTS[1]);
  const [exType, setExType] = useState(EXUDATE_TYPES[0]);
  const [odour, setOdour] = useState(false);
  const [pain, setPain] = useState("");
  const [surrounding, setSurrounding] = useState("");
  const [dressing, setDressing] = useState("");
  const [plan, setPlan] = useState("");
  const [observations, setObservations] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("wound_assessments").insert({
        wound_id: woundId,
        length_cm: length ? Number(length) : null,
        width_cm: width ? Number(width) : null,
        depth_cm: depth ? Number(depth) : null,
        tissue_type: tissue,
        exudate_amount: exAmount,
        exudate_type: exType,
        odour,
        pain_score: pain ? Math.min(10, Math.max(0, Number(pain))) : null,
        surrounding_skin: surrounding || null,
        dressing: dressing || null,
        treatment_plan: plan || null,
        observations: observations || null,
        assessed_by: u.user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Assessment logged"); qc.invalidateQueries({ queryKey: ["wound-assessments", woundId] }); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New wound assessment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label className="text-xs">Length (cm)</Label><Input inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Width (cm)</Label><Input inputMode="decimal" value={width} onChange={(e) => setWidth(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Depth (cm)</Label><Input inputMode="decimal" value={depth} onChange={(e) => setDepth(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Tissue type</Label>
            <Select value={tissue} onValueChange={setTissue}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TISSUE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Exudate amount</Label>
              <Select value={exAmount} onValueChange={setExAmount}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXUDATE_AMOUNTS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Exudate type</Label>
              <Select value={exType} onValueChange={setExType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXUDATE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={odour} onCheckedChange={(v) => setOdour(!!v)} />
            Odour present
          </label>
          <div className="space-y-1.5">
            <Label>Pain score (0-10)</Label>
            <Input type="number" min={0} max={10} value={pain} onChange={(e) => setPain(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Surrounding skin</Label>
            <Textarea rows={2} value={surrounding} onChange={(e) => setSurrounding(e.target.value)} className="resize-none" placeholder="Intact, macerated, red, etc." />
          </div>
          <div className="space-y-1.5">
            <Label>Dressing used</Label>
            <Input value={dressing} onChange={(e) => setDressing(e.target.value)} placeholder="e.g. Aquacel + Mepilex" />
          </div>
          <div className="space-y-1.5">
            <Label>Treatment plan / next steps</Label>
            <Textarea rows={2} value={plan} onChange={(e) => setPlan(e.target.value)} className="resize-none" />
          </div>
          <div className="space-y-1.5">
            <Label>Observations</Label>
            <Textarea rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} className="resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save assessment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
