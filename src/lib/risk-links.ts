// Links between risk assessments (table: resident_risk_assessments) and care plans.
//
// - Which care plan areas each assessment feeds.
// - Plain-text summaries of an assessment's answers, for pulling into a care plan.
// - Review triggers in both directions (see the helpers at the bottom).
//
// Nothing here scores or decides anything. These are prompts for a person to review.
import { RISK_ASSESSMENTS, type RAField, type RiskAssessmentDef } from "./risk-assessments";
import type { CarePlanDomain } from "./care-domains";

/** Scored tools live in the same table, with these type keys. */
export const SCORED_TOOL_KEYS = ["must", "waterlow", "gulp"] as const;
export type ScoredToolKey = (typeof SCORED_TOOL_KEYS)[number];
export const SCORED_TOOL_TITLE: Record<ScoredToolKey, string> = {
  must: "MUST (malnutrition)",
  waterlow: "Waterlow (pressure ulcer risk)",
  gulp: "GULP (dehydration risk)",
};
export const isScoredTool = (t: string): t is ScoredToolKey => (SCORED_TOOL_KEYS as readonly string[]).includes(t);

/** Which care plan areas each assessment feeds. */
export const RA_TO_DOMAINS: Record<string, CarePlanDomain[]> = {
  moving_handling: ["mobility", "personal_care"],
  falls: ["mobility", "safety"],
  peep: ["safety"],
  choking: ["nutrition"],
  skin: ["skin_integrity", "personal_care"],
  nutrition: ["nutrition"],
  allergies: ["nutrition"],
  oral: ["personal_care"],
  continence: ["continence", "skin_integrity"],
  personal_care: ["personal_care"],
  medication: ["medication"],
  communication: ["communication"],
  cultural: ["social"],
  intimacy: ["social"],
  clinical_history: [],
  bed_rail: ["safety", "mobility"],
  hydration: ["nutrition"],
  mca: ["cognition", "mental_health"],
  must: ["nutrition"],
  waterlow: ["skin_integrity", "mobility"],
  gulp: ["nutrition"],
};

export const DOMAIN_TO_RA: Record<string, string[]> = Object.entries(RA_TO_DOMAINS).reduce(
  (acc, [type, domains]) => {
    for (const d of domains) (acc[d] ||= []).push(type);
    return acc;
  },
  {} as Record<string, string[]>,
);

export const raTitle = (type: string) =>
  RISK_ASSESSMENTS.find((a) => a.key === type)?.title ?? (isScoredTool(type) ? SCORED_TOOL_TITLE[type] : type);

export type RARow = {
  id: string;
  resident_id?: string;
  type: string;
  level: string | null;
  status?: string | null;
  answers?: Record<string, unknown> | null;
  outcome?: string | null;
  actions?: string | null;
  review_date?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

const stamp = (r: RARow) => (r.updated_at ?? r.created_at ?? "").slice(0, 10);

// ---------------------------------------------------------------------------
// Summaries for care plans
// ---------------------------------------------------------------------------

const cleanLabel = (s: string) => s.replace(/\s+/g, " ").replace(/\?$/, "").trim();
const asText = (v: unknown): string =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string").join(", ") : typeof v === "string" ? v.trim() : "";

/** Answered questions as "Question: answer" lines. "No" answers are left out; they are not concerns. */
export function answeredLines(def: RiskAssessmentDef, answers: Record<string, unknown> | null | undefined): string[] {
  if (!answers) return [];
  const lines: string[] = [];
  def.sections.forEach((s) =>
    s.fields.forEach((f: RAField) => {
      const t = asText(answers[f.key]);
      if (!t) return;
      if (f.type === "yesno" && t === "No") return;
      if (f.type === "multiselect" && t === "None of these") return;
      lines.push(f.type === "yesno" && t === "Yes" ? cleanLabel(f.label) : `${cleanLabel(f.label)}: ${t}`);
    }),
  );
  return lines;
}

/** What the person was assessed as, in words, for the care plan "risks" text. */
export function assessmentFactors(row: RARow, max = 1800): string {
  const scored = isScoredTool(row.type);
  if (scored) {
    const a = (row.answers ?? {}) as Record<string, unknown>;
    return asText(a._summary) || asText(a._band) || "";
  }
  const def = RISK_ASSESSMENTS.find((x) => x.key === row.type);
  const text = def ? answeredLines(def, row.answers).map((l) => `- ${l}`).join("\n") : "";
  return text.slice(0, max);
}

/** What staff will do about it, for the care plan "plan of care" text. */
export function assessmentControls(row: RARow): string {
  return [row.outcome, row.actions].map((x) => (x ?? "").trim()).filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// Review triggers
// ---------------------------------------------------------------------------

export type PlanLike = { domain: string; last_review?: string | null };
export type RiskTrigger = { row: RARow; reason: "reviewed" | "overdue" };

/**
 * Risk assessment → care plan.
 * A care plan needs reviewing when a linked assessment
 *  - has been recorded or reviewed since the plan was last reviewed ("reviewed"), or
 *  - has passed its own review date ("overdue").
 * Drafts do not count. Reviewing the plan (saving it) clears the first reason.
 */
export function risksTriggeringPlan(plan: PlanLike | undefined, domain: string, risks: RARow[], today = new Date().toISOString().slice(0, 10)): RiskTrigger[] {
  const types = DOMAIN_TO_RA[domain] ?? [];
  const out: RiskTrigger[] = [];
  for (const r of risks) {
    if (!types.includes(r.type) || r.status === "draft") continue;
    if (r.review_date && r.review_date < today) out.push({ row: r, reason: "overdue" });
    else if (plan?.last_review && stamp(r) > plan.last_review) out.push({ row: r, reason: "reviewed" });
  }
  return out;
}

/** Care plan areas an assessment feeds, as labels' keys. */
export const plansFedBy = (type: string): CarePlanDomain[] => RA_TO_DOMAINS[type] ?? [];

/** Calendar date for the next review, from the interval text used in the form. */
export function reviewDateFromInterval(interval: string, from = new Date()): string {
  const m = interval.match(/^(\d+)\s*month/);
  if (!m) return "";
  const d = new Date(from);
  d.setMonth(d.getMonth() + parseInt(m[1], 10));
  return d.toISOString().slice(0, 10);
}
