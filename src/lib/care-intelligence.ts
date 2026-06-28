// ForgeAI Care Intelligence Engine
// Pure client-side analysis over existing care records. Advisory only —
// every recommendation must be reviewed by a clinician.

import { differenceInDays, subDays } from "date-fns";

export type IntelNote = {
  id: string;
  created_at: string;
  content: string;
  domain: string | null;
  risks: string[] | null;
  flags: string[] | null;
};

export type IntelPlan = { id: string; domain: string; updated_at: string };
export type IntelRisk = { id: string; type: string; level: string | null; updated_at: string };

export type Trend = "improving" | "stable" | "declining";
export type Confidence = "Low" | "Medium" | "High";

export type Evidence = { date: string; kind: string; snippet: string };

export type DomainTrend = {
  key: string;
  label: string;
  recent: number;
  prior: number;
  concern: number;
  trend: Trend;
  message: string;
  evidence: Evidence[];
};

export type RiskPrediction = {
  key: "falls" | "choking" | "pressure" | "nutrition" | "behaviour";
  label: string;
  score: number;             // 0..1
  confidence: Confidence;
  signals: string[];
  recommendation: string;
  evidence: Evidence[];
};

export type Recommendation = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  evidence: Evidence[];
};

export type DeteriorationSignal = {
  key: "appetite" | "confusion" | "falls" | "withdrawal" | "sleep" | "mobility" | "personal_care";
  label: string;
  recent: number;
  prior: number;
  trend: Trend;
  message: string;
  evidence: Evidence[];
};

export type CareGap = {
  domain: string;
  kind: "missing_plan" | "stale_plan";
  message: string;
  evidence: Evidence[];
};

export type TimelinePrediction = {
  horizon: "Next 7 days" | "Next 30 days";
  title: string;
  likelihood: Confidence;
  rationale: string;
  evidence: Evidence[];
};

export type ResidentIntelligence = {
  wellbeing: { score: number; trend: Trend; label: string; evidence: Evidence[] };
  domains: DomainTrend[];
  risks: RiskPrediction[];
  planReviews: { domain: string; reason: string; evidence: Evidence[] }[];
  safeguarding: { signal: string; count: number; evidence: Evidence[] }[];
  recommendations: Recommendation[];
  deterioration: DeteriorationSignal[];
  careGaps: CareGap[];
  predictions: TimelinePrediction[];
  noteCount: number;
};

// -----------------------------------------------------------------------------
// Keyword lexicons. Lightweight, deterministic, UK care vocabulary.
// -----------------------------------------------------------------------------

const POS = /\b(settled|happy|engaged|enjoyed|smiling|calm|ate well|good appetite|sociable|chatty|alert|comfortable|sleeping well|independent|steady)\b/gi;
const NEG = /\b(refused|declined|agitated|distressed|low mood|withdrawn|tearful|anxious|pain|sore|tired|lethargic|confused|unsettled|aggressive|wandering)\b/gi;

const DOMAIN_LEX: Record<string, RegExp> = {
  mobility: /\b(unsteady|stumbl|fell|fall|balance|hoist|transfer|walk|frame|zimmer|wheelchair|near miss)\b/i,
  nutrition: /\b(refused (meal|food|drink)|poor (intake|appetite)|lost weight|weight loss|didn'?t eat|left (most|half)|fluids? declined)\b/i,
  sleep: /\b(awake|restless|did not sleep|poor sleep|nightmare|insomnia|wander(ed|ing) at night)\b/i,
  social: /\b(withdrawn|isolated|alone|declined activity|stayed in room|no engagement)\b/i,
  mental_health: /\b(low mood|tearful|anxious|depressed|hopeless|distressed)\b/i,
  cognition: /\b(confused|disorient|repeat(ing)? questions|forgot|memory)\b/i,
  skin_integrity: /\b(red(ness)?|sore|broken skin|pressure|bruis|skin tear|wound)\b/i,
  continence: /\b(incontinent|wet|soiled|UTI|urinary|catheter)\b/i,
};

const RISK_LEX = {
  falls: /\b(fell|fall|stumbl|unsteady|loss of balance|near miss|trip(ped)?|slipp(ed)?)\b/i,
  choking: /\b(chok(ed|ing)?|cough(ed|ing) (at|during) (meal|food|drink)|difficulty swallow|dysphag|SALT|aspirat)\b/i,
  pressure: /\b(red(ness)? on (heel|sacrum|hip|back)|pressure|sore|skin break|bedridden|reposition|immobile)\b/i,
  nutrition: /\b(refused (meal|food)|poor intake|weight loss|didn'?t eat|dehydrat)\b/i,
  behaviour: /\b(aggressi|shout(ed|ing)|hit|kick|distressed|agitat|verbal abuse)\b/i,
};

const DETERIORATION_LEX: Record<DeteriorationSignal["key"], { label: string; rx: RegExp }> = {
  appetite:      { label: "Reduced appetite",       rx: /\b(refused (meal|food|drink)|poor (intake|appetite)|didn'?t eat|left (most|half)|skipped (meal|lunch|breakfast|dinner))\b/i },
  confusion:     { label: "Increasing confusion",   rx: /\b(confused|disorient|repeat(ing)? questions|forgot|did not recognis|memory)\b/i },
  falls:         { label: "Increased falls observations", rx: /\b(fell|fall|stumbl|unsteady|near miss|trip(ped)?|slipp(ed)?)\b/i },
  withdrawal:    { label: "Social withdrawal",      rx: /\b(withdrawn|isolated|declined activity|stayed in (room|bed)|no engagement|kept to (self|themselves))\b/i },
  sleep:         { label: "Sleep disturbance",      rx: /\b(awake (at night|all night)|restless|did not sleep|poor sleep|wander(ed|ing) at night|sleeping (more|all day))\b/i },
  mobility:      { label: "Reduced mobility",       rx: /\b(needed assist|hoist|wheelchair|could not walk|reduced mobility|2 staff|two staff)\b/i },
  personal_care: { label: "Reduced personal-care participation", rx: /\b(refused (wash|shower|bath|personal care)|declined (wash|shower|bath|personal care)|not (washed|changed))\b/i },
};

const SAFEGUARDING_LEX: { key: string; rx: RegExp }[] = [
  { key: "Unexplained injury", rx: /\b(unexplained|unknown cause).{0,30}\b(bruis|injur|mark)/i },
  { key: "Repeated bruising", rx: /\bbruis(e|ing|ed)\b/i },
  { key: "Family concern", rx: /\b(complaint|family raised|family concerned|family unhappy)\b/i },
  { key: "Neglect indicator", rx: /\b(unwashed|soiled clothes|left in|not changed|missed (meal|medication))\b/i },
];

const FLAG_WEIGHTS: Record<string, number> = {
  fall: 14, injury: 10, bruising: 8, safeguarding: 16, skin_breakdown: 10,
  refused_medication: 6, weight_loss: 8, low_intake: 5, unsteady: 4,
  aggressive_behaviour: 6,
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function trendFrom(recent: number, prior: number): Trend {
  if (recent === 0 && prior === 0) return "stable";
  if (recent > prior * 1.4 + 1) return "declining";
  if (prior > recent * 1.4 + 1) return "improving";
  return "stable";
}

function withinDays(d: string, days: number, from = new Date()) {
  return differenceInDays(from, new Date(d)) <= days;
}

function countMatches(text: string, rx: RegExp) {
  const m = text.match(new RegExp(rx.source, rx.flags.includes("g") ? rx.flags : rx.flags + "g"));
  return m ? m.length : 0;
}

function snippetAround(text: string, rx: RegExp, span = 60) {
  const m = text.match(rx);
  if (!m || m.index === undefined) return text.slice(0, span * 2);
  const start = Math.max(0, m.index - span);
  const end = Math.min(text.length, m.index + m[0].length + span);
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}

function collectEvidence(notes: IntelNote[], rx: RegExp, kind: string, max = 4): Evidence[] {
  const out: Evidence[] = [];
  for (const n of notes) {
    if (!n.content) continue;
    if (rx.test(n.content)) {
      out.push({ date: n.created_at, kind, snippet: snippetAround(n.content, rx) });
      if (out.length >= max) break;
    }
  }
  return out;
}

function flagEvidence(notes: IntelNote[], match: (f: string) => boolean, kind: string, max = 4): Evidence[] {
  const out: Evidence[] = [];
  for (const n of notes) {
    const matched = (n.flags ?? []).filter(match);
    if (matched.length === 0) continue;
    out.push({
      date: n.created_at,
      kind,
      snippet: `Flag: ${matched.join(", ")}${n.content ? ` — ${n.content.slice(0, 120)}` : ""}`,
    });
    if (out.length >= max) break;
  }
  return out;
}

// -----------------------------------------------------------------------------
// Main analyser
// -----------------------------------------------------------------------------

export function analyseResident(
  notes: IntelNote[],
  plans: IntelPlan[] = [],
  risks: IntelRisk[] = [],
): ResidentIntelligence {
  const now = new Date();
  const win = 21;
  const recent = notes.filter((n) => withinDays(n.created_at, win, now));
  const prior = notes.filter(
    (n) => !withinDays(n.created_at, win, now) && withinDays(n.created_at, win * 2, now),
  );
  const last60 = notes.filter((n) => withinDays(n.created_at, 60, now));
  const corpus = last60.map((n) => n.content || "").join(" \n ");

  // -- Wellbeing score ------------------------------------------------------
  const posHits = countMatches(corpus, POS);
  const negHits = countMatches(corpus, NEG);
  const flagPenalty = last60.reduce(
    (acc, n) => acc + (n.flags ?? []).reduce((a, f) => a + (FLAG_WEIGHTS[f] ?? 3), 0),
    0,
  );
  const base = 80 + (posHits - negHits) * 1.5 - flagPenalty * 0.6;
  const score = Math.max(15, Math.min(100, Math.round(base)));
  const prevFlagPenalty = prior.reduce(
    (a, n) => a + (n.flags ?? []).reduce((x, f) => x + (FLAG_WEIGHTS[f] ?? 3), 0),
    0,
  );
  const recentFlagPenalty = recent.reduce(
    (a, n) => a + (n.flags ?? []).reduce((x, f) => x + (FLAG_WEIGHTS[f] ?? 3), 0),
    0,
  );
  const wbTrend: Trend =
    recentFlagPenalty > prevFlagPenalty * 1.4 + 2 ? "declining" :
    prevFlagPenalty > recentFlagPenalty * 1.4 + 2 ? "improving" : "stable";
  const wbLabel = score >= 80 ? "Stable" : score >= 65 ? "Watch" : score >= 50 ? "Declining" : "Concerning";
  const wbEvidence: Evidence[] = [
    ...collectEvidence(recent, NEG, "Negative tone", 3),
    ...flagEvidence(recent, () => true, "Flagged incident", 2),
  ].slice(0, 4);

  // -- Domain trends --------------------------------------------------------
  const domains: DomainTrend[] = Object.entries(DOMAIN_LEX).map(([key, rx]) => {
    const r = recent.filter((n) => rx.test(n.content) || n.domain === key).length;
    const p = prior.filter((n) => rx.test(n.content) || n.domain === key).length;
    const concern = recent.filter((n) => rx.test(n.content)).length;
    const t = trendFrom(r, p);
    const label = key.replace(/_/g, " ");
    const msg =
      t === "declining"
        ? `${label[0].toUpperCase() + label.slice(1)} concerns rising over the past ${win} days. Recommend review of related care plan.`
        : t === "improving"
        ? `${label[0].toUpperCase() + label.slice(1)} has improved compared with the prior period.`
        : `${label[0].toUpperCase() + label.slice(1)} appears stable.`;
    return {
      key, label, recent: r, prior: p, concern, trend: t, message: msg,
      evidence: collectEvidence(recent, rx, "Recent observation", 4),
    };
  }).filter((d) => d.recent + d.prior > 0);

  // -- Risk predictions -----------------------------------------------------
  const riskOut: RiskPrediction[] = (Object.keys(RISK_LEX) as (keyof typeof RISK_LEX)[]).map((k) => {
    const rx = RISK_LEX[k];
    const r = recent.filter((n) => rx.test(n.content)).length;
    const p = prior.filter((n) => rx.test(n.content)).length;
    const tagKey = k === "behaviour" ? "behavioural" : (k as string);
    const flagged = recent.filter((n) => (n.risks ?? []).includes(tagKey)).length;
    const raw = r * 0.25 + flagged * 0.15 + Math.max(0, r - p) * 0.15;
    const score = Math.max(0, Math.min(1, raw));
    const confidence: Confidence = score >= 0.7 ? "High" : score >= 0.4 ? "Medium" : "Low";
    const labels: Record<string, string> = {
      falls: "Falls risk", choking: "Swallowing / choking risk", pressure: "Pressure damage risk",
      nutrition: "Nutritional risk", behaviour: "Behavioural distress",
    };
    const recs: Record<string, string> = {
      falls: "Review falls risk assessment and mobility care plan.",
      choking: "Refer to SALT and review choking risk assessment.",
      pressure: "Review skin integrity, repositioning chart and Waterlow score.",
      nutrition: "Refer for dietary review; consider MUST score.",
      behaviour: "Review behavioural support plan; consider triggers and antecedents.",
    };
    return {
      key: k, label: labels[k], score, confidence,
      signals: [`${r} recent mentions`, `${flagged} risk-tagged notes`, `${p} prior period`],
      recommendation: recs[k],
      evidence: [
        ...collectEvidence(recent, rx, "Recent observation", 3),
        ...flagEvidence(recent, (f) => f.includes(k) || (k === "falls" && f === "fall"), "Risk-tagged note", 2),
      ].slice(0, 5),
    };
  }).filter((r) => r.score > 0.05).sort((a, b) => b.score - a.score);

  // -- Deterioration signals -----------------------------------------------
  const deterioration: DeteriorationSignal[] = (Object.keys(DETERIORATION_LEX) as DeteriorationSignal["key"][])
    .map((k) => {
      const { label, rx } = DETERIORATION_LEX[k];
      const r = recent.filter((n) => rx.test(n.content)).length;
      const p = prior.filter((n) => rx.test(n.content)).length;
      const t = trendFrom(r, p);
      const message =
        t === "declining"
          ? `${label} has increased (${r} in last ${win}d vs ${p} prior). Consider clinical review.`
          : t === "improving"
          ? `${label} appears to be reducing compared with prior period.`
          : `${label} appears stable.`;
      return {
        key: k, label, recent: r, prior: p, trend: t, message,
        evidence: collectEvidence(recent, rx, "Recent observation", 4),
      };
    })
    .filter((d) => d.recent >= 2 && d.trend === "declining");

  // -- Care plan reviews / gaps --------------------------------------------
  const planReviews: { domain: string; reason: string; evidence: Evidence[] }[] = [];
  const careGaps: CareGap[] = [];
  for (const d of domains) {
    if (d.trend !== "declining") continue;
    const plan = plans.find((p) => p.domain === d.key);
    if (!plan) {
      const reason = "No active care plan despite emerging concerns.";
      planReviews.push({ domain: d.label, reason, evidence: d.evidence });
      careGaps.push({ domain: d.label, kind: "missing_plan", message: reason, evidence: d.evidence });
    } else {
      const age = differenceInDays(now, new Date(plan.updated_at));
      if (age > 60) {
        const reason = `Care plan not updated in ${age} days while concerns are rising.`;
        planReviews.push({ domain: d.label, reason, evidence: d.evidence });
        if (age > 90) {
          careGaps.push({ domain: d.label, kind: "stale_plan", message: reason, evidence: d.evidence });
        }
      } else {
        planReviews.push({
          domain: d.label,
          reason: "Recent concerns may warrant intervention update.",
          evidence: d.evidence,
        });
      }
    }
  }

  // -- Safeguarding signals -------------------------------------------------
  const sgCounts = new Map<string, number>();
  const sgEvidence = new Map<string, Evidence[]>();
  for (const n of last60) {
    for (const { key, rx } of SAFEGUARDING_LEX) {
      if (rx.test(n.content)) {
        sgCounts.set(key, (sgCounts.get(key) ?? 0) + 1);
        const arr = sgEvidence.get(key) ?? [];
        if (arr.length < 4) arr.push({ date: n.created_at, kind: "Recent observation", snippet: snippetAround(n.content, rx) });
        sgEvidence.set(key, arr);
      }
    }
    for (const f of n.flags ?? []) {
      if (f === "safeguarding" || f === "bruising" || f === "injury") {
        sgCounts.set("Flagged incident", (sgCounts.get("Flagged incident") ?? 0) + 1);
        const arr = sgEvidence.get("Flagged incident") ?? [];
        if (arr.length < 4) arr.push({ date: n.created_at, kind: "Flag", snippet: `Flag: ${f}` });
        sgEvidence.set("Flagged incident", arr);
      }
    }
  }
  const safeguarding = Array.from(sgCounts.entries())
    .filter(([, c]) => c >= 2)
    .map(([signal, count]) => ({ signal, count, evidence: sgEvidence.get(signal) ?? [] }));

  // -- Predictions ----------------------------------------------------------
  const predictions: TimelinePrediction[] = [];
  for (const r of riskOut) {
    if (r.score < 0.45) continue;
    predictions.push({
      horizon: r.score >= 0.7 ? "Next 7 days" : "Next 30 days",
      title: `Elevated ${r.label.toLowerCase()}`,
      likelihood: r.confidence,
      rationale: `Pattern of related observations indicates raised likelihood. ${r.recommendation}`,
      evidence: r.evidence,
    });
  }
  if (deterioration.length >= 2) {
    predictions.push({
      horizon: "Next 30 days",
      title: "Wellbeing decline likely to continue",
      likelihood: deterioration.length >= 3 ? "High" : "Medium",
      rationale: `Multiple deterioration signals detected: ${deterioration.map((d) => d.label.toLowerCase()).join(", ")}.`,
      evidence: deterioration.flatMap((d) => d.evidence).slice(0, 5),
    });
  }
  if (wbTrend === "declining" && predictions.length === 0) {
    predictions.push({
      horizon: "Next 30 days",
      title: "Wellbeing trending downward",
      likelihood: "Medium",
      rationale: "Aggregate wellbeing indicators have dropped relative to prior period.",
      evidence: wbEvidence,
    });
  }

  // -- Recommendations ------------------------------------------------------
  const recommendations: Recommendation[] = [];
  for (const r of riskOut) {
    if (r.score >= 0.4) {
      recommendations.push({
        id: `risk-${r.key}`,
        severity: r.score >= 0.7 ? "critical" : "warning",
        title: `${r.label} escalating`,
        detail: r.recommendation,
        evidence: r.evidence,
      });
    }
  }
  for (const r of planReviews) {
    recommendations.push({
      id: `plan-${r.domain}`,
      severity: "warning",
      title: `Review ${r.domain} care plan`,
      detail: r.reason,
      evidence: r.evidence,
    });
  }
  for (const d of deterioration) {
    recommendations.push({
      id: `det-${d.key}`,
      severity: d.recent >= 4 ? "critical" : "warning",
      title: `Deterioration signal: ${d.label}`,
      detail: d.message,
      evidence: d.evidence,
    });
  }
  if (safeguarding.length) {
    recommendations.push({
      id: "safeguarding",
      severity: "critical",
      title: "Possible safeguarding pattern",
      detail: "Repeated signals detected in recent records. Manager review recommended; do not automatically raise an alert.",
      evidence: safeguarding.flatMap((s) => s.evidence).slice(0, 5),
    });
  }
  if (wbTrend === "declining") {
    recommendations.push({
      id: "wellbeing",
      severity: "warning",
      title: "Wellbeing declining",
      detail: "Aggregate wellbeing indicators have dropped. Consider GP review and MDT discussion.",
      evidence: wbEvidence,
    });
  }
  // De-dupe
  const seen = new Set<string>();
  const dedup = recommendations.filter((r) => (seen.has(r.id) ? false : seen.add(r.id)));

  // touch `risks` parameter so it is retained for future enrichment
  void risks;

  return {
    wellbeing: { score, trend: wbTrend, label: wbLabel, evidence: wbEvidence },
    domains: domains.sort((a, b) => (a.trend === "declining" ? -1 : 1) - (b.trend === "declining" ? -1 : 1)),
    risks: riskOut,
    planReviews,
    safeguarding,
    recommendations: dedup,
    deterioration,
    careGaps,
    predictions,
    noteCount: notes.length,
  };
}

// Day-by-day wellbeing series for charts.
export function wellbeingSeries(notes: IntelNote[], days = 30) {
  const start = subDays(new Date(), days - 1);
  const buckets: Record<string, { date: string; pos: number; neg: number; flags: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = subDays(new Date(), days - 1 - i).toISOString().slice(0, 10);
    buckets[d] = { date: d, pos: 0, neg: 0, flags: 0 };
  }
  for (const n of notes) {
    const d = new Date(n.created_at);
    if (d < start) continue;
    const key = d.toISOString().slice(0, 10);
    if (!buckets[key]) continue;
    buckets[key].pos += countMatches(n.content || "", POS);
    buckets[key].neg += countMatches(n.content || "", NEG);
    buckets[key].flags += (n.flags ?? []).length;
  }
  return Object.values(buckets).map((b) => ({
    date: b.date,
    score: Math.max(20, Math.min(100, 80 + (b.pos - b.neg) * 3 - b.flags * 5)),
  }));
}
