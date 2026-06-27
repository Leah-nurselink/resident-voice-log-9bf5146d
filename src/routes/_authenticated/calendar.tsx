import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "Calendar · CareCore" }] }),
  component: CalendarPage,
});

function CalendarPage() {
  return (
    <AppShell title="Calendar" subtitle="Schedule and manage care appointments">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarIcon className="h-4 w-4 text-primary" /> Care Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Appointments, GP visits, family meetings and review dates will surface here, linked to
            resident profiles and care-plan review cycles.
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
