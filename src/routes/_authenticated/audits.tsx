import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MetricLinkCard, DetailSection } from "@/components/governance/MetricLinkCard";

export const Route = createFileRoute("/_authenticated/audits")({
  head: () => ({ meta: [{ title: "Audits · CareCore" }] }),
  component: AuditsPage,
});

const COMPLETED = [
  { title: "Medication administration audit — Unit A", meta: "Completed 12 Jun by S. Patel", status: "Pass" },
  { title: "Infection prevention & control audit", meta: "Completed 08 Jun by M. Owusu", status: "Pass" },
  { title: "Care plan quality audit — 5 residents", meta: "Completed 05 Jun by J. Reid", status: "Action required" },
];
const DUE = [
  { title: "Weekly medication stock count", meta: "Due Fri 28 Jun", status: "Open" },
  { title: "Falls audit — Unit B", meta: "Due Sat 29 Jun", status: "Open" },
  { title: "Kitchen / food hygiene audit", meta: "Due Sun 30 Jun", status: "Open" },
];
const OVERDUE = [
  { title: "Hand hygiene observation audit", meta: "Was due 20 Jun", status: "Overdue" },
];

function AuditsPage() {
  return (
    <AppShell title="Audits" subtitle="Medication, infection control and care plan audit checks">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricLinkCard label="Completed this month" value={String(COMPLETED.length)} icon={ClipboardCheck} targetId="audits-completed" />
          <MetricLinkCard label="Due this week" value={String(DUE.length)} icon={ClipboardCheck} targetId="audits-due" />
          <MetricLinkCard label="Overdue" value={String(OVERDUE.length)} icon={ClipboardCheck} targetId="audits-overdue" />
        </div>

        <DetailSection id="audits-due" title="Due this week" description="Audits scheduled for completion in the next 7 days" items={DUE} />
        <DetailSection id="audits-overdue" title="Overdue" description="Audits past their scheduled date — prioritise these" items={OVERDUE} emptyText="No overdue audits." />
        <DetailSection id="audits-completed" title="Completed this month" items={COMPLETED} />
      </div>
    </AppShell>
  );
}
