import { differenceInCalendarDays } from "date-fns";
import { allergyConflict, type Medication } from "@/lib/medications";

export type SafetyFlag = { level: "high" | "medium"; text: string };

const GROUPS: Record<string, string[]> = {
  nsaid: ["ibuprofen", "naproxen", "diclofenac", "aspirin", "celecoxib", "meloxicam"],
  anticoag: ["warfarin", "apixaban", "rivaroxaban", "edoxaban", "dabigatran", "clopidogrel"],
  sedative: ["zopiclone", "zolpidem", "lorazepam", "diazepam", "temazepam", "codeine", "morphine", "oxycodone", "tramadol", "quetiapine", "haloperidol", "promethazine"],
  opioid: ["codeine", "morphine", "oxycodone", "tramadol", "fentanyl", "buprenorphine"],
  bp: ["amlodipine", "ramipril", "lisinopril", "bisoprolol", "atenolol", "furosemide", "doxazosin", "losartan"],
  metformin: ["metformin"],
  potassium: ["spironolactone", "ramipril", "lisinopril", "losartan"],
};
const inGroup = (name: string, g: string) => GROUPS[g].some((w) => name.toLowerCase().includes(w));

/** Rule-based checks: allergies, duplicates, known interactions, medical history and care-plan risks. */
export function medicationSafetyFlags(
  med: Medication,
  ctx: { allergies?: string | null; history?: string | null; otherMeds: Medication[]; highRisks: string[] },
): SafetyFlag[] {
  const out: SafetyFlag[] = [];
  const name = med.name;
  const hist = `${ctx.history ?? ""} ${ctx.highRisks.join(" ")}`.toLowerCase();
  const others = ctx.otherMeds.filter((m) => m.id !== med.id && m.status === "active");

  const allergy = allergyConflict(ctx.allergies, name);
  if (allergy) out.push({ level: "high", text: allergy });

  const first = name.toLowerCase().split(/\s+/)[0];
  const dup = others.find((m) => m.name.toLowerCase().split(/\s+/)[0] === first);
  if (dup) out.push({ level: "medium", text: `Possible duplicate: also prescribed ${dup.name}` });

  const has = (g: string) => others.find((m) => inGroup(m.name, g));
  if (inGroup(name, "nsaid") && has("anticoag")) out.push({ level: "high", text: `Bleeding risk with ${has("anticoag")!.name}` });
  if (inGroup(name, "anticoag") && has("nsaid")) out.push({ level: "high", text: `Bleeding risk with ${has("nsaid")!.name}` });
  if (inGroup(name, "sedative")) {
    const s = others.find((m) => inGroup(m.name, "sedative"));
    if (s) out.push({ level: "medium", text: `More than one sedating medicine (${s.name}) — drowsiness / falls` });
  }
  if (inGroup(name, "nsaid") && /kidney|renal|ckd|ulcer|gastric|bleed|asthma|heart failure/.test(hist))
    out.push({ level: "high", text: "Anti-inflammatory with kidney, stomach, asthma or heart history" });
  if (inGroup(name, "metformin") && /kidney|renal|ckd/.test(hist)) out.push({ level: "medium", text: "Metformin with kidney history — check dose" });
  if (inGroup(name, "sedative") && /fall/.test(hist)) out.push({ level: "medium", text: "Sedating medicine and high falls risk in care plan" });
  if (inGroup(name, "bp") && /fall|dizz|low blood pressure|hypotension/.test(hist)) out.push({ level: "medium", text: "Blood pressure medicine and falls/dizziness risk — check before standing" });
  if (inGroup(name, "opioid") && /constipat/.test(hist)) out.push({ level: "medium", text: "Opioid with constipation history — monitor bowels" });
  if (/swallow|dysphagia/.test(hist) && /tablet|capsule/i.test(med.form ?? "tablet"))
    out.push({ level: "medium", text: "Swallowing difficulty — check form is suitable" });
  return out;
}

/** Average doses per day for a scheduled medicine. */
export function dosesPerDay(m: Medication) {
  if (m.is_prn) return m.prn_max_doses_24h ? m.prn_max_doses_24h / 2 : 0;
  const days = m.days_of_week?.length ? m.days_of_week.length : 7;
  return (m.times?.length ?? 0) * (days / 7);
}

export type StockState = {
  status: "out" | "low" | "ok" | "unknown";
  label: string;
  recountDue: boolean;
};

/** Low when ≤25% of the cycle supply is left, or the stock won't last until the cycle end. */
export function stockState(m: Medication, today = new Date()): StockState {
  const recountDue = !m.stock_counted_at || differenceInCalendarDays(today, new Date(m.stock_counted_at)) >= 7;
  if (m.stock_count == null) return { status: "unknown", label: "No stock count", recountDue: true };
  const s = m.stock_count;
  if (s <= 0) return { status: "out", label: "Out of stock", recountDue };
  const perDay = dosesPerDay(m);
  const daysLeft = perDay > 0 ? Math.floor(s / perDay) : null;
  const cycleLeft = m.cycle_end_date ? differenceInCalendarDays(new Date(m.cycle_end_date), today) : null;
  const pct = m.cycle_quantity ? s / m.cycle_quantity : null;
  const short = daysLeft !== null && cycleLeft !== null && daysLeft < cycleLeft;
  if ((pct !== null && pct <= 0.25) || short) {
    return { status: "low", label: `Low: ${s} left${daysLeft !== null ? ` (~${daysLeft} days)` : ""}${short ? " — won't last the cycle" : ""}`, recountDue };
  }
  return { status: "ok", label: `${s} in stock${daysLeft !== null ? ` (~${daysLeft} days)` : ""}`, recountDue };
}

/** Number of units in a dose text such as "2 tablets" or "10ml" (defaults to 1). */
export function unitsFromDose(dose: string | null | undefined) {
  const n = Number((dose ?? "").match(/^\s*(\d+(\.\d+)?)/)?.[1]);
  return Number.isFinite(n) && n > 0 && n < 20 ? n : 1;
}

export const MED_RIGHTS = [
  "Right resident", "Right medicine", "Right dose", "Right route",
  "Right time", "Right reason", "Right to refuse", "Right record",
];
