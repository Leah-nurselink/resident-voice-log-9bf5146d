// Typed question definitions for the 18 CareCore risk assessments (pack v4).
// Question types: yesno, select, multiselect, text, longtext, number, date.
// `showIf` hides a question until another answer matches; `flag` shows a prompt to the
// assessor when an answer matches. Prompts never trigger actions or scores.
// Wording needs review by a registered nurse or clinical lead (DCB0129 evidence).
export type RAFieldType = "yesno" | "select" | "multiselect" | "text" | "longtext" | "number" | "date";
export type RAField = {
  key: string; label: string; type: RAFieldType; options?: string[]; unit?: string; help?: string;
  showIf?: { id: string; equals: string | string[] };
  flag?: { equals: string | string[]; message: string };
};
export type RASection = { title: string; note?: string; prompt?: string; fields: RAField[] };
export type RiskAssessmentDef = {
  key: string; num: number; title: string; category: string; description: string;
  hasLevel: boolean; ratingOptions?: string[]; sections: RASection[];
};

export const RISK_ASSESSMENTS: RiskAssessmentDef[] = [
 {
  "key": "moving_handling",
  "num": 1,
  "title": "Moving and handling",
  "category": "Safety and mobility",
  "description": "Records how the person moves and what staff and equipment are needed to support them safely.",
  "hasLevel": true,
  "sections": [
   {
    "title": "Mobility",
    "fields": [
     {
      "key": "weight",
      "label": "Current weight",
      "type": "number",
      "unit": "kg"
     },
     {
      "key": "assistance",
      "label": "Level of help needed with mobility",
      "type": "select",
      "options": [
       "Independent",
       "Needs prompting or supervision",
       "Needs physical help from one person",
       "Needs physical help from two people",
       "Needs equipment (for example hoist or stand aid)"
      ]
     },
     {
      "key": "abilities",
      "label": "Which of these can the person do without help?",
      "type": "multiselect",
      "options": [
       "Raise their head",
       "Use both arms",
       "Sit",
       "Stand",
       "Turn"
      ]
     },
     {
      "key": "walking",
      "label": "Walking",
      "type": "select",
      "options": [
       "Walks independently",
       "Walks with an aid",
       "Walks with staff support",
       "Walks with an aid and staff support",
       "Does not walk"
      ]
     },
     {
      "key": "aids",
      "label": "Aids and equipment in use",
      "type": "multiselect",
      "options": [
       "Walking frame",
       "Walking stick",
       "Utility trolley",
       "Wheelchair",
       "Hoist",
       "Stand aid",
       "Slide sheet",
       "Other"
      ]
     },
     {
      "key": "aids_other",
      "label": "Other equipment",
      "type": "text",
      "showIf": {
       "id": "aids",
       "equals": "Other"
      }
     }
    ]
   },
   {
    "title": "Wheelchair use",
    "fields": [
     {
      "key": "wc_type",
      "label": "Is the wheelchair prescribed or for transit only?",
      "type": "select",
      "options": [
       "Prescribed",
       "Transit only"
      ],
      "showIf": {
       "id": "aids",
       "equals": "Wheelchair"
      }
     },
     {
      "key": "wc_assessment",
      "label": "Is a copy of the wheelchair assessment held in the home?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "wc_type",
       "equals": "Prescribed"
      }
     },
     {
      "key": "wc_frequency",
      "label": "How often is the wheelchair used?",
      "type": "text",
      "showIf": {
       "id": "aids",
       "equals": "Wheelchair"
      }
     },
     {
      "key": "wc_footplates",
      "label": "Are footplates needed?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "aids",
       "equals": "Wheelchair"
      }
     },
     {
      "key": "wc_belt",
      "label": "Is a wheelchair or posture belt needed?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "aids",
       "equals": "Wheelchair"
      }
     },
     {
      "key": "wc_belt_self",
      "label": "Can the person fit and adjust the belt without help?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "wc_belt",
       "equals": "Yes"
      }
     },
     {
      "key": "wc_sliding",
      "label": "With the belt fitted, is there a risk of sliding down and entrapment?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "wc_belt",
       "equals": "Yes"
      },
      "flag": {
       "equals": "Yes",
       "message": "Entrapment risk: seek advice from the wheelchair or occupational therapy service."
      }
     }
    ]
   },
   {
    "title": "Senses",
    "fields": [
     {
      "key": "vision",
      "label": "Any visual impairment?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "vision_detail",
      "label": "Describe the impairment",
      "type": "longtext",
      "showIf": {
       "id": "vision",
       "equals": "Yes"
      }
     },
     {
      "key": "vision_aids",
      "label": "Visual aids",
      "type": "multiselect",
      "options": [
       "Glasses",
       "Magnifier",
       "None"
      ]
     },
     {
      "key": "hearing",
      "label": "Any hearing impairment?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "hearing_aids",
      "label": "Does the person use hearing aids?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     }
    ]
   },
   {
    "title": "Factors affecting moving and handling",
    "fields": [
     {
      "key": "factors",
      "label": "Any of these that affect moving and handling?",
      "type": "multiselect",
      "options": [
       "Poor balance",
       "Spasm or involuntary movements",
       "Reduced muscle strength or tone",
       "History of seizures",
       "Sensory impairment",
       "Weakness or loss of use of a limb",
       "Pain",
       "None"
      ]
     },
     {
      "key": "factors_detail",
      "label": "Please explain",
      "type": "longtext"
     },
     {
      "key": "medication",
      "label": "Is the person on medication that affects moving and handling?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "help": "For example sedatives, pain relief, muscle relaxants, Parkinson's medication."
     },
     {
      "key": "medication_detail",
      "label": "Which medication, its effect, and how it is managed",
      "type": "longtext",
      "showIf": {
       "id": "medication",
       "equals": "Yes"
      }
     },
     {
      "key": "falls",
      "label": "Has the person fallen before?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "falls_detail",
      "label": "What needs to be taken into account?",
      "type": "longtext",
      "showIf": {
       "id": "falls",
       "equals": "Yes"
      }
     },
     {
      "key": "comprehension",
      "label": "How do understanding and cooperation affect moving and handling?",
      "type": "longtext",
      "help": "Consider confusion, agitation, ability to cooperate and motivation."
     },
     {
      "key": "behaviour",
      "label": "How does behaviour affect moving and handling?",
      "type": "longtext"
     },
     {
      "key": "communication",
      "label": "How does communication affect moving and handling?",
      "type": "longtext",
      "help": "Consider responding to instructions, language, and cultural or religious considerations."
     },
     {
      "key": "daily_support",
      "label": "Areas of day-to-day support the person needs help with",
      "type": "longtext"
     },
     {
      "key": "environment",
      "label": "Environmental issues that could interfere",
      "type": "multiselect",
      "options": [
       "Narrow doorways",
       "Cluttered space",
       "Flooring",
       "Bed or chair height",
       "Limited space for equipment",
       "Stairs",
       "None"
      ]
     },
     {
      "key": "staffing",
      "label": "Is extra support needed for staff?",
      "type": "longtext",
      "help": "Consider training, more than one member of staff, or staff with health issues or restricted mobility."
     },
     {
      "key": "other",
      "label": "Anything else to add",
      "type": "longtext"
     },
     {
      "key": "methods",
      "label": "Methods and procedures to follow after this assessment",
      "type": "longtext"
     }
    ]
   }
  ]
 },
 {
  "key": "falls",
  "num": 2,
  "title": "Falls risk (multifactorial)",
  "category": "Safety and mobility",
  "description": "Looks across medical, physical, environmental and behavioural factors that affect falls and bone health.",
  "hasLevel": true,
  "sections": [
   {
    "title": "History and mobility",
    "fields": [
     {
      "key": "falls_12m",
      "label": "Has the person fallen in the last 12 months?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "falls_12m_detail",
      "label": "How many, causes, injuries, what they were doing, any symptoms such as dizziness",
      "type": "longtext",
      "showIf": {
       "id": "falls_12m",
       "equals": "Yes"
      }
     },
     {
      "key": "unsteady",
      "label": "Is the person unsteady or unsafe when walking?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "transfers",
      "label": "Any difficulty with transfers (on and off the toilet, bed or chair)?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     }
    ]
   },
   {
    "title": "Bone health",
    "fields": [
     {
      "key": "osteoporosis",
      "label": "Does the person have osteoporosis?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "help": "Check transfer notes or ask the GP."
     },
     {
      "key": "osteo_risk",
      "label": "If not, any of these that raise the risk of osteoporosis?",
      "type": "multiselect",
      "options": [
       "Fracture after a minor bump or fall, over age 50",
       "Family history of osteoporosis or hip fracture",
       "Steroids for 3 months or more",
       "Loss of height or outward curve of the spine",
       "None"
      ],
      "showIf": {
       "id": "osteoporosis",
       "equals": "No"
      }
     }
    ]
   },
   {
    "title": "Medication",
    "fields": [
     {
      "key": "meds_4",
      "label": "Is the person on four or more medications?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "meds_risk",
      "label": "Is the person on any of these?",
      "type": "multiselect",
      "options": [
       "Sedatives",
       "Antidepressants",
       "Anti-Parkinson's medication",
       "Diuretics (water tablets)",
       "Antipsychotics",
       "Anticoagulants",
       "Blood pressure medication",
       "None"
      ]
     }
    ]
   },
   {
    "title": "Health and wellbeing",
    "fields": [
     {
      "key": "dizzy",
      "label": "Any dizziness on standing, spinning sensation, fainting or palpitations?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "weight_loss",
      "label": "Any unintentional weight loss or poor appetite?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "daylight",
      "label": "Does the person spend little time outside in daylight?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "confused",
      "label": "Any confusion, disorientation, restlessness, irritability or agitation?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "insight",
      "label": "Reduced insight or judgement, or does the person not cooperate with staff?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "continence",
      "label": "Do continence issues add to the falls risk?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "vision",
      "label": "Poor vision?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "hearing",
      "label": "Poor hearing?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "night",
      "label": "Does the person often get out of bed at night?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "night_safe",
      "label": "Can they get in and out of bed safely on their own?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "night",
       "equals": "Yes"
      }
     },
     {
      "key": "feet",
      "label": "Foot problems such as corns, ingrown nails, bunions, infection, pain or loss of feeling?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "footwear",
      "label": "Ill-fitting shoes, high heels, or shoes without grip?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "oriented",
      "label": "Is the person oriented to their surroundings?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "clothing",
      "label": "Does the person have suitable clothing and footwear?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "other_factors",
      "label": "Any other relevant factors, such as alcohol, pain or low mood?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "other_factors_detail",
      "label": "Please describe",
      "type": "longtext",
      "showIf": {
       "id": "other_factors",
       "equals": "Yes"
      }
     }
    ]
   },
   {
    "title": "Actions",
    "fields": [
     {
      "key": "interventions",
      "label": "Interventions chosen",
      "type": "multiselect",
      "options": [
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
       "Other"
      ]
     },
     {
      "key": "action_plan",
      "label": "Risk factors found, what will be done, and any referrals",
      "type": "longtext"
     },
     {
      "key": "recorded_in",
      "label": "Where the interventions are recorded",
      "type": "multiselect",
      "options": [
       "Care plan",
       "Handover",
       "Other"
      ]
     }
    ]
   }
  ]
 },
 {
  "key": "peep",
  "num": 3,
  "title": "Personal emergency evacuation plan (PEEP)",
  "category": "Safety planning",
  "description": "Records what the person needs to leave the building safely in an emergency, who will help, and the route to a place of safety.",
  "hasLevel": true,
  "ratingOptions": [
   "Low (independent)",
   "Medium (needs some help)",
   "High (very dependent)"
  ],
  "sections": [
   {
    "title": "Where and when this plan applies",
    "fields": [
     {
      "key": "building",
      "label": "Building",
      "type": "text"
     },
     {
      "key": "floor",
      "label": "Floor",
      "type": "text"
     },
     {
      "key": "room",
      "label": "Room number",
      "type": "text"
     },
     {
      "key": "times",
      "label": "When does this plan apply?",
      "type": "multiselect",
      "options": [
       "Daytime",
       "Evening",
       "Night",
       "All times"
      ],
      "help": "Staffing and routes can be different at night. If they are, record the night arrangements in the plan below."
     },
     {
      "key": "other_areas",
      "label": "Other areas the person uses, and whether a plan covers them",
      "type": "longtext",
      "help": "For example lounge, dining room, garden, day centre."
     },
     {
      "key": "fra_suitable",
      "label": "Does the building fire risk assessment show that access and escape routes are suitable for this person?",
      "type": "select",
      "options": [
       "Yes",
       "No",
       "Unsure"
      ],
      "flag": {
       "equals": [
        "No",
        "Unsure"
       ],
       "message": "Record the alternative arrangements and tell the person responsible for fire safety in the building. Consider whether a room move is needed. Complete a new plan if the person moves."
      }
     }
    ]
   },
   {
    "title": "Awareness and the alarm",
    "fields": [
     {
      "key": "explained",
      "label": "Have the emergency procedures been explained to the person?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "comprehension",
      "label": "Would the person understand what to do in an evacuation?",
      "type": "longtext"
     },
     {
      "key": "hear_alarm",
      "label": "Can the person hear the fire alarm in normal circumstances?",
      "type": "select",
      "options": [
       "Yes",
       "No",
       "Unsure"
      ]
     },
     {
      "key": "alerted_by",
      "label": "How will the person be told about an emergency?",
      "type": "multiselect",
      "options": [
       "Existing audible alarm",
       "Visual alarm (flashing light)",
       "Vibrating pager or pillow alarm",
       "Told in person by staff",
       "Other"
      ]
     },
     {
      "key": "alerted_other",
      "label": "Please describe",
      "type": "text",
      "showIf": {
       "id": "alerted_by",
       "equals": "Other"
      }
     },
     {
      "key": "format",
      "label": "Format the emergency procedures should be given in",
      "type": "multiselect",
      "options": [
       "Standard print",
       "Large print",
       "Easy read or pictures",
       "Braille",
       "Audio",
       "British Sign Language or another language"
      ]
     },
     {
      "key": "raise_alarm",
      "label": "Could the person raise the alarm, for example by operating a call point?",
      "type": "select",
      "options": [
       "Yes",
       "No",
       "Unsure"
      ]
     },
     {
      "key": "open_door",
      "label": "Can the person open the fire escape door on the floor they use?",
      "type": "select",
      "options": [
       "Yes",
       "No",
       "Unsure"
      ]
     },
     {
      "key": "call_help",
      "label": "Could the person use a phone or call point to call for help?",
      "type": "select",
      "options": [
       "Yes",
       "No",
       "Unsure"
      ]
     }
    ]
   },
   {
    "title": "Understanding and movement",
    "fields": [
     {
      "key": "equipment",
      "label": "What would the person need to leave the room and reach a safe place?",
      "type": "multiselect",
      "options": [
       "Walking aid",
       "Wheelchair",
       "Evacuation chair, mat or sledge",
       "None"
      ]
     },
     {
      "key": "wc_width",
      "label": "Approximate width of the wheelchair",
      "type": "number",
      "unit": "mm",
      "showIf": {
       "id": "equipment",
       "equals": "Wheelchair"
      }
     },
     {
      "key": "hoist",
      "label": "Could the person be lifted without a hoist in an emergency?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "chair_transfer",
      "label": "Could the person transfer to an evacuation chair with help?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "equipment",
       "equals": "Evacuation chair, mat or sledge"
      }
     },
     {
      "key": "chair_no_lift",
      "label": "Can the person transfer to the evacuation chair without being lifted?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "chair_transfer",
       "equals": "Yes"
      }
     },
     {
      "key": "chair_available",
      "label": "Is an evacuation chair provided for this area?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "equipment",
       "equals": "Evacuation chair, mat or sledge"
      }
     },
     {
      "key": "chair_where",
      "label": "Where is the nearest evacuation chair kept?",
      "type": "text",
      "showIf": {
       "id": "chair_available",
       "equals": "Yes"
      }
     },
     {
      "key": "neuro",
      "label": "Any condition such as stroke, cerebral palsy, muscular dystrophy or MS that affects self-evacuation?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "cognitive",
      "label": "Any condition such as dementia, Parkinson's, Huntington's or dyspraxia that affects self-evacuation?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "sight",
      "label": "Is sight significantly impaired (for example registered blind)?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "hearing",
      "label": "Is hearing significantly impaired (for example registered deaf)?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "frail",
      "label": "Is the person at end of life, or so frail that being moved could be life-threatening?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     }
    ]
   },
   {
    "title": "Routes and time to reach safety",
    "fields": [
     {
      "key": "exits",
      "label": "How many fire exits are available for this person at the times above?",
      "type": "number"
     },
     {
      "key": "exit_distance",
      "label": "If only one exit is available, approximately how far is it from where the person would start?",
      "type": "text",
      "help": "Distance or walking time."
     },
     {
      "key": "time_unaided",
      "label": "Approximately how long would it take the person, unaided, to reach a place of safety?",
      "type": "text",
      "help": "Note a time for each available exit, up to four."
     },
     {
      "key": "barriers",
      "label": "Is there anything on the escape routes that could be a hazard or barrier?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "help": "For example steps, narrow doors, door thresholds, clutter, heavy fire doors."
     },
     {
      "key": "barriers_detail",
      "label": "What, and where?",
      "type": "longtext",
      "showIf": {
       "id": "barriers",
       "equals": "Yes"
      }
     },
     {
      "key": "above_ground",
      "label": "Is the person's area above the ground floor, or in a basement reached by stairs?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "fire_lift",
      "label": "Is there a fire-fighting or evacuation lift?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "above_ground",
       "equals": "Yes"
      }
     },
     {
      "key": "refuge",
      "label": "Is there a refuge on or next to the escape route?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "above_ground",
       "equals": "Yes"
      }
     },
     {
      "key": "refuge_comms",
      "label": "Can the person use the refuge communication point?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "refuge",
       "equals": "Yes"
      }
     },
     {
      "key": "horizontal",
      "label": "Can the person escape sideways into an adjoining fire compartment or building?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "help": "Horizontal evacuation.",
      "showIf": {
       "id": "above_ground",
       "equals": "Yes"
      }
     },
     {
      "key": "relocate",
      "label": "Has moving the person to a ground-floor room been considered?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "above_ground",
       "equals": "Yes"
      },
      "flag": {
       "equals": "No",
       "message": "Consider whether the person could be moved to the ground floor before relying on a stair evacuation."
      }
     }
    ]
   },
   {
    "title": "Behaviour and health",
    "fields": [
     {
      "key": "leave_site",
      "label": "Is the person likely to leave the site when the alarm sounds, and what helps?",
      "type": "longtext"
     },
     {
      "key": "resist",
      "label": "Is the person likely to resist being moved?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "phobia",
      "label": "Any condition such as agoraphobia that could hinder movement?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "medication",
      "label": "Does medication affect the person's ability to evacuate or be evacuated?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "equipment_attached",
      "label": "Is the person attached to medical equipment that could delay or prevent evacuation?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "heart",
      "label": "Known heart condition?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "diabetes",
      "label": "Is the person diabetic?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "oxygen",
      "label": "Does the person receive oxygen therapy?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "breathing",
      "label": "Asthma or another breathing condition?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     }
    ]
   },
   {
    "title": "Who will help",
    "fields": [
     {
      "key": "helper_names",
      "label": "Who will give help? (names or roles)",
      "type": "text"
     },
     {
      "key": "helper_cover",
      "label": "Who covers when the usual helper is absent?",
      "type": "longtext",
      "help": "Include nights, sickness and leave. Name a role if names change."
     },
     {
      "key": "helpers_trained",
      "label": "Have the people who will help been trained in this person's evacuation method?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "flag": {
       "equals": "No",
       "message": "Arrange training before relying on this plan. Record who and when."
      }
     },
     {
      "key": "staff_number",
      "label": "Number of staff needed to help",
      "type": "number"
     }
    ]
   },
   {
    "title": "The plan",
    "fields": [
     {
      "key": "actions",
      "label": "Step-by-step plan, from first alarm to reaching a place of safety",
      "type": "longtext",
      "help": "Include routes, any refuge, and the equipment used. Add a diagram if it helps."
     },
     {
      "key": "diagram",
      "label": "Is a diagram attached?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "problems",
      "label": "Does anything need to change in the building or equipment for this plan to work?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "flag": {
       "equals": "Yes",
       "message": "Tell the registered manager and the person responsible for fire safety, and record what is needed and who will do it. Use an interim arrangement until it is done."
      }
     },
     {
      "key": "problems_detail",
      "label": "What needs to change, who is responsible, and by when?",
      "type": "longtext",
      "showIf": {
       "id": "problems",
       "equals": "Yes"
      }
     },
     {
      "key": "review_when",
      "label": "Review this plan when",
      "type": "multiselect",
      "options": [
       "The person's mobility or health changes",
       "The person moves room",
       "Staffing or night cover changes",
       "After a fire drill or incident",
       "Building or fire risk assessment changes"
      ],
      "help": "A review date is set below. Also review whenever any of these happen."
     }
    ]
   },
   {
    "title": "Agreement and sharing",
    "fields": [
     {
      "key": "agreed",
      "label": "Has the plan been discussed with, and agreed by, the person or their representative?",
      "type": "select",
      "options": [
       "Yes",
       "No",
       "Unsure"
      ],
      "flag": {
       "equals": [
        "No",
        "Unsure"
       ],
       "message": "If the person cannot agree, record how the decision was made in their best interests and who was consulted."
      }
     },
     {
      "key": "share",
      "label": "Has the person (or representative) agreed that the plan can be shared with fire wardens and staff who need it?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "shared_with",
      "label": "Who has a copy, and where is the plan kept so it can be found in an emergency?",
      "type": "text"
     }
    ]
   }
  ]
 },
 {
  "key": "choking",
  "num": 4,
  "title": "Choking risk",
  "category": "Nutrition and medication",
  "description": "Identifies swallowing and eating risks and the support needed at mealtimes.",
  "hasLevel": true,
  "sections": [
   {
    "title": "Background",
    "fields": [
     {
      "key": "reason",
      "label": "Reason for this assessment",
      "type": "select",
      "options": [
       "New admission",
       "Routine review",
       "Change in condition",
       "After an incident",
       "Other"
      ]
     },
     {
      "key": "reason_other",
      "label": "Please describe",
      "type": "text",
      "showIf": {
       "id": "reason",
       "equals": "Other"
      }
     },
     {
      "key": "history",
      "label": "Has the person ever choked?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "history_detail",
      "label": "Approximate dates, what was being eaten, and what help was needed",
      "type": "longtext",
      "showIf": {
       "id": "history",
       "equals": "Yes"
      }
     }
    ]
   },
   {
    "title": "Risk factors",
    "fields": [
     {
      "key": "signs",
      "label": "Any signs that may raise choking risk?",
      "type": "multiselect",
      "options": [
       "Frailty",
       "Frequent coughing",
       "Difficulty chewing or swallowing",
       "Wet or gurgly voice after swallowing",
       "Breathing changes during or after eating or drinking",
       "Poor teeth or no dentures",
       "Needs one-to-one help to eat",
       "Pain or distress when eating or drinking",
       "None observed"
      ]
     },
     {
      "key": "capacity",
      "label": "Can the person decide for themselves what to put in their mouth?",
      "type": "select",
      "options": [
       "Yes",
       "No",
       "Unsure"
      ],
      "help": "If unsure, consider a mental capacity assessment."
     },
     {
      "key": "medical",
      "label": "Any physical condition that raises choking risk?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "help": "For example reflux, breathing conditions, head or neck injury or cancer."
     },
     {
      "key": "medical_detail",
      "label": "Which condition(s)?",
      "type": "longtext",
      "showIf": {
       "id": "medical",
       "equals": "Yes"
      }
     },
     {
      "key": "neuro",
      "label": "Any neurological condition that raises choking risk?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "help": "For example stroke, dementia, Parkinson's disease, seizures."
     },
     {
      "key": "neuro_detail",
      "label": "Which condition(s)?",
      "type": "longtext",
      "showIf": {
       "id": "neuro",
       "equals": "Yes"
      }
     },
     {
      "key": "mental",
      "label": "Any mental health condition that raises choking risk?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "help": "For example pica."
     },
     {
      "key": "mental_detail",
      "label": "Which condition(s)?",
      "type": "longtext",
      "showIf": {
       "id": "mental",
       "equals": "Yes"
      }
     },
     {
      "key": "behaviours",
      "label": "Eating behaviours that could lead to choking",
      "type": "multiselect",
      "options": [
       "Eats or drinks too fast",
       "Overfills the mouth",
       "Talks while eating",
       "Lies down or reclines soon after eating",
       "None observed"
      ]
     },
     {
      "key": "strategies",
      "label": "Strategies that help with these behaviours",
      "type": "longtext",
      "help": "For example prompts or smaller cutlery."
     },
     {
      "key": "medication",
      "label": "Is the person on medication that affects swallowing?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "help": "For example drowsiness, dry mouth, tremor or facial stiffness."
     },
     {
      "key": "medication_detail",
      "label": "Which medication and what effect?",
      "type": "longtext",
      "showIf": {
       "id": "medication",
       "equals": "Yes"
      }
     },
     {
      "key": "other",
      "label": "Anything else relevant to choking risk",
      "type": "longtext"
     }
    ]
   },
   {
    "title": "Follow-up",
    "fields": [
     {
      "key": "followup",
      "label": "Is any follow-up needed?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "flag": {
       "equals": "Yes",
       "message": "Consider whether a speech and language therapy or GP referral is needed."
      }
     },
     {
      "key": "followup_detail",
      "label": "What follow-up, and who will do it?",
      "type": "longtext",
      "showIf": {
       "id": "followup",
       "equals": "Yes"
      }
     }
    ]
   }
  ]
 },
 {
  "key": "skin",
  "num": 5,
  "title": "Skin integrity check",
  "category": "Health and body",
  "description": "A quick check of the skin and any new marks, wounds or injuries.",
  "hasLevel": false,
  "sections": [
   {
    "title": "Skin check",
    "fields": [
     {
      "key": "reason",
      "label": "Reason for the check",
      "type": "select",
      "options": [
       "Initial check when starting care",
       "Routine check",
       "After a fall or incident",
       "Change in condition",
       "Other"
      ]
     },
     {
      "key": "existing",
      "label": "Are there skin conditions already recorded that need updating?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "existing_detail",
      "label": "What needs updating?",
      "type": "longtext",
      "showIf": {
       "id": "existing",
       "equals": "Yes"
      }
     },
     {
      "key": "new_wounds",
      "label": "Any newly identified wounds or marks?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "flag": {
       "equals": "Yes",
       "message": "Record each wound in the wound chart. Consider whether it needs reporting as an incident."
      }
     },
     {
      "key": "location",
      "label": "Where on the body?",
      "type": "text",
      "showIf": {
       "id": "new_wounds",
       "equals": "Yes"
      }
     },
     {
      "key": "wound_type",
      "label": "What kind of wound or mark?",
      "type": "select",
      "options": [
       "Bruise",
       "Skin tear",
       "Pressure injury",
       "Cut or graze",
       "Burn",
       "Rash or irritation",
       "Other"
      ],
      "showIf": {
       "id": "new_wounds",
       "equals": "Yes"
      }
     },
     {
      "key": "photo",
      "label": "Was a photo taken?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "new_wounds",
       "equals": "Yes"
      }
     },
     {
      "key": "consent",
      "label": "Can the person consent to assessment and treatment?",
      "type": "select",
      "options": [
       "Yes",
       "No",
       "Unsure"
      ],
      "help": "If not, follow your mental capacity and best-interests process."
     },
     {
      "key": "other",
      "label": "Anything else to add",
      "type": "longtext"
     }
    ]
   }
  ]
 },
 {
  "key": "nutrition",
  "num": 6,
  "title": "Diet and nutrition",
  "category": "Nutrition and medication",
  "description": "Records eating and drinking needs, textures and preferences.",
  "hasLevel": false,
  "sections": [
   {
    "title": "Diet",
    "fields": [
     {
      "key": "preferences",
      "label": "Dietary preferences and the reason for them",
      "type": "longtext"
     },
     {
      "key": "special_diet",
      "label": "Is the person on a special diet?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "special_diet_detail",
      "label": "Which diet, and why?",
      "type": "longtext",
      "showIf": {
       "id": "special_diet",
       "equals": "Yes"
      }
     },
     {
      "key": "nutrition_needs",
      "label": "Any specific nutritional needs?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "nutrition_needs_detail",
      "label": "Please describe",
      "type": "longtext",
      "showIf": {
       "id": "nutrition_needs",
       "equals": "Yes"
      }
     },
     {
      "key": "religious_diet",
      "label": "Does the person follow a religious or cultural diet?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "religious_diet_detail",
      "label": "Please describe",
      "type": "longtext",
      "showIf": {
       "id": "religious_diet",
       "equals": "Yes"
      }
     }
    ]
   },
   {
    "title": "Textures and aids",
    "fields": [
     {
      "key": "food_texture",
      "label": "Food texture (IDDSI level)",
      "type": "select",
      "options": [
       "Regular (7)",
       "Easy to chew (7EC)",
       "Soft and bite-sized (6)",
       "Minced and moist (5)",
       "Pureed (4)",
       "Liquidised (3)"
      ]
     },
     {
      "key": "fluid_texture",
      "label": "Fluid texture (IDDSI level)",
      "type": "select",
      "options": [
       "Thin (0)",
       "Slightly thick (1)",
       "Mildly thick (2)",
       "Moderately thick (3)",
       "Extremely thick (4)"
      ]
     },
     {
      "key": "aids",
      "label": "Does the person use aids to eat or drink?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "aids_detail",
      "label": "Which aids?",
      "type": "longtext",
      "showIf": {
       "id": "aids",
       "equals": "Yes"
      }
     },
     {
      "key": "dentures",
      "label": "Does the person use dentures or other oral devices?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "dentures_detail",
      "label": "Which devices?",
      "type": "longtext",
      "showIf": {
       "id": "dentures",
       "equals": "Yes"
      }
     }
    ]
   }
  ]
 },
 {
  "key": "allergies",
  "num": 7,
  "title": "Allergies and intolerances",
  "category": "Health and body",
  "description": "Records known allergies and intolerances and what to do if there is a reaction.",
  "hasLevel": false,
  "sections": [
   {
    "title": "Allergies",
    "fields": [
     {
      "key": "food",
      "label": "Food allergies",
      "type": "select",
      "options": [
       "None known",
       "Yes"
      ]
     },
     {
      "key": "food_detail",
      "label": "Which foods and what reaction?",
      "type": "longtext",
      "showIf": {
       "id": "food",
       "equals": "Yes"
      }
     },
     {
      "key": "medication",
      "label": "Medication allergies",
      "type": "select",
      "options": [
       "None known",
       "Yes"
      ]
     },
     {
      "key": "medication_detail",
      "label": "Which medicines and what reaction?",
      "type": "longtext",
      "showIf": {
       "id": "medication",
       "equals": "Yes"
      }
     },
     {
      "key": "environmental",
      "label": "Environmental or contact allergies",
      "type": "select",
      "options": [
       "None known",
       "Yes"
      ]
     },
     {
      "key": "environmental_detail",
      "label": "Which substances and what reaction?",
      "type": "longtext",
      "showIf": {
       "id": "environmental",
       "equals": "Yes"
      }
     },
     {
      "key": "intolerances",
      "label": "Intolerances",
      "type": "select",
      "options": [
       "None known",
       "Yes"
      ]
     },
     {
      "key": "intolerances_detail",
      "label": "Which intolerances?",
      "type": "longtext",
      "showIf": {
       "id": "intolerances",
       "equals": "Yes"
      }
     },
     {
      "key": "reaction_plan",
      "label": "What staff should do if there is a reaction",
      "type": "longtext"
     },
     {
      "key": "notes",
      "label": "Other notes, including family or personal wishes",
      "type": "longtext"
     }
    ]
   }
  ]
 },
 {
  "key": "oral",
  "num": 8,
  "title": "Oral health",
  "category": "Health and body",
  "description": "An observation checklist of the mouth, teeth, gums and any dental pain.",
  "hasLevel": false,
  "sections": [
   {
    "title": "Observations",
    "fields": [
     {
      "key": "lips",
      "label": "Lips",
      "type": "select",
      "options": [
       "Healthy",
       "Some changes",
       "Unhealthy",
       "Not applicable"
      ],
      "flag": {
       "equals": [
        "Some changes",
        "Unhealthy"
       ],
       "message": "Consider arranging for a dentist to examine the person."
      }
     },
     {
      "key": "tongue",
      "label": "Tongue",
      "type": "select",
      "options": [
       "Healthy",
       "Some changes",
       "Unhealthy",
       "Not applicable"
      ],
      "flag": {
       "equals": [
        "Some changes",
        "Unhealthy"
       ],
       "message": "Consider arranging for a dentist to examine the person."
      }
     },
     {
      "key": "gums",
      "label": "Gums and tissues",
      "type": "select",
      "options": [
       "Healthy",
       "Some changes",
       "Unhealthy",
       "Not applicable"
      ],
      "flag": {
       "equals": [
        "Some changes",
        "Unhealthy"
       ],
       "message": "Consider arranging for a dentist to examine the person."
      }
     },
     {
      "key": "saliva",
      "label": "Saliva",
      "type": "select",
      "options": [
       "Healthy",
       "Some changes",
       "Unhealthy",
       "Not applicable"
      ],
      "flag": {
       "equals": [
        "Some changes",
        "Unhealthy"
       ],
       "message": "Consider arranging for a dentist to examine the person."
      }
     },
     {
      "key": "natural_teeth",
      "label": "Natural teeth",
      "type": "select",
      "options": [
       "Healthy",
       "Some changes",
       "Unhealthy",
       "Not applicable"
      ],
      "flag": {
       "equals": [
        "Some changes",
        "Unhealthy"
       ],
       "message": "Consider arranging for a dentist to examine the person."
      }
     },
     {
      "key": "dentures",
      "label": "Dentures",
      "type": "select",
      "options": [
       "Healthy",
       "Some changes",
       "Unhealthy",
       "Not applicable"
      ],
      "flag": {
       "equals": [
        "Some changes",
        "Unhealthy"
       ],
       "message": "Consider arranging for a dentist to examine the person."
      }
     },
     {
      "key": "cleanliness",
      "label": "Oral cleanliness",
      "type": "select",
      "options": [
       "Healthy",
       "Some changes",
       "Unhealthy",
       "Not applicable"
      ],
      "flag": {
       "equals": [
        "Some changes",
        "Unhealthy"
       ],
       "message": "Consider arranging for a dentist to examine the person."
      }
     },
     {
      "key": "pain",
      "label": "Signs of dental pain (behaviour, speech or physical signs)",
      "type": "select",
      "options": [
       "Healthy",
       "Some changes",
       "Unhealthy",
       "Not applicable"
      ],
      "flag": {
       "equals": [
        "Some changes",
        "Unhealthy"
       ],
       "message": "Consider arranging for a dentist to examine the person."
      }
     },
     {
      "key": "actions",
      "label": "Oral hygiene care and actions needed",
      "type": "longtext"
     }
    ]
   }
  ]
 },
 {
  "key": "continence",
  "num": 9,
  "title": "Continence",
  "category": "Health and body",
  "description": "Records toileting needs, support, equipment and any referral needed.",
  "hasLevel": false,
  "sections": [
   {
    "title": "Toileting",
    "fields": [
     {
      "key": "reason",
      "label": "Reason for the assessment",
      "type": "select",
      "options": [
       "New admission",
       "Routine review",
       "Change in condition",
       "After an incident",
       "Other"
      ]
     },
     {
      "key": "recognises",
      "label": "Can the person tell when they need the toilet?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "cues",
      "label": "Signs that they may need the toilet",
      "type": "longtext",
      "help": "For example restlessness or removing clothes."
     },
     {
      "key": "assistance",
      "label": "Help needed to use the toilet",
      "type": "select",
      "options": [
       "None",
       "Prompting",
       "Physical help"
      ]
     },
     {
      "key": "staff_number",
      "label": "Number of staff needed",
      "type": "number",
      "showIf": {
       "id": "assistance",
       "equals": "Physical help"
      }
     },
     {
      "key": "cooperation",
      "label": "Does the person cooperate when helped?",
      "type": "select",
      "options": [
       "Yes",
       "Sometimes",
       "No"
      ]
     },
     {
      "key": "cooperation_detail",
      "label": "Please explain",
      "type": "longtext",
      "showIf": {
       "id": "cooperation",
       "equals": [
        "Sometimes",
        "No"
       ]
      }
     },
     {
      "key": "on_off",
      "label": "Getting on and off the toilet or commode",
      "type": "select",
      "options": [
       "Independent",
       "Needs help, equipment or aids"
      ]
     },
     {
      "key": "dressing",
      "label": "Dressing and undressing for the toilet",
      "type": "select",
      "options": [
       "Independent",
       "Needs help, equipment or aids"
      ]
     },
     {
      "key": "cleaning",
      "label": "Cleaning after using the toilet",
      "type": "select",
      "options": [
       "Independent",
       "Needs help, equipment or aids"
      ]
     },
     {
      "key": "finds_toilet",
      "label": "Can the person find the toilet?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "finds_toilet_help",
      "label": "What would help?",
      "type": "longtext",
      "help": "For example directions, a light on, or the door left open.",
      "showIf": {
       "id": "finds_toilet",
       "equals": "No"
      }
     }
    ]
   },
   {
    "title": "Pattern and aids",
    "fields": [
     {
      "key": "day_frequency",
      "label": "Average toilet visits during the day",
      "type": "number"
     },
     {
      "key": "night_frequency",
      "label": "Average toilet visits during the night",
      "type": "number"
     },
     {
      "key": "night_support",
      "label": "Support needed at night",
      "type": "longtext"
     },
     {
      "key": "sleep_disturbed",
      "label": "Does the night routine disturb sleep?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "sleep_help",
      "label": "What could reduce disturbed sleep?",
      "type": "longtext",
      "help": "For example a commode by the bed.",
      "showIf": {
       "id": "sleep_disturbed",
       "equals": "Yes"
      }
     },
     {
      "key": "catheter",
      "label": "Does the person have a urinary catheter?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "catheter_help",
      "label": "Is help needed to empty the catheter bag?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "catheter",
       "equals": "Yes"
      }
     },
     {
      "key": "aids",
      "label": "Does the person use continence aids?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "aids_used",
      "label": "Which aids?",
      "type": "multiselect",
      "options": [
       "Disposable pads",
       "Washable pads or pants",
       "Commode",
       "Urinal",
       "Catheter",
       "Other"
      ],
      "showIf": {
       "id": "aids",
       "equals": "Yes"
      }
     }
    ]
   },
   {
    "title": "Health and follow-up",
    "fields": [
     {
      "key": "referral",
      "label": "Should a referral be made to the continence service?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "referral_detail",
      "label": "Reason for referral",
      "type": "longtext",
      "showIf": {
       "id": "referral",
       "equals": "Yes"
      }
     },
     {
      "key": "condition",
      "label": "Is a medical condition being managed that may cause incontinence?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "condition_detail",
      "label": "Which condition, and any discomfort it causes",
      "type": "longtext",
      "showIf": {
       "id": "condition",
       "equals": "Yes"
      }
     },
     {
      "key": "medication",
      "label": "Any medication or creams that affect passing urine or stool?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "medication_detail",
      "label": "Which ones?",
      "type": "longtext",
      "showIf": {
       "id": "medication",
       "equals": "Yes"
      }
     },
     {
      "key": "symptoms",
      "label": "Any of these when passing urine or stool?",
      "type": "multiselect",
      "options": [
       "Pain or burning",
       "Blood",
       "Urgency",
       "Frequent passing",
       "Straining",
       "Leakage",
       "None"
      ]
     },
     {
      "key": "other",
      "label": "Anything else about continence",
      "type": "longtext"
     },
     {
      "key": "actions_required",
      "label": "Are any actions required?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "actions_required_detail",
      "label": "What actions?",
      "type": "longtext",
      "showIf": {
       "id": "actions_required",
       "equals": "Yes"
      }
     }
    ]
   }
  ]
 },
 {
  "key": "personal_care",
  "num": 10,
  "title": "Personal care",
  "category": "Personal and communication",
  "description": "Records how much support the person needs with washing, dressing and hygiene, and their preferences.",
  "hasLevel": false,
  "sections": [
   {
    "title": "Personal care",
    "fields": [
     {
      "key": "participation",
      "label": "How the person takes part in their own personal care",
      "type": "select",
      "options": [
       "Independent",
       "Takes part with prompting",
       "Takes part with physical help",
       "Fully dependent on staff"
      ]
     },
     {
      "key": "staff_number",
      "label": "Number of staff needed",
      "type": "number"
     },
     {
      "key": "preferences",
      "label": "Any preferences or wishes about personal care and hygiene?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "preferences_detail",
      "label": "For example gender of carer, time of day, products",
      "type": "longtext",
      "showIf": {
       "id": "preferences",
       "equals": "Yes"
      }
     },
     {
      "key": "other",
      "label": "Anything else to add",
      "type": "longtext"
     }
    ]
   }
  ]
 },
 {
  "key": "medication",
  "num": 11,
  "title": "Medication risk",
  "category": "Nutrition and medication",
  "description": "Looks at how safely the person's medicines can be managed and what support is needed.",
  "hasLevel": true,
  "sections": [
   {
    "title": "Managing medicines",
    "fields": [
     {
      "key": "reason",
      "label": "Reason for the assessment",
      "type": "select",
      "options": [
       "New admission",
       "Routine review",
       "Change in condition",
       "After an incident",
       "Other"
      ]
     },
     {
      "key": "control_all",
      "label": "Can the person keep control of ALL their medicines (oral, applied, injected, as-needed and variable-dose)?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "help": "If not, a separate mental capacity or best-interests decision should be recorded."
     },
     {
      "key": "control_all_notes",
      "label": "Comments and actions",
      "type": "longtext"
     },
     {
      "key": "control_some",
      "label": "Can the person keep control of SOME of their medicines?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "control_some_notes",
      "label": "Which medicines, and comments and actions",
      "type": "longtext"
     },
     {
      "key": "understands",
      "label": "Can the person understand and remember information about their medicines?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "understands_support",
      "label": "What support is needed?",
      "type": "longtext",
      "showIf": {
       "id": "understands",
       "equals": "No"
      }
     },
     {
      "key": "impairment",
      "label": "Any disability or impairment that could affect managing medicines",
      "type": "longtext"
     },
     {
      "key": "self_harm",
      "label": "Any mental health condition that may put the person at risk of self-harm with medicines?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "flag": {
       "equals": "Yes",
       "message": "Consider a referral to the GP or mental health team."
      }
     },
     {
      "key": "others_safety",
      "label": "Does the person understand why medicines must be kept safe from others, and is secure storage available?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "matches_prescription",
      "label": "Do the medicines match the discharge summary or prescription?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "knows_purpose",
      "label": "Does the person know what their medicines are for?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "reads_labels",
      "label": "Can the person read the labels (with or without glasses)?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "has_clock",
      "label": "Does the person have a clock or watch to tell the time?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "opens_packaging",
      "label": "Can the person open the medicine packaging?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "water",
      "label": "Can the person get drinking water?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     }
    ]
   },
   {
    "title": "Prescriptions and records",
    "fields": [
     {
      "key": "prescription_clear",
      "label": "Is the prescription clear about dose and timing?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "mar_matches",
      "label": "Does the MAR chart clearly match the prescription?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "prn_clear",
      "label": "Is it clear what each as-needed (PRN) medicine is for?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "flag": {
       "equals": "No",
       "message": "Ask the prescriber for clear instructions and set up a PRN plan. If the person cannot say they are in pain, use a pain assessment for people with cognitive impairment."
      }
     },
     {
      "key": "variable_dose",
      "label": "Are there variable-dose medicines that depend on test results, such as warfarin?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "variable_written",
      "label": "Is written instruction provided each time the dose changes?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "variable_dose",
       "equals": "Yes"
      }
     },
     {
      "key": "topicals",
      "label": "Are creams or other topical products prescribed?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "topicals_clear",
      "label": "Is it clear how, when and where to apply them?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "topicals",
       "equals": "Yes"
      }
     }
    ]
   },
   {
    "title": "Special medicines and routes",
    "fields": [
     {
      "key": "non_oral",
      "label": "Are any medicines given by a route other than the mouth?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "paraffin",
      "label": "Are paraffin-based creams or emollients prescribed?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "flag": {
       "equals": "Yes",
       "message": "Carry out a separate fire risk assessment, especially for smokers, oxygen users, or people using electric beds or mattresses."
      }
     },
     {
      "key": "drops",
      "label": "Are eye, ear or nasal drops prescribed?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "patches",
      "label": "Are transdermal patches used?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "flag": {
       "equals": "Yes",
       "message": "Use a patch site chart and consider heat sources such as hairdryers."
      }
     },
     {
      "key": "special_techniques",
      "label": "Are any medicines given by special techniques, such as via a feeding tube?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "flag": {
       "equals": "Yes",
       "message": "Staff must be trained by a healthcare professional."
      }
     },
     {
      "key": "oxygen",
      "label": "Is oxygen needed?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "flag": {
       "equals": "Yes",
       "message": "Staff need training from a healthcare professional or oxygen provider. Check storage and signage."
      }
     },
     {
      "key": "controlled",
      "label": "Are controlled drugs prescribed?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "flag": {
       "equals": "Yes",
       "message": "Follow your controlled drugs procedure: register, two signatures, safe storage."
      }
     },
     {
      "key": "covert",
      "label": "Are any medicines given covertly?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "flag": {
       "equals": "Yes",
       "message": "A best-interests decision, GP agreement and pharmacist instructions must be in place and reviewed regularly."
      }
     },
     {
      "key": "covert_auth",
      "label": "Is the covert administration authorisation attached?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "covert",
       "equals": "Yes"
      }
     },
     {
      "key": "other",
      "label": "Any other risks or considerations",
      "type": "longtext",
      "help": "For example food or drink interactions."
     }
    ]
   }
  ]
 },
 {
  "key": "communication",
  "num": 12,
  "title": "Communication",
  "category": "Personal and communication",
  "description": "Records how the person understands and expresses themselves, and what helps.",
  "hasLevel": false,
  "sections": [
   {
    "title": "Written and picture-based communication",
    "fields": [
     {
      "key": "written_understanding",
      "label": "How well does the person understand this kind of communication?",
      "type": "longtext"
     },
     {
      "key": "written_preference",
      "label": "How does the person prefer to communicate this way?",
      "type": "longtext"
     },
     {
      "key": "written_support",
      "label": "What helps the person communicate at their best?",
      "type": "longtext"
     },
     {
      "key": "written_other",
      "label": "Anything else to consider",
      "type": "longtext"
     }
    ]
   },
   {
    "title": "Spoken communication",
    "fields": [
     {
      "key": "spoken_understanding",
      "label": "How well does the person understand this kind of communication?",
      "type": "longtext"
     },
     {
      "key": "spoken_preference",
      "label": "How does the person prefer to communicate this way?",
      "type": "longtext"
     },
     {
      "key": "spoken_support",
      "label": "What helps the person communicate at their best?",
      "type": "longtext"
     },
     {
      "key": "spoken_other",
      "label": "Anything else to consider",
      "type": "longtext"
     }
    ]
   },
   {
    "title": "Gesture-based communication",
    "fields": [
     {
      "key": "gesture_understanding",
      "label": "How well does the person understand this kind of communication?",
      "type": "longtext"
     },
     {
      "key": "gesture_preference",
      "label": "How does the person prefer to communicate this way?",
      "type": "longtext"
     },
     {
      "key": "gesture_support",
      "label": "What helps the person communicate at their best?",
      "type": "longtext"
     },
     {
      "key": "gesture_other",
      "label": "Anything else to consider",
      "type": "longtext"
     }
    ]
   },
   {
    "title": "Using technology to communicate",
    "fields": [
     {
      "key": "technology_understanding",
      "label": "How well does the person understand this kind of communication?",
      "type": "longtext"
     },
     {
      "key": "technology_preference",
      "label": "How does the person prefer to communicate this way?",
      "type": "longtext"
     },
     {
      "key": "technology_support",
      "label": "What helps the person communicate at their best?",
      "type": "longtext"
     },
     {
      "key": "technology_other",
      "label": "Anything else to consider",
      "type": "longtext"
     }
    ]
   },
   {
    "title": "General",
    "fields": [
     {
      "key": "general",
      "label": "General considerations about communication",
      "type": "longtext"
     },
     {
      "key": "interpreter",
      "label": "Does the person need an interpreter or translated materials?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "interpreter_detail",
      "label": "Which language or format?",
      "type": "longtext",
      "showIf": {
       "id": "interpreter",
       "equals": "Yes"
      }
     }
    ]
   }
  ]
 },
 {
  "key": "cultural",
  "num": 13,
  "title": "Cultural, religious and spiritual needs",
  "category": "Personal and communication",
  "description": "Records what matters to the person in their culture, faith and spiritual life.",
  "hasLevel": false,
  "sections": [
   {
    "title": "Culture and faith",
    "fields": [
     {
      "key": "culture",
      "label": "Any considerations related to culture or ethnicity?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "culture_detail",
      "label": "Please describe",
      "type": "longtext",
      "showIf": {
       "id": "culture",
       "equals": "Yes"
      }
     },
     {
      "key": "expression",
      "label": "How does the person express their faith, spirituality or beliefs?",
      "type": "longtext",
      "help": "For example through relationships, conversation, prayer, music, nature or rituals."
     },
     {
      "key": "community",
      "label": "Does the person attend or belong to a place of worship or faith community?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "community_detail",
      "label": "Please describe",
      "type": "longtext",
      "showIf": {
       "id": "community",
       "equals": "Yes"
      }
     },
     {
      "key": "access",
      "label": "Does the person have access to everything they need for their faith or beliefs?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "access_detail",
      "label": "Please describe",
      "type": "longtext",
      "showIf": {
       "id": "access",
       "equals": "No"
      }
     },
     {
      "key": "helpful",
      "label": "What aspects of their faith or practice does the person find most helpful?",
      "type": "longtext"
     },
     {
      "key": "restrictions",
      "label": "Any practices or restrictions staff need to know about in providing care?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "help": "For example medicines or blood products."
     },
     {
      "key": "restrictions_detail",
      "label": "Please describe",
      "type": "longtext",
      "showIf": {
       "id": "restrictions",
       "equals": "Yes"
      }
     },
     {
      "key": "involve",
      "label": "Is there anyone the person would like involved in meeting their spiritual needs?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "involve_detail",
      "label": "Who?",
      "type": "longtext",
      "showIf": {
       "id": "involve",
       "equals": "Yes"
      }
     },
     {
      "key": "other_support",
      "label": "Any other support the person would like",
      "type": "longtext"
     }
    ]
   }
  ]
 },
 {
  "key": "intimacy",
  "num": 14,
  "title": "Intimacy, relationships and sexuality",
  "category": "Personal and communication",
  "description": "Offers the person the chance to talk about relationships and intimacy, respecting privacy and consent.",
  "hasLevel": false,
  "sections": [
   {
    "title": "Relationships and intimacy",
    "fields": [
     {
      "key": "support",
      "label": "Would the person like to talk about, or have support with, their intimate relationships or sexuality?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "help": "Offer sensitively and in private. It is fine for the answer to be No."
     },
     {
      "key": "support_detail",
      "label": "What support would they like?",
      "type": "longtext",
      "showIf": {
       "id": "support",
       "equals": "Yes"
      }
     },
     {
      "key": "privacy",
      "label": "Preferences for privacy and who should (or should not) be involved",
      "type": "longtext",
      "showIf": {
       "id": "support",
       "equals": "Yes"
      }
     },
     {
      "key": "dignity",
      "label": "Anything staff should know to protect dignity, consent and safety",
      "type": "longtext",
      "showIf": {
       "id": "support",
       "equals": "Yes"
      }
     }
    ]
   }
  ]
 },
 {
  "key": "clinical_history",
  "num": 15,
  "title": "Clinical history and medical conditions",
  "category": "Health and body",
  "description": "Records past and current conditions, procedures and any devices or equipment in place.",
  "hasLevel": false,
  "sections": [
   {
    "title": "History",
    "fields": [
     {
      "key": "past_conditions",
      "label": "Known past medical conditions",
      "type": "longtext"
     },
     {
      "key": "current_conditions",
      "label": "Current medical conditions",
      "type": "longtext"
     },
     {
      "key": "surgery",
      "label": "Any known surgical procedures?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "surgery_detail",
      "label": "Which procedures, and when?",
      "type": "longtext",
      "showIf": {
       "id": "surgery",
       "equals": "Yes"
      }
     },
     {
      "key": "devices",
      "label": "Does the person use safety equipment or have implanted medical devices?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "devices_detail",
      "label": "Which devices?",
      "type": "longtext",
      "showIf": {
       "id": "devices",
       "equals": "Yes"
      }
     },
     {
      "key": "disabled",
      "label": "Is the person registered disabled?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "disabled_detail",
      "label": "Please describe",
      "type": "longtext",
      "showIf": {
       "id": "disabled",
       "equals": "Yes"
      }
     }
    ]
   }
  ]
 },
 {
  "key": "bed_rail",
  "num": 16,
  "title": "Bed rail safety",
  "category": "Safety and mobility",
  "description": "Checks whether bed rails are a safe and suitable way to keep the person safe in bed, considers less restrictive alternatives, and records the entrapment and fitting checks.",
  "hasLevel": false,
  "sections": [
   {
    "title": "Mobility and awareness",
    "fields": [
     {
      "key": "bed_movement",
      "label": "How the person moves in bed",
      "type": "select",
      "options": [
       "Independent",
       "Needs some help",
       "Very immobile or hoist-dependent"
      ]
     },
     {
      "key": "alertness",
      "label": "Alertness",
      "type": "select",
      "options": [
       "Alert and orientated",
       "Confused or disorientated",
       "Drowsy",
       "Unconscious"
      ]
     },
     {
      "key": "vision_movement",
      "label": "Vision or movement issues that raise the risk of falling from bed",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "help": "For example visual impairment, involuntary movements or spasms."
     },
     {
      "key": "vision_movement_detail",
      "label": "Please give details",
      "type": "longtext",
      "showIf": {
       "id": "vision_movement",
       "equals": "Yes"
      }
     }
    ]
   },
   {
    "title": "Why bed rails are being considered",
    "fields": [
     {
      "key": "reason",
      "label": "Reason bed rails are being considered",
      "type": "longtext"
     },
     {
      "key": "alternatives_tried",
      "label": "Less restrictive alternatives already tried or considered",
      "type": "longtext",
      "help": "For example low-rise bed, crash mats, repositioning, closer monitoring."
     }
    ]
   },
   {
    "title": "Entrapment and fitting checks",
    "note": "These checks guard against the known risks of bed rails: climbing over, slipping through and entrapment. If the answer to any of the first three checks is Yes, bed rails are not appropriate. Use a less restrictive alternative such as a low-rise bed with safety mats.",
    "fields": [
     {
      "key": "climb_over",
      "label": "Could the person climb over the rail, or get out past the foot of the bed?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "flag": {
       "equals": "Yes",
       "message": "Bed rails are not appropriate. Use a less restrictive alternative."
      }
     },
     {
      "key": "pass_between",
      "label": "Is the person small enough to pass between the bars?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "help": "For example a very small adult.",
      "flag": {
       "equals": "Yes",
       "message": "Bed rails are not appropriate. Use a less restrictive alternative."
      }
     },
     {
      "key": "entrapment_gaps",
      "label": "Are there entrapment gaps?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "help": "Between the bars; between the rail and the mattress edge; where the mattress compresses at the edge; between the footboard and rail; or between the headboard and rail.",
      "flag": {
       "equals": "Yes",
       "message": "Bed rails are not appropriate. Use a less restrictive alternative."
      }
     },
     {
      "key": "maintained",
      "label": "Has the rail been inspected and maintained (if previously used)?",
      "type": "select",
      "options": [
       "Yes",
       "No",
       "Not previously used"
      ],
      "flag": {
       "equals": "No",
       "message": "Do not use until the rail has been inspected and maintained."
      }
     },
     {
      "key": "rollover_height",
      "label": "Is the top of the rail more than 22 cm above the uncompressed mattress, and could the person roll over it?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     }
    ]
   },
   {
    "title": "Capacity and consent",
    "fields": [
     {
      "key": "capacity_agree",
      "label": "Does the person have the capacity to agree to the use of bed rails?",
      "type": "select",
      "options": [
       "Yes",
       "No",
       "Unsure"
      ]
     },
     {
      "key": "mca_done",
      "label": "Has a mental capacity assessment and best-interests decision been completed (Assessment 18)?",
      "type": "select",
      "options": [
       "Yes",
       "No"
      ],
      "showIf": {
       "id": "capacity_agree",
       "equals": [
        "No",
        "Unsure"
       ]
      },
      "flag": {
       "equals": "No",
       "message": "Complete the mental capacity assessment first. Consider whether bed rails are a restriction that needs a DoLS referral."
      }
     }
    ]
   },
   {
    "title": "Outcome",
    "fields": [
     {
      "key": "decision",
      "label": "Decision",
      "type": "select",
      "options": [
       "Use bed rails",
       "Use with caution and extra monitoring",
       "Do not use"
      ]
     },
     {
      "key": "safety_measures",
      "label": "Alternatives and safety measures in place",
      "type": "longtext"
     },
     {
      "key": "informed",
      "label": "Who has been informed",
      "type": "longtext",
      "help": "Handover, and family where appropriate."
     }
    ]
   }
  ]
 },
 {
  "key": "hydration",
  "num": 17,
  "title": "Hydration and dehydration risk",
  "category": "Nutrition and medication",
  "description": "A plain-language check of the person's fluid intake and signs of dehydration, and the support they need to stay well hydrated. This is not a scored tool; where your service uses a validated hydration screening tool, use that alongside this.",
  "hasLevel": true,
  "sections": [
   {
    "title": "Fluids",
    "fields": [
     {
      "key": "usual_intake",
      "label": "Usual daily fluid intake",
      "type": "select",
      "options": [
       "Good",
       "Reduced",
       "Poor or hard to assess"
      ]
     },
     {
      "key": "drinks_liked",
      "label": "Drinks the person likes",
      "type": "text"
     },
     {
      "key": "drink_help",
      "label": "Help the person needs to drink",
      "type": "select",
      "options": [
       "Independent",
       "Prompting",
       "Full help"
      ]
     },
     {
      "key": "swallowing",
      "label": "Any swallowing concerns?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "flag": {
       "equals": "Yes",
       "message": "See the Choking risk assessment."
      }
     }
    ]
   },
   {
    "title": "Signs of dehydration to check",
    "note": "Note any seen.",
    "prompt": "If the person shows signs of dehydration (very dark urine, drowsiness, new confusion, low blood pressure or sunken eyes), seek a GP or clinical review the same day.",
    "fields": [
     {
      "key": "sign_urine",
      "label": "Dark or strong-smelling urine, or fewer wet pads",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "sign_dry",
      "label": "Dry mouth, lips or eyes",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "sign_drowsy",
      "label": "Drowsiness, increased confusion or a sudden change in mental state",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "sign_dizzy",
      "label": "Dizziness or light-headedness, or low blood pressure",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "sign_gi",
      "label": "Recent diarrhoea, vomiting or fever",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     }
    ]
   },
   {
    "title": "Risk factors",
    "fields": [
     {
      "key": "risk_factors",
      "label": "Which of these apply?",
      "type": "multiselect",
      "options": [
       "Takes diuretics",
       "Diabetes or high blood sugar",
       "Recurrent urine infections",
       "Frequent falls",
       "None of these"
      ]
     }
    ]
   },
   {
    "title": "Support plan",
    "fields": [
     {
      "key": "support_plan",
      "label": "How we will support hydration",
      "type": "longtext",
      "help": "For example offer and encourage drinks, keep preferred drinks available, monitor intake, involve family and catering."
     }
    ]
   }
  ]
 },
 {
  "key": "mca",
  "num": 18,
  "title": "Mental capacity and best-interests decision",
  "category": "Personal and communication",
  "description": "Records, for one specific decision, whether the person has the mental capacity to make it and, if not, how a decision was made in their best interests. Follow the Mental Capacity Act 2005 and its Code of Practice, and always start by assuming capacity.",
  "hasLevel": false,
  "sections": [
   {
    "title": "The decision",
    "fields": [
     {
      "key": "decision_to_make",
      "label": "The specific decision to be made",
      "type": "longtext"
     },
     {
      "key": "assessed_date",
      "label": "Date of this assessment",
      "type": "date"
     },
     {
      "key": "assessed_time",
      "label": "Time of this assessment",
      "type": "text"
     }
    ]
   },
   {
    "title": "First checks",
    "fields": [
     {
      "key": "lpa",
      "label": "Is there a valid and relevant Lasting Power of Attorney (health and welfare) or a court-appointed deputy?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "flag": {
       "equals": "Yes",
       "message": "They are the decision-maker."
      }
     },
     {
      "key": "advance_decision",
      "label": "Is there a valid advance decision that covers this decision?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ],
      "flag": {
       "equals": "Yes",
       "message": "It must generally be followed. Seek advice if unsure."
      }
     }
    ]
   },
   {
    "title": "Capacity test (at the time of this decision)",
    "note": "Stage 1: is there an impairment of, or disturbance in, the functioning of the mind or brain? Stage 2: can the person do each of the following?",
    "fields": [
     {
      "key": "impairment",
      "label": "Stage 1: is there an impairment of, or disturbance in, the functioning of the mind or brain?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "understand",
      "label": "Can the person understand the information relevant to the decision?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "retain",
      "label": "Can the person retain that information long enough to decide?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "weigh",
      "label": "Can the person use or weigh that information as part of deciding?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "communicate",
      "label": "Can the person communicate their decision (by any means)?",
      "type": "yesno",
      "options": [
       "Yes",
       "No"
      ]
     },
     {
      "key": "has_capacity",
      "label": "Conclusion: does the person have capacity to make THIS decision?",
      "type": "select",
      "options": [
       "Yes",
       "No",
       "Unsure"
      ]
     }
    ]
   },
   {
    "title": "Supporting the person to decide",
    "fields": [
     {
      "key": "support_given",
      "label": "What was done to help the person make the decision themselves",
      "type": "longtext",
      "help": "For example accessible information, best time of day, someone they trust present."
     }
    ]
   },
   {
    "title": "Best-interests decision (only if the person lacks capacity)",
    "prompt": "If the decision would deprive the person of their liberty (continuous supervision and control, not free to leave), a DoLS authorisation may be needed. Escalate to your manager.",
    "fields": [
     {
      "key": "bi_participation",
      "label": "A. How the person was helped to take part",
      "type": "longtext",
      "showIf": {
       "id": "has_capacity",
       "equals": "No"
      }
     },
     {
      "key": "bi_factors",
      "label": "B. All relevant factors considered",
      "type": "longtext",
      "showIf": {
       "id": "has_capacity",
       "equals": "No"
      }
     },
     {
      "key": "bi_wishes",
      "label": "C. The person’s past and present wishes, feelings, beliefs and values",
      "type": "longtext",
      "showIf": {
       "id": "has_capacity",
       "equals": "No"
      }
     },
     {
      "key": "bi_capacity_return",
      "label": "D. Whether capacity might return and the decision can wait",
      "type": "longtext",
      "showIf": {
       "id": "has_capacity",
       "equals": "No"
      }
     },
     {
      "key": "bi_consulted",
      "label": "E. Who was consulted (family, carers, advocate or IMCA)",
      "type": "longtext",
      "showIf": {
       "id": "has_capacity",
       "equals": "No"
      }
     },
     {
      "key": "bi_decision",
      "label": "The decision made, and why it is the least restrictive option",
      "type": "longtext",
      "showIf": {
       "id": "has_capacity",
       "equals": "No"
      }
     }
    ]
   },
   {
    "title": "Outcome",
    "fields": [
     {
      "key": "decision_maker",
      "label": "Decision-maker",
      "type": "text"
     },
     {
      "key": "others_consulted",
      "label": "Others consulted",
      "type": "longtext"
     },
     {
      "key": "dols_needed",
      "label": "DoLS referral needed?",
      "type": "select",
      "options": [
       "Yes",
       "No",
       "Unsure"
      ]
     }
    ]
   }
  ]
 }
];
