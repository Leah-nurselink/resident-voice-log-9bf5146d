export type AuditQuestion = { id: string; text: string };
export type AuditDefinition = { key: string; title: string; questions: AuditQuestion[] };

const q = (id: string, text: string) => ({ id, text });

export const AUDIT_DEFINITIONS: AuditDefinition[] = [
  {
    key: "care_plan",
    title: "Care plan audit",
    questions: [
      q("cp1", "Is the care plan person-centred and written in the first person where appropriate?"),
      q("cp2", "Are all relevant care plan domains in place (personal care, mobility, nutrition, etc.)?"),
      q("cp3", "Has the care plan been reviewed within the last month?"),
      q("cp4", "Do risk assessments align with the care plan content?"),
      q("cp5", "Is there evidence of resident/family involvement in the plan?"),
      q("cp6", "Are MCA and consent records up to date?"),
      q("cp7", "Are daily notes consistent with the care described in the plan?"),
    ],
  },
  {
    key: "safe_staffing",
    title: "Safe staffing audit",
    questions: [
      q("ss1", "Are staffing levels meeting the dependency tool requirement?"),
      q("ss2", "Is the skill mix appropriate (nurses, seniors, carers) for the shift?"),
      q("ss3", "Have all shifts in the past week been covered without unsafe gaps?"),
      q("ss4", "Are agency/bank staff inducted before starting?"),
      q("ss5", "Are call bell response times within target?"),
      q("ss6", "Are supervisions and handovers happening as scheduled?"),
    ],
  },
  {
    key: "medication",
    title: "Medication audit",
    questions: [
      q("m1", "Are MAR charts fully signed with no unexplained gaps?"),
      q("m2", "Does physical stock reconcile with MAR records?"),
      q("m3", "Are controlled drugs balances correct and double-signed?"),
      q("m4", "Are PRN protocols in place and being followed?"),
      q("m5", "Are medication fridge temperatures recorded daily and within range?"),
      q("m6", "Are covert medication authorisations current and MCA-backed?"),
      q("m7", "Are allergies clearly recorded on every MAR?"),
    ],
  },
  {
    key: "activities",
    title: "Activities & wellbeing audit",
    questions: [
      q("a1", "Is there a varied weekly activity programme on display?"),
      q("a2", "Are residents who decline group activities offered 1:1 engagement?"),
      q("a3", "Are individual interests and life histories reflected in activities?"),
      q("a4", "Is participation recorded for each resident?"),
      q("a5", "Are residents with cognitive impairment included meaningfully?"),
    ],
  },
  {
    key: "night",
    title: "Night audit",
    questions: [
      q("n1", "Were all scheduled night-time checks completed and signed?"),
      q("n2", "Is the building secure and exits monitored?"),
      q("n3", "Are sleep observations documented (where required)?"),
      q("n4", "Are repositioning schedules being followed overnight?"),
      q("n5", "Are night staff alert, visible, and not congregating?"),
      q("n6", "Has the night walkaround been completed by the senior?"),
    ],
  },
  {
    key: "laundry",
    title: "Laundry audit",
    questions: [
      q("l1", "Is dirty and clean linen segregated correctly?"),
      q("l2", "Are infected/red-bag items handled per IPC policy?"),
      q("l3", "Is personal clothing labelled and returned to the correct resident?"),
      q("l4", "Are wash temperatures appropriate (≥71°C for 3 min)?"),
      q("l5", "Is the laundry area clean and uncluttered?"),
    ],
  },
  {
    key: "kitchen",
    title: "Kitchen audit",
    questions: [
      q("k1", "Are fridge and freezer temperatures within range and logged?"),
      q("k2", "Are food probe temperatures recorded for cooked/reheated food?"),
      q("k3", "Are allergens clearly identified on the menu and at point of service?"),
      q("k4", "Are cleaning schedules signed and complete?"),
      q("k5", "Is food storage rotation (FIFO) in place with no out-of-date stock?"),
      q("k6", "Do staff have current food hygiene training?"),
    ],
  },
  {
    key: "home_environment",
    title: "Home environment audit",
    questions: [
      q("h1", "Are communal areas clean, tidy and free of trip hazards?"),
      q("h2", "Are repairs logged and being actioned in a reasonable time?"),
      q("h3", "Are bedrooms personalised and dignified?"),
      q("h4", "Are fire doors, exits and signage in good order?"),
      q("h5", "Are odours managed and IPC standards visibly maintained?"),
    ],
  },
  {
    key: "call_bell",
    title: "Call bell audit",
    questions: [
      q("cb1", "Is the average call bell response time under 5 minutes?"),
      q("cb2", "Are call bells within reach of every resident in bed and in chairs?"),
      q("cb3", "Are repeated long responses investigated?"),
      q("cb4", "Are call bell logs reviewed by the unit lead each week?"),
    ],
  },
  {
    key: "personal_care",
    title: "Showers, bedbath & bath audit",
    questions: [
      q("pc1", "Has each resident received personal care in line with their plan?"),
      q("pc2", "Are showers/baths offered at preferred frequency (not just bedbaths by default)?"),
      q("pc3", "Is dignity maintained (doors closed, towels used, choice offered)?"),
      q("pc4", "Are skin observations recorded after each wash?"),
      q("pc5", "Are residents' preferences for carer gender respected?"),
    ],
  },
  {
    key: "equipment",
    title: "Medical equipment audit & registry",
    questions: [
      q("e1", "Is every piece of equipment on the asset register?"),
      q("e2", "Are servicing and calibration dates current (hoists, scales, BP monitors)?"),
      q("e3", "Are LOLER inspections in date for lifting equipment?"),
      q("e4", "Are faulty items removed from use and clearly labelled?"),
      q("e5", "Are slings checked before each use and recorded?"),
    ],
  },
  {
    key: "antipsychotic",
    title: "Anti-psychotic audit",
    questions: [
      q("ap1", "Is every anti-psychotic prescription linked to a documented indication?"),
      q("ap2", "Has a STOMP review been completed in the last 12 weeks?"),
      q("ap3", "Are non-pharmacological interventions tried and recorded first?"),
      q("ap4", "Are side-effects monitored and documented?"),
      q("ap5", "Has the GP been consulted on dose reduction where appropriate?"),
      q("ap6", "Is MCA / best interest documentation in place?"),
    ],
  },
];

export const getAuditByTitle = (title: string) =>
  AUDIT_DEFINITIONS.find((a) => title.toLowerCase().startsWith(a.title.toLowerCase())) ??
  AUDIT_DEFINITIONS.find((a) => title.toLowerCase().includes(a.title.toLowerCase().split(" ")[0]));

export type AuditAnswer = "yes" | "no" | "na";
export type AuditSubmission = {
  id: string;
  auditKey: string;
  auditTitle: string;
  completedAt: string;
  completedBy: string;
  unit?: string;
  answers: Record<string, { answer: AuditAnswer; note?: string }>;
  summary: string;
  compliance: number; // 0-100
};

const STORAGE_KEY = "carecore.audit_submissions";

export function loadSubmissions(): AuditSubmission[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveSubmission(sub: AuditSubmission) {
  const all = loadSubmissions();
  all.unshift(sub);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 200)));
}
