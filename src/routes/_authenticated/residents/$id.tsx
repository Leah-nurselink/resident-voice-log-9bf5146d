import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { SessionRecorder, type StructuredNote } from "@/components/SessionRecorder";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { ResidentTimeline } from "@/components/ResidentTimeline";
import { ResidentIntelligence } from "@/components/ResidentIntelligence";
import { WoundsTab } from "@/components/WoundsTab";
import { PersonalInfoTab } from "@/components/PersonalInfoTab";
import { PainTab } from "@/components/PainTab";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CARE_PLAN_DOMAINS, RISK_TYPES, RISK_LEVEL_COLOR, CONSENT_TYPES, DOMAIN_TO_RISKS,
  domainLabel, riskLabel,
  type CarePlanDomain, type RiskType,
} from "@/lib/care-domains";
import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { Check, History, Pencil, Sparkles, X, AlertTriangle, Plus, Brain, FileSignature, Phone } from "lucide-react";
import { CallRecorder } from "@/components/CallRecorder";

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
        .from("daily_notes").select("*").eq("resident_id", id)
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

  const consents = useQuery({
    queryKey: ["consents", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("consents").select("*").eq("resident_id", id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const mca = useQuery({
    queryKey: ["mca", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("mca_assessments").select("*").eq("resident_id", id)
        .order("assessment_date", { ascending: false });
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
      // Time-saved estimate: typing baseline at ~25 wpm vs voice capture
      // (recording duration + ~8s review). Floored at 0.
      const words = editing.trim().split(/\s+/).filter(Boolean).length;
      const typingBaselineSec = Math.max(30, Math.round(words * 2.4));
      const voiceActualSec = Math.round((pending.durationSec ?? 0) + 8);
      const timeSaved = Math.max(0, typingBaselineSec - voiceActualSec);
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
        audio_quality: pending.audioQuality ?? null,
        transcript_confidence: pending.transcriptConfidence ?? null,
        signal_level: pending.signal ?? null,
        noise_level: pending.noise ?? null,
        duration_sec: pending.durationSec ?? null,
        time_saved_seconds: pending.durationSec ? timeSaved : null,
        segments: pending.segments ?? null,
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

  const [editConsent, setEditConsent] = useState<any | null>(null);
  const [newConsent, setNewConsent] = useState(false);
  const [editMca, setEditMca] = useState<any | null>(null);
  const [newMca, setNewMca] = useState(false);
  const [callOpen, setCallOpen] = useState(false);

  if (!resident.data) return <AppShell title="Loading…"><div /></AppShell>;
  const r = resident.data;
  const initials = r.full_name.split(" ").map((s: string) => s[0]).slice(0, 2).join("");

  return (
    <AppShell title={r.full_name}>
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary text-lg font-medium text-secondary-foreground">{initials}</div>
          <div className="flex-1">
            <div className="font-medium">{r.full_name}</div>
            <div className="text-xs text-muted-foreground">
              {r.room_number ? `Room ${r.room_number} · ` : ""}{r.date_of_birth ? `DOB ${format(new Date(r.date_of_birth), "d MMM yyyy")}` : "DOB not set"}
            </div>
          </div>
          <Button size="sm" onClick={() => setCallOpen(true)} className="gap-1.5">
            <Phone className="h-3.5 w-3.5" /> Call
          </Button>
        </div>
        <CallRecorder open={callOpen} onOpenChange={setCallOpen} residentId={id} residentName={r.full_name} />
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

      <Tabs defaultValue="intel" className="mt-4">
        <TabsList className="grid w-full grid-cols-11">
          <TabsTrigger value="intel" className="text-xs px-1">AI</TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs px-1">Story</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs px-1">Notes</TabsTrigger>
          <TabsTrigger value="comms" className="text-xs px-1">Comms</TabsTrigger>
          <TabsTrigger value="profile" className="text-xs px-1">Profile</TabsTrigger>
          <TabsTrigger value="care" className="text-xs px-1">Care</TabsTrigger>
          <TabsTrigger value="risk" className="text-xs px-1">Risk</TabsTrigger>
          <TabsTrigger value="pain" className="text-xs px-1">Pain</TabsTrigger>
          <TabsTrigger value="wounds" className="text-xs px-1">Wounds</TabsTrigger>
          <TabsTrigger value="consent" className="text-xs px-1">Consent</TabsTrigger>
          <TabsTrigger value="mca" className="text-xs px-1">MCA</TabsTrigger>
        </TabsList>

        <TabsContent value="intel" className="mt-4">
          <ResidentIntelligence residentId={id} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <ResidentTimeline residentId={id} />
        </TabsContent>

        <TabsContent value="comms" className="mt-4">
          <CommunicationsTab residentId={id} />
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <PersonalInfoTab resident={r} />
        </TabsContent>


        <TabsContent value="notes" className="mt-4 space-y-4">
          <SessionRecorder residentName={r.full_name} onResult={(n) => { setPending(n); setEditing(n.content); }} />

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
                    <Badge variant={n.status === "approved" ? "secondary" : "outline"} className="text-[10px]">{n.status}</Badge>
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

        <TabsContent value="pain" className="mt-4">
          <PainTab residentId={id} residentName={r.full_name} />
        </TabsContent>

        <TabsContent value="wounds">
          <WoundsTab residentId={id} />
        </TabsContent>



        <TabsContent value="consent" className="mt-4 space-y-2">
          <Button onClick={() => setNewConsent(true)} className="w-full"><Plus className="mr-1 h-4 w-4" />Record consent</Button>
          {consents.data?.length ? consents.data.map((c) => (
            <button key={c.id} onClick={() => setEditConsent(c)} className="flex w-full items-center justify-between rounded-2xl border bg-card p-4 text-left hover:bg-accent/30">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileSignature className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{c.consent_type}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {c.given_by_name ? `${c.given_by_name} · ` : ""}
                  {c.date_given ? format(new Date(c.date_given), "d MMM yyyy") : "no date"}
                  {c.review_date ? ` · review ${format(new Date(c.review_date), "d MMM yyyy")}` : ""}
                </p>
              </div>
              <ConsentBadge status={c.status} />
            </button>
          )) : <p className="px-1 text-sm text-muted-foreground">No consents recorded yet.</p>}
        </TabsContent>

        <TabsContent value="mca" className="mt-4 space-y-2">
          <Button onClick={() => setNewMca(true)} className="w-full"><Plus className="mr-1 h-4 w-4" />New MCA assessment</Button>
          {mca.data?.length ? mca.data.map((m) => (
            <button key={m.id} onClick={() => setEditMca(m)} className="flex w-full items-center justify-between rounded-2xl border bg-card p-4 text-left hover:bg-accent/30">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium line-clamp-1">{m.decision}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {format(new Date(m.assessment_date), "d MMM yyyy")}
                  {m.review_date ? ` · review ${format(new Date(m.review_date), "d MMM yyyy")}` : ""}
                </p>
              </div>
              {m.has_capacity === true && <Badge className="bg-success/15 text-success-foreground border-success/30 border">Has capacity</Badge>}
              {m.has_capacity === false && <Badge className="bg-destructive/15 text-destructive border-destructive/30 border">Lacks capacity</Badge>}
              {m.has_capacity === null && <Badge variant="outline">Pending</Badge>}
            </button>
          )) : <p className="px-1 text-sm text-muted-foreground">No MCA assessments recorded.</p>}
        </TabsContent>
      </Tabs>

      {(newConsent || editConsent) && (
        <ConsentDialog residentId={id} existing={editConsent} onClose={() => { setNewConsent(false); setEditConsent(null); }} />
      )}
      {(newMca || editMca) && (
        <MCADialog residentId={id} existing={editMca} onClose={() => { setNewMca(false); setEditMca(null); }} />
      )}
    </AppShell>
  );
}

function ConsentBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    given: "bg-success/15 text-success-foreground border-success/30 border",
    refused: "bg-destructive/15 text-destructive border-destructive/30 border",
    withdrawn: "bg-warning/20 text-warning-foreground border-warning/40 border",
    pending: "",
  };
  return <Badge className={map[status]} variant={status === "pending" ? "outline" : "default"}>{status}</Badge>;
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
            {existing?.last_review && <span className="text-[10px] text-muted-foreground">· reviewed {format(new Date(existing.last_review), "d MMM")}</span>}
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
  const [reviewDate, setReviewDate] = useState(existing?.last_review || new Date().toISOString().slice(0, 10));

  const linkedRiskTypes = DOMAIN_TO_RISKS[domain as CarePlanDomain] || [];

  const linkedRisks = useQuery({
    enabled: linkedRiskTypes.length > 0,
    queryKey: ["linked-risks", residentId, domain],
    queryFn: async () => {
      const { data, error } = await supabase.from("risk_assessments")
        .select("*").eq("resident_id", residentId).in("type", linkedRiskTypes);
      if (error) throw error;
      return data;
    },
  });

  const history = useQuery({
    enabled: !!existing?.id,
    queryKey: ["care-plan-history", existing?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("care_plan_history").select("*")
        .eq("care_plan_id", existing.id).order("changed_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("care_plans").upsert({
        resident_id: residentId, domain, needs, risks: risksTxt, outcome, content,
        last_review: reviewDate, updated_by: u.user!.id,
      }, { onConflict: "resident_id,domain" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Care plan updated"); qc.invalidateQueries({ queryKey: ["care-plans", residentId] }); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  function applyVoice(n: StructuredNote) {
    setContent((c: string) => (c ? c + "\n\n" : "") + n.content);
  }

  function pullFromRisk(r: any) {
    const header = `From ${riskLabel(r.type as RiskType)} (${r.level}) · ${r.updated_at ? format(new Date(r.updated_at), "d MMM yyyy") : ""}`;
    if (r.factors) setRisksTxt((c: string) => (c ? c + "\n\n" : "") + `${header}\n${r.factors}`);
    if (r.controls) setContent((c: string) => (c ? c + "\n\n" : "") + `Controls (${riskLabel(r.type as RiskType)}):\n${r.controls}`);
    toast.success("Pulled into care plan");
  }

  function pullAll() {
    const items = linkedRisks.data || [];
    if (!items.length) return;
    items.forEach(pullFromRisk);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
        <VoiceRecorder onResult={applyVoice} />

        {linkedRisks.data && linkedRisks.data.length > 0 && (
          <div className="rounded-xl border bg-primary/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-primary" />Linked risk assessments
              </div>
              <Button size="sm" variant="outline" onClick={pullAll} className="h-7 text-xs">Pull all into plan</Button>
            </div>
            <ul className="space-y-2">
              {linkedRisks.data.map((r) => (
                <li key={r.id} className="rounded-lg border bg-card p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{riskLabel(r.type as RiskType)}</span>
                        <Badge className={RISK_LEVEL_COLOR[r.level as "low"|"medium"|"high"] + " text-[10px]"}>{r.level}</Badge>
                      </div>
                      {r.factors && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{r.factors}</p>}
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Updated {r.updated_at ? formatDistanceToNow(new Date(r.updated_at), { addSuffix: true }) : "—"}
                        {r.review_date ? ` · review ${format(new Date(r.review_date), "d MMM yyyy")}` : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => pullFromRisk(r)} className="h-7 shrink-0 text-xs">Pull in</Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          <Field label="Need" value={needs} onChange={setNeeds} placeholder="What support does the resident need?" />
          <Field label="Risk" value={risksTxt} onChange={setRisksTxt} placeholder="What could go wrong?" />
          <Field label="Outcome" value={outcome} onChange={setOutcome} placeholder="What outcome are we aiming for?" />
          <Field label="Care plan detail" value={content} onChange={setContent} placeholder="Full care plan content" rows={5} />
          <div className="space-y-1.5">
            <Label>Review date</Label>
            <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
          </div>
        </div>

        {history.data && history.data.length > 1 && (
          <HistoryPanel items={history.data.slice(1)} render={(h) => (
            <>

              <div className="text-[11px] text-muted-foreground">{format(new Date(h.changed_at), "d MMM yyyy HH:mm")}</div>
              <p className="mt-1 line-clamp-3 text-xs">{h.content || h.needs || "—"}</p>
            </>
          )} />
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Update</Button>
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

  const history = useQuery({
    enabled: !!existing?.id,
    queryKey: ["risk-history", existing?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("risk_assessment_history").select("*")
        .eq("risk_assessment_id", existing.id).order("changed_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("risk_assessments").upsert({
        resident_id: residentId, type, level, factors, controls,
        review_date: review || null, updated_by: u.user!.id,
      }, { onConflict: "resident_id,type" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Risk updated"); qc.invalidateQueries({ queryKey: ["risks", residentId] }); onClose(); },
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

        {history.data && history.data.length > 1 && (
          <HistoryPanel items={history.data.slice(1)} render={(h) => (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{format(new Date(h.changed_at), "d MMM yyyy HH:mm")}</span>
                <Badge className={RISK_LEVEL_COLOR[h.level as "low"|"medium"|"high"]}>{h.level}</Badge>
              </div>
              <p className="mt-1 line-clamp-3 text-xs">{h.factors || "—"}</p>
            </>
          )} />
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Update</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConsentDialog({ residentId, existing, onClose }: { residentId: string; existing: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<string>(existing?.consent_type || CONSENT_TYPES[0]);
  const [status, setStatus] = useState<"given"|"refused"|"withdrawn"|"pending">(existing?.status || "given");
  const [givenBy, setGivenBy] = useState<"resident"|"power_of_attorney"|"best_interests"|"next_of_kin">(existing?.given_by || "resident");
  const [givenByName, setGivenByName] = useState(existing?.given_by_name || "");
  const [dateGiven, setDateGiven] = useState(existing?.date_given || new Date().toISOString().slice(0, 10));
  const [reviewDate, setReviewDate] = useState(existing?.review_date || "");
  const [notes, setNotes] = useState(existing?.notes || "");

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        resident_id: residentId, consent_type: type, status, given_by: givenBy,
        given_by_name: givenByName || null, date_given: dateGiven, review_date: reviewDate || null,
        notes: notes || null, updated_by: u.user!.id,
      };
      const { error } = existing
        ? await supabase.from("consents").update(payload).eq("id", existing.id)
        : await supabase.from("consents").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(existing ? "Consent updated" : "Consent recorded"); qc.invalidateQueries({ queryKey: ["consents", residentId] }); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{existing ? "Update consent" : "Record consent"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Type of consent</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CONSENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="given">Given</SelectItem>
                <SelectItem value="refused">Refused</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Consent given by</Label>
            <Select value={givenBy} onValueChange={(v) => setGivenBy(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="resident">Resident</SelectItem>
                <SelectItem value="power_of_attorney">Power of Attorney</SelectItem>
                <SelectItem value="best_interests">Best interests decision</SelectItem>
                <SelectItem value="next_of_kin">Next of kin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Name of person who consented</Label>
            <Input value={givenByName} onChange={(e) => setGivenByName(e.target.value)} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date given</Label>
              <Input type="date" value={dateGiven} onChange={(e) => setDateGiven(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Review date</Label>
              <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
            </div>
          </div>
          <Field label="Notes" value={notes} onChange={setNotes} rows={3} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{existing ? "Update" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MCADialog({ residentId, existing, onClose }: { residentId: string; existing: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState(existing?.decision || "");
  const [impair, setImpair] = useState<boolean>(existing?.has_impairment ?? false);
  const [impairDetail, setImpairDetail] = useState(existing?.impairment_detail || "");
  const [understand, setUnderstand] = useState<boolean>(existing?.can_understand ?? true);
  const [retain, setRetain] = useState<boolean>(existing?.can_retain ?? true);
  const [weigh, setWeigh] = useState<boolean>(existing?.can_weigh ?? true);
  const [communicate, setCommunicate] = useState<boolean>(existing?.can_communicate ?? true);
  const [bestInterests, setBestInterests] = useState(existing?.best_interests_decision || "");
  const [decisionMaker, setDecisionMaker] = useState(existing?.decision_maker || "");
  const [assessmentDate, setAssessmentDate] = useState(existing?.assessment_date || new Date().toISOString().slice(0, 10));
  const [reviewDate, setReviewDate] = useState(existing?.review_date || "");
  const [notes, setNotes] = useState(existing?.notes || "");

  const hasCapacity = !impair ? true : (understand && retain && weigh && communicate);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!decision.trim()) throw new Error("Decision being assessed is required");
      const payload = {
        resident_id: residentId,
        decision, has_impairment: impair, impairment_detail: impairDetail || null,
        can_understand: understand, can_retain: retain, can_weigh: weigh, can_communicate: communicate,
        has_capacity: hasCapacity,
        best_interests_decision: !hasCapacity ? (bestInterests || null) : null,
        decision_maker: decisionMaker || null,
        assessment_date: assessmentDate, review_date: reviewDate || null,
        notes: notes || null, updated_by: u.user!.id,
      };
      const { error } = existing
        ? await supabase.from("mca_assessments").update(payload).eq("id", existing.id)
        : await supabase.from("mca_assessments").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(existing ? "MCA updated" : "MCA saved"); qc.invalidateQueries({ queryKey: ["mca", residentId] }); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{existing ? "Update MCA" : "New MCA assessment"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Decision being assessed" value={decision} onChange={setDecision} placeholder="e.g. Consent to receive personal care" rows={2} />

          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Stage 1 — Diagnostic test</div>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <Checkbox checked={impair} onCheckedChange={(v) => setImpair(!!v)} />
              Impairment of mind or brain present
            </label>
            {impair && <div className="mt-2"><Field label="Impairment details" value={impairDetail} onChange={setImpairDetail} rows={2} /></div>}
          </div>

          {impair && (
            <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Stage 2 — Functional test</div>
              <MCACheck label="Can understand the information relevant to the decision" v={understand} on={setUnderstand} />
              <MCACheck label="Can retain the information long enough to decide" v={retain} on={setRetain} />
              <MCACheck label="Can use or weigh up the information" v={weigh} on={setWeigh} />
              <MCACheck label="Can communicate the decision" v={communicate} on={setCommunicate} />
            </div>
          )}

          <div className={`rounded-xl border p-3 text-sm ${hasCapacity ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"}`}>
            <strong>Outcome: </strong>{hasCapacity ? "Has capacity for this decision" : "Lacks capacity for this decision"}
          </div>

          {!hasCapacity && (
            <>
              <Field label="Best interests decision" value={bestInterests} onChange={setBestInterests} rows={3}
                placeholder="What decision is being made in the resident's best interests?" />
              <div className="space-y-1.5">
                <Label>Decision-maker</Label>
                <Input value={decisionMaker} onChange={(e) => setDecisionMaker(e.target.value)} placeholder="Name & role" />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assessment date</Label>
              <Input type="date" value={assessmentDate} onChange={(e) => setAssessmentDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Review date</Label>
              <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
            </div>
          </div>
          <Field label="Notes" value={notes} onChange={setNotes} rows={3} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{existing ? "Update" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MCACheck({ label, v, on }: { label: string; v: boolean; on: (b: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <Checkbox checked={v} onCheckedChange={(x) => on(!!x)} className="mt-0.5" />
      <span>{label}</span>
    </label>
  );
}

function HistoryPanel<T extends { id: string }>({ items, render }: { items: T[]; render: (item: T) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 rounded-xl border bg-muted/20">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between p-3 text-sm">
        <span className="flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" />Previous versions ({items.length})</span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ul className="divide-y border-t">
          {items.map((it) => (
            <li key={it.id} className="p-3">{render(it)}</li>
          ))}
        </ul>
      )}
    </div>
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
