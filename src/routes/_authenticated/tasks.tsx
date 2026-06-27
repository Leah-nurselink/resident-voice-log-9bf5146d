import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { TasksList } from "@/components/dashboard/TasksList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks · CareCore" }] }),
  component: TasksPage,
});

function TasksPage() {
  return (
    <AppShell title="Tasks" subtitle="Manage and track daily care tasks">
      <div className="space-y-4">
        <TasksList />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-primary" /> Full task management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Recurring rotas, assignment to staff, and handover-linked tasks are coming next.
              The list above is a working view tied to the dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
