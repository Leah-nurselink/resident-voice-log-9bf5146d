/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  RISK_TOOL_LABEL, type RiskTool, type Group,
  WATERLOW_GROUPS, computeWaterlow, WATERLOW_ACTION,
  GULP_GROUPS, computeGULP, GULP_ACTION,
  computeMUST, MUST_ACTION, bmi, weightLossPct,
  type FallsInputs,
  TOOL_TO_RISK_TYPE, type RiskBandLevel,
  STRUCTURED_TOOLS, isStructured, summariseStructured, type ExtendedTool,
} from "@/lib/risk-tools";

const LEVEL_CLASS: Record<RiskBandLevel, string> = {
  low: "bg-success/15 text-success-foreground border border-success/30",
  medium: "bg-warning/20 text-warning-foreground border border-warning/40",
  high: "bg-destructive/15 text-destructive border border-destructive/30",
};

const TOOLS: ExtendedTool[] = ["waterlow", "must", "gulp", "falls_mfra", "tile_mh", "continence", "bedrails", "mca", "behaviour_abc"];
const toolLabel = (t: ExtendedTool) => isStructured(t) ? STRUCTURED_TOOLS[t].label : RISK_TOOL_LABEL[t as RiskTool];

function Big({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-medium ${active ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
      {children}
    </button>
  );
}

/** Renders one scored group — single-select, or multi-select when group.multi. */
function GroupField({ group, value, onChange }: {
  group: Group; value: string | string[] | undefined; onChange: (v: string | string[]) => void;
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const toggle = (optValue: string) => {
    if (group.multi) {
      onChange(selected.includes(optValue) ? selected.filter((x) => x !== optValue) : [...selected, optValue]);
    } else {
      onChange(optValue);
    }
  };
  return (
    <div className="rounded-xl border p-2">
      <p className="mb-1.5 text-sm font-medium">{group.label}{group.multi ? <span className="text-[11px] font-normal text-muted-foreground"> — select all that apply</span> : null}</p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {group.options.map((o) => (
          <Big key={o.value} active={selected.includes(o.value)} onClick={() => toggle(o.value)}>
            <span className="flex items-center justify-between gap-2">
              <span>{o.label}</span>
              <span className="shrink-0 text-xs tabular-nums opacity-70">{o.points}</span>
            </span>
          </Big>
        ))}
      </div>
    </div>
  );
}

function ResultBadge({ level, score, band }: { level: RiskBandLevel; score: number | null; band: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge className={LEVEL_CLASS[level]}>{band ?? (level === "high" ? "At increased risk" : "Not at increased risk")}</Badge>
      {score != null && <span className="text-sm font-semibold tabular-nums">Score: {score}</span>}
    </div>
  );
}

export function RiskToolWizard({ residentId, residentName, onClose }: {
  residentId: string; residentName: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [tool, setTool] = useState<ExtendedTool | null>(null);

  // Shared
  const [reviewDate, setReviewDate] = useState(format(new Date(Date.now() + 30 * 864e5), "yyyy-MM-dd"));
  const [plan, setPlan] = useState("");

  // Waterlow / GULP selections
  const [sel, setSel] = useState<Record<string, string | string[]>>({});
  // MUST
  const [must, setMust] = useState<{ weightKg?: string; heightCm?: string; usualWeightKg?: string; acute?: boolean }>({});
  // Falls
  const [falls, setFalls] = useState<FallsInputs>({ factors: {}, overallConcern: "not_at_risk", plan: "" });

  const reset = () => { setSel({}); setMust({}); setFalls({ factors: {}, overallConcern: "not_at_risk", plan: "" }); setPlan(""); };

  const mustInputs = useMemo(() => ({
    weightKg: must.weightKg ? parseFloat(must.weightKg) : undefined,
    heightCm: must.heightCm ? parseFloat(must.heightCm) : undefined,
    usualWeightKg: must.usualWeightKg ? parseFloat(must.usualWeightKg) : undefined,
    acuteNoIntake: must.acute ?? false,
  }), [must]);

  const result = useMemo(() => {
    if (tool === "waterlow") return computeWaterlow(sel);
    if (tool === "gulp") return computeGULP({ fluid: sel.fluid as string, urine: sel.urine as string, signs: sel.signs as string });
    if (tool === "must") return computeMUST(mustInputs);
    if (tool && isStructured(tool)) return summariseStructured(tool, falls);
    return null;
  }, [tool, sel, mustInputs, falls]);

  const action = useMemo(() => {
    if (!result) return "";
    if (tool === "waterlow") return WATERLOW_ACTION[result.level];
    if (tool === "gulp") return GULP_ACTION[result.level];
    if (tool === "must") return MUST_ACTION[result.level];
    return tool && isStructured(tool) ? STRUCTURED_TOOLS[tool].guidance : "";
  }, [tool, result]);

  const bmiValue = bmi(mustInputs.weightKg ?? 0, mustInputs.heightCm ?? 0);
  const lossPct = weightLossPct(mustInputs.usualWeightKg ?? 0, mustInputs.weightKg ?? 0);

  const canSave = (() => {
    if (!tool || !result) return false;
    if (tool === "waterlow") return !!sel.build && !!sel.sex && !!sel.age && !!sel.mobility && !!sel.continence;
    if (tool === "gulp") return !!sel.fluid && !!sel.urine && !!sel.signs;
    if (tool === "must") return mustInputs.weightKg != null && mustInputs.heightCm != null;
    if (isStructured(tool)) return true;
    return false;
  })();

  const save = useMutation({
    mutationFn: async () => {
      if (!tool || !result) throw new Error("Nothing to save");
      const { data: u } = await supabase.auth.getUser();
      const inputs =
        tool === "must" ? mustInputs :
        isStructured(tool) ? falls :
        sel;
      const factors =
        isStructured(tool)
          ? STRUCTURED_TOOLS[tool].factors.filter((f) => falls.factors[f.key]?.present)
              .map((f) => f.label + (falls.factors[f.key]?.note ? `: ${falls.factors[f.key]!.note}` : "")).join("; ")
          : result.summary;
      const { error } = await supabase.from("risk_assessments").insert({
        resident_id: residentId,
        type: isStructured(tool) ? STRUCTURED_TOOLS[tool].type : TOOL_TO_RISK_TYPE[tool as RiskTool],
        level: result.level,
        tool,
        tool_version: result.version,
        inputs,
        score: result.score,
        band: result.band,
        factors: factors || null,
        controls: (isStructured(tool) ? falls.plan : plan) || null,
        review_date: reviewDate || null,
        updated_by: u.user?.id ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Risk assessment saved"); qc.invalidateQueries({ queryKey: ["risk", residentId] }); onClose(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Risk assessment · {residentName}</DialogTitle>
          <p className="text-xs text-muted-foreground">{tool ? toolLabel(tool) : "Choose a recognised NHS / NICE / HSE / MHRA tool"}</p>
        </DialogHeader>

        {!tool && (
          <div className="grid gap-2">
            {TOOLS.map((t) => <Big key={t} onClick={() => { reset(); setTool(t); }}>{toolLabel(t)}</Big>)}
          </div>
        )}

        {tool && (
          <div className="space-y-3">
            {/* MUST */}
            {tool === "must" && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-xs">Weight (kg)<Input inputMode="decimal" value={must.weightKg ?? ""} onChange={(e) => setMust({ ...must, weightKg: e.target.value })} /></label>
                  <label className="text-xs">Height (cm)<Input inputMode="decimal" value={must.heightCm ?? ""} onChange={(e) => setMust({ ...must, heightCm: e.target.value })} /></label>
                  <label className="text-xs">Usual weight (kg)<Input inputMode="decimal" value={must.usualWeightKg ?? ""} onChange={(e) => setMust({ ...must, usualWeightKg: e.target.value })} /></label>
                </div>
                <div className="rounded-xl border bg-muted/30 p-2 text-sm">
                  BMI: <b>{bmiValue != null ? bmiValue.toFixed(1) : "—"}</b>
                  {lossPct != null && <> · Unplanned weight loss: <b>{lossPct.toFixed(1)}%</b></>}
                </div>
                <Big active={!!must.acute} onClick={() => setMust({ ...must, acute: !must.acute })}>
                  Acutely unwell AND no / likely no intake &gt; 5 days (rare)
                </Big>
              </div>
            )}

            {/* GULP */}
            {tool === "gulp" && GULP_GROUPS.map((g) => (
              <GroupField key={g.key} group={g} value={sel[g.key]} onChange={(v) => setSel({ ...sel, [g.key]: v })} />
            ))}

            {/* Waterlow */}
            {tool === "waterlow" && (
              <>
                <p className="rounded-lg border border-warning/40 bg-warning/10 p-2 text-[11px]">Verify point values against your official Waterlow card. Scoring version: {computeWaterlow(sel).version}.</p>
                {WATERLOW_GROUPS.map((g) => (
                  <GroupField key={g.key} group={g} value={sel[g.key]} onChange={(v) => setSel({ ...sel, [g.key]: v })} />
                ))}
              </>
            )}

            {/* Falls — structured, no score */}
            {tool && isStructured(tool) && (
              <div className="space-y-2">
                <p className="rounded-lg border bg-muted/30 p-2 text-[11px]">{STRUCTURED_TOOLS[tool].guidance} Mark each factor and record the plan.</p>
                {STRUCTURED_TOOLS[tool].factors.map((f) => {
                  const entry = falls.factors[f.key] ?? { present: false };
                  return (
                    <div key={f.key} className="rounded-xl border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div><p className="text-sm font-medium">{f.label}</p>{f.hint && <p className="text-[11px] text-muted-foreground">{f.hint}</p>}</div>
                        <Big active={entry.present} onClick={() => setFalls({ ...falls, factors: { ...falls.factors, [f.key]: { ...entry, present: !entry.present } } })}>
                          {entry.present ? "Concern" : "No concern"}
                        </Big>
                      </div>
                      {entry.present && (
                        <Input className="mt-1.5" placeholder="Detail (optional)" value={entry.note ?? ""}
                          onChange={(e) => setFalls({ ...falls, factors: { ...falls.factors, [f.key]: { ...entry, note: e.target.value } } })} />
                      )}
                    </div>
                  );
                })}
                <div className="grid grid-cols-2 gap-2">
                  <Big active={falls.overallConcern === "not_at_risk"} onClick={() => setFalls({ ...falls, overallConcern: "not_at_risk" })}>{STRUCTURED_TOOLS[tool].notAtRiskLabel}</Big>
                  <Big active={falls.overallConcern === "at_risk"} onClick={() => setFalls({ ...falls, overallConcern: "at_risk" })}>{STRUCTURED_TOOLS[tool].atRiskLabel}</Big>
                </div>
                <Textarea rows={3} placeholder="Agreed plan / controls" value={falls.plan ?? ""} onChange={(e) => setFalls({ ...falls, plan: e.target.value })} />
              </div>
            )}

            {/* Live result */}
            {result && (
              <div className="rounded-2xl border bg-muted/30 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide">Result</p>
                <div className="mt-1"><ResultBadge level={result.level} score={result.score} band={result.band} /></div>
                {action && <p className="mt-2 text-xs text-muted-foreground">{action}</p>}
              </div>
            )}

            {/* Plan (scored tools) + review date */}
            {!isStructured(tool) && (
              <Textarea rows={2} placeholder="Controls / actions (optional)" value={plan} onChange={(e) => setPlan(e.target.value)} />
            )}
            <label className="block text-xs">Review date<Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} /></label>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="h-11 flex-1" onClick={() => setTool(null)}>Back</Button>
              <Button className="h-11 flex-1" disabled={!canSave || save.isPending} onClick={() => save.mutate()}>Save assessment</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
