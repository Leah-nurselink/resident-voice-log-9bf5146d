import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RISK_ASSESSMENTS, type RiskAssessmentDef, type RAField } from "@/lib/risk-assessments";
import { Checkbox } from "@/components/ui/checkbox";
import { RiskToolWizard } from "@/components/RiskToolWizard";
import { SCORED_TOOL_KEYS, SCORED_TOOL_TITLE, plansFedBy, reviewDateFromInterval, type ScoredToolKey } from "@/lib/risk-links";
import { domainLabel } from "@/lib/care-domains";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronRight, AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

// Untyped view of the new table (not yet in generated Supabase types).
const sb = supabase as unknown as { from: (t: string) => any; auth: typeof supabase.auth };

type Answer = string | string[];
type Answers = Record<string, Answer>;

type Row = {
  id: string; type: string; level: string | null; status: string;
  answers: Record<string, any> | null; outcome: string | null; actions: string | null;
  review_interval: string | null; review_date: string | null; updated_at: string;
};

const LEVELS = ["low", "medium", "high"] as const;
const INTERVALS = ["1 month", "3 months", "6 months", "12 months", "As decisions arise"];
const levelClass = (l: string | null) =>
  l === "high" ? "bg-destructive/15 text-destructive border-destructive/30 border"
  : l === "medium" ? "bg-warning/20 text-warning-foreground border-warning/40 border"
  : l === "low" ? "bg-success/15 text-success-foreground border-success/30 border" : "";

export function RiskAssessmentsTab({ residentId, residentName }: { residentId: string; residentName?: string }) {
  const [open, setOpen] = useState<RiskAssessmentDef | null>(null);
  const [tool, setTool] = useState<ScoredToolKey | null>(null);

  const q = useQuery({
    queryKey: ["resident-risk-assessments", residentId],
    queryFn: async () => {
      const { data, error } = await sb.from("resident_risk_assessments").select("*").eq("resident_id", residentId);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const byType = useMemo(() => {
    const m: Record<string, Row> = {};
    (q.data ?? []).forEach((r) => { m[r.type] = r; });
    return m;
  }, [q.data]);

  const categories = useMemo(() => {
    const groups: Record<string, RiskAssessmentDef[]> = {};
    RISK_ASSESSMENTS.forEach((a) => { (groups[a.category] ||= []).push(a); });
    return groups;
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Eighteen structured risk assessments and three scored tools. Open one to record it. Ratings are the assessor&rsquo;s professional judgement; nothing here calculates a score.
      </p>
      {Object.entries(categories).map(([cat, defs]) => (
        <section key={cat} className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat}</h3>
          {defs.map((def) => {
            const row = byType[def.key];
            const done = row?.status === "complete";
            const overdue = !!row?.review_date && row.review_date < new Date().toISOString().slice(0, 10);
            return (
              <button key={def.key} type="button" onClick={() => setOpen(def)}
                className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left hover:bg-accent/30">
                <span className="text-xs font-medium text-muted-foreground">{def.num}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{def.title}</span>
                    {def.hasLevel && row?.level && <Badge className={`text-[10px] capitalize ${levelClass(row.level)}`}>{row.level}</Badge>}
                    {done ? <Badge variant="outline" className="text-[10px]"><CheckCircle2 className="mr-1 h-3 w-3" />Recorded</Badge>
                          : row ? <Badge variant="secondary" className="text-[10px]">Draft</Badge>
                          : <Badge variant="outline" className="text-[10px] text-muted-foreground">Not started</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row?.updated_at ? `Updated ${format(new Date(row.updated_at), "d MMM yyyy")}` : def.description}
                    {plansFedBy(def.key).length > 0 && <span> · feeds care plan: {plansFedBy(def.key).map((d) => domainLabel(d)).join(", ")}</span>}
                    {row?.review_date && <span className={overdue ? "font-medium text-destructive" : ""}>{" · "}review {format(new Date(row.review_date), "d MMM yyyy")}{overdue ? " · overdue" : ""}</span>}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </section>
      ))}
      <section className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scored tools</h3>
        {SCORED_TOOL_KEYS.map((k) => {
          const row = byType[k];
          const overdue = !!row?.review_date && row.review_date < new Date().toISOString().slice(0, 10);
          return (
            <button key={k} type="button" onClick={() => setTool(k)}
              className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left hover:bg-accent/30">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{SCORED_TOOL_TITLE[k]}</span>
                  {row?.level && <Badge className={`text-[10px] ${levelClass(row.level)}`}>{row.answers?._band ?? row.level}{row.answers?._score != null ? ` (${row.answers._score})` : ""}</Badge>}
                  {!row && <Badge variant="outline" className="text-[10px] text-muted-foreground">Not started</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {row?.updated_at ? `Updated ${format(new Date(row.updated_at), "d MMM yyyy")}` : "Calculates a score from weight, height and the chart boxes."}
                  {" · feeds care plan: "}{plansFedBy(k).map((d) => domainLabel(d)).join(", ")}
                  {row?.review_date && <span className={overdue ? "font-medium text-destructive" : ""}>{" · "}review {format(new Date(row.review_date), "d MMM yyyy")}{overdue ? " · overdue" : ""}</span>}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
        <p className="text-[11px] text-muted-foreground">Waterlow and MUST are published tools. Their scoring is pending clinical sign-off before use with real residents.</p>
      </section>
      {tool && <RiskToolWizard residentId={residentId} residentName={residentName ?? ""} initialTool={tool} onClose={() => setTool(null)} />}
      {open && <RiskAssessmentForm residentId={residentId} def={open} existing={byType[open.key] ?? null} onClose={() => setOpen(null)} />}
    </div>
  );
}

function RiskAssessmentForm({ residentId, def, existing, onClose }: { residentId: string; def: RiskAssessmentDef; existing: Row | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Answers>(existing?.answers ?? {});
  const [level, setLevel] = useState(existing?.level ?? "");
  const [outcome, setOutcome] = useState(existing?.outcome ?? "");
  const [actions, setActions] = useState(existing?.actions ?? "");
  const [interval, setInterval] = useState(existing?.review_interval ?? "");
  const [reviewDate, setReviewDate] = useState(existing?.review_date ?? "");
  const [saving, setSaving] = useState(false);

  const save = async (status: "draft" | "complete") => {
    setSaving(true);
    try {
      const { data: u } = await sb.auth.getUser();
      const payload = {
        resident_id: residentId, type: def.key, title: def.title, category: def.category,
        level: def.hasLevel && level ? level : null,
        answers: visibleAnswers(def, answers), outcome: outcome || null, actions: actions || null,
        review_interval: interval || null, review_date: reviewDate || null,
        status, assessed_by: u.user?.id ?? null, updated_by: u.user?.id ?? null,
      };
      const { error } = await sb.from("resident_risk_assessments").upsert(payload, { onConflict: "resident_id,type" });
      if (error) throw error;
      toast.success(status === "complete" ? "Assessment recorded" : "Draft saved");
      qc.invalidateQueries({ queryKey: ["resident-risk-assessments", residentId] });
      qc.invalidateQueries({ queryKey: ["risks", residentId] });
      qc.invalidateQueries({ queryKey: ["care-plans", residentId] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save — check you have permission to edit risk assessments.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" />{def.title}</DialogTitle>
        </DialogHeader>
        <p className="text-xs italic text-muted-foreground">{def.description}</p>
        <div className="space-y-4">
          {def.hasLevel && (
            <div className="space-y-1.5">
              <Label>Overall risk level (assessor&rsquo;s judgement)</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>{LEVELS.map((l, i) => <SelectItem key={l} value={l} className="capitalize">{def.ratingOptions?.[i] ?? l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {def.sections.map((s, si) => (
            <section key={si} className="space-y-2 rounded-lg border bg-muted/20 p-3">
              {s.title && <h4 className="text-sm font-semibold">{s.title}</h4>}
              {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
              {s.fields.filter((f) => isShown(f, answers)).map((f) => (
                <FieldInput key={f.key} f={f} value={answers[f.key]} onChange={(v) => setAnswers((p) => ({ ...p, [f.key]: v }))} />
              ))}
              {s.prompt && (
                <p className="flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{s.prompt}
                </p>
              )}
            </section>
          ))}
          <div className="space-y-1.5"><Label>Outcome</Label><Textarea rows={2} value={outcome} onChange={(e) => setOutcome(e.target.value)} className="resize-none" /></div>
          <div className="space-y-1.5"><Label>Actions required</Label><Textarea rows={2} value={actions} onChange={(e) => setActions(e.target.value)} className="resize-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Review interval</Label>
              <Select value={interval} onValueChange={(v) => { setInterval(v); const d = reviewDateFromInterval(v); if (d) setReviewDate(d); }}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{INTERVALS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Review date</Label><Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={() => save("draft")} disabled={saving}>Save draft</Button>
          <Button onClick={() => save("complete")} disabled={saving}>{saving ? "Saving…" : "Save assessment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Question helpers -------------------------------------------------------

const matches = (a: Answer | undefined, equals: string | string[]) => {
  const want = Array.isArray(equals) ? equals : [equals];
  const have = Array.isArray(a) ? a : a ? [a] : [];
  return have.some((h) => want.includes(h));
};
const isShown = (f: RAField, answers: Answers) => !f.showIf || matches(answers[f.showIf.id], f.showIf.equals);
function visibleAnswers(def: RiskAssessmentDef, answers: Answers): Answers {
  const out: Answers = {};
  def.sections.forEach((s) => s.fields.forEach((f) => {
    const v = answers[f.key];
    if (isShown(f, answers) && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)) out[f.key] = v;
  }));
  return out;
}

function Choice({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Button key={o} type="button" size="sm" role="radio" aria-checked={value === o}
          variant={value === o ? "default" : "outline"} className="h-8 text-xs"
          onClick={() => onChange(value === o ? "" : o)}>{o}</Button>
      ))}
    </div>
  );
}

function FieldInput({ f, value, onChange }: { f: RAField; value: Answer | undefined; onChange: (v: Answer) => void }) {
  const str = typeof value === "string" ? value : "";
  const arr = Array.isArray(value) ? value : [];
  const opts = f.options ?? [];
  const flagged = f.flag && matches(value, f.flag.equals);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs leading-snug">{f.label}</Label>
      {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
      {(f.type === "yesno" || (f.type === "select" && opts.length <= 3 && opts.every((o) => o.length <= 22))) && (
        <Choice options={opts} value={str} onChange={onChange} />
      )}
      {f.type === "select" && !(opts.length <= 3 && opts.every((o) => o.length <= 22)) && (
        <Select value={str} onValueChange={onChange}>
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {f.type === "multiselect" && (
        <div className="space-y-1.5">
          <p className="text-[11px] italic text-muted-foreground">Tick all that apply</p>
          {opts.map((o) => (
            <label key={o} className="flex cursor-pointer items-start gap-2 text-sm">
              <Checkbox checked={arr.includes(o)} className="mt-0.5"
                onCheckedChange={(c) => onChange(c ? [...arr, o] : arr.filter((x) => x !== o))} />
              <span className="leading-snug">{o}</span>
            </label>
          ))}
        </div>
      )}
      {f.type === "text" && <Input value={str} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm" />}
      {f.type === "number" && (
        <div className="flex items-center gap-2">
          <Input type="number" inputMode="decimal" value={str} onChange={(e) => onChange(e.target.value)} className="h-9 w-32 text-sm" />
          {f.unit && <span className="text-xs text-muted-foreground">{f.unit}</span>}
        </div>
      )}
      {f.type === "date" && <Input type="date" value={str} onChange={(e) => onChange(e.target.value)} className="h-9 w-44 text-sm" />}
      {f.type === "longtext" && <Textarea rows={2} value={str} onChange={(e) => onChange(e.target.value)} className="resize-y text-sm" />}
      {flagged && (
        <p className="flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{f.flag!.message}
        </p>
      )}
    </div>
  );
}
