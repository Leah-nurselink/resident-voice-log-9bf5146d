import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { analyzeAbbeyPain } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Activity, Sparkles, Plus, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const DOMAINS = [
  { key: "vocalisation", label: "Vocalisation", hint: "Whimpering, groaning, crying, calling out" },
  { key: "facial_expression", label: "Facial expression", hint: "Tense, frowning, grimacing, frightened" },
  { key: "body_language", label: "Body language", hint: "Fidgeting, rocking, guarding, withdrawn" },
  { key: "behaviour_change", label: "Behaviour change", hint: "Confusion, refusing care, alteration in routine" },
  { key: "physiological_change", label: "Physiological change", hint: "Temp, pulse, BP, sweating, pallor outside normal range" },
  { key: "physical_change", label: "Physical change", hint: "Skin tears, pressure injuries, arthritis, contractures, previous injuries" },
] as const;

type DomainKey = typeof DOMAINS[number]["key"];

function severityFromScore(s: number) {
  if (s <= 2) return { label: "No pain", className: "bg-success/15 text-success-foreground border-success/30 border" };
  if (s <= 7) return { label: "Mild pain", className: "bg-warning/15 text-warning-foreground border-warning/30 border" };
  if (s <= 13) return { label: "Moderate pain", className: "bg-warning/30 text-warning-foreground border-warning/50 border" };
  return { label: "Severe pain", className: "bg-destructive/15 text-destructive border-destructive/30 border" };
}

export function PainTab({ residentId, residentName }: { residentId: string; residentName: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const assessments = useQuery({
    queryKey: ["pain", residentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pain_assessments").select("*").eq("resident_id", residentId)
        .order("assessed_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const latest = assessments.data?.[0];
  const trend = useMemo(() => {
    if (!assessments.data || assessments.data.length < 2) return null;
    const recent = assessments.data.slice(0, 5).map((a) => a.total_score);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = assessments.data.slice(5, 10).map((a) => a.total_score);
    if (!older.length) return null;
    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;
    return avgRecent - avgOlder;
  }, [assessments.data]);

  return (
    <div className="space-y-3">
      <Button onClick={() => setOpen(true)} className="w-full"><Plus className="mr-1 h-4 w-4" />New Abbey Pain assessment</Button>

      {latest && (
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Current pain status</div>
              <div className="mt-1 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-2xl font-semibold">{latest.total_score}</span>
                <Badge className={severityFromScore(latest.total_score).className}>
                  {severityFromScore(latest.total_score).label}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {format(new Date(latest.assessed_at), "d MMM yyyy HH:mm")}
              </div>
            </div>
            {trend !== null && (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">30-day trend</div>
                <div className="mt-1 flex items-center gap-1">
                  {trend > 0.5 ? <TrendingUp className="h-4 w-4 text-destructive" /> :
                    trend < -0.5 ? <TrendingDown className="h-4 w-4 text-success" /> :
                    <Minus className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-sm font-medium">{trend > 0 ? "+" : ""}{trend.toFixed(1)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {assessments.data?.length ? (
        <ul className="space-y-2">
          {assessments.data.map((a) => {
            const sev = severityFromScore(a.total_score);
            return (
              <li key={a.id} className="rounded-2xl border bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">{format(new Date(a.assessed_at), "d MMM yyyy HH:mm")}</div>
                  <div className="flex items-center gap-1.5">
                    {a.source === "ai_assisted" && <Badge variant="outline" className="text-[10px]"><Sparkles className="mr-1 h-3 w-3" />AI</Badge>}
                    <Badge className={sev.className}>Score {a.total_score} · {sev.label}</Badge>
                  </div>
                </div>
                {a.notes && <p className="mt-2 text-sm">{a.notes}</p>}
                <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
                  <span>Voc {a.vocalisation}</span>
                  <span>Face {a.facial_expression}</span>
                  <span>Body {a.body_language}</span>
                  <span>Behav {a.behaviour_change}</span>
                  <span>Physiol {a.physiological_change}</span>
                  <span>Phys {a.physical_change}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-1 text-sm text-muted-foreground">No pain assessments recorded yet.</p>
      )}

      {open && (
        <PainDialog residentId={residentId} residentName={residentName} onClose={() => {
          setOpen(false);
          qc.invalidateQueries({ queryKey: ["pain", residentId] });
        }} />
      )}
    </div>
  );
}

function PainDialog({ residentId, residentName, onClose }: { residentId: string; residentName: string; onClose: () => void }) {
  const analyze = useServerFn(analyzeAbbeyPain);
  const [scores, setScores] = useState<Record<DomainKey, number>>({
    vocalisation: 0, facial_expression: 0, body_language: 0,
    behaviour_change: 0, physiological_change: 0, physical_change: 0,
  });
  const [notes, setNotes] = useState("");
  const [painType, setPainType] = useState<string>("");
  const [transcript, setTranscript] = useState("");
  const [aiEvidence, setAiEvidence] = useState<Record<string, string> | null>(null);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [source, setSource] = useState<"manual" | "ai_assisted">("manual");

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const sev = severityFromScore(total);

  const aiSuggest = useMutation({
    mutationFn: async () => {
      // pull last 10 notes for context
      const { data: notesData } = await supabase
        .from("daily_notes").select("content,created_at")
        .eq("resident_id", residentId)
        .order("created_at", { ascending: false }).limit(10);
      const recentNotes = (notesData ?? []).map((n) => n.content as string).filter(Boolean);
      return await analyze({ data: { residentName, transcript, recentNotes } });
    },
    onSuccess: (out: any) => {
      setScores({
        vocalisation: out.vocalisation.score,
        facial_expression: out.facial_expression.score,
        body_language: out.body_language.score,
        behaviour_change: out.behaviour_change.score,
        physiological_change: out.physiological_change.score,
        physical_change: out.physical_change.score,
      });
      setAiEvidence({
        vocalisation: out.vocalisation.evidence,
        facial_expression: out.facial_expression.evidence,
        body_language: out.body_language.evidence,
        behaviour_change: out.behaviour_change.evidence,
        physiological_change: out.physiological_change.evidence,
        physical_change: out.physical_change.evidence,
      });
      setAiConfidence(out.confidence);
      setAiSummary(out.summary);
      setSource("ai_assisted");
      toast.success("AI suggestions ready — please review");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "AI failed"),
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const sevLabel = total <= 2 ? "none" : total <= 7 ? "mild" : total <= 13 ? "moderate" : "severe";
      const { error } = await supabase.from("pain_assessments").insert({
        resident_id: residentId,
        assessed_by: u.user!.id,
        ...scores,
        total_score: total,
        severity: sevLabel,
        pain_type: painType || null,
        source,
        ai_confidence: aiConfidence,
        ai_evidence: aiEvidence,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pain assessment saved"); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Abbey Pain assessment</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Care session / observations (for AI analysis)</Label>
            <Textarea rows={3} value={transcript} onChange={(e) => setTranscript(e.target.value)}
              placeholder="e.g. Mary was moaning when repositioned and guarding her left hip…" />
            <Button size="sm" variant="outline" className="mt-2 w-full"
              onClick={() => aiSuggest.mutate()} disabled={aiSuggest.isPending}>
              <Sparkles className="mr-1 h-4 w-4" />
              {aiSuggest.isPending ? "Analysing…" : "AI suggest scores"}
            </Button>
            {aiSummary && (
              <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs">
                <div className="font-medium text-primary">AI summary {aiConfidence != null && `· ${Math.round(aiConfidence * 100)}% confidence`}</div>
                <p className="mt-1 text-muted-foreground">{aiSummary}</p>
              </div>
            )}
          </div>

          {DOMAINS.map((d) => (
            <div key={d.key} className="rounded-lg border p-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{d.label}</div>
                  <div className="text-[11px] text-muted-foreground">{d.hint}</div>
                </div>
                <Select value={String(scores[d.key])} onValueChange={(v) => setScores((s) => ({ ...s, [d.key]: Number(v) }))}>
                  <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {aiEvidence?.[d.key] && (
                <p className="mt-1 text-[11px] italic text-muted-foreground">AI: {aiEvidence[d.key]}</p>
              )}
            </div>
          ))}

          <div>
            <Label className="text-xs">Pain type</Label>
            <Select value={painType} onValueChange={setPainType}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="chronic">Chronic</SelectItem>
                <SelectItem value="acute">Acute</SelectItem>
                <SelectItem value="both">Chronic + acute episode</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Clinical notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total score</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-semibold">{total}</span>
                <Badge className={sev.className}>{sev.label}</Badge>
              </div>
            </div>
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
