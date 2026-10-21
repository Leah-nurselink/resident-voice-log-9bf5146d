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
 *       Waterlow chart your service has chosen, and the GULP item scoring against
 *       the official Food First GULP form, before clinical use. The Waterlow
 *       scoring here follows the NHS Scotland "Adapted Waterlow Pressure Area Risk
 *       Assessment Chart (Adults)" v4.0, approved Aug 2024 (Healthcare Improvement
 *       Scotland). MUST follows BAPEN (2003, reviewed 2011). See docs/risk-tools-signoff.md.
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

/** Where the person is being screened. BAPEN gives different repeat-screening intervals. */
export type CareSetting = "care_home" | "community";
export const CARE_SETTING_LABEL: Record<CareSetting, string> = {
  care_home: "Care home",
  community: "Community / domiciliary",
};

/**
 * Measurements captured ONCE and shared by MUST and Waterlow (Waterlow v4.0's
 * nutritional element is the same three checks as MUST).
 */
export type Measurements = {
  weightKg?: number;
  heightCm?: number;
  usualWeightKg?: number;       // weight 3-6 months ago, for % unplanned loss
  acuteNoIntake?: boolean;      // acutely ill AND no (or likely no) intake for > 5 days
};

/** BMI from metric inputs. heightCm in centimetres, weightKg in kilograms. */
export function bmi(weightKg: number, heightCm: number): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  if (m <= 0) return null;
  return weightKg / (m * m);
}

/**
 * BMI to one decimal place, as it is recorded and read on the chart. MUST and Waterlow score THIS value,
 * so the BMI the assessor sees is the BMI that is scored (56 kg at 174 cm = 18.5, which scores 1).
 * Decision for the clinical lead to confirm: BAPEN's chart calls its lines "exact cut off points".
 */
export const bmi1dp = (b: number | null): number | null => (b == null ? null : Math.round(b * 10) / 10);

/** Unplanned weight-loss percentage over the last 3–6 months. */
export function weightLossPct(usualKg: number, currentKg: number): number | null {
  if (!usualKg || !currentKg || usualKg <= 0) return null;
  return ((usualKg - currentKg) / usualKg) * 100;
}

/**
 * MUST step 1. BAPEN: ">20 (>30 obese) = 0; 18.5–20 = 1; <18.5 = 2", and its chart
 * says the lines are "the exact cut off points". So a BMI of exactly 20.0 scores 1,
 * not 0, and the exact (unrounded) BMI is what is scored.
 */
export function mustBmiScore(bmiValue: number | null): number | null {
  const v = bmiValue;
  if (v == null) return null;
  if (v > 20) return 0;
  if (v >= 18.5) return 1;
  return 2;
}

/** MUST step 2. <5% = 0; 5–10% = 1; >10% = 2. */
export function mustWeightLossScore(pct: number | null): number | null {
  if (pct == null) return null;
  if (pct > 10) return 2;
  if (pct >= 5) return 1;
  return 0;
}

export type MustInputs = Measurements & {
  /** Which repeat-screening intervals apply. Defaults to care_home. */
  setting?: CareSetting;
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
  /** BAPEN: record the presence of obesity (BMI > 30). Not part of the score. */
  obese: boolean;
};

export function computeMUST(i: MustInputs): MustResult {
  const bmiValue = bmi1dp(bmi(i.weightKg ?? 0, i.heightCm ?? 0));
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

  const shown = bmi1dp(bmiValue);
  const obese = bmiValue != null && bmiValue > 30;

  const summary = `MUST ${total} — ${band}` +
    (shown != null ? ` · BMI ${shown.toFixed(1)}` : "") +
    (pctLoss != null ? (pctLoss < 0 ? ` · weight gain ${Math.abs(pctLoss).toFixed(1)}%` : ` · weight loss ${pctLoss.toFixed(1)}%`) : "") +
    (obese ? " · Obese (BMI > 30) — record" : "");

  return {
    tool: "must", version: MUST_VERSION,
    score: total, band, level, summary,
    bmi: bmiValue, bmiScore, pctLoss, lossScore, acuteScore, obese,
  };
}

/**
 * BAPEN MUST step 5 — management guidelines and repeat-screening intervals by setting.
 * (Hospital intervals are weekly but are not offered here — CareCore is for care
 * homes and community care.)
 */
export const MUST_ACTION: Record<CareSetting, Record<RiskBandLevel, string>> = {
  care_home: {
    low: "Routine clinical care. Repeat screening monthly.",
    medium: "Observe: document dietary intake for 3 days. If adequate, little concern — repeat screening at least monthly. If inadequate, there is clinical concern: follow local policy, set goals, improve and increase overall nutritional intake, and monitor and review the care plan regularly.",
    high: "Treat (unless detrimental or no benefit is expected from nutritional support, e.g. imminent death): refer to a dietitian or nutritional support team, or follow local policy. Set goals, improve and increase overall nutritional intake. Monitor and review the care plan monthly.",
  },
  community: {
    low: "Routine clinical care. Repeat screening annually for special groups, e.g. people over 75.",
    medium: "Observe: document dietary intake for 3 days. If adequate, little concern — repeat screening at least every 2–3 months. If inadequate, there is clinical concern: follow local policy, set goals, improve and increase overall nutritional intake, and monitor and review the care plan regularly.",
    high: "Treat (unless detrimental or no benefit is expected from nutritional support, e.g. imminent death): refer to a dietitian or nutritional support team, or follow local policy. Set goals, improve and increase overall nutritional intake. Monitor and review the care plan monthly.",
  },
};

/** BAPEN: shown for every risk category. */
export const MUST_ALL_CATEGORIES_NOTE =
  "All risk categories: treat the underlying condition and provide help and advice on food choices, eating and drinking when necessary. Record the malnutrition risk category and any need for special diets, and follow local policy. Re-assess people identified at risk as they move through care settings.";

export const MUST_OBESITY_NOTE =
  "Obesity: record its presence. For people with underlying conditions, these are generally controlled before the treatment of obesity.";

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
// 3) Waterlow — Pressure Area Risk Assessment
//    Follows the NHS Scotland "Adapted Waterlow Pressure Area Risk Assessment
//    Chart (Adults)" v4.0, approved Aug 2024, review Aug 2027 (Healthcare
//    Improvement Scotland). Boxes, point values and wording match that chart.
//    >>> CSO: verify against the chart, then change the version to "-VERIFIED-<date>".
//    >>> Check reproduction permission before commercial rollout (see docs/risk-tools-signoff.md).
// ===========================================================================
export const WATERLOW_VERSION = "Waterlow-HIS-adapted-v4.0-2024-UNVERIFIED";

/** Keys of the Waterlow groups that are worked out from the shared measurements. */
export const WATERLOW_AUTO_KEYS = ["build", "nutBmi", "nutLoss", "nutAcute"] as const;

export const WATERLOW_GROUPS: Group[] = [
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
      { value: "14to49", label: "14 – 49", points: 1 },
      { value: "50to64", label: "50 – 64", points: 2 },
      { value: "65to74", label: "65 – 74", points: 3 },
      { value: "75to80", label: "75 – 80", points: 4 },
      { value: "81plus", label: "81+", points: 5 },
    ],
  },
  {
    key: "build", label: "Build / weight for height (weight in kg / height in m²)",
    options: [
      { value: "average", label: "Average BMI 20 – 24.9", points: 0 },
      { value: "above", label: "Above average BMI 25 – 29.9", points: 1 },
      { value: "obese", label: "Obese BMI > 30", points: 2 },
      { value: "below", label: "Below average BMI < 20", points: 3 },
    ],
  },
  {
    key: "continence", label: "Continence",
    options: [
      { value: "complete", label: "Complete / catheterised", points: 0 },
      { value: "urine", label: "Incontinent urine", points: 1 },
      { value: "faeces", label: "Incontinent faeces", points: 2 },
      { value: "double", label: "Doubly incontinent (urine & faeces)", points: 3 },
    ],
  },
  {
    key: "skin", label: "Skin type (visual risk areas) — more than one can be selected", multi: true,
    options: [
      { value: "healthy", label: "Healthy", points: 0 },
      { value: "tissuepaper", label: "Tissue paper (thin / fragile)", points: 1 },
      { value: "dry", label: "Dry (appears flaky)", points: 1 },
      { value: "oedematous", label: "Oedematous (puffy)", points: 1 },
      { value: "clammy", label: "Clammy (moist to touch / pyrexia)", points: 1 },
      { value: "discoloured", label: "Discoloured (bruising / mottled)", points: 2 },
      { value: "broken", label: "Broken (established ulcer)", points: 3 },
    ],
  },
  {
    key: "mobility", label: "Mobility",
    options: [
      { value: "fully", label: "Fully mobile", points: 0 },
      { value: "restless", label: "Restless / fidgety", points: 1 },
      { value: "apathetic", label: "Apathetic (sedated / depressed / reluctant to move)", points: 2 },
      { value: "restricted", label: "Restricted (restricted by severe pain or disease)", points: 3 },
      { value: "bedbound", label: "Bedbound (unconscious / unable to change position / traction)", points: 4 },
      { value: "chairbound", label: "Chair bound (unable to leave chair without assistance)", points: 5 },
    ],
  },
  // Nutritional element — three checks that add together (same as MUST steps 1–3).
  {
    key: "nutLoss", label: "Nutritional element — unplanned weight loss in the past 3–6 months",
    options: [
      { value: "lt5", label: "< 5%", points: 0 },
      { value: "5to10", label: "5 – 10%", points: 1 },
      { value: "gt10", label: "> 10%", points: 2 },
    ],
  },
  {
    key: "nutBmi", label: "Nutritional element — BMI",
    options: [
      { value: "gt20", label: "BMI > 20", points: 0 },
      { value: "18.5to20", label: "BMI 18.5 – 20", points: 1 },
      { value: "lt18.5", label: "BMI < 18.5", points: 2 },
    ],
  },
  {
    key: "nutAcute", label: "Nutritional element — acutely ill or no nutritional intake for more than 5 days",
    options: [
      { value: "no", label: "No", points: 0 },
      { value: "yes", label: "Patient / client acutely ill or no nutritional intake > 5 days", points: 2 },
    ],
  },
  {
    key: "tissueMalnutrition", label: "Special risks — tissue malnutrition — more than one can be selected", multi: true,
    options: [
      { value: "smoking", label: "Smoking", points: 1 },
      { value: "anaemia", label: "Anaemia (Hb < 8)", points: 2 },
      { value: "singleorgan", label: "Single organ failure, e.g. cardiac, renal, respiratory", points: 5 },
      { value: "pvd", label: "Peripheral vascular disease", points: 5 },
      { value: "multiorgan", label: "Multiple organ failure / terminal cachexia", points: 8 },
    ],
  },
  {
    // The chart gives one line scored 4–6 "dependent on condition stability / impact severity".
    // The three options below are CareCore's reading of that range — CSO to confirm.
    key: "neuro", label: "Special risks — neurological deficit",
    options: [
      { value: "none", label: "None", points: 0 },
      { value: "mild", label: "Diabetes / MS / CVA / motor / sensory / paraplegia — stable or mild impact", points: 4 },
      { value: "moderate", label: "Diabetes / MS / CVA / motor / sensory / paraplegia — moderate impact", points: 5 },
      { value: "severe", label: "Diabetes / MS / CVA / motor / sensory / paraplegia — unstable or severe impact", points: 6 },
    ],
  },
  {
    key: "surgery", label: "Special risks — surgery / trauma — more than one can be selected", multi: true,
    options: [
      { value: "orthopaedic", label: "Orthopaedic / below waist / spinal (up to 48 hours post op)", points: 5 },
      { value: "ontable2h", label: "On table > 2 hours (up to 48 hours post op)", points: 5 },
      { value: "ontable6h", label: "On table > 6 hours", points: 8 },
    ],
  },
  {
    key: "medication", label: "Special risks — medication",
    options: [
      { value: "none", label: "None", points: 0 },
      { value: "high", label: "Cytotoxic, anti-inflammatory, long term / high dose steroid", points: 4 },
    ],
  },
];

export type WaterlowInputs = Record<string, string | string[] | undefined>;

/**
 * Work out the four Waterlow boxes that come from measurements (build, plus the
 * three nutritional checks). Returns only the keys it can fill in.
 *   Build: BMI < 20 = below; 20–24.9 = average; 25–30 = above; > 30 = obese.
 */
export function waterlowFromMeasurements(m: Measurements): WaterlowInputs {
  const out: WaterlowInputs = {};
  const b = bmi1dp(bmi(m.weightKg ?? 0, m.heightCm ?? 0)); // same one-decimal BMI as MUST
  if (b != null) {
    out.build = b < 20 ? "below" : b < 25 ? "average" : b <= 30 ? "above" : "obese";
    out.nutBmi = b > 20 ? "gt20" : b >= 18.5 ? "18.5to20" : "lt18.5";
  }
  const loss = mustWeightLossScore(weightLossPct(m.usualWeightKg ?? 0, m.weightKg ?? 0));
  if (loss != null) out.nutLoss = loss === 0 ? "lt5" : loss === 1 ? "5to10" : "gt10";
  if (m.acuteNoIntake != null) out.nutAcute = m.acuteNoIntake ? "yes" : "no";
  return out;
}

function waterlowEffective(inputs: WaterlowInputs): WaterlowInputs {
  // "On table > 6 hours" includes "> 2 hours": never count both.
  const surgery = inputs.surgery;
  return Array.isArray(surgery) && surgery.includes("ontable6h")
    ? { ...inputs, surgery: surgery.filter((v) => v !== "ontable2h") }
    : inputs;
}

const SHORT: Record<string, string> = {
  build: "Build", nutLoss: "Weight loss", nutBmi: "BMI (nutrition)", nutAcute: "Acute illness / no intake",
  tissueMalnutrition: "Tissue malnutrition", neuro: "Neurological", surgery: "Surgery / trauma", medication: "Medication",
};

/** Points per chart section, so the assessor can check the total against the paper chart. */
export function waterlowBreakdown(inputs: WaterlowInputs): { key: string; label: string; points: number }[] {
  const effective = waterlowEffective(inputs);
  return WATERLOW_GROUPS.map((g) => ({ key: g.key, label: SHORT[g.key] ?? g.label.split(" — ")[0], points: pointsOf(g, effective[g.key]) }));
}

export function computeWaterlow(inputs: WaterlowInputs): ToolResult {
  const effective = waterlowEffective(inputs);
  const total = WATERLOW_GROUPS.reduce((sum, g) => sum + pointsOf(g, effective[g.key]), 0);

  // Chart: 10–14 at risk; 14–19 high risk (the chart prints 14 in both — CSO to confirm;
  // here 14 is "at risk" and 15–19 is "high risk"); 20+ very high risk.
  let band: string, level: RiskBandLevel;
  if (total < 10) { band = "Not at risk (< 10)"; level = "low"; }
  else if (total < 15) { band = "At risk (10–14)"; level = "medium"; }
  else if (total < 20) { band = "High risk (15–19)"; level = "high"; }
  else { band = "Very high risk (20+)"; level = "high"; }

  return { tool: "waterlow", version: WATERLOW_VERSION, score: total, band, level, summary: `Waterlow ${total} — ${band}` };
}

/** Required boxes before a Waterlow can be saved. */
export const WATERLOW_REQUIRED = ["sex", "age", "build", "continence", "mobility", "nutLoss", "nutBmi", "nutAcute"] as const;

export const WATERLOW_GUIDANCE =
  "Use together with your clinical judgement. Complete within 6 hours of admission or on the first home visit; reassess if the person's condition changes and repeat regularly according to local procedures. An indication of risk should be followed with an action, i.e. develop and implement a pressure ulcer prevention care plan.";

export const WATERLOW_ACTION: Record<RiskBandLevel, string> = {
  low: "Reassess regularly and if condition changes.",
  medium: "At risk: develop and implement a pressure ulcer prevention care plan — repositioning schedule, skin inspection, pressure-relieving equipment as indicated; document a SSKIN plan.",
  high: "High / very high risk: develop and implement a pressure ulcer prevention care plan — individualised repositioning, pressure-redistributing mattress/cushion, daily skin inspection, dietitian/TVN referral as indicated; review frequently.",
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
