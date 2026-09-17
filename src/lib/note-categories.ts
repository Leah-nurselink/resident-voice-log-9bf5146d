export const NOTE_CATEGORIES = [
  "personal_care",
  "nutrition",
  "hydration",
  "mobility",
  "mood",
  "behaviour",
  "sleep",
  "pain",
  "skin",
  "activities",
  "clinical_observation",
  "other",
] as const;

export type NoteCategory = typeof NOTE_CATEGORIES[number];

export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  personal_care: "Personal care",
  nutrition: "Nutrition",
  hydration: "Hydration",
  mobility: "Mobility",
  mood: "Mood",
  behaviour: "Behaviour",
  sleep: "Sleep",
  pain: "Pain",
  skin: "Skin",
  activities: "Activities",
  clinical_observation: "Clinical observation",
  other: "Other",
};

export const noteCategoryLabel = (c: string | null | undefined) =>
  (c && NOTE_CATEGORY_LABELS[c as NoteCategory]) || null;
