import { createFileRoute } from "@tanstack/react-router";
import { Scale, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MetricLinkCard, DetailSection } from "@/components/governance/MetricLinkCard";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/regulatory")({
  head: () => ({ meta: [{ title: "Regulatory · CareCore" }] }),
  component: RegulatoryPage,
});

const RATING = [
  { title: "Overall rating: Good", meta: "Last inspection 14 Mar 2026", status: "Good" },
  { title: "Safe — Good", meta: "Domain rating", status: "Good" },
  { title: "Effective — Good", meta: "Domain rating", status: "Good" },
  { title: "Caring — Outstanding", meta: "Domain rating", status: "Outstanding" },
  { title: "Responsive — Good", meta: "Domain rating", status: "Good" },
  { title: "Well-led — Good", meta: "Domain rating", status: "Good" },
];
const NOTIFICATIONS = [
  { title: "Death of a service user", meta: "Submitted 02 Jun · Ref CQC-2026-041", status: "Acknowledged" },
  { title: "Serious injury — fall with fracture", meta: "Submitted 18 May · Ref CQC-2026-038", status: "Acknowledged" },
  { title: "DoLS authorisation granted", meta: "Submitted 10 May · Ref CQC-2026-035", status: "Acknowledged" },
  { title: "Allegation of abuse — safeguarding referral", meta: "Submitted 21 Apr · Ref CQC-2026-029", status: "Closed" },
];
const ACTIONS = [
  { title: "Update medicines policy to v4.2", meta: "Owner: Registered Manager · Due 10 Jul", status: "In progress" },
  { title: "Refresh staff training on Mental Capacity Act", meta: "Owner: Training lead · Due 31 Jul", status: "Open" },
];

function RegulatoryPage() {
  return (
    <AppShell title="Regulatory" subtitle="CQC, safeguarding and DoLS tracking">
      <div className="space-y-6">
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">
                Example data — not a real regulatory record
              </p>
              <p className="mt-1 text-muted-foreground">
                Everything below (the CQC rating, notification references, and outstanding
                actions) is placeholder content for design purposes. It is not connected to
                any real inspection, submitted notification, or action tracker. Do not rely
                on this page as evidence of statutory notifications or CQC status — check
                your actual CQC records directly until this page is built against real data.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricLinkCard label="CQC rating" value="Good" icon={Scale} targetId="reg-rating" />
          <MetricLinkCard label="Notifications submitted" value={String(NOTIFICATIONS.length)} icon={Scale} targetId="reg-notifications" />
          <MetricLinkCard label="Actions outstanding" value={String(ACTIONS.length)} icon={Scale} targetId="reg-actions" />
        </div>

        <DetailSection id="reg-actions" title="Actions outstanding" description="Improvement actions raised by inspection or internal audit" items={ACTIONS} />
        <DetailSection id="reg-notifications" title="Notifications submitted" description="Statutory CQC notifications filed by the service" items={NOTIFICATIONS} />
        <DetailSection id="reg-rating" title="CQC rating breakdown" description="Latest published rating by key question" items={RATING} />
      </div>
    </AppShell>
  );
}
