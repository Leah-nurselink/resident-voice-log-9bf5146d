import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import {
  PA_SECTIONS, PA_RISK_MAP, DECISIONS, answersForDomain, prefillFromResident, type PAAnswers,
} from "@/lib/pre-assessment";
import type { CarePlanDomain } from "@/lib/care-domains";

export function usePreAssessments(residentId: string) {
  return useQuery({
    queryKey: ["pre-assessments", residentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("pre_assessments").select("*")
        .eq("resident_id", residentId).order("version", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function PreAssessmentTab({ resident }: { resident: any }) {
  const qc = useQueryClient();
  const list = usePreAssessments(resident.id);
  const current = list.data?.[0];
  const [answers, setAnswers] = useState<PAAnswers>({});
  const [meta, setMeta] = useState({ decision: "", decision_rationale: "", assessor_name: "", assessor_role: "", assessed_on: "" });
  const [step, setStep] = useState(0);
  const locked = current?.status === "approved";

  useEffect(() => {
    if (!current) return;
    setAnswers((current.answers ?? {}) as PAAnswers);
    setMeta({
      decision: current.decision ?? "", decision_rationale: current.decision_rationale ?? "",
      assessor_name: current.assessor_name ?? "", assessor_role: current.assessor_role ?? "", assessed_on: current.assessed_on ?? "",
    });
  }, [current?.id, current?.updated_at]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["pre-assessments", resident.id] });
  const fail = (e: Error) => toast.error(e.message);

  const create = useMutation({
    mutationFn: async () => {
      const base = current ? { ...(current.answers as PAAnswers) } : prefillFromResident(resident);
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("pre_assessments").insert({
        resident_id: resident.id, version: (current?.version ?? 0) + 1, answers: base as never, assessor_id: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pre-assessment started"); setStep(0); refresh(); }, onError: fail,
  });

  const save = useMutation({
    mutationFn: async (status?: "submitted" | "approved") => {
      const patch: any = { answers, ...meta, decision: meta.decision || null, assessed_on: meta.assessed_on || null };
      if (status) patch.status = status;
      if (status === "submitted") patch.submitted_at = new Date().toISOString();
      const { error } = await supabase.from("pre_assessments").update(patch).eq("id", current!.id);
      if (error) throw error;
      return status;
    },
    onSuccess: (s) => { toast.success(s === "approved" ? "Signed off and locked" : s === "submitted" ? "Submitted for sign-off" : "Saved"); refresh(); },
    onError: fail,
  });

  if (list.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!current) return (
    <div className="rounded-2xl border border-dashed p-8 text-center">
      <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-2 text-sm">No pre-assessment yet.</p>
      <p className="text-xs text-muted-foreground">Details already on this record will be filled in for you.</p>
      <Button className="mt-4" onClick={() => create.mutate()} disabled={create.isPending}>Start pre-assessment</Button>
    </div>
  );

  const section = PA_SECTIONS[step];
  const set = (id: string, v: string | boolean) => setAnswers((a) => ({ ...a, [id]: v }));
  const go = (n: number) => { if (!locked) save.mutate(undefined); setStep(n); };
  const isLast = step === PA_SECTIONS.length - 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Version {current.version}</Badge>
        <Badge variant={locked ? "default" : "secondary"}>
          {locked ? <><Lock className="mr-1 h-3 w-3" />Signed off</> : current.status === "submitted" ? "Awaiting sign-off" : "Draft"}
        </Badge>
        {locked && <Button size="sm" variant="outline" className="ml-auto" onClick={() => create.mutate()}>Start new version</Button>}
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {PA_SECTIONS.map((s, i) => (
          <button key={s.id} onClick={() => go(i)} className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${i === step ? "bg-primary text-primary-foreground" : "bg-card"}`}>
            {i + 1}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{section.title}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {section.questions.map((q) => {
            const v = answers[q.id];
            return (
              <div key={q.id} className="space-y-1.5">
                {q.type !== "check" && <label className="text-sm font-medium">{q.label}</label>}
                {q.type === "text" && <Textarea rows={2} disabled={locked} value={(v as string) ?? ""} onChange={(e) => set(q.id, e.target.value)} />}
                {(q.type === "yesno" || q.type === "choice") && (
                  <div className="flex flex-wrap gap-2">
                    {(q.type === "yesno" ? ["Yes", "No", "Unknown"] : q.options!).map((o) => (
                      <Button key={o} type="button" size="sm" disabled={locked} variant={v === o ? "default" : "outline"} onClick={() => set(q.id, o)}>{o}</Button>
                    ))}
                  </div>
                )}
                {q.type === "check" && (
                  <label className="flex min-h-10 items-center gap-2 text-sm">
                    <Checkbox disabled={locked} checked={v === true} onCheckedChange={(c) => set(q.id, c === true)} />{q.label}
                  </label>
                )}
              </div>
            );
          })}

          {section.id === "decision" && (
            <div className="space-y-3 border-t pt-4">
              <label className="text-sm font-medium">Decision</label>
              <div className="flex flex-wrap gap-2">
                {DECISIONS.map((d) => (
                  <Button key={d.id} size="sm" disabled={locked} variant={meta.decision === d.id ? "default" : "outline"} onClick={() => setMeta({ ...meta, decision: d.id })}>{d.label}</Button>
                ))}
              </div>
              <Textarea placeholder="Rationale for decision" disabled={locked} value={meta.decision_rationale} onChange={(e) => setMeta({ ...meta, decision_rationale: e.target.value })} />
              <div className="grid gap-2 sm:grid-cols-3">
                <Input placeholder="Assessor name" disabled={locked} value={meta.assessor_name} onChange={(e) => setMeta({ ...meta, assessor_name: e.target.value })} />
                <Input placeholder="Role" disabled={locked} value={meta.assessor_role} onChange={(e) => setMeta({ ...meta, assessor_role: e.target.value })} />
                <Input type="date" disabled={locked} value={meta.assessed_on} onChange={(e) => setMeta({ ...meta, assessed_on: e.target.value })} />
              </div>
              {!locked && (
                <div className="flex flex-wrap gap-2">
                  {current.status === "draft" && <Button disabled={!meta.decision || !meta.assessor_name} onClick={() => save.mutate("submitted")}>Submit for sign-off</Button>}
                  {current.status === "submitted" && <Button onClick={() => save.mutate("approved")}>Sign off (manager / clinical lead)</Button>}
                </div>
              )}
              {locked && <p className="text-xs text-muted-foreground">Signed off {current.approved_at && new Date(current.approved_at).toLocaleString()}. Answers now inform care plans and CareCore AI drafts.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="outline" disabled={step === 0} onClick={() => go(step - 1)}><ChevronLeft className="h-4 w-4" />Back</Button>
        {!locked && <Button variant="secondary" onClick={() => save.mutate(undefined)} disabled={save.isPending}>Save</Button>}
        <Button variant="outline" disabled={isLast} onClick={() => go(step + 1)}>Next<ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

/** Answers relevant to one care area, from the latest signed-off pre-assessment. */
export function PreAssessmentHints({ residentId, domain }: { residentId: string; domain: CarePlanDomain }) {
  const list = usePreAssessments(residentId);
  const pa = list.data?.find((p) => p.status === "approved");
  if (!pa) return null;
  const items = answersForDomain(pa.answers as PAAnswers, domain);
  if (!items.length) return null;
  return (
    <details className="rounded-lg border bg-muted/40 px-3 py-2 text-xs">
      <summary className="cursor-pointer font-medium">From pre-assessment ({items.length})</summary>
      <ul className="mt-2 space-y-1">
        {items.map((i) => <li key={i.label}><span className="text-muted-foreground">{i.label}:</span> {i.value}</li>)}
      </ul>
    </details>
  );
}

/** Risk assessments flagged at pre-assessment that are not yet recorded. */
export function PreAssessmentRiskPrompts({ residentId, doneTypes }: { residentId: string; doneTypes: string[] }) {
  const list = usePreAssessments(residentId);
  const pa = list.data?.find((p) => p.status === "approved") ?? list.data?.[0];
  if (!pa) return null;
  const a = pa.answers as PAAnswers;
  const missing = Object.entries(PA_RISK_MAP).filter(([q, t]) => a[q] === true && !doneTypes.includes(t));
  if (!missing.length) return null;
  const labels = missing.map(([q]) => PA_SECTIONS.find((s) => s.id === "risks")!.questions.find((x) => x.id === q)!.label);
  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
      Flagged at pre-assessment, not yet completed: <strong>{labels.join(", ")}</strong>
    </div>
  );
}
