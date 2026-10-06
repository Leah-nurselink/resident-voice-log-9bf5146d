/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
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
import { ArrowRight, ChevronLeft, ChevronRight, Clock, Pill, Plus, Sparkles } from "lucide-react";
import {
  INTERVENTIONS, LEVEL_CLASS, LEVEL_LABEL, OBSERVATIONS, OBS_LEVELS, OUTCOME_LABEL, REASONS,
  interventionLabel, levelFromObs, levelFromSelf, levelOf, outcome, painPatterns,
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
const typeLabel = (a: any) => (a.method === "self_report" ? "Self-report" : a.method === "observational" ? "Observational" : "Abbey Pain");

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
          <span className="text-xs text-muted-foreground">following intervention</span>
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

function PainCheckWizard({ residentId, residentName, parent, prn, onClose }: { residentId: string; residentName: string; parent?: any; prn: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [when, setWhen] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [reason, setReason] = useState(parent ? "Reassessment" : "");
  const [pc, setPc] = useState(false);
  const [can, setCan] = useState<"yes" | "no" | "unsure" | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [det, setDet] = useState({ location: parent?.location ?? "", description: "", onset: "", duration: "", modifiers: "" });
  const [obs, setObs] = useState<Partial<Record<ObsKey, number>>>({});
  const [ints, setInts] = useState<string[]>([]);
  const [prnId, setPrnId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [reassess, setReassess] = useState<number | null>(parent ? null : 60);

  const self = can === "yes";
  const res = self
    ? { level: score == null ? ("unable" as PainLevel) : levelFromSelf(score), total: score ?? 0, factors: score == null ? [] : [`Resident rated pain ${score}/10`] }
    : levelFromObs(obs);
  const factors = [...res.factors, ...(det.location ? [`Location: ${det.location}`] : []), ...(pc ? ["Recorded during personal care"] : [])];
  const o = parent ? outcome(levelOf(parent), res.level) : null;
  const recentPrn = prn.filter((p) => Date.now() - new Date(p.administered_at).getTime() < 6 * 36e5);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const at = new Date(when).toISOString();
      const { error } = await supabase.from("pain_assessments").insert({
        resident_id: residentId, assessed_by: u.user!.id, assessed_at: at,
        vocalisation: 0, facial_expression: 0, body_language: 0, behaviour_change: 0, physiological_change: 0, physical_change: 0,
        total_score: res.total, severity: res.level, source: "manual",
        method: self ? "self_report" : "observational", reason: reason || null, can_self_report: can,
        self_score: self ? score : null, ...Object.fromEntries(Object.entries(det).map(([k, v]) => [k, v || null])),
        observations: self ? null : obs, result: res.level, interventions: parent ? [] : ints,
        during_personal_care: pc, notes: note || null, parent_assessment_id: parent?.id ?? null,
        medication_administration_id: ints.includes("prn") ? prnId : null,
        reassess_due_at: !parent && reassess ? new Date(new Date(at).getTime() + reassess * 6e4).toISOString() : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pain check saved"); qc.invalidateQueries({ queryKey: ["pain", residentId] }); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const steps = ["Details", "Can they tell you?", self ? "Pain rating" : "What do you see?", "Result"];
  const canNext = [!!reason, !!can, self ? score != null : true, true][step];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{parent ? "Reassessment" : "Digital Pain Check"} · {residentName}</DialogTitle>
          <p className="text-xs text-muted-foreground">Step {step + 1} of 4 — {steps[step]}</p>
        </DialogHeader>

        {step === 0 && (
          <div className="space-y-3">
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            <p className="text-xs text-muted-foreground">Assessor: you (signed in)</p>
            <div className="grid grid-cols-2 gap-2">{REASONS.map((r) => <Big key={r} active={reason === r} onClick={() => { setReason(r); if (r === "During personal care") setPc(true); }}>{r}</Big>)}</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pc} onChange={(e) => setPc(e.target.checked)} className="h-5 w-5" />During personal care</label>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Is the resident able to reliably describe their pain?</p>
            <div className="grid gap-2">
              <Big active={can === "yes"} onClick={() => setCan("yes")}>Yes</Big>
              <Big active={can === "no"} onClick={() => setCan("no")}>No</Big>
              <Big active={can === "unsure"} onClick={() => setCan("unsure")}>Unable to determine</Big>
            </div>
          </div>
        )}

        {step === 2 && self && (
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

        {step === 2 && !self && (
          <div className="space-y-2">
            {OBSERVATIONS.map((o) => (
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
            <Input placeholder="Where does it seem to hurt? (optional)" value={det.location} onChange={(e) => setDet({ ...det, location: e.target.value })} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="rounded-2xl border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Recorded result</p>
              <div className="mt-1"><LevelBadge level={res.level} /></div>
              {parent && o && <p className="mt-2 text-sm">{format(new Date(parent.assessed_at), "HH:mm")} — {LEVEL_LABEL[levelOf(parent)]} → now {LEVEL_LABEL[res.level]}: <b>{OUTCOME_LABEL[o]}</b></p>}
              <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">{factors.length ? factors.map((f) => <li key={f}>{f}</li>) : <li>No signs recorded</li>}</ul>
              <p className="mt-2 text-[11px] text-muted-foreground">Based only on what you recorded — not a diagnosis.</p>
            </div>
            {!parent && (
              <>
                <p className="text-sm font-medium">What happened next?</p>
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
                  <p className="mb-1 text-sm font-medium">Reassess in</p>
                  <div className="grid grid-cols-4 gap-2">{[[30, "30 min"], [60, "1 hr"], [120, "2 hr"], [null, "Not needed"]].map(([v, l]) => <Big key={String(v)} active={reassess === v} onClick={() => setReassess(v as number | null)}>{l}</Big>)}</div>
                </div>
              </>
            )}
            <Textarea rows={2} placeholder="Anything else to add (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {step > 0 && <Button variant="outline" className="h-12 flex-1" onClick={() => setStep(step - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Back</Button>}
          {step < 3
            ? <Button className="h-12 flex-1" disabled={!canNext} onClick={() => setStep(step + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
            : <Button className="h-12 flex-1" disabled={save.isPending} onClick={() => save.mutate()}>Save pain check</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
