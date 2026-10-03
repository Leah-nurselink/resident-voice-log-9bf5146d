import { supabase } from "@/integrations/supabase/client";

export const HIGHLIGHT_PERIODS = [
  { id: "24h", label: "24 hours", hours: 24 },
  { id: "3d", label: "3 days", hours: 72 },
  { id: "7d", label: "7 days", hours: 168 },
] as const;
export type HighlightPeriod = (typeof HIGHLIGHT_PERIODS)[number]["id"];

type Note = { content: string | null; category: string | null; domain: string | null; flags: string[] | null; status: string | null };

const AREAS: { id: string; label: string; match: (n: Note) => boolean; words: RegExp }[] = [
  { id: "hydration", label: "Hydration", words: /\b(drink|drank|fluid|water|tea|juice|hydrat)/i, match: (n) => n.category === "hydration" },
  { id: "nutrition", label: "Nutrition", words: /\b(ate|eat|meal|breakfast|lunch|dinner|food|appetite|snack)/i, match: (n) => n.category === "nutrition" || n.domain === "nutrition" },
  { id: "continence", label: "Continence", words: /\b(continen|incontinen|pad|toilet|urin|bowel|commode)/i, match: (n) => n.domain === "continence" },
  { id: "behaviour", label: "Behaviour & mood", words: /\b(agitat|aggress|distress|anxious|upset|calm|happy|low mood|wander)/i, match: (n) => ["behaviour", "mood"].includes(n.category ?? "") || n.domain === "mental_health" },
  { id: "sleep", label: "Sleep", words: /\b(sleep|slept|night|awake|rest)/i, match: (n) => n.category === "sleep" || n.domain === "sleep" },
  { id: "mobility", label: "Mobility", words: /\b(walk|mobil|transfer|hoist|frame|fall)/i, match: (n) => n.category === "mobility" || n.domain === "mobility" },
];

const CONCERN = /\b(refus|declin|poor|low|little|not eat|not drink|only|agitat|aggress|distress|wet|soiled|unsettled|fall|fell|pain)/i;

export type Highlights = {
  periodLabel: string;
  noteCount: number;
  areas: { id: string; label: string; count: number; concerns: number; latest: string | null }[];
  meds: { given: number; refused: number; omitted: number; prn: number };
  professionals: { label: string; count: number }[];
  professionalTotal: number;
  flags: string[];
  painMax: number | null;
  summary: string[];
};

export const FAMILY_PERIODS = [
  { id: "24h", label: "Today", hours: 24 },
  { id: "7d", label: "This week", hours: 168 },
  { id: "14d", label: "Two weeks", hours: 336 },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadHighlights(residentId: string, period: string, client: any = supabase, approvedOnly = false): Promise<Highlights> {
  const p = [...HIGHLIGHT_PERIODS, ...FAMILY_PERIODS].find((x) => x.id === period)!;
  const since = new Date(Date.now() - p.hours * 3600e3).toISOString();
  let notesQ = client.from("daily_notes").select("content,category,domain,flags,status,created_at").eq("resident_id", residentId).gte("created_at", since);
  if (approvedOnly) notesQ = notesQ.eq("status", "approved");
  const [notes, mar, comms, pain] = await Promise.all([
    notesQ.order("created_at", { ascending: false }),
    client.from("medication_administrations").select("status,medication_id,medications(is_prn)").eq("resident_id", residentId).gte("administered_at", since),
    client.from("communications").select("contact_type,channel,professionals(role)").eq("resident_id", residentId).gte("created_at", since),
    client.from("pain_assessments").select("total_score").eq("resident_id", residentId).gte("assessed_at", since),
  ]);
  const ns = (notes.data ?? []) as Note[];

  const areas = AREAS.map((a) => {
    const hits = ns.filter((n) => a.match(n) || a.words.test(n.content ?? ""));
    return { id: a.id, label: a.label, count: hits.length, concerns: hits.filter((n) => CONCERN.test(n.content ?? "")).length, latest: hits[0]?.content ?? null };
  });

  const meds = { given: 0, refused: 0, omitted: 0, prn: 0 };
  for (const m of (mar.data ?? []) as { status: string; medications: { is_prn: boolean } | null }[]) {
    if (m.status === "given" || m.status === "administered") meds.given++;
    else if (m.status === "refused") meds.refused++;
    else meds.omitted++;
    if (m.medications?.is_prn) meds.prn++;
  }

  const profMap = new Map<string, number>();
  for (const c of (comms.data ?? []) as { contact_type: string | null; professionals: { role: string } | null }[]) {
    const role = c.professionals?.role ?? (c.contact_type && c.contact_type !== "family" ? c.contact_type : null);
    if (!role) continue;
    const label = role.replace(/_/g, " ");
    profMap.set(label, (profMap.get(label) ?? 0) + 1);
  }
  const professionals = [...profMap].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  const professionalTotal = professionals.reduce((s, x) => s + x.count, 0);

  const flags = [...new Set(ns.flatMap((n) => n.flags ?? []))].map((f) => f.replace(/_/g, " "));
  const scores = (pain.data ?? []).map((x: { total_score: number }) => x.total_score);
  const painMax = scores.length ? Math.max(...scores) : null;

  const summary: string[] = [];
  summary.push(ns.length ? `${ns.length} care note${ns.length === 1 ? "" : "s"} recorded in the last ${p.label}.` : `No care notes recorded in the last ${p.label}.`);
  for (const a of areas) {
    if (!a.count) continue;
    summary.push(a.concerns
      ? `${a.label}: ${a.count} record${a.count === 1 ? "" : "s"}, ${a.concerns} noting a possible concern — worth a look.`
      : `${a.label}: ${a.count} record${a.count === 1 ? "" : "s"}, nothing of concern noted.`);
  }
  const missing = areas.filter((a) => !a.count && ["hydration", "nutrition", "continence"].includes(a.id)).map((a) => a.label.toLowerCase());
  if (missing.length) summary.push(`No ${missing.join(", ")} recorded — check whether this was documented.`);
  if (meds.given + meds.refused + meds.omitted) summary.push(`Medication: ${meds.given} given, ${meds.refused} refused, ${meds.omitted} omitted${meds.prn ? ` (${meds.prn} as-needed)` : ""}.`);
  summary.push(professionalTotal ? `Contact with health professionals: ${professionals.map((x) => `${x.label} ×${x.count}`).join(", ")}.` : "No contact with health professionals recorded.");
  if (painMax != null) summary.push(`Highest pain score: ${painMax}.`);
  if (flags.length) summary.push(`Flags raised: ${flags.join(", ")}.`);

  return { periodLabel: p.label, noteCount: ns.length, areas, meds, professionals, professionalTotal, flags, painMax, summary };
}
