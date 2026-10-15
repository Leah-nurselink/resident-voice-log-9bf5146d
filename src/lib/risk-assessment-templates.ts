// Risk assessment templates for CareCore.
//
// Suggested location: src/lib/risk-assessment-templates.ts
//
// Design notes
// - Each assessment is DATA, not a hand-built screen. One generic form renderer can
//   display any of them, so adding or changing a question is a small edit here.
// - The wording is original. The coverage (topics and clinical areas) follows the
//   example export you shared; none of its answers are used.
// - Nothing here scores or decides anything. The assessor records answers, then
//   gives their own overall rating. The form renderer should add the footer fields
//   to every template: overall rating (when `rated`), actions required, review due
//   date, and who/when (taken automatically).
// - `flag` messages are prompts shown to the assessor. They never trigger actions.
// - Waterlow and MUST are NOT here. They are scored, published tools with their own
//   licensing and exact scoring rules, so they should stay as the separate validated
//   tools already in the app until licensing is confirmed.
// - `defaultReviewMonths` is a placeholder for your clinical lead to confirm.
// - Have a registered nurse or clinical lead review all wording before pilot use
//   (part of the DCB0129 evidence).

export type QuestionType =
  | "yesno"
  | "text"
  | "longtext"
  | "number"
  | "select"
  | "multiselect"
  | "date";

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[];
  unit?: string;
  help?: string;
  /**
   * Only show this question when another answer matches. For multiselect answers
   * it matches if ANY of the listed values is selected.
   */
  showIf?: { id: string; equals: string | string[] };
  /** Show a prompt to the assessor when the answer matches. Prompt only. */
  flag?: { equals: string | string[]; message: string };
}

export interface Section {
  title: string;
  questions: Question[];
}

export interface RiskTemplate {
  key: string;
  title: string;
  summary: string;
  group:
    | "Safety and mobility"
    | "Health and body"
    | "Nutrition and medication"
    | "Personal and communication"
    | "Safety planning";
  /** Whether the assessor gives an overall risk rating at the end. */
  rated: boolean;
  /** Override the default Low / Medium / High options. */
  ratingOptions?: string[];
  defaultReviewMonths: number;
  sections: Section[];
}

// ---------------------------------------------------------------------------
// Small helpers to keep the definitions readable
// ---------------------------------------------------------------------------

type Extra = Partial<Omit<Question, "id" | "label" | "type">>;

const YN = ["Yes", "No"];
const YNU = ["Yes", "No", "Unsure"];

const yn = (id: string, label: string, o: Extra = {}): Question => ({ id, label, type: "yesno", options: YN, ...o });
const ynu = (id: string, label: string, o: Extra = {}): Question => ({ id, label, type: "select", options: YNU, ...o });
const text = (id: string, label: string, o: Extra = {}): Question => ({ id, label, type: "text", ...o });
const long = (id: string, label: string, o: Extra = {}): Question => ({ id, label, type: "longtext", ...o });
const num = (id: string, label: string, o: Extra = {}): Question => ({ id, label, type: "number", ...o });
const sel = (id: string, label: string, options: string[], o: Extra = {}): Question => ({ id, label, type: "select", options, ...o });
const multi = (id: string, label: string, options: string[], o: Extra = {}): Question => ({ id, label, type: "multiselect", options, ...o });

/** A follow-up details box that appears when its parent question is answered "Yes". */
const detailIf = (
  parentId: string,
  label = "Please give details",
  answer: string | string[] = "Yes",
): Question => long(`${parentId}_detail`, label, { showIf: { id: parentId, equals: answer } });

const REASON_OPTIONS = ["New admission", "Routine review", "Change in condition", "After an incident", "Other"];

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const choking: RiskTemplate = {
  key: "choking",
  title: "Choking risk",
  summary: "Identifies swallowing and eating risks and the support needed at mealtimes.",
  group: "Nutrition and medication",
  rated: true,
  defaultReviewMonths: 3,
  sections: [
    {
      title: "Background",
      questions: [
        sel("reason", "Reason for this assessment", REASON_OPTIONS),
        text("reason_other", "Please describe", { showIf: { id: "reason", equals: "Other" } }),
        yn("history", "Has the person ever choked?"),
        detailIf("history", "Approximate dates, what was being eaten, and what help was needed"),
      ],
    },
    {
      title: "Risk factors",
      questions: [
        multi("signs", "Any signs that may raise choking risk?", [
          "Frailty",
          "Frequent coughing",
          "Difficulty chewing or swallowing",
          "Wet or gurgly voice after swallowing",
          "Breathing changes during or after eating or drinking",
          "Poor teeth or no dentures",
          "Needs one-to-one help to eat",
          "Pain or distress when eating or drinking",
          "None observed",
        ]),
        ynu("capacity", "Can the person decide for themselves what to put in their mouth?", {
          help: "If unsure, consider a mental capacity assessment.",
        }),
        yn("medical", "Any physical condition that raises choking risk?", {
          help: "For example reflux, breathing conditions, head or neck injury or cancer.",
        }),
        detailIf("medical", "Which condition(s)?"),
        yn("neuro", "Any neurological condition that raises choking risk?", {
          help: "For example stroke, dementia, Parkinson's disease, seizures.",
        }),
        detailIf("neuro", "Which condition(s)?"),
        yn("mental", "Any mental health condition that raises choking risk?", {
          help: "For example pica.",
        }),
        detailIf("mental", "Which condition(s)?"),
        multi("behaviours", "Eating behaviours that could lead to choking", [
          "Eats or drinks too fast",
          "Overfills the mouth",
          "Talks while eating",
          "Lies down or reclines soon after eating",
          "None observed",
        ]),
        long("strategies", "Strategies that help with these behaviours", {
          help: "For example prompts or smaller cutlery.",
        }),
        yn("medication", "Is the person on medication that affects swallowing?", {
          help: "For example drowsiness, dry mouth, tremor or facial stiffness.",
        }),
        detailIf("medication", "Which medication and what effect?"),
        long("other", "Anything else relevant to choking risk"),
      ],
    },
    {
      title: "Follow-up",
      questions: [
        yn("followup", "Is any follow-up needed?", {
          flag: {
            equals: "Yes",
            message: "Consider whether a speech and language therapy or GP referral is needed.",
          },
        }),
        detailIf("followup", "What follow-up, and who will do it?"),
      ],
    },
  ],
};

const movingHandling: RiskTemplate = {
  key: "moving_handling",
  title: "Moving and handling",
  summary: "Records how the person moves and what staff and equipment are needed to support them safely.",
  group: "Safety and mobility",
  rated: true,
  defaultReviewMonths: 3,
  sections: [
    {
      title: "Mobility",
      questions: [
        num("weight", "Current weight", { unit: "kg" }),
        sel("assistance", "Level of help needed with mobility", [
          "Independent",
          "Needs prompting or supervision",
          "Needs physical help from one person",
          "Needs physical help from two people",
          "Needs equipment (for example hoist or stand aid)",
        ]),
        multi("abilities", "Which of these can the person do without help?", [
          "Raise their head",
          "Use both arms",
          "Sit",
          "Stand",
          "Turn",
        ]),
        sel("walking", "Walking", [
          "Walks independently",
          "Walks with an aid",
          "Walks with staff support",
          "Walks with an aid and staff support",
          "Does not walk",
        ]),
        multi("aids", "Aids and equipment in use", [
          "Walking frame",
          "Walking stick",
          "Utility trolley",
          "Wheelchair",
          "Hoist",
          "Stand aid",
          "Slide sheet",
          "Other",
        ]),
        text("aids_other", "Other equipment", { showIf: { id: "aids", equals: "Other" } }),
      ],
    },
    {
      title: "Wheelchair use",
      questions: [
        sel("wc_type", "Is the wheelchair prescribed or for transit only?", ["Prescribed", "Transit only"], {
          showIf: { id: "aids", equals: "Wheelchair" },
        }),
        yn("wc_assessment", "Is a copy of the wheelchair assessment held in the home?", {
          showIf: { id: "wc_type", equals: "Prescribed" },
        }),
        text("wc_frequency", "How often is the wheelchair used?", { showIf: { id: "aids", equals: "Wheelchair" } }),
        yn("wc_footplates", "Are footplates needed?", { showIf: { id: "aids", equals: "Wheelchair" } }),
        yn("wc_belt", "Is a wheelchair or posture belt needed?", { showIf: { id: "aids", equals: "Wheelchair" } }),
        yn("wc_belt_self", "Can the person fit and adjust the belt without help?", {
          showIf: { id: "wc_belt", equals: "Yes" },
        }),
        yn("wc_sliding", "With the belt fitted, is there a risk of sliding down and entrapment?", {
          showIf: { id: "wc_belt", equals: "Yes" },
          flag: { equals: "Yes", message: "Entrapment risk: seek advice from the wheelchair or occupational therapy service." },
        }),
      ],
    },
    {
      title: "Senses",
      questions: [
        yn("vision", "Any visual impairment?"),
        detailIf("vision", "Describe the impairment"),
        multi("vision_aids", "Visual aids", ["Glasses", "Magnifier", "None"]),
        yn("hearing", "Any hearing impairment?"),
        yn("hearing_aids", "Does the person use hearing aids?"),
      ],
    },
    {
      title: "Factors affecting moving and handling",
      questions: [
        multi("factors", "Any of these that affect moving and handling?", [
          "Poor balance",
          "Spasm or involuntary movements",
          "Reduced muscle strength or tone",
          "History of seizures",
          "Sensory impairment",
          "Weakness or loss of use of a limb",
          "Pain",
          "None",
        ]),
        long("factors_detail", "Please explain"),
        yn("medication", "Is the person on medication that affects moving and handling?", {
          help: "For example sedatives, pain relief, muscle relaxants, Parkinson's medication.",
        }),
        detailIf("medication", "Which medication, its effect, and how it is managed"),
        yn("falls", "Has the person fallen before?"),
        detailIf("falls", "What needs to be taken into account?"),
        long("comprehension", "How do understanding and cooperation affect moving and handling?", {
          help: "Consider confusion, agitation, ability to cooperate and motivation.",
        }),
        long("behaviour", "How does behaviour affect moving and handling?"),
        long("communication", "How does communication affect moving and handling?", {
          help: "Consider responding to instructions, language, and cultural or religious considerations.",
        }),
        long("daily_support", "Areas of day-to-day support the person needs help with"),
        multi("environment", "Environmental issues that could interfere", [
          "Narrow doorways",
          "Cluttered space",
          "Flooring",
          "Bed or chair height",
          "Limited space for equipment",
          "Stairs",
          "None",
        ]),
        long("staffing", "Is extra support needed for staff?", {
          help: "Consider training, more than one member of staff, or staff with health issues or restricted mobility.",
        }),
        long("other", "Anything else to add"),
        long("methods", "Methods and procedures to follow after this assessment"),
      ],
    },
  ],
};

const falls: RiskTemplate = {
  key: "falls",
  title: "Falls risk (multifactorial)",
  summary: "Looks across medical, physical, environmental and behavioural factors that affect falls and bone health.",
  group: "Safety and mobility",
  rated: true,
  defaultReviewMonths: 1,
  sections: [
    {
      title: "History and mobility",
      questions: [
        yn("falls_12m", "Has the person fallen in the last 12 months?"),
        detailIf("falls_12m", "How many, causes, injuries, what they were doing, any symptoms such as dizziness"),
        yn("unsteady", "Is the person unsteady or unsafe when walking?"),
        yn("transfers", "Any difficulty with transfers (on and off the toilet, bed or chair)?"),
      ],
    },
    {
      title: "Bone health",
      questions: [
        yn("osteoporosis", "Does the person have osteoporosis?", {
          help: "Check transfer notes or ask the GP.",
        }),
        multi(
          "osteo_risk",
          "If not, any of these that raise the risk of osteoporosis?",
          [
            "Fracture after a minor bump or fall, over age 50",
            "Family history of osteoporosis or hip fracture",
            "Steroids for 3 months or more",
            "Loss of height or outward curve of the spine",
            "None",
          ],
          { showIf: { id: "osteoporosis", equals: "No" } },
        ),
      ],
    },
    {
      title: "Medication",
      questions: [
        yn("meds_4", "Is the person on four or more medications?"),
        multi("meds_risk", "Is the person on any of these?", [
          "Sedatives",
          "Antidepressants",
          "Anti-Parkinson's medication",
          "Diuretics (water tablets)",
          "Antipsychotics",
          "Anticoagulants",
          "Blood pressure medication",
          "None",
        ]),
      ],
    },
    {
      title: "Health and wellbeing",
      questions: [
        yn("dizzy", "Any dizziness on standing, spinning sensation, fainting or palpitations?"),
        yn("weight_loss", "Any unintentional weight loss or poor appetite?"),
        yn("daylight", "Does the person spend little time outside in daylight?"),
        yn("confused", "Any confusion, disorientation, restlessness, irritability or agitation?"),
        yn("insight", "Reduced insight or judgement, or does the person not cooperate with staff?"),
        yn("continence", "Do continence issues add to the falls risk?"),
        yn("vision", "Poor vision?"),
        yn("hearing", "Poor hearing?"),
        yn("night", "Does the person often get out of bed at night?"),
        yn("night_safe", "Can they get in and out of bed safely on their own?", {
          showIf: { id: "night", equals: "Yes" },
        }),
        yn("feet", "Foot problems such as corns, ingrown nails, bunions, infection, pain or loss of feeling?"),
        yn("footwear", "Ill-fitting shoes, high heels, or shoes without grip?"),
        yn("oriented", "Is the person oriented to their surroundings?"),
        yn("clothing", "Does the person have suitable clothing and footwear?"),
        yn("other_factors", "Any other relevant factors, such as alcohol, pain or low mood?"),
        detailIf("other_factors", "Please describe"),
      ],
    },
    {
      title: "Actions",
      questions: [
        multi("interventions", "Interventions chosen", [
          "Medication review with GP or pharmacist",
          "Referral to falls service or physiotherapy",
          "Mobility aid check",
          "Supervision when walking or transferring",
          "Changes to lighting or clutter",
          "Footwear or clothing review",
          "Toileting or continence plan",
          "Vision or hearing review",
          "Bone health review with GP",
          "Nutrition review",
          "Sensor mat or other alert",
          "Other",
        ]),
        long("action_plan", "Risk factors found, what will be done, and any referrals"),
        multi("recorded_in", "Where the interventions are recorded", ["Care plan", "Handover", "Other"]),
      ],
    },
  ],
};

const skinIntegrity: RiskTemplate = {
  key: "skin_integrity",
  title: "Skin integrity check",
  summary: "A quick check of the skin and any new marks, wounds or injuries.",
  group: "Health and body",
  rated: false,
  defaultReviewMonths: 1,
  sections: [
    {
      title: "Skin check",
      questions: [
        sel("reason", "Reason for the check", [
          "Initial check when starting care",
          "Routine check",
          "After a fall or incident",
          "Change in condition",
          "Other",
        ]),
        yn("existing", "Are there skin conditions already recorded that need updating?"),
        detailIf("existing", "What needs updating?"),
        yn("new_wounds", "Any newly identified wounds or marks?", {
          flag: {
            equals: "Yes",
            message: "Record each wound in the wound chart. Consider whether it needs reporting as an incident.",
          },
        }),
        text("location", "Where on the body?", { showIf: { id: "new_wounds", equals: "Yes" } }),
        sel(
          "wound_type",
          "What kind of wound or mark?",
          ["Bruise", "Skin tear", "Pressure injury", "Cut or graze", "Burn", "Rash or irritation", "Other"],
          { showIf: { id: "new_wounds", equals: "Yes" } },
        ),
        yn("photo", "Was a photo taken?", { showIf: { id: "new_wounds", equals: "Yes" } }),
        ynu("consent", "Can the person consent to assessment and treatment?", {
          help: "If not, follow your mental capacity and best-interests process.",
        }),
        long("other", "Anything else to add"),
      ],
    },
  ],
};

const dietNutrition: RiskTemplate = {
  key: "diet_nutrition",
  title: "Diet and nutrition",
  summary: "Records eating and drinking needs, textures and preferences.",
  group: "Nutrition and medication",
  rated: false,
  defaultReviewMonths: 3,
  sections: [
    {
      title: "Diet",
      questions: [
        long("preferences", "Dietary preferences and the reason for them"),
        yn("special_diet", "Is the person on a special diet?"),
        detailIf("special_diet", "Which diet, and why?"),
        yn("nutrition_needs", "Any specific nutritional needs?"),
        detailIf("nutrition_needs", "Please describe"),
        yn("religious_diet", "Does the person follow a religious or cultural diet?"),
        detailIf("religious_diet", "Please describe"),
      ],
    },
    {
      title: "Textures and aids",
      questions: [
        sel("food_texture", "Food texture (IDDSI level)", [
          "Regular (7)",
          "Easy to chew (7EC)",
          "Soft and bite-sized (6)",
          "Minced and moist (5)",
          "Pureed (4)",
          "Liquidised (3)",
        ]),
        sel("fluid_texture", "Fluid texture (IDDSI level)", [
          "Thin (0)",
          "Slightly thick (1)",
          "Mildly thick (2)",
          "Moderately thick (3)",
          "Extremely thick (4)",
        ]),
        yn("aids", "Does the person use aids to eat or drink?"),
        detailIf("aids", "Which aids?"),
        yn("dentures", "Does the person use dentures or other oral devices?"),
        detailIf("dentures", "Which devices?"),
      ],
    },
  ],
};

const allergies: RiskTemplate = {
  key: "allergies",
  title: "Allergies and intolerances",
  summary: "Records known allergies and intolerances and what to do if there is a reaction.",
  group: "Health and body",
  rated: false,
  defaultReviewMonths: 6,
  sections: [
    {
      title: "Allergies",
      questions: [
        sel("food", "Food allergies", ["None known", "Yes"]),
        detailIf("food", "Which foods and what reaction?", "Yes"),
        sel("medication", "Medication allergies", ["None known", "Yes"]),
        detailIf("medication", "Which medicines and what reaction?", "Yes"),
        sel("environmental", "Environmental or contact allergies", ["None known", "Yes"]),
        detailIf("environmental", "Which substances and what reaction?", "Yes"),
        sel("intolerances", "Intolerances", ["None known", "Yes"]),
        detailIf("intolerances", "Which intolerances?", "Yes"),
        long("reaction_plan", "What staff should do if there is a reaction"),
        long("notes", "Other notes, including family or personal wishes"),
      ],
    },
  ],
};

const oralHealth: RiskTemplate = {
  key: "oral_health",
  title: "Oral health",
  summary: "An observation checklist of the mouth, teeth, gums and any dental pain.",
  group: "Health and body",
  rated: false,
  defaultReviewMonths: 3,
  sections: [
    {
      title: "Observations",
      questions: [
        ...[
          ["lips", "Lips"],
          ["tongue", "Tongue"],
          ["gums", "Gums and tissues"],
          ["saliva", "Saliva"],
          ["natural_teeth", "Natural teeth"],
          ["dentures", "Dentures"],
          ["cleanliness", "Oral cleanliness"],
          ["pain", "Signs of dental pain (behaviour, speech or physical signs)"],
        ].map(([id, label]) =>
          sel(id, label, ["Healthy", "Some changes", "Unhealthy", "Not applicable"], {
            flag: {
              equals: ["Some changes", "Unhealthy"],
              message: "Consider arranging for a dentist to examine the person.",
            },
          }),
        ),
        long("actions", "Oral hygiene care and actions needed"),
      ],
    },
  ],
};

const continence: RiskTemplate = {
  key: "continence",
  title: "Continence",
  summary: "Records toileting needs, support, equipment and any referral needed.",
  group: "Health and body",
  rated: false,
  defaultReviewMonths: 3,
  sections: [
    {
      title: "Toileting",
      questions: [
        sel("reason", "Reason for the assessment", REASON_OPTIONS),
        yn("recognises", "Can the person tell when they need the toilet?"),
        long("cues", "Signs that they may need the toilet", {
          help: "For example restlessness or removing clothes.",
        }),
        sel("assistance", "Help needed to use the toilet", ["None", "Prompting", "Physical help"]),
        num("staff_number", "Number of staff needed", { showIf: { id: "assistance", equals: "Physical help" } }),
        sel("cooperation", "Does the person cooperate when helped?", ["Yes", "Sometimes", "No"]),
        long("cooperation_detail", "Please explain", { showIf: { id: "cooperation", equals: ["Sometimes", "No"] } }),
        sel("on_off", "Getting on and off the toilet or commode", ["Independent", "Needs help, equipment or aids"]),
        sel("dressing", "Dressing and undressing for the toilet", ["Independent", "Needs help, equipment or aids"]),
        sel("cleaning", "Cleaning after using the toilet", ["Independent", "Needs help, equipment or aids"]),
        yn("finds_toilet", "Can the person find the toilet?"),
        long("finds_toilet_help", "What would help?", {
          showIf: { id: "finds_toilet", equals: "No" },
          help: "For example directions, a light on, or the door left open.",
        }),
      ],
    },
    {
      title: "Pattern and aids",
      questions: [
        num("day_frequency", "Average toilet visits during the day"),
        num("night_frequency", "Average toilet visits during the night"),
        long("night_support", "Support needed at night"),
        yn("sleep_disturbed", "Does the night routine disturb sleep?"),
        long("sleep_help", "What could reduce disturbed sleep?", {
          showIf: { id: "sleep_disturbed", equals: "Yes" },
          help: "For example a commode by the bed.",
        }),
        yn("catheter", "Does the person have a urinary catheter?"),
        yn("catheter_help", "Is help needed to empty the catheter bag?", { showIf: { id: "catheter", equals: "Yes" } }),
        yn("aids", "Does the person use continence aids?"),
        multi(
          "aids_used",
          "Which aids?",
          ["Disposable pads", "Washable pads or pants", "Commode", "Urinal", "Catheter", "Other"],
          { showIf: { id: "aids", equals: "Yes" } },
        ),
      ],
    },
    {
      title: "Health and follow-up",
      questions: [
        yn("referral", "Should a referral be made to the continence service?"),
        detailIf("referral", "Reason for referral"),
        yn("condition", "Is a medical condition being managed that may cause incontinence?"),
        detailIf("condition", "Which condition, and any discomfort it causes"),
        yn("medication", "Any medication or creams that affect passing urine or stool?"),
        detailIf("medication", "Which ones?"),
        multi("symptoms", "Any of these when passing urine or stool?", [
          "Pain or burning",
          "Blood",
          "Urgency",
          "Frequent passing",
          "Straining",
          "Leakage",
          "None",
        ]),
        long("other", "Anything else about continence"),
        yn("actions_required", "Are any actions required?"),
        detailIf("actions_required", "What actions?"),
      ],
    },
  ],
};

const personalCare: RiskTemplate = {
  key: "personal_care",
  title: "Personal care",
  summary: "Records how much support the person needs with washing, dressing and hygiene, and their preferences.",
  group: "Personal and communication",
  rated: false,
  defaultReviewMonths: 6,
  sections: [
    {
      title: "Personal care",
      questions: [
        sel("participation", "How the person takes part in their own personal care", [
          "Independent",
          "Takes part with prompting",
          "Takes part with physical help",
          "Fully dependent on staff",
        ]),
        num("staff_number", "Number of staff needed"),
        yn("preferences", "Any preferences or wishes about personal care and hygiene?"),
        detailIf("preferences", "For example gender of carer, time of day, products"),
        long("other", "Anything else to add"),
      ],
    },
  ],
};

const commMode = (id: string, title: string): Section => ({
  title,
  questions: [
    long(`${id}_understanding`, "How well does the person understand this kind of communication?"),
    long(`${id}_preference`, "How does the person prefer to communicate this way?"),
    long(`${id}_support`, "What helps the person communicate at their best?"),
    long(`${id}_other`, "Anything else to consider"),
  ],
});

const communication: RiskTemplate = {
  key: "communication",
  title: "Communication",
  summary: "Records how the person understands and expresses themselves, and what helps.",
  group: "Personal and communication",
  rated: false,
  defaultReviewMonths: 6,
  sections: [
    commMode("written", "Written and picture-based communication"),
    commMode("spoken", "Spoken communication"),
    commMode("gesture", "Gesture-based communication"),
    commMode("technology", "Using technology to communicate"),
    {
      title: "General",
      questions: [
        long("general", "General considerations about communication"),
        yn("interpreter", "Does the person need an interpreter or translated materials?"),
        detailIf("interpreter", "Which language or format?"),
      ],
    },
  ],
};

const medicationRisk: RiskTemplate = {
  key: "medication_risk",
  title: "Medication risk",
  summary: "Looks at how safely the person's medicines can be managed and what support is needed.",
  group: "Nutrition and medication",
  rated: true,
  defaultReviewMonths: 3,
  sections: [
    {
      title: "Managing medicines",
      questions: [
        sel("reason", "Reason for the assessment", REASON_OPTIONS),
        yn("control_all", "Can the person keep control of ALL their medicines (oral, applied, injected, as-needed and variable-dose)?", {
          help: "If not, a separate mental capacity or best-interests decision should be recorded.",
        }),
        long("control_all_notes", "Comments and actions"),
        yn("control_some", "Can the person keep control of SOME of their medicines?"),
        long("control_some_notes", "Which medicines, and comments and actions"),
        yn("understands", "Can the person understand and remember information about their medicines?"),
        long("understands_support", "What support is needed?", { showIf: { id: "understands", equals: "No" } }),
        long("impairment", "Any disability or impairment that could affect managing medicines"),
        yn("self_harm", "Any mental health condition that may put the person at risk of self-harm with medicines?", {
          flag: { equals: "Yes", message: "Consider a referral to the GP or mental health team." },
        }),
        yn("others_safety", "Does the person understand why medicines must be kept safe from others, and is secure storage available?"),
        yn("matches_prescription", "Do the medicines match the discharge summary or prescription?"),
        yn("knows_purpose", "Does the person know what their medicines are for?"),
        yn("reads_labels", "Can the person read the labels (with or without glasses)?"),
        yn("has_clock", "Does the person have a clock or watch to tell the time?"),
        yn("opens_packaging", "Can the person open the medicine packaging?"),
        yn("water", "Can the person get drinking water?"),
      ],
    },
    {
      title: "Prescriptions and records",
      questions: [
        yn("prescription_clear", "Is the prescription clear about dose and timing?"),
        yn("mar_matches", "Does the MAR chart clearly match the prescription?"),
        yn("prn_clear", "Is it clear what each as-needed (PRN) medicine is for?", {
          flag: {
            equals: "No",
            message: "Ask the prescriber for clear instructions and set up a PRN plan. If the person cannot say they are in pain, use a pain assessment for people with cognitive impairment.",
          },
        }),
        yn("variable_dose", "Are there variable-dose medicines that depend on test results, such as warfarin?"),
        yn("variable_written", "Is written instruction provided each time the dose changes?", {
          showIf: { id: "variable_dose", equals: "Yes" },
        }),
        yn("topicals", "Are creams or other topical products prescribed?"),
        yn("topicals_clear", "Is it clear how, when and where to apply them?", { showIf: { id: "topicals", equals: "Yes" } }),
      ],
    },
    {
      title: "Special medicines and routes",
      questions: [
        yn("non_oral", "Are any medicines given by a route other than the mouth?"),
        yn("paraffin", "Are paraffin-based creams or emollients prescribed?", {
          flag: {
            equals: "Yes",
            message: "Carry out a separate fire risk assessment, especially for smokers, oxygen users, or people using electric beds or mattresses.",
          },
        }),
        yn("drops", "Are eye, ear or nasal drops prescribed?"),
        yn("patches", "Are transdermal patches used?", {
          flag: { equals: "Yes", message: "Use a patch site chart and consider heat sources such as hairdryers." },
        }),
        yn("special_techniques", "Are any medicines given by special techniques, such as via a feeding tube?", {
          flag: { equals: "Yes", message: "Staff must be trained by a healthcare professional." },
        }),
        yn("oxygen", "Is oxygen needed?", {
          flag: {
            equals: "Yes",
            message: "Staff need training from a healthcare professional or oxygen provider. Check storage and signage.",
          },
        }),
        yn("controlled", "Are controlled drugs prescribed?", {
          flag: { equals: "Yes", message: "Follow your controlled drugs procedure: register, two signatures, safe storage." },
        }),
        yn("covert", "Are any medicines given covertly?", {
          flag: {
            equals: "Yes",
            message: "A best-interests decision, GP agreement and pharmacist instructions must be in place and reviewed regularly.",
          },
        }),
        yn("covert_auth", "Is the covert administration authorisation attached?", {
          showIf: { id: "covert", equals: "Yes" },
        }),
        long("other", "Any other risks or considerations", {
          help: "For example food or drink interactions.",
        }),
      ],
    },
  ],
};

const peep: RiskTemplate = {
  key: "peep",
  title: "Personal emergency evacuation plan (PEEP)",
  summary: "Records what the person needs to leave the building safely in an emergency.",
  group: "Safety planning",
  rated: true,
  ratingOptions: ["Low (independent)", "Medium (needs some help)", "High (very dependent)"],
  defaultReviewMonths: 6,
  sections: [
    {
      title: "Understanding and movement",
      questions: [
        long("comprehension", "Would the person understand what to do in an evacuation?"),
        multi("equipment", "What would the person need to leave the room and reach a safe place?", [
          "Walking aid",
          "Wheelchair",
          "Evacuation mat or sledge",
          "None",
        ]),
        yn("hoist", "Could the person be lifted without a hoist in an emergency?"),
        yn("neuro", "Any condition such as stroke, cerebral palsy, muscular dystrophy or MS that affects self-evacuation?"),
        yn("cognitive", "Any condition such as dementia, Parkinson's, Huntington's or dyspraxia that affects self-evacuation?"),
        yn("sight", "Is sight significantly impaired (for example registered blind)?"),
        yn("hearing", "Is hearing significantly impaired (for example registered deaf)?"),
        yn("frail", "Is the person at end of life, or so frail that being moved could be life-threatening?"),
      ],
    },
    {
      title: "Behaviour and health",
      questions: [
        long("leave_site", "Is the person likely to leave the site when the alarm sounds, and what helps?"),
        yn("resist", "Is the person likely to resist being moved?"),
        yn("phobia", "Any condition such as agoraphobia that could hinder movement?"),
        yn("medication", "Does medication affect the person's ability to evacuate or be evacuated?"),
        yn("equipment_attached", "Is the person attached to medical equipment that could delay or prevent evacuation?"),
        yn("heart", "Known heart condition?"),
        yn("diabetes", "Is the person diabetic?"),
        yn("oxygen", "Does the person receive oxygen therapy?"),
        yn("breathing", "Asthma or another breathing condition?"),
      ],
    },
    {
      title: "Plan",
      questions: [
        long("actions", "Actions to take in an evacuation"),
        num("staff_number", "Number of staff needed to help"),
      ],
    },
  ],
};

const cultural: RiskTemplate = {
  key: "cultural_spiritual",
  title: "Cultural, religious and spiritual needs",
  summary: "Records what matters to the person in their culture, faith and spiritual life.",
  group: "Personal and communication",
  rated: false,
  defaultReviewMonths: 12,
  sections: [
    {
      title: "Culture and faith",
      questions: [
        yn("culture", "Any considerations related to culture or ethnicity?"),
        detailIf("culture", "Please describe"),
        long("expression", "How does the person express their faith, spirituality or beliefs?", {
          help: "For example through relationships, conversation, prayer, music, nature or rituals.",
        }),
        yn("community", "Does the person attend or belong to a place of worship or faith community?"),
        detailIf("community", "Please describe"),
        yn("access", "Does the person have access to everything they need for their faith or beliefs?"),
        long("access_detail", "Please describe", { showIf: { id: "access", equals: "No" } }),
        long("helpful", "What aspects of their faith or practice does the person find most helpful?"),
        yn("restrictions", "Any practices or restrictions staff need to know about in providing care?", {
          help: "For example medicines or blood products.",
        }),
        detailIf("restrictions", "Please describe"),
        yn("involve", "Is there anyone the person would like involved in meeting their spiritual needs?"),
        detailIf("involve", "Who?"),
        long("other_support", "Any other support the person would like"),
      ],
    },
  ],
};

const intimacy: RiskTemplate = {
  key: "intimacy_relationships",
  title: "Intimacy, relationships and sexuality",
  summary: "Offers the person the chance to talk about relationships and intimacy, respecting privacy and consent.",
  group: "Personal and communication",
  rated: false,
  defaultReviewMonths: 12,
  sections: [
    {
      title: "Relationships and intimacy",
      questions: [
        yn("support", "Would the person like to talk about, or have support with, their intimate relationships or sexuality?", {
          help: "Offer sensitively and in private. It is fine for the answer to be No.",
        }),
        long("support_detail", "What support would they like?", { showIf: { id: "support", equals: "Yes" } }),
        long("privacy", "Preferences for privacy and who should (or should not) be involved", {
          showIf: { id: "support", equals: "Yes" },
        }),
        long("dignity", "Anything staff should know to protect dignity, consent and safety", {
          showIf: { id: "support", equals: "Yes" },
        }),
      ],
    },
  ],
};

const clinicalHistory: RiskTemplate = {
  key: "clinical_history",
  title: "Clinical history and medical conditions",
  summary: "Records past and current conditions, procedures and any devices or equipment in place.",
  group: "Health and body",
  rated: false,
  defaultReviewMonths: 6,
  sections: [
    {
      title: "History",
      questions: [
        long("past_conditions", "Known past medical conditions"),
        long("current_conditions", "Current medical conditions"),
        yn("surgery", "Any known surgical procedures?"),
        detailIf("surgery", "Which procedures, and when?"),
        yn("devices", "Does the person use safety equipment or have implanted medical devices?"),
        detailIf("devices", "Which devices?"),
        yn("disabled", "Is the person registered disabled?"),
        detailIf("disabled", "Please describe"),
      ],
    },
  ],
};

export const RISK_TEMPLATES: RiskTemplate[] = [
  movingHandling,
  falls,
  peep,
  choking,
  skinIntegrity,
  dietNutrition,
  allergies,
  oralHealth,
  continence,
  personalCare,
  medicationRisk,
  communication,
  cultural,
  intimacy,
  clinicalHistory,
];

export function getRiskTemplate(key: string): RiskTemplate | undefined {
  return RISK_TEMPLATES.find((t) => t.key === key);
}
