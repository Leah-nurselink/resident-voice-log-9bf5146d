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
import { Activity, Plus, Ruler, ChevronRight, Camera, X, ImageIcon } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

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
  const [reviewDate, setReviewDate] = useState(existing?.review_date || "");

  const save = useMutation({
    mutationFn: async () => {
      if (!location.trim()) throw new Error("Location is required");
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        resident_id: residentId, location, side: side || null, wound_type: woundType,
        category: category || null, cause: cause || null, date_noticed: dateNoticed,
        status, date_healed: status === "healed" ? (dateHealed || new Date().toISOString().slice(0, 10)) : null,
        review_date: reviewDate || null,
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
          <div className="space-y-1.5">
            <Label>Next review date</Label>
            <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
          </div>
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
            {wound.review_date ? ` · review ${format(new Date(wound.review_date), "d MMM yyyy")}` : ""}
          </div>
          {wound.cause && <p className="mt-2 text-xs">{wound.cause}</p>}
          <div className="mt-2">
            <Button size="sm" variant="outline" onClick={() => setEdit(true)} className="h-7 text-xs">Edit details</Button>
          </div>
        </div>

        {assessments.data && assessments.data.length > 0 && (
          <WoundPhotoHistory entries={assessments.data} woundId={wound.id} />
        )}

        {assessments.data && assessments.data.length >= 2 && (
          <WoundComparison entries={assessments.data} />
        )}

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
                {Array.isArray(a.photos) && a.photos.length > 0 && <PhotoGallery paths={(a.photos as unknown[]).filter((x): x is string => typeof x === "string")} />}
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
  const [photos, setPhotos] = useState<{ path: string; previewUrl: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uploaded: { path: string; previewUrl: string }[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${u.user!.id}/${woundId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("wound-photos").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        uploaded.push({ path, previewUrl: URL.createObjectURL(file) });
      }
      setPhotos((prev) => [...prev, ...uploaded]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = async (path: string) => {
    await supabase.storage.from("wound-photos").remove([path]);
    setPhotos((prev) => prev.filter((p) => p.path !== path));
  };

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
        photos: photos.map((p) => p.path),
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
          <div className="space-y-1.5">
            <Label>Photos</Label>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
              onChange={(e) => handleFiles(e.target.files)} />
            <div className="flex flex-wrap gap-2">
              {photos.map((p) => (
                <div key={p.path} className="relative h-20 w-20 overflow-hidden rounded-lg border">
                  <img src={p.previewUrl} alt="wound" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removePhoto(p.path)}
                    className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 shadow">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground hover:bg-accent/30 disabled:opacity-50">
                <Camera className="h-5 w-5" />
                {uploading ? "Uploading…" : "Add photo"}
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || uploading}>Save assessment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PhotoGallery({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [viewing, setViewing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.storage.from("wound-photos").createSignedUrls(paths, 3600);
      if (!cancelled && data) setUrls(data.map((d) => d.signedUrl).filter((u): u is string => !!u));
    })();
    return () => { cancelled = true; };
  }, [paths.join("|")]);

  if (urls.length === 0) {
    return <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"><ImageIcon className="h-3 w-3" /> Loading {paths.length} photo{paths.length > 1 ? "s" : ""}…</div>;
  }
  return (
    <>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {urls.map((u, i) => (
          <button key={i} type="button" onClick={() => setViewing(u)} className="h-16 w-16 overflow-hidden rounded-md border">
            <img src={u} alt={`wound ${i + 1}`} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {viewing && (
        <Dialog open onOpenChange={() => setViewing(null)}>
          <DialogContent className="max-w-2xl p-2">
            <img src={viewing} alt="wound" className="max-h-[80vh] w-full rounded object-contain" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function WoundPhotoHistory({ entries, woundId }: { entries: any[]; woundId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const paths: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${u.user!.id}/${woundId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("wound-photos").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        paths.push(path);
      }
      const latest = entries[0];
      const existing = Array.isArray(latest?.photos) ? (latest.photos as string[]) : [];
      const { error } = await supabase.from("wound_assessments")
        .update({ photos: [...existing, ...paths] as never })
        .eq("id", latest.id);
      if (error) throw error;
      toast.success(paths.length > 1 ? "Photos added" : "Photo added");
      qc.invalidateQueries({ queryKey: ["wound-assessments", woundId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // entries arrive newest-first
  const items = entries.flatMap((e: any) =>
    (Array.isArray(e.photos) ? (e.photos as unknown[]) : [])
      .filter((x): x is string => typeof x === "string")
      .map((path) => ({ path, at: e.assessed_at as string })),
  );
  const [urls, setUrls] = useState<{ url: string; at: string }[]>([]);
  const [index, setIndex] = useState<number | null>(null);
  const key = items.map((i) => i.path).join("|");

  useEffect(() => {
    let cancelled = false;
    if (items.length === 0) { setUrls([]); return; }
    (async () => {
      const { data } = await supabase.storage.from("wound-photos").createSignedUrls(items.map((i) => i.path), 3600);
      if (cancelled || !data) return;
      setUrls(data.map((d, i) => ({ url: d.signedUrl ?? "", at: items[i].at })).filter((u) => u.url));
    })();
    return () => { cancelled = true; };
  }, [key]);

  const current = index != null ? urls[index] : null;

  return (
    <div className="mt-3 rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Photo history</h3>
        <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
        <div className="ml-auto">
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment"
            className="hidden" onChange={(e) => addPhotos(e.target.files)} />
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={uploading}
            onClick={() => fileRef.current?.click()}>
            <Camera className="mr-1 h-3.5 w-3.5" />{uploading ? "Uploading…" : "Add photos"}
          </Button>
        </div>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">Newest first — tap a photo to view it full size and step back through earlier ones.</p>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No photos yet — add one with the button above.</p>
      ) : urls.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading photos…</p>
      ) : (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {urls.map((u, i) => (
            <button key={i} type="button" onClick={() => setIndex(i)} className="shrink-0 text-left">
              <div className="h-24 w-24 overflow-hidden rounded-lg border">
                <img src={u.url} alt={`Wound photo ${i + 1}`} className="h-full w-full object-cover" />
              </div>
              <div className="mt-1 w-24 text-[10px] text-muted-foreground">{format(new Date(u.at), "d MMM yyyy")}</div>
            </button>
          ))}
        </div>
      )}

      {current && (
        <Dialog open onOpenChange={() => setIndex(null)}>
          <DialogContent className="max-w-3xl p-3">
            <DialogHeader>
              <DialogTitle className="text-sm">
                {format(new Date(current.at), "d MMM yyyy HH:mm")} · photo {(index ?? 0) + 1} of {urls.length}
              </DialogTitle>
            </DialogHeader>
            <img src={current.url} alt="Wound photo" className="max-h-[70vh] w-full rounded object-contain" />
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={(index ?? 0) >= urls.length - 1}
                onClick={() => setIndex((i) => Math.min((i ?? 0) + 1, urls.length - 1))}>
                Earlier photo
              </Button>
              <Button variant="outline" size="sm" disabled={(index ?? 0) <= 0}
                onClick={() => setIndex((i) => Math.max((i ?? 0) - 1, 0))}>
                Later photo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function WoundComparison({ entries }: { entries: any[] }) {
  // entries arrive newest-first
  const latest = entries[0];
  const [compareId, setCompareId] = useState<string>(entries[entries.length - 1].id);
  const earlier = entries.find((e) => e.id === compareId) ?? entries[entries.length - 1];

  const area = (a: any) =>
    a.length_cm != null && a.width_cm != null ? Number(a.length_cm) * Number(a.width_cm) : null;
  const aNow = area(latest);
  const aThen = area(earlier);
  const change = aNow != null && aThen != null && aThen > 0 ? ((aNow - aThen) / aThen) * 100 : null;

  const row = (label: string, then: any, now: any) => (
    <div className="grid grid-cols-3 gap-2 border-t py-1.5 text-xs first:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      <span>{then ?? "—"}</span>
      <span className="font-medium">{now ?? "—"}</span>
    </div>
  );

  return (
    <div className="mt-3 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Compare over time</h3>
        <Select value={compareId} onValueChange={setCompareId}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {entries.slice(1).map((e) => (
              <SelectItem key={e.id} value={e.id} className="text-xs">
                {format(new Date(e.assessed_at), "d MMM yyyy")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-medium text-muted-foreground">
        <span />
        <span>{format(new Date(earlier.assessed_at), "d MMM")}</span>
        <span>{format(new Date(latest.assessed_at), "d MMM")} (latest)</span>
      </div>
      <div className="mt-1">
        {row("Length (cm)", earlier.length_cm, latest.length_cm)}
        {row("Width (cm)", earlier.width_cm, latest.width_cm)}
        {row("Depth (cm)", earlier.depth_cm, latest.depth_cm)}
        {row("Tissue", earlier.tissue_type, latest.tissue_type)}
        {row("Exudate", earlier.exudate_amount, latest.exudate_amount)}
        {row("Pain", earlier.pain_score != null ? `${earlier.pain_score}/10` : null, latest.pain_score != null ? `${latest.pain_score}/10` : null)}
        {row("Dressing", earlier.dressing, latest.dressing)}
      </div>

      {change != null && (
        <div className="mt-2 rounded-lg border bg-muted/30 p-2 text-xs">
          Surface area has {change < 0 ? "reduced" : change > 0 ? "increased" : "stayed the same"}
          {change !== 0 ? ` by ${Math.abs(change).toFixed(0)}%` : ""} between these two entries
          ({aThen?.toFixed(1)} cm² → {aNow?.toFixed(1)} cm²).
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[11px] text-muted-foreground">Earlier photos</div>
          {Array.isArray(earlier.photos) && earlier.photos.length > 0
            ? <PhotoGallery paths={(earlier.photos as unknown[]).filter((x): x is string => typeof x === "string")} />
            : <p className="text-[11px] text-muted-foreground">None</p>}
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">Latest photos</div>
          {Array.isArray(latest.photos) && latest.photos.length > 0
            ? <PhotoGallery paths={(latest.photos as unknown[]).filter((x): x is string => typeof x === "string")} />
            : <p className="text-[11px] text-muted-foreground">None</p>}
        </div>
      </div>
    </div>
  );
}
