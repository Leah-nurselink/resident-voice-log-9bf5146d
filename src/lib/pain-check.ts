// Digital Pain Check helpers. Documentation/monitoring only — never a diagnosis.

export const OBSERVATIONS = [
  { key: "facial", label: "Facial expression", hint: "Grimacing, frowning, tense" },
  { key: "vocal", label: "Vocalisation", hint: "Moaning, groaning, calling out" },
  { key: "movement", label: "Body movement", hint: "Rigid, tense, fidgeting" },
  { key: "guarding", label: "Protective / guarding", hint: "Holding or protecting an area" },
  { key: "restless", label: "Restlessness", hint: "Unable to settle, rocking" },
  { key: "activity", label: "Change in activity", hint: "Less mobile, withdrawn" },
  { key: "resist", label: "Resistance to care", hint: "Pulling away, refusing" },
  { key: "behaviour", label: "Behaviour change", hint: "Agitated, confused, quiet" },
  { key: "sleep", label: "Sleep / rest change", hint: "Disturbed or excessive" },
  { key: "distress", label: "Other distress", hint: "Sweating, crying, pallor" },
] as const;
export type ObsKey = (typeof OBSERVATIONS)[number]["key"];
export const OBS_LEVELS = [
  { v: 0, label: "Not seen" },
  { v: 1, label: "Some" },
  { v: 2, label: "Clear" },
] as const;

export const INTERVENTIONS = [
  { key: "repositioning", label: "Repositioning" },
  { key: "comfort", label: "Comfort measures" },
  { key: "personal_care", label: "Personal care adjusted" },
  { key: "prn", label: "Prescribed PRN medication" },
  { key: "other", label: "Other intervention" },
  { key: "escalated", label: "Escalated to nurse/clinician" },
  { key: "none", label: "No intervention required" },
] as const;
export const interventionLabel = (k: string) => INTERVENTIONS.find((i) => i.key === k)?.label ?? k;

export const REASONS = ["Routine check", "During personal care", "Change in behaviour", "Resident reported pain", "After a fall", "Reassessment"];

export type PainLevel = "none" | "mild" | "moderate" | "severe" | "unable";
export const LEVEL_LABEL: Record<PainLevel, string> = {
  none: "No apparent pain", mild: "Mild pain", moderate: "Moderate pain", severe: "Severe pain", unable: "Unable to determine",
};
export const LEVEL_RANK: Record<PainLevel, number | null> = { none: 0, mild: 1, moderate: 2, severe: 3, unable: null };
export const LEVEL_CLASS: Record<PainLevel, string> = {
  none: "bg-success/15 text-success-foreground border border-success/30",
  mild: "bg-warning/15 text-warning-foreground border border-warning/30",
  moderate: "bg-warning/30 text-warning-foreground border border-warning/50",
  severe: "bg-destructive/15 text-destructive border border-destructive/30",
  unable: "bg-muted text-muted-foreground border",
};

export function levelFromSelf(score: number): PainLevel {
  if (score <= 0) return "none";
  if (score <= 3) return "mild";
  if (score <= 6) return "moderate";
  return "severe";
}

export function levelFromObs(obs: Partial<Record<ObsKey, number>>): { level: PainLevel; total: number; factors: string[] } {
  const entries = OBSERVATIONS.map((o) => ({ o, v: obs[o.key] }));
  const answered = entries.filter((e) => e.v != null);
  const total = answered.reduce((s, e) => s + (e.v ?? 0), 0);
  const factors = answered.filter((e) => (e.v ?? 0) > 0).map((e) => `${e.o.label}: ${e.v === 2 ? "clear" : "some"}`);
  if (answered.length < 3) return { level: "unable", total, factors };
  const level: PainLevel = total === 0 ? "none" : total <= 4 ? "mild" : total <= 9 ? "moderate" : "severe";
  return { level, total, factors };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function levelOf(a: any): PainLevel {
  if (a.result && a.result in LEVEL_LABEL) return a.result as PainLevel;
  const s = a.total_score ?? 0; // legacy Abbey Pain scale
  return s <= 2 ? "none" : s <= 7 ? "mild" : s <= 13 ? "moderate" : "severe";
}

export function outcome(before: PainLevel, after: PainLevel): "improved" | "same" | "increased" | null {
  const a = LEVEL_RANK[before], b = LEVEL_RANK[after];
  if (a == null || b == null) return null;
  return b < a ? "improved" : b > a ? "increased" : "same";
}
export const OUTCOME_LABEL = { improved: "Appeared to improve", same: "Remained the same", increased: "Appeared to increase" };

export type PainPattern = { title: string; detail: string };

// Pattern detection over documented records only. Wording is deliberately non-diagnostic.
export function painPatterns(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assessments: any[],
  prnPain: { administered_at: string }[],
): PainPattern[] {
  const now = Date.now(), d7 = now - 7 * 864e5, d14 = now - 14 * 864e5;
  const t = (x: string) => new Date(x).getTime();
  const last7 = assessments.filter((a) => t(a.assessed_at) >= d7);
  const prev7 = assessments.filter((a) => t(a.assessed_at) < d7 && t(a.assessed_at) >= d14);
  const out: PainPattern[] = [];
  const tail = "Pattern identified — clinical review may be appropriate.";
  if (last7.length >= 3 && last7.length > prev7.length)
    out.push({ title: "More pain assessments recorded", detail: `${last7.length} pain assessments were recorded in the last 7 days compared with ${prev7.length} in the previous 7 days. ${tail}` });
  const p7 = prnPain.filter((p) => t(p.administered_at) >= d7).length;
  const pp7 = prnPain.filter((p) => t(p.administered_at) < d7 && t(p.administered_at) >= d14).length;
  if (p7 >= 2 && p7 > pp7)
    out.push({ title: "PRN documented more often", detail: `PRN medication was documented ${p7} times in the last 7 days compared with ${pp7} in the previous 7 days. ${tail}` });
  const linked = last7.filter((a) => a.medication_administration_id || (a.interventions ?? []).includes("prn")).length;
  if (linked >= 2)
    out.push({ title: "PRN following pain assessments", detail: `${linked} PRN administrations were documented following pain assessments in the last 7 days. ${tail}` });
  const pc = last7.filter((a) => a.during_personal_care).length;
  if (pc >= 2)
    out.push({ title: "Pain during personal care", detail: `${pc} pain episodes were recorded during personal care in the last 7 days. ${tail}` });
  const locs = new Map<string, number>();
  for (const a of assessments.filter((a) => t(a.assessed_at) >= d14 && a.location && levelOf(a) !== "none")) {
    const k = String(a.location).trim().toLowerCase();
    locs.set(k, (locs.get(k) ?? 0) + 1);
  }
  for (const [loc, n] of locs) if (n >= 3)
    out.push({ title: "Repeated location", detail: `${n} pain episodes were documented in the same location (${loc}) in the last 14 days. ${tail}` });
  return out;
}
