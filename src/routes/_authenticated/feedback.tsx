import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MetricLinkCard, DetailSection } from "@/components/governance/MetricLinkCard";

export const Route = createFileRoute("/_authenticated/feedback")({
  head: () => ({ meta: [{ title: "Feedback · CareCore" }] }),
  component: FeedbackPage,
});

const RESPONSES = [
  { title: "Daughter of Mrs E. Howard", meta: "Care quality survey · 22 Jun", status: "5 / 5" },
  { title: "Son of Mr A. Bennett", meta: "Care quality survey · 19 Jun", status: "4 / 5" },
  { title: "Wife of Mr P. Singh", meta: "Care quality survey · 15 Jun", status: "5 / 5" },
];
const SATISFACTION = [
  { title: "Communication with family", meta: "Average over last 30 days", status: "4.8 / 5" },
  { title: "Quality of care", meta: "Average over last 30 days", status: "4.7 / 5" },
  { title: "Food & meals", meta: "Average over last 30 days", status: "4.4 / 5" },
  { title: "Activities & engagement", meta: "Average over last 30 days", status: "4.6 / 5" },
];
const COMPLAINTS = [
  { title: "Missed medication round — Unit A", meta: "Raised 11 Jun · investigating", status: "Open" },
  { title: "Laundry items lost", meta: "Raised 04 Jun · awaiting response", status: "Open" },
];

function FeedbackPage() {
  return (
    <AppShell title="Feedback" subtitle="Resident, family and staff feedback overview">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricLinkCard label="Family responses" value={String(RESPONSES.length)} icon={MessageCircle} targetId="fb-responses" />
          <MetricLinkCard label="Average satisfaction" value="4.7 / 5" icon={MessageCircle} targetId="fb-satisfaction" />
          <MetricLinkCard label="Open complaints" value={String(COMPLAINTS.length)} icon={MessageCircle} targetId="fb-complaints" />
        </div>

        <DetailSection id="fb-complaints" title="Open complaints" description="Complaints currently being investigated" items={COMPLAINTS} emptyText="No open complaints." />
        <DetailSection id="fb-responses" title="Recent family responses" items={RESPONSES} />
        <DetailSection id="fb-satisfaction" title="Satisfaction by theme" items={SATISFACTION} />
      </div>
    </AppShell>
  );
}
