export type CarePlanDomain =
  | "personal_care" | "mobility" | "nutrition" | "continence" | "skin_integrity"
  | "communication" | "mental_health" | "cognition" | "medication" | "breathing"
  | "sleep" | "safety" | "social" | "end_of_life";

export const CARE_PLAN_DOMAINS: { id: CarePlanDomain; label: string; hint: string }[] = [
  { id: "personal_care",   label: "Personal care",                hint: "Washing, dressing, oral hygiene" },
  { id: "mobility",        label: "Mobility & moving and handling", hint: "Transfers, walking aids, falls" },
  { id: "nutrition",       label: "Nutrition & hydration",        hint: "Meals, fluids, fortified diet" },
  { id: "continence",      label: "Continence",                   hint: "Toileting, pads, schedules" },
  { id: "skin_integrity",  label: "Skin integrity / pressure care", hint: "Pressure areas, repositioning" },
  { id: "communication",   label: "Communication",                hint: "Hearing, speech, language" },
  { id: "mental_health",   label: "Mental health & wellbeing",    hint: "Mood, anxiety, depression" },
  { id: "cognition",       label: "Cognition & memory",           hint: "Dementia, orientation" },
  { id: "medication",      label: "Medication",                   hint: "MAR, PRN, side effects" },
  { id: "breathing",       label: "Breathing",                    hint: "COPD, oxygen, inhalers" },
  { id: "sleep",           label: "Sleep",                        hint: "Routine, disturbances" },
  { id: "safety",          label: "Safety & safeguarding",        hint: "Environment, vulnerability" },
  { id: "social",          label: "Social activities & relationships", hint: "Family, hobbies, engagement" },
  { id: "end_of_life",     label: "End-of-life care",             hint: "Advance care plan, comfort" },
];

export type RiskType =
  | "falls" | "pressure" | "nutrition" | "moving_handling" | "continence"
  | "medication" | "environmental" | "behavioural" | "mental_capacity" | "general";

export const RISK_TYPES: { id: RiskType; label: string }[] = [
  { id: "falls",            label: "Falls risk" },
  { id: "pressure",         label: "Pressure ulcer / skin integrity" },
  { id: "nutrition",        label: "Nutrition & malnutrition (MUST)" },
  { id: "moving_handling",  label: "Moving & handling" },
  { id: "continence",       label: "Continence" },
  { id: "medication",       label: "Medication" },
  { id: "environmental",    label: "Environmental safety" },
  { id: "behavioural",      label: "Behavioural" },
  { id: "mental_capacity",  label: "Mental capacity & cognition" },
  { id: "general",          label: "General risk" },
];

export const RISK_LEVEL_COLOR: Record<"low" | "medium" | "high", string> = {
  low: "bg-success/15 text-success-foreground border-success/30",
  medium: "bg-warning/20 text-warning-foreground border-warning/40",
  high: "bg-destructive/15 text-destructive border-destructive/30",
};

export const domainLabel = (d: CarePlanDomain | null | undefined) =>
  CARE_PLAN_DOMAINS.find((x) => x.id === d)?.label ?? "General";
export const riskLabel = (r: RiskType) =>
  RISK_TYPES.find((x) => x.id === r)?.label ?? r;

export const CONSENT_TYPES = [
  "Care & treatment",
  "Personal care",
  "Photography / images",
  "Information sharing with family",
  "Information sharing with professionals",
  "Covert medication",
  "DNACPR",
  "End-of-life preferences",
  "Use of bed rails / restrictive equipment",
  "Other",
] as const;

// Which care plan domains a given risk assessment feeds into.
export const RISK_TO_DOMAINS: Record<RiskType, CarePlanDomain[]> = {
  falls:           ["mobility", "safety"],
  pressure:        ["skin_integrity", "personal_care"],
  nutrition:       ["nutrition"],
  moving_handling: ["mobility", "personal_care"],
  continence:      ["continence", "skin_integrity"],
  medication:      ["medication"],
  environmental:   ["safety"],
  behavioural:     ["mental_health", "safety"],
  mental_capacity: ["cognition", "mental_health"],
  general:         [],
};

export const DOMAIN_TO_RISKS: Record<CarePlanDomain, RiskType[]> = Object.entries(RISK_TO_DOMAINS)
  .reduce((acc, [risk, domains]) => {
    for (const d of domains) (acc[d] ||= []).push(risk as RiskType);
    return acc;
  }, {} as Record<CarePlanDomain, RiskType[]>);


