import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  FileSearch,
  Heart,
  MessageCircle,
  MessageSquare,
  Scale,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { TasksList } from "@/components/dashboard/TasksList";
import { LiveCareActivity } from "@/components/dashboard/LiveCareActivity";
import { ResidentPhotoStrip } from "@/components/dashboard/ResidentPhotoStrip";
import { TrendArea, DonutChart } from "@/components/analytics/AnalyticsCharts";
import careHero from "@/assets/care-hero.jpg";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · CareCore" },
      { name: "description", content: "View residents, care activity, tasks and clinical priorities in CareCore." },
      { property: "og:title", content: "Dashboard · CareCore" },
      { property: "og:description", content: "View residents, care activity, tasks and clinical priorities in CareCore." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const residents = useQuery({
    queryKey: ["residents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("residents").select("id");
      if (error) throw error;
      return data;
    },
  });

  const drafts = useQuery({
    queryKey: ["notes-draft-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("daily_notes")
        .select("*", { count: "exact", head: true })
        .eq("status", "draft");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const carePlans = useQuery({
    queryKey: ["care-plans-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("care_plans")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const highRisks = useQuery({
    queryKey: ["high-risks-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("risk_assessments")
        .select("*", { count: "exact", head: true })
        .eq("level", "high");
      if (error) throw error;
      return count ?? 0;
    },
  });

  return (
    <AppShell title="Dashboard" subtitle="Person-centred care at a glance">
      <div className="space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-elevated">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25"
            style={{ backgroundImage: `url(${careHero})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/70 to-transparent" />
          <div className="relative p-6 md:p-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold md:text-3xl">Welcome to CareCore</h2>
              <p className="mt-2 text-sm opacity-90 md:text-base">
                AI-assisted person-centred care documentation. Real-time observations, joined-up risk assessments, and the time to actually care.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs md:text-sm">
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" /> {residents.data?.length ?? 0} Residents
                </span>
                <span className="inline-flex items-center gap-2">
                  <Heart className="h-4 w-4" /> 24/7 Care
                </span>
                <span className="inline-flex items-center gap-2">
                  <Shield className="h-4 w-4" /> CQC Aligned
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Total Residents" value={residents.data?.length ?? 0} description="Currently in care" icon={Users} />
          <MetricCard title="Notes Awaiting Approval" value={drafts.data ?? 0} description="AI drafts to review" icon={ClipboardCheck} />
          <MetricCard title="Care Plans" value={carePlans.data ?? 0} description="Across all domains" icon={Heart} />
          <MetricCard title="High-risk Flags" value={highRisks.data ?? 0} description="Requiring attention" icon={AlertTriangle} />
        </div>

        <ResidentPhotoStrip />

        {/* Live feed from carer app */}
        <LiveCareActivity />

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TasksList />
          </div>
          <RecentActivity />
        </div>

        {/* Analytics snapshot */}
        <div>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Analytics snapshot
              </h3>
              <p className="text-xs text-muted-foreground">Last 14 days · from recorded notes</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/analytics">Open analytics</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-primary" /> Notes logged per day
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TrendArea data={snapshot.data?.perDay ?? []} dataKey="value" height={200} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Heart className="h-4 w-4 text-primary" /> Care mix
                </CardTitle>
              </CardHeader>
              <CardContent>
                {snapshot.data?.mix.length ? (
                  <DonutChart height={200} data={snapshot.data.mix} />
                ) : (
                  <p className="text-sm text-muted-foreground">No notes recorded yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Governance row */}
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Governance & Quality
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageCircle className="h-4 w-4 text-primary" /> Family feedback
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Responses" value={governance.data?.feedbackCount ?? 0} />
                <Row label="Avg satisfaction" value={governance.data?.avgRating ? `${governance.data.avgRating} / 5` : "—"} />
                <Row label="Awaiting reply" value={governance.data?.awaitingReply ?? 0} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSearch className="h-4 w-4 text-primary" /> Incident Review
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Open incidents" value={governance.data?.open ?? 0} />
                <Row label="Under review" value={governance.data?.review ?? 0} />
                <Row label="Closed (30d)" value={governance.data?.closed30 ?? 0} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
