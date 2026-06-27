import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, ShieldCheck, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports · CareCore" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <AppShell title="Reports & Analytics" subtitle="Care quality, compliance, and CQC readiness">
      <Tabs defaultValue="cqc" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cqc">
            <ShieldCheck className="mr-1 h-4 w-4" /> CQC Toolkit
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="mr-1 h-4 w-4" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="compliance">
            <ClipboardCheck className="mr-1 h-4 w-4" /> Compliance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cqc">
          <Card>
            <CardHeader>
              <CardTitle>CQC Inspection Toolkit</CardTitle>
              <CardDescription>
                Walk through CQC's quality statements, attach evidence from notes and care plans, and run AI evaluations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The full toolkit (quality-statement checklist, evidence upload, AI evaluation) is coming next.
                Care notes, care plans, risk assessments, consents and MCA records already feed into evidence.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Analytics Dashboard</CardTitle>
              <CardDescription>Trends across notes, risks, and incidents.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Charts coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Tracking</CardTitle>
              <CardDescription>Consent, MCA, training and audit status.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Compliance scoring coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
