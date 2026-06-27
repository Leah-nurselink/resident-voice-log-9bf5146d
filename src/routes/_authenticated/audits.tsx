import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/audits")({
  head: () => ({ meta: [{ title: "Audits · CareCore" }] }),
  component: AuditsPage,
});

function AuditsPage() {
  return (
    <AppShell title="Audits" subtitle="Medication, infection control and care plan audit checks">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          ["Completed this month", "12"],
          ["Due this week", "3"],
          ["Overdue", "1"],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="h-4 w-4 text-primary" /> {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-nav-navy">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}