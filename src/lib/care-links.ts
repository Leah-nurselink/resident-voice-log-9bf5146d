import type { CareNote, Resident } from "@/lib/mock-data";
import { residents } from "@/lib/mock-data";
import { CARE_PLAN_DOMAINS, type CarePlanDomain } from "@/lib/care-plan-data";

export type RiskKey = "falls" | "skin" | "nutrition" | "mobility" | "medication" | "behaviour";

export const RISK_LABEL: Record<RiskKey, string> = {
  falls: "Falls",
  skin: "Skin integrity",
  nutrition: "Nutrition",
  mobility: "Mobility",
  medication: "Medication",
  behaviour: "Behaviour",
};

export type RiskLevel = "low" | "medium" | "high" | "info";

export interface ResidentRisk {
  key: RiskKey;
  level: RiskLevel;
  note?: string; // e.g. "Assisted x1"
  reviewedAt: string; // display label e.g. "12 Jun"
}

/** Per-resident risk summary used for the profile banner + side panel. */
export const RESIDENT_RISKS: Record<string, ResidentRisk[]> = {
  "r-001": [
    { key: "falls", level: "medium", reviewedAt: "12 Jun" },
    { key: "skin", level: "medium", reviewedAt: "12 Jun" },
    { key: "nutrition", level: "low", reviewedAt: "01 Jun" },
    { key: "mobility", level: "info", note: "Assisted x1", reviewedAt: "12 Jun" },
  ],
  "r-002": [
    { key: "falls", level: "high", reviewedAt: "18 Jun" },
    { key: "mobility", level: "high", note: "Frame + supervision", reviewedAt: "18 Jun" },
    { key: "medication", level: "medium", reviewedAt: "10 Jun" },
    { key: "nutrition", level: "medium", reviewedAt: "01 Jun" },
  ],
  "r-003": [
    { key: "falls", level: "low", reviewedAt: "05 Jun" },
    { key: "skin", level: "low", reviewedAt: "05 Jun" },
  ],
  "r-004": [
    { key: "behaviour", level: "medium", reviewedAt: "14 Jun" },
    { key: "falls", level: "low", reviewedAt: "05 Jun" },
  ],
};

export const RISK_TONE: Record<RiskLevel, string> = {
  low: "bg-success/15 text-success",
  medium: "bg-warning/20 text-warning-foreground",
  high: "bg-destructive/15 text-destructive",
  info: "bg-secondary text-secondary-foreground",
};

/* ---------------- Inference ---------------- */

const DOMAIN_PATTERNS: Array<{ re: RegExp; domain: CarePlanDomain }> = [
  { re: /wash|bath|shower|dress|personal care|grooming/i, domain: "Personal care" },
  { re: /mobil|walk|zimmer|frame|transfer|hoist|unsteady|balance|fell|fall/i, domain: "Mobility and moving & handling" },
  { re: /eat|ate|drink|drank|meal|breakfast|lunch|dinner|appetite|fluid|hydrat|weight/i, domain: "Nutrition and hydration" },
  { re: /continen|incontin|toilet|pad|catheter/i, domain: "Continence" },
  { re: /skin|redness|pressure|sore|wound|bruis|reposition/i, domain: "Skin integrity / pressure care" },
  { re: /communicat|speech|hearing|verbal/i, domain: "Communication" },
  { re: /mood|anxious|distress|wellbeing|emotion|low in mood|tearful|depress/i, domain: "Mental health and emotional wellbeing" },
  { re: /confus|memory|dement|disorient/i, domain: "Cognition / memory" },
  { re: /medic|tablet|dose|prn|antibiotic|paracetamol/i, domain: "Medication" },
  { re: /breath|short of breath|sob|cough|oxygen|chest/i, domain: "Breathing" },
  { re: /sleep|night|restless|woke|awake/i, domain: "Sleep" },
  { re: /safeguard|abus|neglect|hit|aggressive|harm/i, domain: "Safety and safeguarding" },
  { re: /activit|social|singing|group|visit|family|daughter|son|wife|husband|spoke with/i, domain: "Social activities and relationships" },
  { re: /end.of.life|palliat|terminal|advance care/i, domain: "End-of-life care" },
];

const RISK_PATTERNS: Array<{ re: RegExp; risk: RiskKey }> = [
  { re: /fall|fell|unsteady|balance|dizzy|near.fall/i, risk: "falls" },
  { re: /mobil|walk|zimmer|frame|transfer|hoist/i, risk: "mobility" },
  { re: /skin|red|pressure|sore|wound|bruis|reposition/i, risk: "skin" },
  { re: /eat|ate|drink|drank|appetite|weight|fluid|hydrat|meal/i, risk: "nutrition" },
  { re: /medic|tablet|dose|refused (his|her|the)/i, risk: "medication" },
  { re: /aggressive|agitat|distress|hit|shout|restless/i, risk: "behaviour" },
];

export function inferCarePlanDomain(text: string): CarePlanDomain {
  for (const { re, domain } of DOMAIN_PATTERNS) {
    if (re.test(text)) return domain;
  }
  return "Personal care";
}

export function inferRiskLinks(text: string): RiskKey[] {
  const out = new Set<RiskKey>();
  for (const { re, risk } of RISK_PATTERNS) {
    if (re.test(text)) out.add(risk);
  }
  // Mobility implies falls
  if (out.has("mobility")) out.add("falls");
  return Array.from(out);
}

/** Combined view for one note. */
export function linksForNote(note: CareNote) {
  const text = `${note.transcript} ${note.note}`;
  return {
    domain: inferCarePlanDomain(text),
    risks: inferRiskLinks(text),
  };
}

/* ---------------- Pattern detection ---------------- */

export interface RiskPattern {
  residentId: string;
  resident: Resident;
  risk: RiskKey;
  count: number;
  windowDays: number;
  notes: CareNote[];
}

export function detectRiskPatterns(notes: CareNote[], windowDays = 7, threshold = 3): RiskPattern[] {
  const cutoff = Date.now() - windowDays * 24 * 3600_000;
  const buckets = new Map<string, CareNote[]>();
  for (const n of notes) {
    if (new Date(n.createdAt).getTime() < cutoff) continue;
    for (const risk of inferRiskLinks(`${n.transcript} ${n.note}`)) {
      const k = `${n.residentId}::${risk}`;
      const arr = buckets.get(k) ?? [];
      arr.push(n);
      buckets.set(k, arr);
    }
  }
  const patterns: RiskPattern[] = [];
  for (const [k, arr] of buckets) {
    if (arr.length < threshold) continue;
    const [residentId, risk] = k.split("::") as [string, RiskKey];
    const resident = residents.find((r) => r.id === residentId);
    if (!resident) continue;
    patterns.push({ residentId, resident, risk, count: arr.length, windowDays, notes: arr });
  }
  return patterns.sort((a, b) => b.count - a.count);
}

/* ---------------- Due-task derivation ---------------- */

export type TaskKind =
  | "Personal care"
  | "Welfare check"
  | "Repositioning"
  | "Fluid intake"
  | "Medication";

interface TaskRule {
  kind: TaskKind;
  /** Match a note category/text to recognise this kind of activity. */
  matches: (n: CareNote) => boolean;
  /** Maximum hours allowed between activities of this kind. */
  intervalHours: number;
  /** Only generate this task for residents meeting this filter. */
  appliesTo?: (r: Resident) => boolean;
}

const TASK_RULES: TaskRule[] = [
  {
    kind: "Personal care",
    intervalHours: 8,
    matches: (n) => n.category === "Personal care",
  },
  {
    kind: "Welfare check",
    intervalHours: 4,
    matches: () => false, // welfare checks aren't seeded — always due
  },
  {
    kind: "Fluid intake",
    intervalHours: 4,
    matches: (n) => n.category === "Nutrition & hydration",
  },
  {
    kind: "Repositioning",
    intervalHours: 3,
    matches: (n) => /reposition|pressure|skin/i.test(`${n.transcript} ${n.note}`),
    appliesTo: (r) => (RESIDENT_RISKS[r.id] ?? []).some((x) => x.key === "skin" && x.level !== "low"),
  },
  {
    kind: "Medication",
    intervalHours: 8,
    matches: (n) => n.category === "Medication",
    appliesTo: (r) => (RESIDENT_RISKS[r.id] ?? []).some((x) => x.key === "medication"),
  },
];

export interface DueTask {
  resident: Resident;
  kind: TaskKind;
  lastAt?: string;
  hoursOverdue: number;
}

export function dueTasks(allNotes: CareNote[]): DueTask[] {
  const tasks: DueTask[] = [];
  const now = Date.now();
  for (const r of residents) {
    const rNotes = allNotes.filter((n) => n.residentId === r.id);
    for (const rule of TASK_RULES) {
      if (rule.appliesTo && !rule.appliesTo(r)) continue;
      const last = rNotes
        .filter(rule.matches)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const lastTime = last ? new Date(last.createdAt).getTime() : 0;
      const hoursSince = lastTime ? (now - lastTime) / 3600_000 : rule.intervalHours + 1;
      if (hoursSince > rule.intervalHours) {
        tasks.push({
          resident: r,
          kind: rule.kind,
          lastAt: last?.createdAt,
          hoursOverdue: Math.round(hoursSince - rule.intervalHours),
        });
      }
    }
  }
  return tasks.sort((a, b) => b.hoursOverdue - a.hoursOverdue);
}
