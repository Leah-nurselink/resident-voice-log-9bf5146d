import { format } from "date-fns";
import type { Administration, Medication } from "@/lib/medications";

export type MedicationObservation = {
  id: string;
  title: string;
  detail: string;
  severity: "info" | "warning";
  evidence: { date: string; text: string }[];
};

const DAY = 24 * 60 * 60 * 1000;

function within(a: Administration, from: number, to: number) {
  const t = +new Date(a.administered_at);
  return t >= from && t < to;
}

/**
 * Pattern spotting over recorded administrations only.
 * These are observations for staff to review — never clinical conclusions.
 */
export function medicationObservations(
  meds: Medication[],
  administrations: Administration[],
): MedicationObservation[] {
  const out: MedicationObservation[] = [];
  const now = Date.now();
  const last7 = now - 7 * DAY;
  const prev7 = now - 14 * DAY;

  for (const m of meds) {
    const mine = administrations.filter((a) => a.medication_id === m.id);
    if (!mine.length) continue;

    const ev = (list: Administration[]) =>
      list.slice(0, 5).map((a) => ({
        date: format(new Date(a.administered_at), "d MMM"),
        text: `${m.name} — ${a.status.replace(/_/g, " ")}${a.reason ? `: ${a.reason}` : ""}`,
      }));

    if (m.is_prn) {
      const recent = mine.filter((a) => a.status === "given" && within(a, last7, now + DAY));
      const earlier = mine.filter((a) => a.status === "given" && within(a, prev7, last7));
      if (recent.length >= 3 && recent.length > earlier.length) {
        out.push({
          id: `prn-${m.id}`,
          title: `${m.name} recorded more often`,
          detail: `${m.name} (as required) has been recorded ${recent.length} time${recent.length === 1 ? "" : "s"} in the last 7 days, compared with ${earlier.length} in the previous 7 days. Review recommended.`,
          severity: "warning",
          evidence: ev(recent),
        });
      }
    }

    const refusals = mine.filter((a) => a.status === "refused" && within(a, last7, now + DAY));
    if (refusals.length >= 2) {
      out.push({
        id: `refused-${m.id}`,
        title: `${m.name} refused repeatedly`,
        detail: `${m.name} has been recorded as refused ${refusals.length} times in the last 7 days. Review recommended.`,
        severity: "warning",
        evidence: ev(refusals),
      });
    }

    const omissions = mine.filter(
      (a) => (a.status === "omitted" || a.status === "not_available") && within(a, last7, now + DAY),
    );
    if (omissions.length >= 2) {
      out.push({
        id: `omitted-${m.id}`,
        title: `${m.name} not given on several occasions`,
        detail: `${m.name} has been recorded as omitted or unavailable ${omissions.length} times in the last 7 days. Review recommended.`,
        severity: "warning",
        evidence: ev(omissions),
      });
    }
  }

  return out;
}
