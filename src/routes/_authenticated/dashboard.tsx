import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  ClipboardCheck,
  Heart,
  MessageSquare,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { TasksList } from "@/components/dashboard/TasksList";
import careHero from "@/assets/care-hero.jpg";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · CareCore" }] }),
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

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TasksList />
          </div>
          <RecentActivity />
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-primary" /> Today's Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                ["Morning handover", "07:30"],
                ["Doctor's visit", "10:00"],
                ["Family meeting", "14:00"],
                ["Evening handover", "19:30"],
              ].map(([label, time]) => (
                <div key={label} className="flex items-center justify-between">
                  <span>{label}</span>
                  <span className="text-muted-foreground">{time}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4 text-primary" /> Communication
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium">Family Updates</p>
                <p className="text-xs text-muted-foreground">3 families contacted today</p>
              </div>
              <div>
                <p className="font-medium">MDT Notes</p>
                <p className="text-xs text-muted-foreground">2 new physiotherapy reports</p>
              </div>
              <div>
                <p className="font-medium">Staff Messages</p>
                <p className="text-xs text-muted-foreground">5 internal communications</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" /> Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ["Care Quality", "Excellent", 92],
                ["Staff Satisfaction", "High", 88],
                ["Compliance", "100%", 100],
              ].map(([label, status, pct]) => (
                <div key={label as string} className="text-sm">
                  <div className="mb-1 flex justify-between">
                    <span>{label}</span>
                    <span className="font-medium text-care-on-track">{status}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-care-on-track" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
