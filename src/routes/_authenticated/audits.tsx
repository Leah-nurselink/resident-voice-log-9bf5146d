import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, LayoutGrid, Play } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MetricLinkCard, DetailSection } from "@/components/governance/MetricLinkCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AuditDialog } from "@/components/audits/AuditDialog";
import {
  AUDIT_DEFINITIONS,
  loadSubmissions,
  type AuditDefinition,
  type AuditSubmission,
} from "@/lib/audit-questions";

export const Route = createFileRoute("/_authenticated/audits")({
  head: () => ({ meta: [{ title: "Audits · CareCore" }] }),
  component: AuditsPage,
});

const FREQUENCY: Record<string, string> = {
  care_plan: "Monthly",
  safe_staffing: "Weekly",
  medication: "Weekly",
  activities: "Monthly",
  night: "Weekly",
  laundry: "Monthly",
  kitchen: "Weekly",
  home_environment: "Monthly",
  call_bell: "Weekly",
  personal_care: "Weekly",
  equipment: "Monthly",
  antipsychotic: "Quarterly",
};

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
  const [active, setActive] = useState<AuditDefinition | null>(null);
  const [open, setOpen] = useState(false);
  const [submissions, setSubmissions] = useState<AuditSubmission[]>(() => loadSubmissions());

  const startAudit = (a: AuditDefinition) => {
    setActive(a);
    setOpen(true);
  };
  const refresh = () => setSubmissions(loadSubmissions());

  const completedItems = submissions.map((s) => {
    const openActions = s.actionPlan?.filter((a) => a.status !== "done").length ?? 0;
    const totalActions = s.actionPlan?.length ?? 0;
    const actionSummary = totalActions
      ? ` · ${openActions}/${totalActions} action${totalActions === 1 ? "" : "s"} open`
      : "";
    return {
      title: `${s.auditTitle}${s.unit ? ` — ${s.unit}` : ""}`,
      meta: `Completed ${new Date(s.completedAt).toLocaleString()} by ${s.completedBy}${actionSummary}${s.summary ? ` · ${s.summary}` : ""}`,
      status: `${s.compliance}% · ${s.compliance >= 90 ? "Pass" : s.compliance >= 70 ? "Action required" : "Fail"}`,
    };
  });

  return (
    <AppShell title="Audits" subtitle="Quality, safety and compliance audits across the service">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricLinkCard label="Completed (this device)" value={String(submissions.length)} icon={ClipboardCheck} targetId="audits-completed" />
          <MetricLinkCard label="Due this week" value={String(DUE.length)} icon={ClipboardCheck} targetId="audits-due" />
          <MetricLinkCard label="Overdue" value={String(OVERDUE.length)} icon={ClipboardCheck} targetId="audits-overdue" />
        </div>

        <Card id="audit-types" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="h-4 w-4 text-primary" />
              Audit programme
            </CardTitle>
            <p className="text-xs text-muted-foreground">Tap an audit to answer its questions</p>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {AUDIT_DEFINITIONS.map((a) => (
                <li key={a.key} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.questions.length} questions · {FREQUENCY[a.key] ?? "Scheduled"}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => startAudit(a)} className="shrink-0">
                    <Play className="mr-1 h-3.5 w-3.5" /> Start
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <DetailSection id="audits-due" title="Due this week" description="Audits scheduled for completion in the next 7 days" items={DUE} />
        <DetailSection id="audits-overdue" title="Overdue" description="Audits past their scheduled date — prioritise these" items={OVERDUE} emptyText="No overdue audits." />
        <DetailSection id="audits-completed" title="Completed audits" items={completedItems} emptyText="No audits submitted yet — tap Start on any audit above." />
      </div>

      <AuditDialog audit={active} open={open} onOpenChange={setOpen} onSubmitted={refresh} />
    </AppShell>
  );
}
