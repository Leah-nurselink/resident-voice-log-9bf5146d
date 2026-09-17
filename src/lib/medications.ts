import { format } from "date-fns";

export type Medication = {
  id: string;
  resident_id: string;
  name: string;
  form: string | null;
  dose: string | null;
  route: string | null;
  frequency_text: string | null;
  times: string[] | null;
  days_of_week: number[] | null;
  is_prn: boolean;
  prn_indication: string | null;
  prn_min_interval_minutes: number | null;
  prn_max_doses_24h: number | null;
  indication: string | null;
  instructions: string | null;
  start_date: string | null;
  end_date: string | null;
  review_date: string | null;
  prescriber: string | null;
  notes: string | null;
  status: string;
};

export type Administration = {
  id: string;
  medication_id: string;
  resident_id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  reason: string | null;
  action_taken: string | null;
  dose_given: string | null;
  administered_by: string | null;
  administered_at: string;
  effectiveness: string | null;
  notes: string | null;
};

export const ADMIN_STATUSES = [
  { value: "given", label: "Given", tone: "bg-success/15 text-success-foreground border-success/30 border", needsReason: false },
  { value: "refused", label: "Refused", tone: "bg-warning/20 text-warning-foreground border-warning/40 border", needsReason: true },
  { value: "omitted", label: "Omitted", tone: "bg-warning/20 text-warning-foreground border-warning/40 border", needsReason: true },
  { value: "not_available", label: "Not available", tone: "bg-destructive/15 text-destructive border-destructive/30 border", needsReason: true },
  { value: "other", label: "Other", tone: "bg-muted text-muted-foreground border", needsReason: true },
] as const;

export type AdminStatus = typeof ADMIN_STATUSES[number]["value"];

export function statusMeta(value: string) {
  return ADMIN_STATUSES.find((s) => s.value === value) ?? ADMIN_STATUSES[4];
}

export const ROUTES = ["Oral", "Topical", "Sublingual", "Inhaled", "Subcutaneous", "Intramuscular", "Transdermal", "Rectal", "Eye", "Ear", "Nasal", "Other"];

/** Normalise a stored time value (e.g. "08:00:00") to "08:00". */
export function hhmm(t: string | null | undefined) {
  if (!t) return "";
  return t.slice(0, 5);
}

export type DueDose = {
  key: string;
  medication: Medication;
  time: string; // "08:00"
  administration?: Administration;
};

/** Expand a resident's scheduled medications into the doses due on a given day. */
export function dueDosesForDay(
  meds: Medication[],
  administrations: Administration[],
  day: Date,
): DueDose[] {
  const dateKey = format(day, "yyyy-MM-dd");
  const dow = day.getDay();
  const out: DueDose[] = [];

  for (const m of meds) {
    if (m.status !== "active" || m.is_prn) continue;
    if (m.start_date && m.start_date > dateKey) continue;
    if (m.end_date && m.end_date < dateKey) continue;
    const days = m.days_of_week ?? [0, 1, 2, 3, 4, 5, 6];
    if (days.length && !days.includes(dow)) continue;

    for (const raw of m.times ?? []) {
      const time = hhmm(raw);
      if (!time) continue;
      const administration = administrations.find(
        (a) => a.medication_id === m.id && a.scheduled_date === dateKey && hhmm(a.scheduled_time) === time,
      );
      out.push({ key: `${m.id}-${time}`, medication: m, time, administration });
    }
  }

  out.sort((a, b) => (a.time === b.time ? a.medication.name.localeCompare(b.medication.name) : a.time.localeCompare(b.time)));
  return out;
}

/** Minutes since the last recorded PRN dose, or null when never given. */
export function minutesSinceLastPrn(med: Medication, administrations: Administration[]) {
  const last = administrations
    .filter((a) => a.medication_id === med.id && a.status === "given")
    .sort((a, b) => +new Date(b.administered_at) - +new Date(a.administered_at))[0];
  if (!last) return null;
  return Math.round((Date.now() - +new Date(last.administered_at)) / 60000);
}

export function prnDosesInLast24h(med: Medication, administrations: Administration[]) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return administrations.filter(
    (a) => a.medication_id === med.id && a.status === "given" && +new Date(a.administered_at) >= cutoff,
  ).length;
}

/** Simple word-overlap check between the resident's allergy text and a medication name. */
export function allergyConflict(allergies: string | null | undefined, medicationName: string) {
  if (!allergies) return null;
  const words = allergies
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3);
  const name = medicationName.toLowerCase();
  const hit = words.find((w) => name.includes(w));
  return hit ? `Recorded allergy mentions "${hit}"` : null;
}

export function describeSchedule(m: Medication) {
  if (m.is_prn) return `As required${m.prn_indication ? ` — ${m.prn_indication}` : ""}`;
  const times = (m.times ?? []).map(hhmm).filter(Boolean);
  if (times.length) return times.join(", ");
  return m.frequency_text ?? "No times set";
}
