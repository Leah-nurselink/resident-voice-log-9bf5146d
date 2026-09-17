import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { TaskBoard } from "@/components/TaskBoard";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks · CareCore" },
      { name: "description", content: "Track, assign and complete care actions raised from messages and AI insights." },
      { property: "og:title", content: "Tasks · CareCore" },
      { property: "og:description", content: "Track, assign and complete care actions raised from messages and AI insights." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TasksPage,
});

function TasksPage() {
  return (
    <AppShell title="Tasks" subtitle="Actions raised from messages and AI insights — assigned and tracked">
      <TaskBoard />
    </AppShell>
  );
}
