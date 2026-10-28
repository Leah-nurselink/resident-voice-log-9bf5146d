export type Rag = "red" | "amber" | "green" | "none";

export const AMBER_DAYS = 7;
export const CARE_PLAN_REVIEW_DAYS = 30;
export const TOTAL_CARE_DOMAINS = 18;

export const RAG_CLASS: Record<Rag, string> = {
  red: "bg-red-500/15 text-red-700 border-red-500/40",
  amber: "bg-amber-500/15 text-amber-700 border-amber-500/40",
  green: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
  none: "bg-muted text-muted-foreground border-border",
};

export function daysUntil(dateISO: string, now: Date = new Date()): number {
  const d = new Date(`${dateISO.slice(0, 10)}T00:00:00`);
  const t = new Date(now);
  t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

export function ragFromDays(days: number | null): Rag {
  if (days === null || Number.isNaN(days)) return "none";
  if (days < 0) return "red";
  if (days <= AMBER_DAYS) return "amber";
  return "green";
}

export function ragForDate(dateISO?: string | null): Rag {
  return dateISO ? ragFromDays(daysUntil(dateISO)) : "none";
}

export function ragText(days: number | null): string {
  if (days === null) return "No review date";
  if (days < 0) return `Overdue ${-days}d`;
  if (days === 0) return "Due today";
  return `Due in ${days}d`;
}

export function carePlanDueDate(lastReview?: string | null): string | null {
  if (!lastReview) return null;
  const d = new Date(`${lastReview.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + CARE_PLAN_REVIEW_DAYS);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function carePlanDaysLeft(lastReview?: string | null): number | null {
  const due = carePlanDueDate(lastReview);
  return due ? daysUntil(due) : null;
}

export function ragForCarePlan(lastReview?: string | null): Rag {
  return ragFromDays(carePlanDaysLeft(lastReview));
}

const ORDER: Rag[] = ["none", "green", "amber", "red"];
export function worstRag(list: Rag[]): Rag {
  return list.reduce<Rag>((w, r) => (ORDER.indexOf(r) > ORDER.indexOf(w) ? r : w), "none");
}

export type PlanRow = {
  resident_id: string;
  needs: string | null;
  outcome: string | null;
  content: string | null;
  last_review: string | null;
};

export function isPlanDocumented(p: Pick<PlanRow, "needs" | "outcome" | "content">) {
  return !!(p.needs || p.outcome || p.content);
}

export function isPlanComplete(p: PlanRow) {
  return !!(p.needs && p.outcome && p.content) && ragForCarePlan(p.last_review) !== "red";
}

export function carePlanProgress(plans: PlanRow[]) {
  const documented = plans.filter(isPlanDocumented);
  const rags = documented.map((p) => ragForCarePlan(p.last_review));
  return {
    done: plans.filter(isPlanComplete).length,
    documented: documented.length,
    red: rags.filter((r) => r === "red").length,
    amber: rags.filter((r) => r === "amber").length,
    rag: worstRag(rags),
  };
}

export type RaRow = {
  resident_id: string;
  status: string | null;
  review_date: string | null;
};

export function raProgress(rows: RaRow[]) {
  const live = rows.filter((r) => r.status !== "draft");
  const rags = live.map((r) => ragForDate(r.review_date));
  return {
    total: live.length,
    red: rags.filter((r) => r === "red").length,
    amber: rags.filter((r) => r === "amber").length,
    rag: worstRag(rags),
  };
}
