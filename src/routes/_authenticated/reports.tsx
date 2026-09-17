import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BarChart3, ShieldCheck, ClipboardCheck, ChevronRight } from "lucide-react";
import { subDays } from "date-fns";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports · CareCore" },
      { name: "description", content: "Care quality, compliance and CQC readiness figures — every number links back to the records behind it." },
      { property: "og:title", content: "Reports · CareCore" },
      { property: "og:description", content: "Care quality, compliance and CQC readiness figures — every number links back to the records behind it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

type Metric = { label: string; value: number; hint: string; to: string };

function useMetrics() {
  return useQuery({
    queryKey: ["report-metrics"],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const today = new Date().toISOString().slice(0, 10);
      const count = (q: { count: number | null }) => q.count ?? 0;

      const [notes, drafts, openAlerts, pendingRecs, openTasks, comms, consentsPending, mcaDue, plans, medsGiven, medsNotGiven, medsReviewDue] = await Promise.all([
        supabase.from("daily_notes").select("id", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("daily_notes").select("id", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("alerts").select("id", { count: "exact", head: true }).eq("resolved", false),
        supabase.from("ai_recommendations").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("communication_tasks").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
        supabase.from("communications").select("id", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("consents").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("mca_assessments").select("id", { count: "exact", head: true }).lte("review_date", today),
        supabase.from("care_plans").select("id", { count: "exact", head: true }),
        supabase.from("medication_administrations").select("id", { count: "exact", head: true }).eq("status", "given").gte("administered_at", since),
        supabase.from("medication_administrations").select("id", { count: "exact", head: true }).in("status", ["refused", "omitted", "not_available"]).gte("administered_at", since),
        supabase.from("medications").select("id", { count: "exact", head: true }).eq("status", "active").lte("review_date", today),
      ]);

      const quality: Metric[] = [
        { label: "Care notes (30 days)", value: count(notes), hint: "Open the care notes behind this figure", to: "/notes" },
        { label: "Notes awaiting approval", value: count(drafts), hint: "Drafts not yet approved by staff", to: "/notes" },
        { label: "Unresolved alerts", value: count(openAlerts), hint: "Open the alerts list", to: "/alerts" },
        { label: "AI insights awaiting review", value: count(pendingRecs), hint: "Open the approvals queue", to: "/approvals" },
        { label: "Doses given (30 days)", value: count(medsGiven), hint: "Open today's medication round", to: "/medication-round" },
        { label: "Doses refused, omitted or unavailable", value: count(medsNotGiven), hint: "Open today's medication round", to: "/medication-round" },
      ];
      const governance: Metric[] = [
        { label: "Open actions", value: count(openTasks), hint: "Open the tasks board", to: "/tasks" },
        { label: "Messages logged (30 days)", value: count(comms), hint: "Open communications", to: "/communications" },
        { label: "Consents pending", value: count(consentsPending), hint: "Open reviews due", to: "/reviews" },
        { label: "Capacity reviews due", value: count(mcaDue), hint: "Open reviews due", to: "/reviews" },
        { label: "Care plans in place", value: count(plans), hint: "Open care plans", to: "/care-plans" },
        { label: "Medication reviews due", value: count(medsReviewDue), hint: "Open reviews due", to: "/reviews" },
      ];
      return { quality, governance };
    },
  });
}

function MetricGrid({ items }: { items: Metric[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((m) => (
        <Link key={m.label} to={m.to} className="group rounded-xl border bg-card p-4 transition hover:shadow-soft">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{m.label}</p>
          <p className="mt-1 text-2xl font-semibold">{m.value}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-primary opacity-0 transition group-hover:opacity-100">
            {m.hint} <ChevronRight className="h-3 w-3" />
          </p>
        </Link>
      ))}
    </div>
  );
}

function ReportsPage() {
  const { data } = useMetrics();

  return (
    <AppShell title="Reports & Analytics" subtitle="Every figure links back to the records behind it">
      <Tabs defaultValue="quality" className="space-y-4">
        <TabsList>
          <TabsTrigger value="quality"><BarChart3 className="mr-1 h-4 w-4" /> Care quality</TabsTrigger>
          <TabsTrigger value="governance"><ClipboardCheck className="mr-1 h-4 w-4" /> Governance</TabsTrigger>
          <TabsTrigger value="cqc"><ShieldCheck className="mr-1 h-4 w-4" /> CQC toolkit</TabsTrigger>
        </TabsList>

        <TabsContent value="quality" className="space-y-3">
          <MetricGrid items={data?.quality ?? []} />
        </TabsContent>

        <TabsContent value="governance" className="space-y-3">
          <MetricGrid items={data?.governance ?? []} />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Reviews due</CardTitle>
              <CardDescription>Care plans, risk assessments, consents and capacity assessments due across all residents.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm" variant="outline"><Link to="/reviews">Open reviews due</Link></Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cqc">
          <Card>
            <CardHeader>
              <CardTitle>CQC Inspection Toolkit</CardTitle>
              <CardDescription>
                Walk through CQC's quality statements and attach evidence from notes and care plans.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                The quality-statement checklist is coming next. Care notes, care plans, risk assessments, consents and capacity
                assessments already feed the figures above, and each one opens the records behind it.
              </p>
              <Button asChild size="sm" variant="outline"><Link to="/regulatory">Open regulatory readiness</Link></Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
