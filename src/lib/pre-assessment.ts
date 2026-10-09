import type { CarePlanDomain, RiskType } from "./care-domains";

export type PAType = "text" | "yesno" | "choice" | "check";
export type PAQuestion = { id: string; label: string; type: PAType; options?: string[]; prefill?: string };
export type PASection = { id: string; title: string; domains: CarePlanDomain[]; questions: PAQuestion[] };

const t = (id: string, label: string, prefill?: string): PAQuestion => ({ id, label, type: "text", prefill });
const yn = (id: string, label: string): PAQuestion => ({ id, label, type: "yesno" });
const ch = (id: string, label: string, options: string[]): PAQuestion => ({ id, label, type: "choice", options });
const ck = (id: string, label: string): PAQuestion => ({ id, label, type: "check" });
const HELP = ["Independent", "Prompting", "1 carer", "2 carers"];

export const PA_SECTIONS: PASection[] = [
  { id: "details", title: "1. Resident details", domains: [], questions: [
    t("d_name", "Full name, preferred name, date of birth", "name"), t("d_nhs", "NHS number", "nhs"),
    t("d_address", "Current address and contact details"), t("d_nok", "Next of kin and emergency contacts", "nok"),
    t("d_gp", "GP details", "gp"), t("d_sw", "Social worker / care coordinator details") ] },
  { id: "admission", title: "2. Reason for admission", domains: [], questions: [
    t("a_reason", "Reason for referral"), t("a_date", "Expected admission date"),
    ch("a_type", "Placement type", ["Permanent", "Respite", "Short-term"]), t("a_prev", "Previous care setting"),
    t("a_expect", "Resident's and family's expectations"), ch("a_urgency", "Urgency of placement", ["Routine", "Soon", "Urgent"]) ] },
  { id: "medical", title: "3. Medical history", domains: ["medication", "breathing", "end_of_life"], questions: [
    t("m_dx", "Diagnoses and medical conditions"), t("m_past", "Past medical history", "history"),
    t("m_allergy", "Allergies and sensitivities", "allergies"), t("m_meds", "Current medication and administration requirements"),
    t("m_hosp", "Recent hospital admissions"), t("m_infection", "Current infections or infection risks"),
    t("m_teams", "Specialist medical teams involved"), t("m_acp", "Advance care planning and DNACPR/ReSPECT documentation", "dnacpr") ] },
  { id: "cognition", title: "4. Cognitive and mental health", domains: ["cognition", "mental_health"], questions: [
    yn("c_dementia", "Dementia or cognitive impairment?"), t("c_dementia_n", "Details of dementia / impairment"),
    t("c_memory", "Memory and orientation"), t("c_mh", "Mental health history"), t("c_mood", "Anxiety, depression or distress"),
    t("c_triggers", "Behavioural changes and known triggers"), t("c_capacity", "Mental capacity for specific decisions"),
    t("c_consent", "Consent and legal representatives"), ch("c_dols", "DoLS status", ["Not applicable", "Applied", "Authorised", "Expired"]) ] },
  { id: "personal", title: "5. Personal care and daily living", domains: ["personal_care", "sleep"], questions: [
    ch("p_wash", "Washing, bathing and showering", HELP), ch("p_dress", "Dressing and undressing", HELP),
    t("p_oral", "Oral care and dentures"), t("p_toilet", "Toileting and continence"),
    t("p_groom", "Grooming and personal preferences"), ch("p_level", "Overall level of assistance", HELP),
    t("p_routine", "Preferred daily routine (waking, bedtime) and privacy needs") ] },
  { id: "mobility", title: "6. Mobility and moving & handling", domains: ["mobility", "safety"], questions: [
    ch("mo_level", "Mobility", ["Independent", "Walking aid", "Wheelchair", "Bed-bound"]), t("mo_aids", "Walking aids and wheelchairs"),
    ch("mo_transfer", "Transfers and repositioning", HELP), yn("mo_hoist", "Hoist required?"), t("mo_sling", "Hoist and sling details"),
    t("mo_falls", "Falls history (last 12 months) and falls risk"), t("mo_phys", "Contractures, weakness or physical impairments"),
    t("mo_equip", "Moving and handling equipment required") ] },
  { id: "nutrition", title: "7. Nutrition and hydration", domains: ["nutrition"], questions: [
    t("n_wt", "Weight, height and BMI"), t("n_change", "Recent weight loss or gain"), t("n_must", "MUST screening score"),
    t("n_pref", "Appetite and food preferences"), t("n_diet", "Allergies and dietary requirements", "diet"),
    yn("n_swallow", "Swallowing difficulties?"), t("n_salt", "SALT recommendations"),
    t("n_iddsi", "Modified-texture diet / thickened fluids (IDDSI level), if prescribed"), ch("n_assist", "Feeding assistance", HELP),
    yn("n_peg", "PEG or other enteral feeding?"), t("n_fluid", "Fluid restrictions or monitoring") ] },
  { id: "skin", title: "8. Skin integrity and wound care", domains: ["skin_integrity"], questions: [
    t("s_cond", "Current skin condition"), yn("s_wounds", "Existing pressure ulcers or wounds?"),
    t("s_detail", "Wound location, category and treatment"), t("s_risk", "Pressure ulcer risk assessment (e.g. Waterlow)"),
    t("s_equip", "Pressure-relieving mattress and cushion"), t("s_repo", "Repositioning requirements"), t("s_tvn", "Tissue viability input") ] },
  { id: "continence", title: "9. Continence", domains: ["continence"], questions: [
    ch("co_urine", "Urinary continence", ["Continent", "Occasional", "Incontinent", "Catheter"]),
    ch("co_bowel", "Bowel continence", ["Continent", "Occasional", "Incontinent", "Stoma"]),
    t("co_cath", "Catheter or stoma care"), t("co_products", "Continence products"), t("co_plan", "Bowel management plan"),
    t("co_issues", "Constipation or diarrhoea"), t("co_assist", "Assistance and monitoring requirements") ] },
  { id: "clinical", title: "10. Clinical and complex care needs", domains: ["breathing", "medication", "end_of_life"], questions: [
    yn("cl_o2", "Oxygen therapy?"), yn("cl_trach", "Tracheostomy or laryngectomy?"), yn("cl_suction", "Suction required?"),
    t("cl_diabetes", "Diabetes management"), t("cl_epilepsy", "Epilepsy and seizure management"),
    t("cl_neuro", "Parkinson's / motor neurone disease"), t("cl_rescue", "Complex or rescue medication"),
    t("cl_obs", "Clinical observations and monitoring"), t("cl_eol", "End-of-life care requirements"),
    t("cl_comp", "Specialist equipment and competencies required") ] },
  { id: "communication", title: "11. Communication and sensory needs", domains: ["communication"], questions: [
    t("cm_lang", "Preferred language", "language"), t("cm_hear", "Hearing impairment and hearing aids"),
    t("cm_vision", "Visual impairment and glasses"), t("cm_speech", "Speech difficulties"),
    t("cm_aids", "Communication aids", "communication"), t("cm_pain", "How the resident expresses pain, distress or discomfort") ] },
  { id: "social", title: "12. Behaviour, wellbeing and social needs", domains: ["social", "mental_health"], questions: [
    t("so_interests", "Personality, interests and hobbies"), t("so_family", "Family and social relationships"),
    t("so_culture", "Cultural, religious and spiritual preferences", "religion"), t("so_risk", "Behaviours that may present risks"),
    t("so_deesc", "Known triggers and de-escalation strategies"), t("so_emotional", "Emotional support requirements"),
    t("so_activities", "Meaningful activities and preferred routines", "preferences") ] },
  { id: "risks", title: "13. Risk assessments required", domains: [], questions: [
    ck("r_falls", "Falls"), ck("r_moving_handling", "Moving and handling"), ck("r_pressure", "Pressure ulcer"),
    ck("r_nutrition", "Nutrition and hydration"), ck("r_choking", "Choking and aspiration"), ck("r_medication", "Medication"),
    ck("r_infection", "Infection"), ck("r_wandering", "Wandering / missing person"), ck("r_behavioural", "Behavioural"),
    ck("r_environmental", "Environmental"), ck("r_safeguarding", "Self-neglect and safeguarding"), t("r_other", "Individual clinical risks") ] },
  { id: "legal", title: "14. Safeguarding and legal documentation", domains: ["safety"], questions: [
    t("l_sg", "Relevant safeguarding history"), t("l_mca", "Mental Capacity Act assessments"), t("l_dols", "DoLS authorisation / application"),
    t("l_lpa", "Lasting Power of Attorney details and scope", "poa"), t("l_adrt", "Advance decisions and statements", "advance"),
    t("l_dnacpr", "DNACPR / ReSPECT documentation"), t("l_court", "Court orders or deputyship") ] },
  { id: "staffing", title: "15. Staffing and equipment", domains: [], questions: [
    ch("st_carers", "Carers needed for routine care", ["1", "2", "3+"]), yn("st_nursing", "Nursing input required?"),
    yn("st_1to1", "One-to-one or enhanced observation?"), t("st_night", "Night-time care requirements"),
    t("st_comp", "Specialist competencies required"), t("st_equip", "Equipment and adaptations required"),
    t("st_avail", "Are appropriate staff and resources available?") ] },
  { id: "documents", title: "16. Documents to request", domains: [], questions: [
    ck("doc_discharge", "Hospital discharge / clinical summary"), ck("doc_gp", "GP medical summary"), ck("doc_mar", "Current MAR"),
    ck("doc_cp", "Current care plan"), ck("doc_ra", "Existing risk assessments"), ck("doc_mh", "Moving and handling plan"),
    ck("doc_must", "MUST and swallowing assessments"), ck("doc_wound", "Wound care documentation"), ck("doc_salt", "SALT recommendations"),
    ck("doc_legal", "Mental capacity and legal documents"), ck("doc_acp", "Advance care planning documents"), ck("doc_spec", "Specialist nursing / therapy reports") ] },
  { id: "decision", title: "17. Admission decision", domains: [], questions: [
    yn("x_safe", "Can the home safely meet the resident's needs?"), yn("x_staff", "Are staffing and competencies available?"),
    yn("x_equip", "Is specialist equipment available?"), yn("x_more", "Are additional assessments required?"),
    t("x_unmet", "Any unmet clinical needs?"), yn("x_mdt", "Is a further multidisciplinary review needed?") ] },
];

export const PA_RISK_MAP: Record<string, RiskType> = {
  r_falls: "falls", r_moving_handling: "moving_handling", r_pressure: "pressure", r_nutrition: "nutrition",
  r_medication: "medication", r_behavioural: "behavioural", r_environmental: "environmental",
};

export const DECISIONS = [
  { id: "accepted", label: "Accepted" },
  { id: "accepted_conditions", label: "Accepted subject to conditions" },
  { id: "further_assessment", label: "Further assessment required" },
  { id: "declined", label: "Declined" },
] as const;

export type PAAnswers = Record<string, string | boolean>;

export function answersForDomain(answers: PAAnswers, domain: CarePlanDomain): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (const s of PA_SECTIONS) {
    if (!s.domains.includes(domain)) continue;
    for (const q of s.questions) {
      const v = answers[q.id];
      if (v === undefined || v === "" || v === false) continue;
      out.push({ label: q.label, value: v === true ? "Yes" : String(v) });
    }
  }
  return out;
}

export function prefillFromResident(r: any): PAAnswers {
  const gp = r.gp && typeof r.gp === "object" ? Object.values(r.gp).filter(Boolean).join(", ") : "";
  const map: Record<string, string> = {
    name: [r.full_name, r.preferred_name && `(prefers ${r.preferred_name})`, r.date_of_birth].filter(Boolean).join(" · "),
    nhs: r.nhs_number ?? "",
    nok: [r.next_of_kin_relationship, r.next_of_kin_phone, r.emergency_contact_name && `Emergency: ${r.emergency_contact_name} ${r.emergency_contact_phone ?? ""}`].filter(Boolean).join(" · "),
    gp: [r.gp_practice, r.gp_phone, gp].filter(Boolean).join(" · "),
    history: r.medical_history ?? "", allergies: r.allergies ?? "", dnacpr: r.dnacpr_status ?? "",
    diet: r.dietary_requirements ?? "", language: r.first_language ?? "", communication: r.communication_needs ?? "",
    religion: r.religion ?? "", preferences: r.important_preferences ?? "", poa: r.power_of_attorney ?? "", advance: r.advance_decisions ?? "",
  };
  const a: PAAnswers = {};
  for (const s of PA_SECTIONS) for (const q of s.questions) if (q.prefill && map[q.prefill]) a[q.id] = map[q.prefill];
  return a;
}
