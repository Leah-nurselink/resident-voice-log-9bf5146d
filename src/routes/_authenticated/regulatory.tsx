import { createFileRoute } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/regulatory")({
  head: () => ({ meta: [{ title: "Regulatory · CareCore" }] }),
  component: RegulatoryPage,
});

function RegulatoryPage() {
  return (
    <AppShell title="Regulatory" subtitle="CQC, safeguarding and DoLS tracking">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          ["CQC rating", "Good"],
          ["Notifications submitted", "4"],
          ["Actions outstanding", "2"],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className="h-4 w-4 text-primary" /> {label}
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