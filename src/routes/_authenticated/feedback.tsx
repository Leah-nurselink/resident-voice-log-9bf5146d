import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/feedback")({
  head: () => ({ meta: [{ title: "Feedback · CareCore" }] }),
  component: FeedbackPage,
});

function FeedbackPage() {
  return (
    <AppShell title="Feedback" subtitle="Resident, family and staff feedback overview">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          ["Family responses", "18"],
          ["Average satisfaction", "4.7 / 5"],
          ["Open complaints", "2"],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="h-4 w-4 text-primary" /> {label}
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