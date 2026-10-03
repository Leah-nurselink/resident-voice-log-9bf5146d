import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { FamilyFeedbackList } from "@/components/FamilyFeedbackList";

export const Route = createFileRoute("/_authenticated/feedback")({
  head: () => ({ meta: [{ title: "Feedback · CareCore" }, { name: "description", content: "Family reviews of care and replies from the home." }] }),
  component: FeedbackPage,
});

function FeedbackPage() {
  return (
    <AppShell title="Feedback" subtitle="Family reviews of care — Admins and Managers can reply">
      <FamilyFeedbackList />
    </AppShell>
  );
}
