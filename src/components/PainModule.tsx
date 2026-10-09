/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analyseFacialPain, FACIAL_INDICATORS } from "@/lib/facial-pain.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AbbeyAssessments } from "@/components/PainTab";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ArrowRight, ChevronLeft, ChevronRight, Clock, Pill, Plus, Sparkles, Camera, Loader2, Pencil, Check } from "lucide-react";
import {
  INTERVENTIONS, LEVEL_CLASS, LEVEL_LABEL, OBSERVATIONS, OBS_LEVELS, OUTCOME_LABEL, REASONS,
  interventionLabel, levelFromObs, facialObsValue, METHOD_LABEL, type FacialIndicator, levelFromSelf, levelOf, outcome, painPatterns,
  type ObsKey, type PainLevel,
} from "@/lib/pain-check";

const SECTIONS = [
  ["check", "Pain Check"], ["assess", "Assessments"], ["timeline", "Timeline"], ["response", "Interventions"],
  ["prn", "PRN review"], ["trends", "Trends"], ["insights", "Insights"],
] as const;
type Section = (typeof SECTIONS)[number][0];

function usePainData(residentId: string) {
  return useQuery({
    queryKey: ["pain", residentId, "module"],
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 864e5).toISOString();
      const [a, m] = await Promise.all([
        supabase.from("pain_assessments").select("*").eq("resident_id", residentId).gte("assessed_at", since).order("assessed_at", { ascending: false }),
        supabase.from("medication_administrations").select("id,administered_at,status,dose_given,effectiveness,medications!inner(name,is_prn,indication,prn_indication)")
          .eq("resident_id", residentId).eq("medications.is_prn", true).eq("status", "given").gte("administered_at", since).order("administered_at", { ascending: false }),
      ]);
      if (a.error) throw a.error;
      return { assessments: (a.data ?? []) as any[], prn: (m.data ?? []) as any[] };
    },
  });
}

const LevelBadge = ({ level }: { level: PainLevel }) => <Badge className={LEVEL_CLASS[level]}>{LEVEL_LABEL[level]}</Badge>;
const typeLabel = (a: any) => METHOD_LABEL[a.method] ?? "Abbey Pain";

export function PainSummary({ residentId, onOpen }: { residentId: string; onOpen: () => void }) {
  const { data } = usePainData(residentId);
  if (!data) return null;
  const last = data.assessments[0];
  const lvls = data.assessments.slice(0, 4).map(levelOf);
  const prn7 = data.prn.filter((p) => new Date(p.administered_at).getTime() > Date.now() - 7 * 864e5).length;
  const trend = lvls.length >= 2 ? outcome(lvls[lvls.length - 1], lvls[0]) : null;
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left hover:bg-muted/40">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">Pain</p>
        {last ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            <LevelBadge level={levelOf(last)} />
            <span className="text-muted-foreground">{formatDistanceToNow(new Date(last.assessed_at), { addSuffix: true })}</span>
            {trend && <span className="text-muted-foreground">· {OUTCOME_LABEL[trend].toLowerCase()}</span>}
            <span className="text-muted-foreground">· PRN {prn7}× / 7d</span>
          </div>
        ) : <p className="text-sm">No pain recorded</p>}
      </div>
      <span className="flex items-center text-xs font-medium text-primary">View Pain <ChevronRight className="h-4 w-4" /></span>
    </button>
  );
}

export function PainModule({ residentId, residentName, onOpenTab }: { residentId: string; residentName: string; onOpenTab: (t: string) => void }) {
  const [section, setSection] = useState<Section>("check");
  const [wizard, setWizard] = useState<{ parent?: any } | null>(null);
  const { data } = usePainData(residentId);
  const as = data?.assessments ?? [];
  const prn = data?.prn ?? [];
  const childrenOf = (id: string) => as.filter((x) => x.parent_assessment_id === id).sort((a, b) => a.assessed_at.localeCompare(b.assessed_at));
  const roots = as.filter((x) => !x.parent_assessment_id);
  const due = roots.filter((r) => r.reassess_due_at && childrenOf(r.id).length === 0);
  const patterns = useMemo(() => painPatterns(as, prn), [as, prn]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {SECTIONS.map(([k, l]) => (
          <button key={k} onClick={() => setSection(k)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${section === k ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>
            {l}{k === "insights" && patterns.length ? ` · ${patterns.length}` : ""}
          </button>
        ))}
      </div>

      {section === "check" && (
        <div className="space-y-3">
          <Button size="lg" className="h-14 w-full text-base" onClick={() => setWizard({})}><Plus className="mr-2 h-5 w-5" />Start Digital Pain Check</Button>
          <p className="px-1 text-xs text-muted-foreground">A quick, step-by-step record of what you saw or were told. It supports — never replaces — clinical judgement.</p>
          {due.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-3">
              <div className="text-sm"><Clock className="mr-1 inline h-4 w-4" />Reassessment {new Date(r.reassess_due_at) < new Date() ? "overdue" : "due"} {format(new Date(r.reassess_due_at), "HH:mm")} · was <b>{LEVEL_LABEL[levelOf(r)].toLowerCase()}</b></div>
              <Button size="sm" onClick={() => setWizard({ parent: r })}>Reassess</Button>
            </div>
          ))}
          {as[0] && <Chain root={roots[0]} kids={childrenOf(roots[0]?.id)} />}
        </div>
      )}

      {section === "assess" && <AbbeyAssessments residentId={residentId} residentName={residentName} />}

      {section === "timeline" && (
        roots.length ? <ul className="space-y-2">{roots.map((r) => <li key={r.id}><Chain root={r} kids={childrenOf(r.id)} detailed /></li>)}</ul>
          : <Empty />
      )}

      {section === "response" && (() => {
        const rows = roots.filter((r) => (r.interventions?.length || r.intervention));
        return rows.length ? (
          <ul className="space-y-2">{rows.map((r) => {
            const k = childrenOf(r.id); const o = k.length ? outcome(levelOf(r), levelOf(k[k.length - 1])) : null;
            return (
              <li key={r.id} className="rounded-2xl border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{format(new Date(r.assessed_at), "d MMM HH:mm")} <LevelBadge level={levelOf(r)} /></div>
                <p className="mt-1">{[...(r.interventions ?? []).map(interventionLabel), r.intervention].filter(Boolean).join(" · ")}</p>
                <p className="mt-1 text-xs">{o ? <b>{OUTCOME_LABEL[o]}</b> : r.response ? r.response : <span className="text-muted-foreground">No reassessment recorded</span>}</p>
              </li>);
          })}</ul>
        ) : <Empty text="No interventions recorded yet." />;
      })()}

      {section === "prn" && (
        prn.length ? <ul className="space-y-2">{prn.slice(0, 20).map((p) => {
          const t = new Date(p.administered_at).getTime();
          const before = as.find((a) => a.medication_administration_id === p.id) ??
            as.find((a) => { const d = t - new Date(a.assessed_at).getTime(); return d >= 0 && d < 2 * 36e5; });
          const after = before ? childrenOf(before.id).at(-1) : null;
          return (
            <li key={p.id} className="rounded-2xl border bg-card p-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {before ? <LevelBadge level={levelOf(before)} /> : <span className="text-muted-foreground">No pain check before</span>}
                <ArrowRight className="h-3 w-3" />
                <span className="flex items-center gap-1 font-medium"><Pill className="h-3 w-3" />{p.medications?.name} {p.dose_given ?? ""} · {format(new Date(p.administered_at), "d MMM HH:mm")}</span>
                <ArrowRight className="h-3 w-3" />
                {after ? <LevelBadge level={levelOf(after)} /> : <span className="text-muted-foreground">No reassessment</span>}
              </div>
            </li>);
        })}</ul> : <Empty text="No PRN medication documented in the last 60 days." />
      )}

      {section === "trends" && <Trends as={as} prn={prn} />}

      {section === "insights" && (
        <div className="space-y-2">
          {patterns.length === 0 ? <Empty text="No pain patterns identified from recent records." /> : patterns.map((p, i) => (
            <div key={i} className="rounded-2xl border bg-card p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-warning-foreground">Pain pattern identified</p>
              <p className="mt-1 text-sm font-medium">{p.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{p.detail}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSection("timeline")}>View timeline</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSection("assess")}>Review assessments</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenTab("meds")}>View MAR</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onOpenTab("notes")}>Add clinical note</Button>
              </div>
            </div>
          ))}
          <p className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground"><Sparkles className="h-3 w-3" />Patterns come only from documented records. They are not diagnoses or treatment advice.</p>
        </div>
      )}

      {wizard && <PainCheckWizard residentId={residentId} residentName={residentName} parent={wizard.parent} prn={prn} onClose={() => setWizard(null)} />}
    </div>
  );
}

const Empty = ({ text = "No pain checks recorded yet." }: { text?: string }) => <p className="px-1 text-sm text-muted-foreground">{text}</p>;

function Chain({ root, kids, detailed }: { root: any; kids: any[]; detailed?: boolean }) {
  if (!root) return null;
  const last = kids.at(-1);
  const o = last ? outcome(levelOf(root), levelOf(last)) : null;
  return (
    <div className="rounded-2xl border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{format(new Date(root.assessed_at), detailed ? "d MMM HH:mm" : "HH:mm")}</span>
        <LevelBadge level={levelOf(root)} />
        <span className="text-xs text-muted-foreground">{typeLabel(root)}{root.location ? ` · ${root.location}` : ""}</span>
      </div>
      {(root.interventions?.length > 0 || root.intervention) && (
        <p className="mt-1 text-xs text-muted-foreground">→ {[...(root.interventions ?? []).map(interventionLabel), root.intervention].filter(Boolean).join(", ")}</p>
      )}
      {kids.map((k) => (
        <div key={k.id} className="mt-1 flex flex-wrap items-center gap-2 border-l-2 pl-2">
          <span className="font-medium">{format(new Date(k.assessed_at), "HH:mm")}</span><LevelBadge level={levelOf(k)} />
          <span className="text-xs text-muted-foreground">Reassessment{k.facial_analysis_used ? " · facial analysis" : ""}</span>
        </div>
      ))}
      {o && <p className="mt-1 text-xs font-medium">{OUTCOME_LABEL[o]}</p>}
    </div>
  );
}

function Trends({ as, prn }: { as: any[]; prn: any[] }) {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 864e5); const key = d.toISOString().slice(0, 10);
    const lv = as.filter((a) => a.assessed_at.slice(0, 10) === key).map((a) => ({ none: 0, mild: 1, moderate: 2, severe: 3, unable: 0 })[levelOf(a)]);
    return { key, label: format(d, "d"), max: lv.length ? Math.max(...lv) : null, prn: prn.filter((p) => p.administered_at.slice(0, 10) === key).length };
  });
  const c = (from: number, to: number, arr: any[], f: string) => arr.filter((x) => { const t = Date.now() - new Date(x[f]).getTime(); return t >= from * 864e5 && t < to * 864e5; }).length;
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">Highest recorded level per day (last 14 days) · ● PRN given</p>
      <div className="flex h-28 items-end gap-1">
        {days.map((d) => (
          <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
            {d.prn > 0 && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            <div className={`w-full rounded-t ${d.max == null ? "bg-muted" : d.max >= 3 ? "bg-destructive" : d.max >= 2 ? "bg-warning" : d.max >= 1 ? "bg-warning/50" : "bg-success/50"}`}
              style={{ height: `${d.max == null ? 4 : 12 + d.max * 26}px` }} />
            <span className="text-[9px] text-muted-foreground">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>Checks: <b>{c(0, 7, as, "assessed_at")}</b> this week vs {c(7, 14, as, "assessed_at")} last</div>
        <div>PRN: <b>{c(0, 7, prn, "administered_at")}</b> this week vs {c(7, 14, prn, "administered_at")} last</div>
      </div>
    </div>
  );
}

function Big({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`min-h-12 rounded-xl border px-3 py-2 text-sm font-medium ${active ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>{children}</button>;
}

type Method = "self_report" | "observational" | "facial_observational";
type Facial = { indicators: FacialIndicator[]; quality: number; issues: string[]; faceVisible: boolean; model: string };

function FacialCapture({ residentId, onDone }: { residentId: string; onDone: (f: Facial) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"starting" | "ready" | "capturing" | "analysing" | "error">("starting");
  const [err, setErr] = useState("");
  const analyse = useServerFn(analyseFacialPain);
  const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  useEffect(() => {
    (async () => {
      try {
        const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 640 } }, audio: false });
        streamRef.current = st;
        if (videoRef.current) { videoRef.current.srcObject = st; await videoRef.current.play(); }
        setState("ready");
      } catch { setErr("Camera not available. Allow camera access, or go back and choose Observational."); setState("error"); }
    })();
    return stop;
  }, []);
  const capture = async () => {
    const v = videoRef.current; if (!v) return;
    setState("capturing");
    const frames: string[] = [];
    const c = document.createElement("canvas"); const w = 512; c.width = w; c.height = Math.round((v.videoHeight / v.videoWidth) * w) || Math.round(w * 0.75);
    for (let n = 0; n < 6; n++) {
      c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
      frames.push(c.toDataURL("image/jpeg", 0.7));
      await new Promise((r) => setTimeout(r, 700));
    }
    stop(); setState("analysing");
    try {
      const r = await analyse({ data: { residentId, consentConfirmed: true, frames } });
      frames.length = 0; // frames discarded — never stored
      onDone({ indicators: r.indicators as FacialIndicator[], quality: r.quality, issues: r.quality_issues, faceVisible: r.face_visible, model: r.model });
    } catch (e) { setErr(e instanceof Error ? e.message : "Analysis failed"); setState("error"); }
  };
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Position the resident's face within the guide and ensure the face is clearly visible.</p>
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-muted">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-[12%_18%] rounded-[50%] border-4 border-dashed border-primary/80" />
        {state !== "ready" && state !== "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-sm font-medium">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />{{ starting: "Starting camera…", capturing: "Observing… hold still", analysing: "Analysing expression…" }[state]}
          </div>
        )}
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button className="h-12 w-full" disabled={state !== "ready"} onClick={capture}><Camera className="mr-2 h-4 w-4" />Capture observation (~4s)</Button>
      <p className="text-[11px] text-muted-foreground">Facial <b>expression</b> analysis only — not facial recognition. The person is not identified and no images or video are kept.</p>
    </div>
  );
}

function FacialSummary({ f, editable, onChange }: { f: Facial; editable?: boolean; onChange?: (f: Facial) => void }) {
  const found = f.indicators.filter((i) => i.intensity > 0);
  const q = f.quality >= 0.7 ? "Good" : f.quality >= 0.4 ? "Fair" : "Poor";
  const bump = (k: string) =>
    onChange?.({ ...f, indicators: f.indicators.map((i) => i.key === k ? { ...i, intensity: (i.intensity + 1) % 6 } : i) });
  return (
    <div className="rounded-2xl border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide">Facial observation</p>
        <Badge variant="outline">Capture quality: {q} ({Math.round(f.quality * 100)}%)</Badge>
      </div>
      {!f.faceVisible || f.quality < 0.4
        ? <p className="mt-2 text-sm">Face not clearly visible{f.issues.length ? ` (${f.issues.join(", ")})` : ""}. Facial findings are not used — rely on observations.</p>
        : <>
          <p className="mt-2 text-xs text-muted-foreground">Facial action units (intensity 0–5){editable ? " — tap to adjust" : ""}:</p>
          <ul className="mt-1 space-y-1">
            {(editable ? f.indicators : found).map((i) => {
              const label = FACIAL_INDICATORS.find((x) => x[0] === i.key)?.[1] ?? i.key;
              return <li key={i.key} className="flex items-start justify-between gap-2 text-sm">
                <span>{label}<span className="block text-[11px] text-muted-foreground">{i.observation}</span></span>
                {editable
                  ? <button type="button" onClick={() => bump(i.key)} className="shrink-0 rounded-lg border px-2 py-1 text-xs tabular-nums">{i.intensity}/5</button>
                  : <span className="shrink-0 text-xs font-medium tabular-nums">{i.intensity}/5</span>}
              </li>;
            })}
            {!editable && !found.length && <li className="text-sm">No facial pain indicators seen</li>}
          </ul>
        </>}
      <p className="mt-2 text-[10px] text-muted-foreground">Prototype — facial-expression analysis. Not a clinically validated device.</p>
    </div>
  );
}

function PainCheckWizard({ residentId, residentName, parent, prn, onClose }: { residentId: string; residentName: string; parent?: any; prn: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [when, setWhen] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [reason, setReason] = useState(parent ? "Reassessment" : "");
  const [method, setMethod] = useState<Method | null>(parent?.method === "self_report" || parent?.method === "observational" || parent?.method === "facial_observational" ? parent.method : null);
  const [consentTick, setConsentTick] = useState(false);
  const [facial, setFacial] = useState<Facial | null>(null);
  const [ctx, setCtx] = useState({ rest: false, movement: false, pc: false });
  const [score, setScore] = useState<number | null>(null);
  const [det, setDet] = useState({ location: parent?.location ?? "", description: "", onset: "", duration: "", modifiers: "" });
  const [obs, setObs] = useState<Partial<Record<ObsKey, number>>>({});
  const [override, setOverride] = useState<PainLevel | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [ints, setInts] = useState<string[]>([]);
  const [prnId, setPrnId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [reassess, setReassess] = useState<number | null>(parent ? null : 60);

  const consentQ = useQuery({
    queryKey: ["facial-consent", residentId],
    queryFn: async () => (await supabase.from("consents").select("id,consent_type,date_given").eq("resident_id", residentId).eq("status", "given").or("consent_type.ilike.*facial*,consent_type.ilike.*care*treatment*").limit(1)).data?.[0] ?? null,
  });

  const self = method === "self_report";
  const isFacial = method === "facial_observational";
  const facialVal = facial ? facialObsValue(facial.indicators, facial.faceVisible ? facial.quality : 0) : null;
  const obsAll = isFacial && facialVal != null ? { ...obs, facial: facialVal } : obs;
  const auto = self
    ? { level: score == null ? ("unable" as PainLevel) : levelFromSelf(score), total: score ?? 0, factors: score == null ? [] : [`Resident rated pain ${score}/10`] }
    : levelFromObs(obsAll);
  const level = override ?? auto.level;
  const factors = [...auto.factors, ...(det.location ? [`Location: ${det.location}`] : []), ...(ctx.rest ? ["At rest"] : []), ...(ctx.movement ? ["During movement"] : []), ...(ctx.pc ? ["During personal care"] : [])];
  const o = parent ? outcome(levelOf(parent), level) : null;
  const recentPrn = prn.filter((p) => Date.now() - new Date(p.administered_at).getTime() < 6 * 36e5);

  const flow = [
    "start",
    ...(isFacial ? ["facial"] : []),
    self ? "rating" : "observations",
    "review",
    ...(parent ? [] : ["intervention"]),
  ] as const;
  const cur = flow[step] as string;
  const last = step === flow.length - 1;
  const canNext = ({
    start: !!reason && !!method,
    facial: !!facial, rating: score != null, observations: true, review: confirmed, intervention: true,
  } as Record<string, boolean>)[cur];

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const at = new Date(when).toISOString();
      const { error } = await supabase.from("pain_assessments").insert({
        resident_id: residentId, assessed_by: u.user!.id, assessed_at: at,
        vocalisation: 0, facial_expression: 0, body_language: 0, behaviour_change: 0, physiological_change: 0, physical_change: 0,
        total_score: auto.total, severity: level, source: isFacial ? "facial_prototype" : "manual",
        method, reason: reason || null, can_self_report: self ? "yes" : "no",
        self_score: self ? score : null, ...Object.fromEntries(Object.entries(det).map(([k, v]) => [k, v || null])),
        observations: self ? null : obsAll, result: level, interventions: parent ? [] : ints,
        during_personal_care: ctx.pc, context_rest: ctx.rest, context_movement: ctx.movement,
        facial_analysis_used: isFacial && !!facial, facial_indicators: facial?.indicators ?? null,
        facial_quality: facial?.quality ?? null, facial_model: facial?.model ?? null, facial_consent_confirmed: isFacial && consentTick,
        ai_confidence: null, // capture quality is stored in facial_quality; this is NOT a diagnostic confidence
        approved: true, confirmed_by: u.user!.id, confirmed_at: new Date().toISOString(),
        notes: [override && override !== auto.level ? `Staff adjusted result from ${LEVEL_LABEL[auto.level]} to ${LEVEL_LABEL[override]}.` : "", note].filter(Boolean).join(" ") || null,
        parent_assessment_id: parent?.id ?? null,
        medication_administration_id: ints.includes("prn") ? prnId : null,
        reassess_due_at: !parent && reassess ? new Date(new Date(at).getTime() + reassess * 6e4).toISOString() : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pain assessment confirmed and saved"); qc.invalidateQueries({ queryKey: ["pain", residentId] }); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const TITLES: Record<string, string> = { start: "Start pain check", facial: "Facial analysis", rating: "Pain rating", observations: "Observations", review: "Review assessment", intervention: "What happened next?" };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{parent ? "Reassessment" : "Digital Pain Check"} · {residentName}</DialogTitle>
          <p className="text-xs text-muted-foreground">Step {step + 1} of {flow.length} — {TITLES[cur]}</p>
        </DialogHeader>

        {cur === "start" && (
          <div className="space-y-3">
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">{REASONS.map((r) => <Big key={r} active={reason === r} onClick={() => { setReason(r); if (r === "During personal care") setCtx({ ...ctx, pc: true }); }}>{r}</Big>)}</div>
            <p className="pt-1 text-sm font-medium">Assessment method</p>
            <div className="grid gap-2">
              <Big active={method === "self_report"} onClick={() => setMethod("self_report")}>Self-report <span className="block text-[11px] font-normal opacity-80">Preferred when the resident can reliably describe pain</span></Big>
              <Big active={method === "observational"} onClick={() => setMethod("observational")}>Observational</Big>
              <Big active={method === "facial_observational"} onClick={() => setMethod("facial_observational")}>Facial-expression analysis + observational <span className="block text-[11px] font-normal opacity-80">For residents who cannot reliably communicate pain · Prototype</span></Big>
            </div>
            {isFacial && (
              <p className="text-[11px] text-muted-foreground">Consent is checked at the facial analysis step — you can continue answering the questions first.</p>
            )}
          </div>
        )}

        {cur === "facial" && (facial
          ? <div className="space-y-2"><FacialSummary f={facial} /><Button variant="outline" className="w-full" onClick={() => setFacial(null)}>Retake</Button></div>
          : (
            <div className="space-y-3">
              {consentQ.data ? (
                <label className="flex items-start gap-2 rounded-xl border p-2 text-sm">
                  <input type="checkbox" checked={consentTick} onChange={(e) => setConsentTick(e.target.checked)} className="mt-0.5 h-5 w-5" />
                  <span>Consent recorded ({consentQ.data.consent_type}). I confirm the resident (or best-interests decision) still supports facial analysis today.</span>
                </label>
              ) : (
                <p className="rounded-xl border border-warning/40 bg-warning/10 p-2 text-sm">No recorded consent covering facial expression analysis. Add a consent such as "Facial expression analysis" or "Care and treatment" on the resident's Consents section, or go back and choose Observational.</p>
              )}
              {consentQ.data && consentTick
                ? <FacialCapture residentId={residentId} onDone={setFacial} />
                : consentQ.data
                  ? <p className="text-xs text-muted-foreground">Tick the consent confirmation above to start the camera.</p>
                  : null}
            </div>
          ))}

        {cur === "rating" && (
          <div className="space-y-3">
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: 11 }, (_, n) => (
                <button key={n} onClick={() => setScore(n)} className={`h-12 rounded-xl border text-base font-semibold ${score === n ? "border-primary bg-primary text-primary-foreground" : n === 0 ? "bg-success/10" : n <= 3 ? "bg-warning/10" : n <= 6 ? "bg-warning/25" : "bg-destructive/10"}`}>{n}</button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">0 none · 1–3 mild · 4–6 moderate · 7–10 severe</p>
            {(["location", "description", "onset", "duration", "modifiers"] as const).map((k) => (
              <Input key={k} placeholder={{ location: "Where? (e.g. left hip)", description: "What is it like? (aching, sharp…)", onset: "When did it start?", duration: "How long does it last?", modifiers: "What makes it better or worse?" }[k]}
                value={det[k]} onChange={(e) => setDet({ ...det, [k]: e.target.value })} />
            ))}
          </div>
        )}

        {cur === "observations" && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              <Big active={ctx.rest} onClick={() => setCtx({ ...ctx, rest: !ctx.rest })}>At rest</Big>
              <Big active={ctx.movement} onClick={() => setCtx({ ...ctx, movement: !ctx.movement })}>Movement</Big>
              <Big active={ctx.pc} onClick={() => setCtx({ ...ctx, pc: !ctx.pc })}>Personal care</Big>
            </div>
            {OBSERVATIONS.filter((o) => !(isFacial && facialVal != null && o.key === "facial")).map((o) => (
              <div key={o.key} className="rounded-xl border p-2">
                <p className="text-sm font-medium">{o.label} <span className="text-[11px] font-normal text-muted-foreground">— {o.hint}</span></p>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {OBS_LEVELS.map((l) => (
                    <button key={l.v} onClick={() => setObs({ ...obs, [o.key]: l.v })}
                      className={`h-10 rounded-lg border text-xs font-medium ${obs[o.key] === l.v ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>{l.label}</button>
                  ))}
                </div>
              </div>
            ))}
            {isFacial && facialVal != null && <p className="text-xs text-muted-foreground">Facial expression is taken from the facial analysis ({OBS_LEVELS[facialVal].label.toLowerCase()}).</p>}
            <Input placeholder="Where does it seem to hurt? (optional)" value={det.location} onChange={(e) => setDet({ ...det, location: e.target.value })} />
          </div>
        )}

        {cur === "review" && (
          <div className="space-y-3">
            {facial && <FacialSummary f={facial} editable={editing} onChange={setFacial} />}
            {!self && (
              <div className="rounded-2xl border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide">Behavioural observations</p>
                <ul className="mt-1 list-disc pl-5 text-sm">{auto.factors.length ? auto.factors.map((f) => <li key={f}>{f}</li>) : <li>No signs recorded</li>}</ul>
              </div>
            )}
            {self && <div className="rounded-2xl border p-3"><p className="text-xs font-semibold uppercase tracking-wide">Self-report</p><p className="mt-1 text-sm">Resident rated pain {score}/10{det.location ? ` · ${det.location}` : ""}</p></div>}
            <div className="rounded-2xl border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide">Overall assessment</p>
              <div className="mt-1"><LevelBadge level={level} /></div>
              {parent && o && <p className="mt-2 text-sm">{format(new Date(parent.assessed_at), "HH:mm")} {LEVEL_LABEL[levelOf(parent)]} → now {LEVEL_LABEL[level]}: <b>{OUTCOME_LABEL[o]}</b></p>}
              {factors.length > auto.factors.length && <p className="mt-1 text-xs text-muted-foreground">{factors.slice(auto.factors.length).join(" · ")}</p>}
              <p className="mt-2 text-[11px] text-muted-foreground">Assessment result based on recorded observations — not a diagnosis.{isFacial ? " Facial-expression analysis (prototype) was used." : ""}</p>
              {editing && (
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {(Object.keys(LEVEL_LABEL) as PainLevel[]).map((l) => <Big key={l} active={level === l} onClick={() => setOverride(l === auto.level ? null : l)}>{LEVEL_LABEL[l]}</Big>)}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-12" onClick={() => { setEditing(!editing); setConfirmed(false); }}><Pencil className="mr-1 h-4 w-4" />{editing ? "Done editing" : "Edit assessment"}</Button>
              <Button className="h-12" variant={confirmed ? "secondary" : "default"} onClick={() => { setConfirmed(true); setEditing(false); if (!last) setStep(step + 1); }}><Check className="mr-1 h-4 w-4" />{confirmed ? "Confirmed" : "Confirm assessment"}</Button>
            </div>
            {parent && <Textarea rows={2} placeholder="Notes (optional)" value={note} onChange={(e) => setNote(e.target.value)} />}
          </div>
        )}

        {cur === "intervention" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {INTERVENTIONS.map((i) => <Big key={i.key} active={ints.includes(i.key)} onClick={() => setInts(i.key === "none" ? ["none"] : ints.includes(i.key) ? ints.filter((x) => x !== i.key) : [...ints.filter((x) => x !== "none"), i.key])}>{i.label}</Big>)}
            </div>
            {ints.includes("prn") && (
              recentPrn.length ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Link the PRN dose recorded on the MAR:</p>
                  {recentPrn.map((p) => <Big key={p.id} active={prnId === p.id} onClick={() => setPrnId(p.id)}>{p.medications?.name} · {format(new Date(p.administered_at), "HH:mm")}</Big>)}
                </div>
              ) : <p className="text-xs text-muted-foreground">Record the PRN dose on the Meds tab — it will appear in PRN review.</p>
            )}
            <div>
              <p className="mb-1 text-sm font-medium">Schedule reassessment</p>
              <div className="grid grid-cols-4 gap-2">{[[30, "30 min"], [60, "1 hr"], [120, "2 hr"], [null, "Not needed"]].map(([v, l]) => <Big key={String(v)} active={reassess === v} onClick={() => setReassess(v as number | null)}>{l}</Big>)}</div>
            </div>
            <Textarea rows={2} placeholder="Notes (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {step > 0 && <Button variant="outline" className="h-12 flex-1" onClick={() => setStep(step - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Back</Button>}
          {!last
            ? cur !== "review" && <Button className="h-12 flex-1" disabled={!canNext} onClick={() => setStep(step + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
            : <Button className="h-12 flex-1" disabled={save.isPending || !confirmed} onClick={() => save.mutate()}>Save</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
