export type CarePlanDomain =
  | "Personal care"
  | "Mobility and moving & handling"
  | "Nutrition and hydration"
  | "Continence"
  | "Skin integrity / pressure care"
  | "Communication"
  | "Mental health and emotional wellbeing"
  | "Cognition / memory"
  | "Medication"
  | "Breathing"
  | "Sleep"
  | "Safety and safeguarding"
  | "Social activities and relationships"
  | "End-of-life care";

export type RiskAssessment =
  | "Falls risk assessment"
  | "Pressure ulcer / skin integrity risk"
  | "Nutrition / malnutrition (MUST)"
  | "Moving and handling risk"
  | "Continence risk"
  | "Medication risk"
  | "Environmental safety risk"
  | "Behavioural risk"
  | "Mental capacity / cognition"
  | "General risk assessment";

export const CARE_PLAN_DOMAINS: CarePlanDomain[] = [
  "Personal care",
  "Mobility and moving & handling",
  "Nutrition and hydration",
  "Continence",
  "Skin integrity / pressure care",
  "Communication",
  "Mental health and emotional wellbeing",
  "Cognition / memory",
  "Medication",
  "Breathing",
  "Sleep",
  "Safety and safeguarding",
  "Social activities and relationships",
  "End-of-life care",
];

export const RISK_ASSESSMENTS: RiskAssessment[] = [
  "Falls risk assessment",
  "Pressure ulcer / skin integrity risk",
  "Nutrition / malnutrition (MUST)",
  "Moving and handling risk",
  "Continence risk",
  "Medication risk",
  "Environmental safety risk",
  "Behavioural risk",
  "Mental capacity / cognition",
  "General risk assessment",
];

export type CarePlanKind = "domain" | "risk";

export interface CarePlanEntry {
  id: string;
  residentId: string;
  kind: CarePlanKind;
  area: CarePlanDomain | RiskAssessment;
  transcript: string;
  content: string;
  author: string;
  updatedAt: string;
  reviewDue?: string;
}

const STORAGE_KEY = "caresound.careplans.v1";

function read(): CarePlanEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CarePlanEntry[]) : seed();
  } catch {
    return [];
  }
}

function write(entries: CarePlanEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function seed(): CarePlanEntry[] {
  const now = new Date().toISOString();
  const seeded: CarePlanEntry[] = [
    {
      id: "cp-1",
      residentId: "r-001",
      kind: "domain",
      area: "Personal care",
      transcript: "Mary likes a warm shower in the morning, prefers female carers, uses lavender body wash.",
      content:
        "Mary prefers a warm shower each morning with the support of a female carer. Lavender body wash is to be used. Encourage independence with face and hands. Privacy and dignity to be maintained throughout.",
      author: "Priya Singh (Nurse)",
      updatedAt: now,
      reviewDue: "2026-09-12",
    },
    {
      id: "cp-2",
      residentId: "r-002",
      kind: "risk",
      area: "Falls risk assessment",
      transcript: "John is high risk for falls, near fall this week, needs walking frame and supervision in corridors.",
      content:
        "John is assessed as HIGH risk of falls. A near-fall was recorded this week. Walking frame to be in reach at all times. Staff supervision required when mobilising in corridors. Sensor mat in place at bedside overnight.",
      author: "Marcus Bell (Senior Carer)",
      updatedAt: now,
      reviewDue: "2026-07-10",
    },
  ];
  write(seeded);
  return seeded;
}

export function getEntries(residentId?: string): CarePlanEntry[] {
  const all = read();
  return residentId ? all.filter((e) => e.residentId === residentId) : all;
}

export function upsertEntry(entry: CarePlanEntry) {
  const all = read();
  const idx = all.findIndex((e) => e.id === entry.id);
  if (idx >= 0) all[idx] = entry;
  else all.unshift(entry);
  write(all);
}

export function deleteEntry(id: string) {
  write(read().filter((e) => e.id !== id));
}

/** Naive "AI" formatter for care plan prose. */
export function formatCarePlanText(transcript: string, residentName: string): string {
  let t = transcript.trim();
  if (!t) return "";
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.!?]$/.test(t)) t += ".";
  const replacements: [RegExp, string][] = [
    [/\bi\b/g, "Staff"],
    [/\blikes\b/gi, "prefers"],
    [/\bneeds\b/gi, "requires"],
    [/\bgive\b/gi, "provide"],
    [/\bhelp\b/gi, "support"],
    [/\bok\b/gi, "settled"],
    [/\bhigh risk\b/gi, "assessed as HIGH risk"],
    [/\blow risk\b/gi, "assessed as LOW risk"],
    [/\bmedium risk\b/gi, "assessed as MEDIUM risk"],
  ];
  for (const [re, sub] of replacements) t = t.replace(re, sub);
  if (!t.toLowerCase().includes(residentName.toLowerCase())) {
    t = `${residentName}: ${t}`;
  }
  return t;
}
