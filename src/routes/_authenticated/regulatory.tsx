import { createFileRoute } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MetricLinkCard, DetailSection } from "@/components/governance/MetricLinkCard";

export const Route = createFileRoute("/_authenticated/regulatory")({
  head: () => ({ meta: [{ title: "Regulatory · CareCore" }] }),
  component: RegulatoryPage,
});

type Item = { title: string; meta?: string; status?: string };
const RATING: Item[] = [];
const NOTIFICATIONS: Item[] = [];
const ACTIONS: Item[] = [];

function RegulatoryPage() {
  return (
    <AppShell title="Regulatory" subtitle="CQC, safeguarding and DoLS tracking">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricLinkCard label="CQC rating" value={RATING[0]?.status ?? "Not recorded"} icon={Scale} targetId="reg-rating" />
          <MetricLinkCard label="Notifications submitted" value={String(NOTIFICATIONS.length)} icon={Scale} targetId="reg-notifications" />
          <MetricLinkCard label="Actions outstanding" value={String(ACTIONS.length)} icon={Scale} targetId="reg-actions" />
        </div>

        <DetailSection id="reg-actions" title="Actions outstanding" description="Improvement actions raised by inspection or internal audit" items={ACTIONS} emptyText="No outstanding actions recorded." />
        <DetailSection id="reg-notifications" title="Notifications submitted" description="Statutory CQC notifications filed by the service" items={NOTIFICATIONS} emptyText="No notifications recorded yet." />
        <DetailSection id="reg-rating" title="CQC rating breakdown" description="Latest published rating by key question" items={RATING} emptyText="No inspection rating recorded yet." />
      </div>
    </AppShell>
  );
}
