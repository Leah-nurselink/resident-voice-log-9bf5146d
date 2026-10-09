/**
 * Validated clinical risk-assessment tools for Eleni Care / CareCore.
 *
 * Tools implemented:
 *   - Waterlow  — pressure-ulcer risk (scored)
 *   - MUST      — malnutrition (scored, with BMI + % weight-loss calculators)
 *   - GULP      — dehydration risk (scored)
 *   - Falls     — NICE CG161 multifactorial assessment (STRUCTURED, NOT scored)
 *
 * CLINICAL GOVERNANCE
 *   Every point value, band and threshold below is data in one place so the
 *   Clinical Safety Officer can verify it against the official instrument and
 *   edit it without touching any UI. Each tool carries a `version` string —
 *   bump it whenever the scoring changes, so stored assessments remain auditable.
 *
 *   >>> The CSO must confirm the Waterlow point values and thresholds against the
 *       official Waterlow card, and the GULP item scoring against the official
 *       Food First GULP form, before clinical use. The values here follow the
 *       published tools (BAPEN MUST; Waterlow; Essex/Food First GULP; NICE CG161).
 */

// Maps to the existing Postgres `risk_level` enum used by the app's badges.
export type RiskBandLevel = "low" | "medium" | "high";
export type RiskTool = "waterlow" | "must" | "gulp" | "falls_mfra";

export const RISK_TOOL_LABEL: Record<RiskTool, string> = {
  waterlow: "Waterlow (pressure ulcer risk)",
  must: "MUST (malnutrition)",
  gulp: "GULP (dehydration risk)",
  falls_mfra: "Multifactorial falls risk assessment (NICE CG161)",
};

/** A scored tool result. `score`/`band` are null for structured (unscored) tools. */
export type ToolResult = {
  tool: RiskTool;
  version: string;
  score: number | null;
  band: string | null;     // precise tool band, e.g. "High risk (15–19)"
  level: RiskBandLevel;     // coarse mapping for existing low/medium/high UI
  summary: string;          // one-line human summary
};

// ---------------------------------------------------------------------------
// Shared option typing for categorical, scored groups
// ---------------------------------------------------------------------------
export type Opt = { value: string; label: string; points: number };
export type Group = { key: string; label: string; multi?: boolean; options: Opt[] };

const pointsOf = (group: Group, selected: string[] | string | undefined): number => {
  if (selected == null) return 0;
  const values = Array.isArray(selected) ? selected : [selected];
  return group.options
    .filter((o) => values.includes(o.value))
    .reduce((s, o) => s + o.points, 0);
};

// ===========================================================================
// 1) MUST — Malnutrition Universal Screening Tool (BAPEN)
// ===========================================================================
export const MUST_VERSION = "BAPEN-MUST-2011";

/** BMI from metric inputs. heightCm in centimetres, weightKg in kilograms. */
export function bmi(weightKg: number, heightCm: number): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  if (m <= 0) return null;
  return weightKg / (m * m);
}

/** Unplanned weight-loss percentage over the last 3–6 months. */
export function weightLossPct(usualKg: number, currentKg: number): number | null {
  if (!usualKg || !currentKg || usualKg <= 0) return null;
  return ((usualKg - currentKg) / usualKg) * 100;
}

export function mustBmiScore(bmiValue: number | null): number | null {
  if (bmiValue == null) return null;
  if (bmiValue >= 20) return 0;     // >20 (incl. obese) = 0
  if (bmiValue >= 18.5) return 1;   // 18.5–20 = 1
  return 2;                         // <18.5 = 2
}

export function mustWeightLossScore(pct: number | null): number | null {
  if (pct == null) return null;
  if (pct > 10) return 2;           // >10% = 2
  if (pct >= 5) return 1;           // 5–10% = 1
  return 0;                         // <5% = 0
}

export type MustInputs = {
  weightKg?: number;
  heightCm?: number;
  usualWeightKg?: number;
  // Acutely unwell AND no / likely no nutritional intake for > 5 days (rare in a care home).
  acuteNoIntake?: boolean;
  // Optional manual overrides if BMI/weight can't be measured (document the reason).
  bmiScoreOverride?: 0 | 1 | 2;
  weightLossScoreOverride?: 0 | 1 | 2;
};

export type MustResult = ToolResult & {
  bmi: number | null;
  bmiScore: number | null;
  pctLoss: number | null;
  lossScore: number | null;
  acuteScore: number;
};

export function computeMUST(i: MustInputs): MustResult {
  const bmiValue = bmi(i.weightKg ?? 0, i.heightCm ?? 0);
  const bmiScore = i.bmiScoreOverride ?? mustBmiScore(bmiValue);
  const pctLoss = weightLossPct(i.usualWeightKg ?? 0, i.weightKg ?? 0);
  const lossScore = i.weightLossScoreOverride ?? mustWeightLossScore(pctLoss);
  const acuteScore = i.acuteNoIntake ? 2 : 0;

  const parts = [bmiScore, lossScore, acuteScore];
  const total = parts.reduce<number>((s, p) => s + (p ?? 0), 0);

  let band: string, level: RiskBandLevel;
  if (total === 0) { band = "Low risk (0)"; level = "low"; }
  else if (total === 1) { band = "Medium risk (1)"; level = "medium"; }
  else { band = "High risk (2+)"; level = "high"; }

  const summary = `MUST ${total} — ${band}` +
    (bmiValue != null ? ` · BMI ${bmiValue.toFixed(1)}` : "") +
    (pctLoss != null ? ` · weight loss ${pctLoss.toFixed(1)}%` : "");

  return {
    tool: "must", version: MUST_VERSION,
    score: total, band, level, summary,
    bmi: bmiValue, bmiScore, pctLoss, lossScore, acuteScore,
  };
}

export const MUST_ACTION: Record<RiskBandLevel, string> = {
  low: "Routine clinical care. Re-screen monthly in a care home.",
  medium: "Observe: document dietary intake for 3 days; re-screen at least monthly. If intake inadequate, set goals and follow local policy.",
  high: "Treat: refer to dietitian / nutrition support, set goals, increase nutritional intake, monitor and review. Re-screen monthly.",
};

// ===========================================================================
// 2) GULP — Dehydration Risk Screening Tool (Essex / Food First)
//    NOTE: official form states max total 7; verify item scoring against the card.
// ===========================================================================
export const GULP_VERSION = "FoodFirst-GULP-v1";

export const GULP_GROUPS: Group[] = [
  {
    key: "fluid", label: "Fluid intake in the last 24 hours",
    options: [
      { value: "over1600", label: "More than 1600 ml", points: 0 },
      { value: "1200to1600", label: "1200–1600 ml, or cannot be assessed", points: 1 },
      { value: "under1200", label: "Less than 1200 ml", points: 2 },
    ],
  },
  {
    key: "urine", label: "Urine colour (1–8 pee chart)",
    options: [
      { value: "1to3", label: "Colour 1–3 (well hydrated)", points: 0 },
      { value: "cannot", label: "Cannot be assessed", points: 1 },
      { value: "4to8", label: "Colour 4–8 (poorly hydrated)", points: 2 },
    ],
  },
  {
    key: "signs", label: "Signs, symptoms & risk factors",
    options: [
      { value: "none", label: "No signs of dehydration", points: 0 },
      {
        value: "mild",
        label: "Mild: recurrent UTIs, frequent falls, postural hypotension, dizziness, dry mouth/lips/eyes, taking diuretics, weeping wound, hyperglycaemia",
        points: 1,
      },
      {
        value: "severe",
        label: "Severe: drowsiness, low BP, weak pulse, sunken eyes, new/worsening confusion, diarrhoea &/or vomiting, fever",
        points: 2,
      },
    ],
  },
];

export type GulpInputs = { fluid?: string; urine?: string; signs?: string };

export function computeGULP(i: GulpInputs): ToolResult {
  const total =
    pointsOf(GULP_GROUPS[0], i.fluid) +
    pointsOf(GULP_GROUPS[1], i.urine) +
    pointsOf(GULP_GROUPS[2], i.signs);

  let band: string, level: RiskBandLevel;
  if (total === 0) { band = "Low risk (0)"; level = "low"; }
  else if (total <= 3) { band = "Medium risk (1–3)"; level = "medium"; }
  else { band = "High risk (4+)"; level = "high"; }

  return { tool: "gulp", version: GULP_VERSION, score: total, band, level, summary: `GULP ${total} — ${band}` };
}

export const GULP_ACTION: Record<RiskBandLevel, string> = {
  low: "Encourage current fluid intake; provide the 'Keeping Hydrated' information.",
  medium: "Encourage more frequent/larger drinks; self-monitor urine colour, aiming for 1–3.",
  high: "Provide an extra four 250 ml drinks per day in addition to usual fluids; offer a drink at each visit; involve family/carers; review.",
};

// ===========================================================================
// 3) Waterlow — Pressure Ulcer Risk Assessment
//    >>> CSO: verify every point value and the thresholds against the official card. <<<
// ===========================================================================
export const WATERLOW_VERSION = "Waterlow-2005-UNVERIFIED"; // change to "-VERIFIED-<date>" once the CSO signs off

// Single-select groups (pick the one that applies).
export const WATERLOW_GROUPS: Group[] = [
  {
    key: "build", label: "Build / weight for height",
    options: [
      { value: "average", label: "Average", points: 0 },
      { value: "above", label: "Above average", points: 1 },
      { value: "obese", label: "Obese", points: 2 },
      { value: "below", label: "Below average", points: 3 },
    ],
  },
  {
    key: "skin", label: "Skin type / visual risk areas", multi: true,
    options: [
      { value: "healthy", label: "Healthy", points: 0 },
      { value: "tissuepaper", label: "Tissue paper", points: 1 },
      { value: "dry", label: "Dry", points: 1 },
      { value: "oedematous", label: "Oedematous", points: 1 },
      { value: "clammy", label: "Clammy (raised temp)", points: 1 },
      { value: "discoloured", label: "Discoloured (grade 1)", points: 2 },
      { value: "broken", label: "Broken / spot (grade 2–4)", points: 3 },
    ],
  },
  {
    key: "sex", label: "Sex",
    options: [
      { value: "male", label: "Male", points: 1 },
      { value: "female", label: "Female", points: 2 },
    ],
  },
  {
    key: "age", label: "Age",
    options: [
      { value: "14to49", label: "14–49", points: 1 },
      { value: "50to64", label: "50–64", points: 2 },
      { value: "65to74", label: "65–74", points: 3 },
      { value: "75to80", label: "75–80", points: 4 },
      { value: "81plus", label: "81+", points: 5 },
    ],
  },
  {
    key: "continence", label: "Continence",
    options: [
      { value: "complete", label: "Complete / catheterised", points: 0 },
      { value: "urine", label: "Occasionally incontinent (urine)", points: 1 },
      { value: "faeces", label: "Catheterised / incontinent of faeces", points: 2 },
      { value: "double", label: "Doubly incontinent", points: 3 },
    ],
  },
  {
    key: "mobility", label: "Mobility",
    options: [
      { value: "fully", label: "Fully mobile", points: 0 },
      { value: "restless", label: "Restless / fidgety", points: 1 },
      { value: "apathetic", label: "Apathetic", points: 2 },
      { value: "restricted", label: "Restricted", points: 3 },
      { value: "inert", label: "Inert / traction", points: 4 },
      { value: "chairbound", label: "Chairbound", points: 5 },
    ],
  },
  {
    key: "appetite", label: "Appetite",
    options: [
      { value: "average", label: "Average", points: 0 },
      { value: "poor", label: "Poor", points: 1 },
      { value: "ng", label: "NG tube / fluids only", points: 2 },
      { value: "nbm", label: "NBM / anorexic", points: 3 },
    ],
  },
  {
    // Modern Waterlow nutrition sub-section — CSO to confirm it is on your card.
    key: "weightLoss", label: "Recent weight loss",
    options: [
      { value: "none", label: "No recent weight loss", points: 0 },
      { value: "0.5to5", label: "0.5–5 kg", points: 1 },
      { value: "5to10", label: "5–10 kg", points: 2 },
      { value: "10to15", label: "10–15 kg", points: 3 },
      { value: "over15", label: "More than 15 kg", points: 4 },
      { value: "unsure", label: "Unsure", points: 2 },
    ],
  },
  {
    key: "tissueMalnutrition", label: "Special risk — tissue malnutrition",
    options: [
      { value: "none", label: "None", points: 0 },
      { value: "cachexia", label: "Terminal cachexia", points: 8 },
      { value: "cardiac", label: "Cardiac failure", points: 5 },
      { value: "pvd", label: "Peripheral vascular disease", points: 5 },
      { value: "anaemia", label: "Anaemia", points: 2 },
      { value: "smoking", label: "Smoking", points: 1 },
    ],
  },
  {
    key: "neuro", label: "Special risk — neurological deficit",
    options: [
      { value: "none", label: "None", points: 0 },
      { value: "mild", label: "Diabetes / MS / CVA / motor–sensory (mild)", points: 4 },
      { value: "moderate", label: "Moderate", points: 5 },
      { value: "severe", label: "Severe / paraplegia", points: 6 },
    ],
  },
  {
    key: "surgery", label: "Special risk — major surgery / trauma", multi: true,
    options: [
      { value: "none", label: "None", points: 0 },
      { value: "orthopaedic", label: "Orthopaedic — below waist / spinal", points: 5 },
      { value: "ontable2h", label: "On table > 2 hours", points: 5 },
      { value: "ontable6h", label: "On table > 6 hours", points: 8 },
    ],
  },
  {
    key: "medication", label: "Special risk — medication",
    options: [
      { value: "none", label: "None", points: 0 },
      { value: "high", label: "Cytotoxics / high-dose steroids / anti-inflammatory", points: 4 },
    ],
  },
];

export type WaterlowInputs = Record<string, string | string[] | undefined>;

export function computeWaterlow(inputs: WaterlowInputs): ToolResult {
  const total = WATERLOW_GROUPS.reduce((sum, g) => sum + pointsOf(g, inputs[g.key]), 0);

  let band: string, level: RiskBandLevel;
  if (total < 10) { band = "Not at risk (<10)"; level = "low"; }
  else if (total < 15) { band = "At risk (10–14)"; level = "medium"; }
  else if (total < 20) { band = "High risk (15–19)"; level = "high"; }
  else { band = "Very high risk (20+)"; level = "high"; }

  return { tool: "waterlow", version: WATERLOW_VERSION, score: total, band, level, summary: `Waterlow ${total} — ${band}` };
}

export const WATERLOW_ACTION: Record<RiskBandLevel, string> = {
  low: "Reassess regularly and if condition changes.",
  medium: "At risk: repositioning schedule, skin inspection, pressure-relieving equipment as indicated; document a SSKIN plan.",
  high: "High / very high risk: individualised repositioning, pressure-redistributing mattress/cushion, daily skin inspection, dietitian/TVN referral as indicated; review frequently.",
};

// ===========================================================================
// 4) Falls — NICE CG161 Multifactorial Falls Risk Assessment
//    NICE: "Do not use risk-prediction tools ... that assign a numerical score."
//    So this is STRUCTURED, not scored. Overall outcome is the clinician's
//    judgement (at increased risk vs not), driven by the factors identified.
// ===========================================================================
export const FALLS_VERSION = "NICE-CG161-MFRA";

export type FallsFactor = { key: string; label: string; hint?: string };

export const FALLS_FACTORS: FallsFactor[] = [
  { key: "history", label: "Falls history", hint: "Number and circumstances of recent falls" },
  { key: "gait", label: "Gait, balance and mobility", hint: "Transfers, walking, aids" },
  { key: "muscle", label: "Muscle weakness" },
  { key: "osteoporosis", label: "Osteoporosis / fracture risk" },
  { key: "fear", label: "Perceived functional ability & fear of falling" },
  { key: "vision", label: "Visual impairment" },
  { key: "cognition", label: "Cognitive impairment & neurological" },
  { key: "continence", label: "Urinary continence" },
  { key: "cardio", label: "Cardiovascular — postural BP / syncope" },
  { key: "medication", label: "Medication review (polypharmacy, psychotropics, sedatives)" },
  { key: "footwear", label: "Footwear & feet" },
  { key: "environment", label: "Home / environment hazards" },
  { key: "nutrition", label: "Nutrition & hydration" },
  { key: "mood", label: "Mood (depression / anxiety)" },
  { key: "hearing", label: "Hearing" },
];

export type FallsFactorEntry = { present: boolean; note?: string };
export type FallsInputs = {
  factors: Record<string, FallsFactorEntry>;
  overallConcern: "not_at_risk" | "at_risk"; // clinician judgement — NOT a computed score
  plan?: string;
};

export function summariseFalls(i: FallsInputs): ToolResult {
  const identified = Object.entries(i.factors).filter(([, v]) => v?.present).length;
  const level: RiskBandLevel = i.overallConcern === "at_risk" ? "high" : "low";
  return {
    tool: "falls_mfra", version: FALLS_VERSION,
    score: null, band: null, level,
    summary: `Multifactorial falls assessment — ${i.overallConcern === "at_risk" ? "at increased risk" : "not at increased risk"} (${identified} factor${identified === 1 ? "" : "s"} identified). Clinical judgement, no numeric score (NICE CG161).`,
  };
}

// ---------------------------------------------------------------------------
// Convenience: map a tool + inputs to a stored row's computed fields.
// ---------------------------------------------------------------------------
export function summariseTool(tool: RiskTool, inputs: unknown): ToolResult {
  switch (tool) {
    case "must": return computeMUST(inputs as MustInputs);
    case "gulp": return computeGULP(inputs as GulpInputs);
    case "waterlow": return computeWaterlow(inputs as WaterlowInputs);
    case "falls_mfra": return summariseFalls(inputs as FallsInputs);
    default: throw new Error(`Unknown risk tool: ${tool as string}`);
  }
}

/** Which `risk_assessment_type` each tool maps to (for the existing `type` column). */
export const TOOL_TO_RISK_TYPE: Record<RiskTool, string> = {
  waterlow: "pressure",
  must: "nutrition",
  gulp: "nutrition",
  falls_mfra: "falls",
};

// ===========================================================================
// 5) Further STRUCTURED (unscored) assessments — clinician judgement on
//    identified factors, following the named national guidance.
// ===========================================================================
export type StructuredTool = "falls_mfra" | "tile_mh" | "continence" | "bedrails" | "mca" | "behaviour_abc";
export type ExtendedTool = RiskTool | Exclude<StructuredTool, "falls_mfra">;

export const STRUCTURED_TOOLS: Record<StructuredTool, { label: string; version: string; type: string; guidance: string; factors: FallsFactor[]; atRiskLabel: string; notAtRiskLabel: string }> = {
  falls_mfra: { label: RISK_TOOL_LABEL.falls_mfra, version: FALLS_VERSION, type: "falls", guidance: "NICE CG161 / NG249: structured multifactorial assessment — no numeric score.", factors: FALLS_FACTORS, atRiskLabel: "At increased risk", notAtRiskLabel: "Not at increased risk" },
  tile_mh: {
    label: "Moving & handling (TILE — HSE MHOR 1992)", version: "HSE-TILE-L23", type: "moving_handling",
    guidance: "HSE Manual Handling Operations Regulations (L23): assess Task, Individual, Load (the person) and Environment.",
    factors: [
      { key: "task", label: "Task", hint: "Transfers, repositioning, bathing, stooping/twisting, frequency" },
      { key: "individual", label: "Individual (staff)", hint: "Number of staff needed, training, capability" },
      { key: "load_weight", label: "Load — person's weight / size", hint: "Bariatric needs, weight-bearing ability" },
      { key: "load_cooperation", label: "Load — cooperation & cognition", hint: "Understanding, unpredictable movement, pain" },
      { key: "load_clinical", label: "Load — clinical factors", hint: "Pain, wounds, catheters, contractures, falls history" },
      { key: "environment", label: "Environment", hint: "Space, flooring, lighting, bed/chair height" },
      { key: "equipment", label: "Equipment", hint: "Hoist + sling size, slide sheet, stand aid — LOLER checks in date" },
    ], atRiskLabel: "Assistance / equipment required", notAtRiskLabel: "Independent / low risk",
  },
  continence: {
    label: "Continence assessment (NICE CG97 / CG49 / QS77)", version: "NICE-continence-v1", type: "continence",
    guidance: "NICE CG97 (LUTS), CG49 (faecal incontinence), QS77: identify type and cause before using containment products.",
    factors: [
      { key: "urinary", label: "Urinary incontinence", hint: "Stress, urge, mixed, overflow, functional" },
      { key: "faecal", label: "Faecal incontinence / constipation", hint: "Bristol stool chart, bowel pattern" },
      { key: "uti", label: "UTI signs or catheter", hint: "Catheter type, change date, care" },
      { key: "mobility", label: "Mobility / access to toilet", hint: "Functional incontinence" },
      { key: "cognition", label: "Cognition / recognising need", hint: "Prompted toileting" },
      { key: "medication", label: "Medication contributing", hint: "Diuretics, anticholinergics, opioids, laxatives" },
      { key: "fluids", label: "Fluid & fibre intake" },
      { key: "skin", label: "Skin — moisture-associated damage", hint: "Links to Waterlow / skin integrity" },
    ], atRiskLabel: "Continence need identified", notAtRiskLabel: "Continent / no concerns",
  },
  bedrails: {
    label: "Bed rails risk assessment (MHRA)", version: "MHRA-bedrails-2023", type: "environmental",
    guidance: "MHRA 'Bed rails: management and safe use': only use when benefit outweighs entrapment risk; consent / best interests required.",
    factors: [
      { key: "fall_from_bed", label: "Risk of falling / rolling out of bed" },
      { key: "confusion", label: "Confused, agitated or likely to climb over rails" },
      { key: "entrapment", label: "Entrapment risk — gaps, mattress fit, small/frail person" },
      { key: "alternatives", label: "Alternatives tried", hint: "Low bed, crash mat, sensor mat" },
      { key: "equipment", label: "Rails / bumpers compatible with bed & mattress" },
      { key: "consent", label: "Consent or MCA best-interests decision recorded" },
    ], atRiskLabel: "Bed rails NOT safe / not indicated", notAtRiskLabel: "Bed rails appropriate with controls",
  },
  mca: {
    label: "Mental Capacity Act assessment (MCA 2005 two-stage)", version: "MCA2005-CoP", type: "mental_capacity",
    guidance: "MCA 2005 Code of Practice: decision-specific. Stage 1 impairment; Stage 2 understand, retain, weigh, communicate. Tick each area of concern.",
    factors: [
      { key: "decision", label: "Specific decision being assessed", hint: "Record the decision in the detail box" },
      { key: "impairment", label: "Stage 1 — impairment of mind or brain" },
      { key: "understand", label: "Cannot understand the relevant information" },
      { key: "retain", label: "Cannot retain the information long enough" },
      { key: "weigh", label: "Cannot use or weigh the information" },
      { key: "communicate", label: "Cannot communicate the decision (by any means)" },
      { key: "support", label: "All practicable steps taken to support the decision", hint: "Record what was tried" },
      { key: "best_interests", label: "Best interests decision / LPA / advocate involved" },
    ], atRiskLabel: "Lacks capacity for this decision", notAtRiskLabel: "Has capacity for this decision",
  },
  behaviour_abc: {
    label: "Behaviour assessment (ABC — NICE NG97 / NG11)", version: "NICE-NG97-ABC", type: "behavioural",
    guidance: "NICE NG97 (dementia) / NG11: understand distress behaviour via Antecedent–Behaviour–Consequence; look for unmet need before medication.",
    factors: [
      { key: "antecedent", label: "Antecedent — triggers", hint: "Time, place, people, task, noise" },
      { key: "behaviour", label: "Behaviour — what happened", hint: "Describe objectively" },
      { key: "consequence", label: "Consequence — what followed / helped" },
      { key: "pain", label: "Possible pain or physical cause", hint: "Use the Pain check; infection, constipation" },
      { key: "unmet_need", label: "Unmet need (hunger, thirst, toilet, boredom, fear)" },
      { key: "risk_others", label: "Risk to self or others" },
      { key: "restriction", label: "Restrictive practice / PRN considered", hint: "Least restrictive option" },
    ], atRiskLabel: "Risk identified — PBS plan needed", notAtRiskLabel: "No significant risk",
  },
};

export const isStructured = (t: string): t is StructuredTool => t in STRUCTURED_TOOLS;

export function summariseStructured(tool: StructuredTool, i: FallsInputs): ToolResult {
  const def = STRUCTURED_TOOLS[tool];
  const identified = Object.values(i.factors).filter((v) => v?.present).length;
  const atRisk = i.overallConcern === "at_risk";
  return {
    tool: tool as RiskTool, version: def.version, score: null,
    band: atRisk ? def.atRiskLabel : def.notAtRiskLabel,
    level: atRisk ? "high" : "low",
    summary: `${def.label} — ${atRisk ? def.atRiskLabel : def.notAtRiskLabel} (${identified} factor${identified === 1 ? "" : "s"} identified). Clinical judgement, no numeric score.`,
  };
}
