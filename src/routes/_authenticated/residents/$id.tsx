import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { VoiceRecorder, type StructuredNote } from "@/components/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CARE_PLAN_DOMAINS, RISK_TYPES, RISK_LEVEL_COLOR, domainLabel, riskLabel, type CarePlanDomain, type RiskType } from "@/lib/care-domains";
import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { Check, Pencil, Sparkles, X, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/residents/$id")({
  head: () => ({ meta: [{ title: "Resident · ForgeAI" }] }),
  component: ResidentDetail,
});

function ResidentDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const resident = useQuery({
    queryKey: ["resident", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("residents").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const notes = useQuery({
    queryKey: ["notes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_notes")
        .select("*")
        .eq("resident_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const carePlans = useQuery({
    queryKey: ["care-plans", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("care_plans").select("*").eq("resident_id", id);
      if (error) throw error;
      return data;
    },
  });

  const risks = useQuery({
    queryKey: ["risks", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("risk_assessments").select("*").eq("resident_id", id);
      if (error) throw error;
      return data;
    },
  });

  const [pending, setPending] = useState<StructuredNote | null>(null);
  const [editing, setEditing] = useState("");

  const saveNote = useMutation({
    mutationFn: async (status: "draft" | "approved") => {
      if (!pending) return;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("daily_notes").insert({
        resident_id: id,
        author_id: u.user!.id,
        transcript: pending.transcript,
        content: editing,
        domain: (pending.domain as CarePlanDomain) || null,
        risks: pending.risks as RiskType[],
        flags: pending.flags,
        status,
        source: "voice",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note saved");
      setPending(null);
      qc.invalidateQueries({ queryKey: ["notes", id] });
      qc.invalidateQueries({ queryKey: ["notes-draft"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  if (!resident.data) return <AppShell title="Loading…"><div /></AppShell>;
  const r = resident.data;
  const initials = r.full_name.split(" ").map((s: string) => s[0]).slice(0, 2).join("");

  return (
    <AppShell title={r.full_name}>
      {/* Summary */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary text-lg font-medium text-secondary-foreground">{initials}</div>
          <div className="flex-1">
            <div className="font-medium">{r.full_name}</div>
            <div className="text-xs text-muted-foreground">
              {r.room_number ? `Room ${r.room_number} · ` : ""}{r.date_of_birth ? `DOB ${format(new Date(r.date_of_birth), "d MMM yyyy")}` : "DOB not set"}
            </div>
          </div>
        </div>
        {risks.data && risks.data.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {risks.data.map((rk) => (
              <Badge key={rk.id} className={RISK_LEVEL_COLOR[rk.level as "low"|"medium"|"high"]}>
                {riskLabel(rk.type as RiskType)}: {rk.level}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Tabs defaultValue="timeline" className="mt-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="care">Care plans</TabsTrigger>
          <TabsTrigger value="risk">Risks</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4 space-y-4">
          <VoiceRecorder
            residentName={r.full_name}
            onResult={(n) => { setPending(n); setEditing(n.content); }}
          />

          {pending && (
            <div className="rounded-2xl border-2 border-primary/40 bg-card p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" /> AI draft — review before saving
              </div>
              <Textarea value={editing} onChange={(e) => setEditing(e.target.value)} rows={4} className="resize-none" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pending.domain && <Badge variant="secondary">{domainLabel(pending.domain as CarePlanDomain)}</Badge>}
                {pending.risks.map((rk) => <Badge key={rk} variant="outline">{riskLabel(rk as RiskType)}</Badge>)}
                {pending.flags.map((f) => (
                  <Badge key={f} className="bg-destructive/15 text-destructive border-destructive/30 border">
                    <AlertTriangle className="mr-1 h-3 w-3" />{f.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
              {pending.transcript && (
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">View original transcript</summary>
                  <p className="mt-1 italic">"{pending.transcript}"</p>
                </details>
              )}
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" onClick={() => setPending(null)}><X className="mr-1 h-4 w-4" />Discard</Button>
                <Button variant="outline" onClick={() => saveNote.mutate("draft")} disabled={saveNote.isPending}>Save draft</Button>
                <Button onClick={() => saveNote.mutate("approved")} disabled={saveNote.isPending}>
                  <Check className="mr-1 h-4 w-4" />Approve
                </Button>
              </div>
            </div>
          )}

          {notes.data?.length ? (
            <ul className="space-y-2">
              {notes.data.map((n) => (
                <li key={n.id} className="rounded-2xl border bg-card p-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                    <Badge variant={n.status === "approved" ? "secondary" : "outline"} className="text-[10px]">
                      {n.status}
                    </Badge>
                  </div>
                  <p className="text-sm">{n.content}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {n.domain && <Badge variant="secondary" className="text-[10px]">{domainLabel(n.domain)}</Badge>}
                    {(n.risks as string[]).map((r) => <Badge key={r} variant="outline" className="text-[10px]">{riskLabel(r as RiskType)}</Badge>)}
                    {(n.flags as string[]).map((f) => (
                      <Badge key={f} className="bg-destructive/15 text-destructive border-destructive/30 border text-[10px]">{f.replace(/_/g, " ")}</Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 text-sm text-muted-foreground">No notes yet — speak or type one above.</p>
          )}
        </TabsContent>

        <TabsContent value="care" className="mt-4 space-y-2">
          {CARE_PLAN_DOMAINS.map((d) => {
            const existing = carePlans.data?.find((c) => c.domain === d.id);
            return <CarePlanRow key={d.id} residentId={id} domain={d.id} label={d.label} hint={d.hint} existing={existing} />;
          })}
        </TabsContent>

        <TabsContent value="risk" className="mt-4 space-y-2">
          {RISK_TYPES.map((t) => {
            const existing = risks.data?.find((r) => r.type === t.id);
            return <RiskRow key={t.id} residentId={id} type={t.id} label={t.label} existing={existing} />;
          })}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function CarePlanRow({ residentId, domain, label, hint, existing }: { residentId: string; domain: CarePlanDomain; label: string; hint: string; existing?: any }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-between rounded-2xl border bg-card p-4 text-left hover:bg-accent/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{label}</span>
            {existing ? <Badge variant="secondary" className="text-[10px]">Documented</Badge> : <Badge variant="outline" className="text-[10px]">Not set</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{existing?.content?.slice(0, 80) || hint}</p>
        </div>
        <Pencil className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && <CarePlanDialog residentId={residentId} domain={domain} label={label} existing={existing} onClose={() => setOpen(false)} />}
    </>
  );
}

function CarePlanDialog({ residentId, domain, label, existing, onClose }: any) {
  const qc = useQueryClient();
  const [needs, setNeeds] = useState(existing?.needs || "");
  const [risksTxt, setRisksTxt] = useState(existing?.risks || "");
  const [outcome, setOutcome] = useState(existing?.outcome || "");
  const [content, setContent] = useState(existing?.content || "");

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        resident_id: residentId, domain, needs, risks: risksTxt, outcome, content,
        last_review: new Date().toISOString().slice(0, 10), updated_by: u.user!.id,
      };
      const { error } = await supabase.from("care_plans").upsert(payload, { onConflict: "resident_id,domain" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Care plan saved"); qc.invalidateQueries({ queryKey: ["care-plans", residentId] }); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  function applyVoice(n: StructuredNote) {
    setContent((c: string) => (c ? c + "\n\n" : "") + n.content);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
        <VoiceRecorder onResult={applyVoice} />
        <div className="space-y-3">
          <Field label="Need" value={needs} onChange={setNeeds} placeholder="What support does the resident need?" />
          <Field label="Risk" value={risksTxt} onChange={setRisksTxt} placeholder="What could go wrong?" />
          <Field label="Outcome" value={outcome} onChange={setOutcome} placeholder="What outcome are we aiming for?" />
          <Field label="Care plan detail" value={content} onChange={setContent} placeholder="Full care plan content" rows={5} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RiskRow({ residentId, type, label, existing }: { residentId: string; type: RiskType; label: string; existing?: any }) {
  const [open, setOpen] = useState(false);
  const level = (existing?.level || "low") as "low"|"medium"|"high";
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-between rounded-2xl border bg-card p-4 text-left hover:bg-accent/30">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">{existing?.factors?.slice(0, 80) || "Not assessed"}</p>
        </div>
        <Badge className={RISK_LEVEL_COLOR[level]}>{level}</Badge>
      </button>
      {open && <RiskDialog residentId={residentId} type={type} label={label} existing={existing} onClose={() => setOpen(false)} />}
    </>
  );
}

function RiskDialog({ residentId, type, label, existing, onClose }: any) {
  const qc = useQueryClient();
  const [level, setLevel] = useState<"low"|"medium"|"high">(existing?.level || "low");
  const [factors, setFactors] = useState(existing?.factors || "");
  const [controls, setControls] = useState(existing?.controls || "");
  const [review, setReview] = useState(existing?.review_date || "");

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("risk_assessments").upsert({
        resident_id: residentId, type, level, factors, controls,
        review_date: review || null, updated_by: u.user!.id,
      }, { onConflict: "resident_id,type" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Risk saved"); qc.invalidateQueries({ queryKey: ["risks", residentId] }); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  function applyVoice(n: StructuredNote) {
    setFactors((c: string) => (c ? c + "\n\n" : "") + n.content);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
        <VoiceRecorder onResult={applyVoice} />
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Risk level</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Risk factors" value={factors} onChange={setFactors} rows={3} />
          <Field label="Controls in place" value={controls} onChange={setControls} rows={3} />
          <div className="space-y-1.5">
            <Label>Review date</Label>
            <Input type="date" value={review} onChange={(e) => setReview(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, placeholder, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="resize-none" />
    </div>
  );
}
