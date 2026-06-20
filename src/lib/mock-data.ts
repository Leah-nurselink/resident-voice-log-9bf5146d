export type CareCategory =
  | "Personal care"
  | "Nutrition & hydration"
  | "Mobility"
  | "Skin integrity"
  | "Emotional wellbeing"
  | "Family communication"
  | "Medication"
  | "Continence"
  | "Sleep"
  | "Safeguarding"
  | "Social activities";

export type IncidentFlag =
  | "fall"
  | "injury"
  | "bruising"
  | "refused medication"
  | "weight loss"
  | "aggressive behaviour"
  | "safeguarding";

export interface CareNote {
  id: string;
  residentId: string;
  category: CareCategory;
  transcript: string;
  note: string;
  author: string;
  createdAt: string; // ISO
  flags: IncidentFlag[];
  status: "draft" | "approved";
}

export interface Resident {
  id: string;
  name: string;
  room: string;
  dob: string;
  photo: string;
  preferredName?: string;
  unit: string;
  tagId: string;
  riskLevel: "low" | "medium" | "high";
  carePlanDomains: string[];
  emergencyContact: { name: string; relation: string; phone: string };
  family: { name: string; relation: string; phone: string }[];
}

export const residents: Resident[] = [
  {
    id: "r-001",
    name: "Mary Whitfield",
    preferredName: "Mary",
    room: "12A",
    dob: "1938-04-12",
    photo: "https://i.pravatar.cc/200?img=47",
    unit: "Lavender Wing",
    tagId: "NFC-8821",
    riskLevel: "medium",
    carePlanDomains: ["Personal care", "Mobility", "Skin integrity", "Cognition"],
    emergencyContact: { name: "Sarah Whitfield", relation: "Daughter", phone: "07700 900123" },
    family: [{ name: "Sarah Whitfield", relation: "Daughter", phone: "07700 900123" }],
  },
  {
    id: "r-002",
    name: "John Patterson",
    preferredName: "John",
    room: "08",
    dob: "1942-11-03",
    photo: "https://i.pravatar.cc/200?img=12",
    unit: "Oakwood Wing",
    tagId: "NFC-4419",
    riskLevel: "high",
    carePlanDomains: ["Mobility", "Falls", "Medication", "Nutrition"],
    emergencyContact: { name: "Linda Patterson", relation: "Daughter", phone: "07700 900456" },
    family: [{ name: "Linda Patterson", relation: "Daughter", phone: "07700 900456" }],
  },
  {
    id: "r-003",
    name: "Edith Hollis",
    preferredName: "Edie",
    room: "14",
    dob: "1935-07-22",
    photo: "https://i.pravatar.cc/200?img=45",
    unit: "Lavender Wing",
    tagId: "NFC-7762",
    riskLevel: "low",
    carePlanDomains: ["Personal care", "Social activities"],
    emergencyContact: { name: "Tom Hollis", relation: "Son", phone: "07700 900789" },
    family: [{ name: "Tom Hollis", relation: "Son", phone: "07700 900789" }],
  },
  {
    id: "r-004",
    name: "Albert Reyes",
    preferredName: "Bert",
    room: "21",
    dob: "1940-01-30",
    photo: "https://i.pravatar.cc/200?img=15",
    unit: "Oakwood Wing",
    tagId: "NFC-3310",
    riskLevel: "medium",
    carePlanDomains: ["Continence", "Sleep", "Emotional wellbeing"],
    emergencyContact: { name: "Maria Reyes", relation: "Wife", phone: "07700 900222" },
    family: [{ name: "Maria Reyes", relation: "Wife", phone: "07700 900222" }],
  },
];

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();

export const careNotes: CareNote[] = [
  {
    id: "n-1",
    residentId: "r-001",
    category: "Personal care",
    transcript: "Assisted Mary with personal care. Skin intact. No concerns noted.",
    note: "Supported Mary with morning personal care. Skin assessed — intact with no signs of redness or breakdown. Mary engaged well and reported no discomfort.",
    author: "Aisha Khan (Care Assistant)",
    createdAt: hoursAgo(1.5),
    flags: [],
    status: "approved",
  },
  {
    id: "n-2",
    residentId: "r-001",
    category: "Nutrition & hydration",
    transcript: "Mary ate about half her breakfast and drank a full cup of tea.",
    note: "Mary consumed approximately 50% of her breakfast and a full cup of tea. Encouraged to continue with mid-morning snack. Appetite to be monitored.",
    author: "Aisha Khan (Care Assistant)",
    createdAt: hoursAgo(4),
    flags: [],
    status: "approved",
  },
  {
    id: "n-3",
    residentId: "r-002",
    category: "Mobility",
    transcript: "John had a near fall in the corridor near the lounge. Caught his arm in time. No injury.",
    note: "John experienced a near-fall in the corridor adjacent to the lounge. Staff intervened and supported him before impact. No injury sustained. Falls risk assessment to be reviewed.",
    author: "Marcus Bell (Senior Carer)",
    createdAt: hoursAgo(2),
    flags: ["fall"],
    status: "approved",
  },
  {
    id: "n-4",
    residentId: "r-002",
    category: "Family communication",
    transcript: "Spoke with John's daughter Linda about his mobility and the GP appointment on Friday.",
    note: "Discussed John's recent mobility changes with daughter Linda. Confirmed upcoming GP appointment on Friday. Linda will attend.",
    author: "Marcus Bell (Senior Carer)",
    createdAt: hoursAgo(6),
    flags: [],
    status: "approved",
  },
  {
    id: "n-5",
    residentId: "r-002",
    category: "Medication",
    transcript: "John refused his evening blood pressure tablet again.",
    note: "John declined his evening antihypertensive medication. Reason given: 'feeling tired.' Refusal recorded; nurse in charge informed.",
    author: "Priya Singh (Nurse)",
    createdAt: hoursAgo(14),
    flags: ["refused medication"],
    status: "approved",
  },
  {
    id: "n-6",
    residentId: "r-003",
    category: "Social activities",
    transcript: "Edie joined the singing group and was really enjoying herself.",
    note: "Edie participated in the afternoon singing group. Presented as cheerful and engaged throughout. Positive mood noted.",
    author: "Aisha Khan (Care Assistant)",
    createdAt: hoursAgo(3),
    flags: [],
    status: "approved",
  },
  {
    id: "n-7",
    residentId: "r-004",
    category: "Sleep",
    transcript: "Bert was up several times last night, restless and asking for his wife.",
    note: "Bert had a disturbed night with multiple wakings. Appeared restless and was searching for his wife. Reassurance provided. To monitor and discuss with nurse in charge.",
    author: "Tom Pritchard (Night Carer)",
    createdAt: hoursAgo(10),
    flags: [],
    status: "approved",
  },
];

export const incidentKeywords: { keyword: string; flag: IncidentFlag }[] = [
  { keyword: "fall", flag: "fall" },
  { keyword: "fell", flag: "fall" },
  { keyword: "injury", flag: "injury" },
  { keyword: "injured", flag: "injury" },
  { keyword: "bruis", flag: "bruising" },
  { keyword: "refused medication", flag: "refused medication" },
  { keyword: "refused his", flag: "refused medication" },
  { keyword: "refused her", flag: "refused medication" },
  { keyword: "weight loss", flag: "weight loss" },
  { keyword: "lost weight", flag: "weight loss" },
  { keyword: "aggressive", flag: "aggressive behaviour" },
  { keyword: "hit", flag: "aggressive behaviour" },
  { keyword: "safeguard", flag: "safeguarding" },
];

export function detectFlags(text: string): IncidentFlag[] {
  const lower = text.toLowerCase();
  const flags = new Set<IncidentFlag>();
  for (const { keyword, flag } of incidentKeywords) {
    if (lower.includes(keyword)) flags.add(flag);
  }
  return Array.from(flags);
}

export function inferCategory(text: string): CareCategory {
  const t = text.toLowerCase();
  if (/wash|bath|shower|dress|personal care|continen/.test(t)) return "Personal care";
  if (/eat|ate|drink|drank|meal|breakfast|lunch|dinner|fluid|hydrat/.test(t)) return "Nutrition & hydration";
  if (/walk|mobil|fall|fell|transfer|hoist/.test(t)) return "Mobility";
  if (/skin|redness|pressure|sore|wound|bruis/.test(t)) return "Skin integrity";
  if (/mood|happy|sad|anxious|distress|wellbeing|emotion/.test(t)) return "Emotional wellbeing";
  if (/famil|daughter|son|wife|husband|relative|spoke with/.test(t)) return "Family communication";
  if (/medic|tablet|dose|prn/.test(t)) return "Medication";
  if (/sleep|night|restless|woke|awake/.test(t)) return "Sleep";
  if (/safeguard|abus|neglect/.test(t)) return "Safeguarding";
  return "Personal care";
}

/** Naive "AI" formatter — replaces fragments with more professional phrasing. */
export function formatProfessionalNote(transcript: string, residentName: string): string {
  let t = transcript.trim();
  if (!t) return "";
  // Capitalise first letter
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.!?]$/.test(t)) t += ".";

  const replacements: [RegExp, string][] = [
    [/\bi\b/g, "Staff"],
    [/\bme\b/gi, "staff"],
    [/\bgave\b/gi, "administered"],
    [/\bate\b/gi, "consumed"],
    [/\bdrank\b/gi, "consumed fluids of"],
    [/\bhappy\b/gi, "in good spirits"],
    [/\bsad\b/gi, "low in mood"],
    [/\bok\b/gi, "settled"],
    [/\bfine\b/gi, "settled"],
  ];
  for (const [re, sub] of replacements) t = t.replace(re, sub);

  // Add a closing line for clinical clarity
  const closing = ` ${residentName} appeared comfortable at the end of the interaction.`;
  if (!t.toLowerCase().includes(residentName.toLowerCase())) {
    t = `${residentName}: ${t}`;
  }
  return t + closing;
}
