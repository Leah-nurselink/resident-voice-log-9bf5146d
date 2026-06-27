import { createFileRoute } from "@tanstack/react-router";
import { FileSearch } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MetricLinkCard, DetailSection } from "@/components/governance/MetricLinkCard";

export const Route = createFileRoute("/_authenticated/incident-review")({
  head: () => ({ meta: [{ title: "Incident Review · CareCore" }] }),
  component: IncidentReviewPage,
});

const OPEN = [
  { title: "Unwitnessed fall — Mrs E. Howard", meta: "24 Jun · Lounge", status: "Investigation" },
  { title: "Medication error — wrong dose paracetamol", meta: "22 Jun · Unit A", status: "Investigation" },
  { title: "Skin tear — Mr A. Bennett", meta: "20 Jun · Bathroom", status: "Monitoring" },
  { title: "Resident-to-resident altercation", meta: "19 Jun · Day room", status: "Investigation" },
  { title: "Missing personal item — wedding ring", meta: "17 Jun · Bedroom 12", status: "Investigation" },
];
const AWAITING = [
  { title: "Fall with head injury — Mrs P. Quinn", meta: "Review meeting Fri 28 Jun", status: "Awaiting review" },
  { title: "Medication omission — insulin", meta: "Review meeting Mon 01 Jul", status: "Awaiting review" },
  { title: "Pressure ulcer category 2 — Mr T. Clarke", meta: "Review meeting Mon 01 Jul", status: "Awaiting review" },
];
const CLOSED = [
  { title: "Fall — no injury, Mrs J. Patel", meta: "Closed 14 Jun · lessons shared", status: "Closed" },
  { title: "Aggression toward staff", meta: "Closed 10 Jun · care plan updated", status: "Closed" },
  { title: "Slip on wet floor — visitor", meta: "Closed 06 Jun", status: "Closed" },
];

function IncidentReviewPage() {
  return (
    <AppShell title="Incident Review" subtitle="Falls, medication errors and safeguarding incident follow-up">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricLinkCard label="Open incidents" value={String(OPEN.length)} icon={FileSearch} targetId="inc-open" />
          <MetricLinkCard label="Awaiting review" value={String(AWAITING.length)} icon={FileSearch} targetId="inc-awaiting" />
          <MetricLinkCard label="Closed in 30 days" value={String(CLOSED.length)} icon={FileSearch} targetId="inc-closed" />
        </div>

        <DetailSection id="inc-awaiting" title="Awaiting review" description="Incidents booked into upcoming review meetings" items={AWAITING} />
        <DetailSection id="inc-open" title="Open incidents" description="Currently under investigation or active monitoring" items={OPEN} />
        <DetailSection id="inc-closed" title="Closed in last 30 days" items={CLOSED} />
      </div>
    </AppShell>
  );
}
