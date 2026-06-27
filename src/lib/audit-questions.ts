export type AuditQuestion = { id: string; text: string };
export type AuditDefinition = { key: string; title: string; questions: AuditQuestion[] };

const mk = (prefix: string, texts: string[]): AuditQuestion[] =>
  texts.map((text, i) => ({ id: `${prefix}${i + 1}`, text }));

export const AUDIT_DEFINITIONS: AuditDefinition[] = [
  {
    key: "care_plan",
    title: "Care plan audit",
    questions: mk("cp", [
      "Is the care plan person-centred and written in the first person where appropriate?",
      "Are all relevant care plan domains in place (personal care, mobility, nutrition, continence, skin, communication, mental health, cognition, medication, breathing, sleep, safety, social, end-of-life)?",
      "Has the care plan been reviewed within the last month?",
      "Do risk assessments align with the care plan content?",
      "Is there documented evidence of resident involvement in the plan?",
      "Is there documented evidence of family / advocate involvement where appropriate?",
      "Are MCA assessments in place where capacity is in doubt?",
      "Are consent records current and signed?",
      "Are daily notes consistent with the care described in the plan?",
      "Are outcomes / goals SMART and measurable?",
      "Are cultural, religious and dietary preferences recorded?",
      "Are communication needs (hearing, sight, language) clearly documented?",
      "Is the resident's life history / 'This is me' document in place?",
      "Are advance care plans / DNACPR clearly visible to staff?",
      "Are allergies and medical alerts on the front sheet?",
      "Are weights, MUST and Waterlow scores up to date?",
      "Are changes since the last review clearly recorded with author and date?",
      "Is the care plan accessible (digitally or in print) to the staff providing care?",
    ]),
  },
  {
    key: "safe_staffing",
    title: "Safe staffing audit",
    questions: mk("ss", [
      "Are staffing levels meeting the dependency tool requirement?",
      "Is the skill mix appropriate for the shift (nurses, seniors, carers)?",
      "Have all shifts in the past 7 days been covered without unsafe gaps?",
      "Are agency / bank staff inducted before starting their shift?",
      "Are call bell response times within target?",
      "Are supervisions taking place at the required frequency?",
      "Are handovers structured and documented?",
      "Is there a nominated person in charge on every shift?",
      "Are mandatory training compliance rates ≥ 90%?",
      "Are role-specific competencies (e.g. catheter care, PEG, end of life) up to date?",
      "Are sickness and absence patterns reviewed weekly?",
      "Is there a clear escalation route when staffing falls short?",
      "Are night shifts staffed in line with the assessed dependency?",
      "Are staff allocated by resident need, not just by room?",
      "Are breaks being taken and recorded?",
      "Is overtime monitored to prevent fatigue?",
      "Are new starters supernumerary for the required period?",
      "Are staff confident raising concerns about staffing?",
    ]),
  },
  {
    key: "medication",
    title: "Medication audit",
    questions: mk("m", [
      "Are MAR charts fully signed with no unexplained gaps?",
      "Does physical stock reconcile with MAR records?",
      "Are controlled drugs balances correct and double-signed?",
      "Are PRN protocols in place for every 'as required' medication?",
      "Are PRN administrations followed up with effectiveness recording?",
      "Are medication fridge temperatures recorded daily and within 2–8°C?",
      "Are room temperatures for medicines storage within range?",
      "Are covert medication authorisations current and MCA-backed?",
      "Are allergies clearly recorded on every MAR?",
      "Are 'when required' time-critical medicines (e.g. Parkinson's) given on time?",
      "Are medicines disposed of via an audited returns process?",
      "Are homely remedies authorised and documented?",
      "Are self-medicating residents risk-assessed?",
      "Are thickeners stored safely and signed for?",
      "Are antibiotics reviewed against stewardship guidance?",
      "Are recent medication errors logged, investigated and learned from?",
      "Are staff administering medication competency-assessed in the last 12 months?",
      "Are GP / pharmacy reviews completed at required intervals?",
    ]),
  },
  {
    key: "activities",
    title: "Activities & wellbeing audit",
    questions: mk("a", [
      "Is there a varied weekly activity programme on display?",
      "Are residents who decline group activities offered 1:1 engagement?",
      "Are individual interests and life histories reflected in activities?",
      "Is participation recorded for each resident?",
      "Are residents with cognitive impairment included meaningfully?",
      "Are bed-bound residents offered in-room activities?",
      "Are residents able to access outdoors regularly?",
      "Are community / intergenerational links being maintained?",
      "Are religious and cultural needs supported through activity?",
      "Are residents involved in choosing the programme?",
      "Is there evidence of meaningful occupation, not just entertainment?",
      "Are pets / animal visits offered where appropriate?",
      "Are evenings and weekends covered, not just weekdays?",
      "Are families invited to events?",
      "Are activity outcomes (mood, engagement) tracked?",
      "Are staff trained in dementia-friendly activity approaches?",
      "Is the activity budget being used and accounted for?",
    ]),
  },
  {
    key: "night",
    title: "Night audit",
    questions: mk("n", [
      "Were all scheduled night-time checks completed and signed?",
      "Is the building secure and exits monitored?",
      "Are sleep observations documented where required?",
      "Are repositioning schedules being followed overnight?",
      "Are night staff alert, visible, and not congregating?",
      "Has the night walkaround been completed by the senior?",
      "Are continence checks happening in line with care plans?",
      "Are PRN / night-time medications administered correctly?",
      "Is lighting appropriate (dim but safe) in corridors?",
      "Are noise levels minimised on the unit?",
      "Are kitchens, drug rooms and offices locked overnight?",
      "Is the call bell response time acceptable on nights?",
      "Are residents up overnight engaged safely?",
      "Are night staff aware of resident-specific risks (falls, wandering)?",
      "Is there a clear escalation route to on-call?",
      "Are handovers to the day shift complete and timely?",
      "Are fire panel and emergency systems checked at handover?",
    ]),
  },
  {
    key: "laundry",
    title: "Laundry audit",
    questions: mk("l", [
      "Is dirty and clean linen segregated correctly?",
      "Are infected / red-bag items handled per IPC policy?",
      "Is personal clothing labelled and returned to the correct resident?",
      "Are wash temperatures appropriate (≥71°C for 3 min, or sluice cycle)?",
      "Is the laundry area clean and uncluttered?",
      "Are dirty-to-clean workflows one-directional?",
      "Are PPE supplies available at the point of use?",
      "Are washing machines and dryers serviced and in date?",
      "Are linen stock levels adequate for the service?",
      "Are damaged items removed from circulation?",
      "Are staff trained in laundry / IPC procedures?",
      "Are lost-property processes effective?",
      "Are chemical COSHH sheets accessible?",
      "Are chemicals stored securely?",
      "Is hand hygiene equipment available in the laundry?",
      "Are residents' preferences for clothing care respected?",
    ]),
  },
  {
    key: "kitchen",
    title: "Kitchen audit",
    questions: mk("k", [
      "Are fridge and freezer temperatures within range and logged?",
      "Are food probe temperatures recorded for cooked / reheated food?",
      "Are allergens clearly identified on the menu and at point of service?",
      "Are cleaning schedules signed and complete?",
      "Is food storage rotation (FIFO) in place with no out-of-date stock?",
      "Do staff have current food hygiene training (Level 2+)?",
      "Are personalised dietary requirements (IDDSI, diabetic, etc.) catered for?",
      "Are fortified diets provided where prescribed?",
      "Are residents' food preferences recorded and respected?",
      "Are mealtimes calm and unhurried?",
      "Is the kitchen pest-free and well maintained?",
      "Are knives / equipment stored safely?",
      "Are food deliveries checked and recorded on arrival?",
      "Are nutritional intake records completed where required?",
      "Are snacks and drinks available 24/7?",
      "Is the EHO rating current (and at 5 where possible)?",
      "Are HACCP records up to date?",
    ]),
  },
  {
    key: "home_environment",
    title: "Home environment audit",
    questions: mk("h", [
      "Are communal areas clean, tidy and free of trip hazards?",
      "Are repairs logged and being actioned in a reasonable time?",
      "Are bedrooms personalised and dignified?",
      "Are fire doors, exits and signage in good order?",
      "Are odours managed and IPC standards visibly maintained?",
      "Are floors free of clutter, cables and slip hazards?",
      "Is the temperature comfortable across the building?",
      "Are bathrooms clean and stocked (soap, towels, gloves)?",
      "Are PPE stations available and replenished?",
      "Are window restrictors in place and intact?",
      "Are radiator covers in place where needed?",
      "Are emergency lighting and call points functional?",
      "Is signage dementia-friendly?",
      "Are outdoor spaces accessible and safe?",
      "Are infection-control posters current?",
      "Are clinical waste bins not overfilled and locked where required?",
      "Is dignity maintained (doors closed, screens used)?",
      "Are residents' belongings stored securely?",
    ]),
  },
  {
    key: "call_bell",
    title: "Call bell audit",
    questions: mk("cb", [
      "Is the average call bell response time under 5 minutes?",
      "Are call bells within reach of every resident in bed?",
      "Are call bells within reach of every resident in their chair?",
      "Are repeated long responses investigated?",
      "Are call bell logs reviewed by the unit lead each week?",
      "Are call bells tested and functional in every room?",
      "Are response times broken down by time of day (day / evening / night)?",
      "Are residents with limited dexterity offered adapted call options?",
      "Are mobile / pendant call devices issued where assessed?",
      "Are bathrooms and toilets fitted with red pull cords?",
      "Are pull cords clear of the floor and accessible?",
      "Are repeat-caller residents reviewed for unmet need?",
      "Are staff allocations adjusted based on call bell patterns?",
      "Are residents and families informed how to use the call bell?",
      "Is there a process for muted / disabled bells?",
      "Are call bell reports shared with the registered manager?",
    ]),
  },
  {
    key: "personal_care",
    title: "Showers, bedbath & bath audit",
    questions: mk("pc", [
      "Has each resident received personal care in line with their plan?",
      "Are showers / baths offered at preferred frequency (not bedbaths by default)?",
      "Is dignity maintained (doors closed, towels used, choice offered)?",
      "Are skin observations recorded after each wash?",
      "Are residents' preferences for carer gender respected?",
      "Are oral / denture care needs being met daily?",
      "Are nails clean and cared for?",
      "Is hair washed and styled to preference?",
      "Are continence pads changed promptly?",
      "Are pressure-relieving routines (repositioning) recorded?",
      "Are slings / hoists checked before each use?",
      "Are two-staff transfers staffed as planned?",
      "Are towels and linen single-use per resident?",
      "Is water temperature checked before bathing?",
      "Are bathing risk assessments current?",
      "Are toiletries personal and labelled?",
      "Is privacy respected during personal care discussions?",
      "Are refusals recorded with follow-up offered?",
    ]),
  },
  {
    key: "equipment",
    title: "Medical equipment audit & registry",
    questions: mk("e", [
      "Is every piece of equipment on the asset register?",
      "Are servicing and calibration dates current (hoists, scales, BP monitors)?",
      "Are LOLER inspections in date for lifting equipment?",
      "Are faulty items removed from use and clearly labelled?",
      "Are slings checked before each use and recorded?",
      "Are profiling beds working safely (brakes, controls, sides)?",
      "Are pressure mattresses set to the correct weight?",
      "Are wheelchairs in good repair (tyres, brakes, footplates)?",
      "Are oxygen cylinders stored safely and in date?",
      "Are suction machines tested weekly?",
      "Are thermometers / pulse oximeters calibrated?",
      "Are glucometers quality-controlled?",
      "Are bed rails risk-assessed and consented?",
      "Are emergency grab bags stocked and in date?",
      "Are AED pads in date and battery checked?",
      "Are equipment cleaning logs maintained?",
      "Are staff trained on each piece of equipment they use?",
      "Are decommissioned items disposed of and removed from the register?",
    ]),
  },
  {
    key: "antipsychotic",
    title: "Anti-psychotic audit",
    questions: mk("ap", [
      "Is every anti-psychotic prescription linked to a documented indication?",
      "Has a STOMP review been completed in the last 12 weeks?",
      "Are non-pharmacological interventions tried and recorded first?",
      "Are side-effects monitored and documented?",
      "Has the GP been consulted on dose reduction where appropriate?",
      "Is MCA / best interest documentation in place?",
      "Is the family / advocate aware of the prescription?",
      "Are behavioural charts (ABC) being completed?",
      "Are triggers for distress identified and addressed?",
      "Are PRN anti-psychotics used as a last resort?",
      "Are PRN uses reviewed weekly?",
      "Is there evidence of de-prescribing where stable?",
      "Are physical health checks (weight, BP, ECG) being done?",
      "Are diabetes / metabolic screening completed?",
      "Are falls and sedation monitored as side-effects?",
      "Is the duration of treatment time-limited and reviewed?",
      "Are alternatives (life-story work, sensory, exercise) being tried?",
      "Are staff trained in dementia care and distress reactions?",
    ]),
  },
];

export const getAuditByTitle = (title: string) =>
  AUDIT_DEFINITIONS.find((a) => title.toLowerCase().startsWith(a.title.toLowerCase())) ??
  AUDIT_DEFINITIONS.find((a) => title.toLowerCase().includes(a.title.toLowerCase().split(" ")[0]));

export type AuditAnswer = "yes" | "no" | "na";
export type ActionPriority = "low" | "medium" | "high";
export type ActionStatus = "open" | "in_progress" | "done";
export type AuditActionItem = {
  id: string;
  questionId?: string;
  questionText?: string;
  action: string;
  owner: string;
  dueDate: string;
  priority: ActionPriority;
  status: ActionStatus;
};
export type AuditSubmission = {
  id: string;
  auditKey: string;
  auditTitle: string;
  completedAt: string;
  completedBy: string;
  unit?: string;
  answers: Record<string, { answer: AuditAnswer; note?: string }>;
  summary: string;
  compliance: number;
  actionPlan: AuditActionItem[];
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

export function saveAllSubmissions(all: AuditSubmission[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 200)));
}
