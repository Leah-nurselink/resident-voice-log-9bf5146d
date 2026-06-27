import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, LayoutGrid } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MetricLinkCard, DetailSection } from "@/components/governance/MetricLinkCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/audits")({
  head: () => ({ meta: [{ title: "Audits · CareCore" }] }),
  component: AuditsPage,
});

const AUDIT_TYPES: { title: string; meta: string; status: string }[] = [
  { title: "Care plan audit", meta: "Monthly · quality of care plans across residents", status: "Monthly" },
  { title: "Safe staffing audit", meta: "Weekly · dependency vs. staffing levels", status: "Weekly" },
  { title: "Medication audit", meta: "Weekly · MAR, stock, controlled drugs", status: "Weekly" },
  { title: "Activities & wellbeing audit", meta: "Monthly · engagement and participation", status: "Monthly" },
  { title: "Night audit", meta: "Weekly · night-time checks, walkaround, sleep observations", status: "Weekly" },
  { title: "Laundry audit", meta: "Monthly · infection control, labelling, segregation", status: "Monthly" },
  { title: "Kitchen audit", meta: "Weekly · food hygiene, temperatures, allergens", status: "Weekly" },
  { title: "Home environment audit", meta: "Monthly · cleanliness, repairs, safety", status: "Monthly" },
  { title: "Call bell audit", meta: "Weekly · average response times by unit", status: "Weekly" },
  { title: "Showers, bedbath & bath audit", meta: "Weekly · personal care frequency and dignity", status: "Weekly" },
  { title: "Medical equipment audit & registry", meta: "Monthly · servicing, calibration, asset register", status: "Monthly" },
  { title: "Anti-psychotic audit", meta: "Quarterly · STOMP review of prescribing", status: "Quarterly" },
];

const COMPLETED = [
  { title: "Medication audit — Unit A", meta: "Completed 12 Jun by S. Patel", status: "Pass" },
  { title: "Kitchen audit", meta: "Completed 08 Jun by M. Owusu", status: "Pass" },
  { title: "Care plan audit — 5 residents", meta: "Completed 05 Jun by J. Reid", status: "Action required" },
];
const DUE = [
  { title: "Call bell audit", meta: "Due Fri 28 Jun", status: "Open" },
  { title: "Night audit — Unit B", meta: "Due Sat 29 Jun", status: "Open" },
  { title: "Kitchen audit", meta: "Due Sun 30 Jun", status: "Open" },
  { title: "Showers, bedbath & bath audit", meta: "Due Sun 30 Jun", status: "Open" },
];
const OVERDUE = [
  { title: "Anti-psychotic audit (Q2)", meta: "Was due 20 Jun", status: "Overdue" },
  { title: "Medical equipment registry check", meta: "Was due 22 Jun", status: "Overdue" },
];

function AuditsPage() {
  return (
    <AppShell title="Audits" subtitle="Quality, safety and compliance audits across the service">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricLinkCard label="Completed this month" value={String(COMPLETED.length)} icon={ClipboardCheck} targetId="audits-completed" />
          <MetricLinkCard label="Due this week" value={String(DUE.length)} icon={ClipboardCheck} targetId="audits-due" />
          <MetricLinkCard label="Overdue" value={String(OVERDUE.length)} icon={ClipboardCheck} targetId="audits-overdue" />
        </div>

        <Card id="audit-types" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="h-4 w-4 text-primary" />
              Audit programme
            </CardTitle>
            <p className="text-xs text-muted-foreground">All audit types in the rolling schedule</p>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {AUDIT_TYPES.map((a) => (
                <li key={a.title} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.meta}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{a.status}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <DetailSection id="audits-due" title="Due this week" description="Audits scheduled for completion in the next 7 days" items={DUE} />
        <DetailSection id="audits-overdue" title="Overdue" description="Audits past their scheduled date — prioritise these" items={OVERDUE} emptyText="No overdue audits." />
        <DetailSection id="audits-completed" title="Completed this month" items={COMPLETED} />
      </div>
    </AppShell>
  );
}
