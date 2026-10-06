// Rule-based deviation detection: compares concern signals in recent notes
// (last `recentDays`) against each resident's own baseline rate (prior `baselineDays`).

export type DeviationCategory =
  | "behaviour" | "eating_drinking" | "continence" | "sleep" | "mobility" | "pain" | "mood";

export const CATEGORY_LABELS: Record<DeviationCategory, string> = {
  behaviour: "Behaviour",
  eating_drinking: "Eating & drinking",
  continence: "Continence",
  sleep: "Sleep",
  mobility: "Mobility & falls",
  pain: "Pain",
  mood: "Mood & wellbeing",
};

const PATTERNS: Record<DeviationCategory, RegExp> = {
  behaviour: /\b(agitat|aggress|restless|wander|shout|hit|kick|distress|resist|refus(ed|ing) care|verbal(ly)? abus|exit.?seek|sundown)/i,
  eating_drinking: /\b(refus(ed|ing)? (food|meal|drink|fluid)|poor (intake|appetite)|ate (little|nothing|half|25%)|declined (meal|food|drink)|not eating|not drinking|low (intake|fluid)|dehydrat|weight loss|choking|cough(ed|ing) (on|while) (eating|drinking))/i,
  continence: /\b(incontinen|wet (bed|pad)|soiled|uti|urine infection|constipat|no bowel|diarrh|catheter (block|leak)|smell(y|ing) urine)/i,
  sleep: /\b(poor sleep|awake (all|most)|unsettled (night|overnight)|not sleep|insomnia|up (during|in) the night|disturbed night)/i,
  mobility: /\b(fall|fell|found on (the )?floor|unsteady|near miss|trip(ped)?|slip(ped)?|reduced mobility|unable to (stand|weight.?bear))/i,
  pain: /\b(pain|grimac|wince|sore|ache|discomfort|tender)/i,
  mood: /\b(low mood|tearful|crying|withdrawn|anxious|isolat|lonely|sad|depress|confus(ed|ion) (increase|worse))/i,
};

const DOMAIN_MAP: Partial<Record<string, DeviationCategory>> = {
  nutrition: "eating_drinking", continence: "continence", sleep: "sleep",
  mobility: "mobility", mental_health: "mood", cognition: "behaviour",
};

export type NoteLite = { resident_id: string; created_at: string; content: string | null; domain?: string | null; category?: string | null; flags?: string[] | null; risks?: string[] | null };

export type Deviation = {
  category: DeviationCategory;
  recent: number;
  baselinePerPeriod: number;
  severity: "high" | "medium";
  latest: { at: string; excerpt: string };
};

function hits(n: NoteLite): DeviationCategory[] {
  const text = [n.content, ...(n.flags ?? []), ...(n.risks ?? [])].filter(Boolean).join(" ");
  const out = new Set<DeviationCategory>();
  for (const [cat, re] of Object.entries(PATTERNS) as [DeviationCategory, RegExp][]) if (re.test(text)) out.add(cat);
  // Flagged notes in a mapped domain count too.
  const mapped = n.domain ? DOMAIN_MAP[n.domain] : undefined;
  if (mapped && (n.flags?.length ?? 0) > 0) out.add(mapped);
  return [...out];
}

export function detectDeviations(notes: NoteLite[], now = Date.now(), recentDays = 3, baselineDays = 14): Deviation[] {
  const day = 86_400_000;
  const recentStart = now - recentDays * day;
  const baseStart = recentStart - baselineDays * day;
  const recent = new Map<DeviationCategory, NoteLite[]>();
  const base = new Map<DeviationCategory, number>();
  for (const n of notes) {
    const t = new Date(n.created_at).getTime();
    if (t < baseStart || t > now) continue;
    for (const c of hits(n)) {
      if (t >= recentStart) recent.set(c, [...(recent.get(c) ?? []), n]);
      else base.set(c, (base.get(c) ?? 0) + 1);
    }
  }
  const out: Deviation[] = [];
  for (const [category, list] of recent) {
    const baselinePerPeriod = ((base.get(category) ?? 0) / baselineDays) * recentDays;
    // Flag when recent signals clearly exceed the resident's usual rate.
    if (list.length >= 2 && list.length >= baselinePerPeriod * 2 || (list.length >= 1 && baselinePerPeriod === 0 && category !== "pain")) {
      const latest = list.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      out.push({
        category, recent: list.length, baselinePerPeriod: Math.round(baselinePerPeriod * 10) / 10,
        severity: list.length >= 3 || category === "mobility" ? "high" : "medium",
        latest: { at: latest.created_at, excerpt: (latest.content ?? "").slice(0, 140) },
      });
    }
  }
  return out.sort((a, b) => (a.severity === b.severity ? b.recent - a.recent : a.severity === "high" ? -1 : 1));
}
