import { createFileRoute } from "@tanstack/react-router";
import { FileSearch } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/incident-review")({
  head: () => ({ meta: [{ title: "Incident Review · CareCore" }] }),
  component: IncidentReviewPage,
});

function IncidentReviewPage() {
  return (
    <AppShell title="Incident Review" subtitle="Falls, medication errors and safeguarding incident follow-up">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          ["Open incidents", "5"],
          ["Awaiting review", "3"],
          ["Closed in 30 days", "14"],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSearch className="h-4 w-4 text-primary" /> {label}
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