import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AlertTriangle, Bell, ChevronRight, ClipboardList, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { domainLabel, riskLabel, RISK_LEVEL_COLOR, type RiskType } from "@/lib/care-domains";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · ForgeAI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const residents = useQuery({
    queryKey: ["residents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("residents").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const drafts = useQuery({
    queryKey: ["notes-draft"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_notes")
        .select("id, content, domain, created_at, status, resident_id, residents(full_name)")
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const highRisks = useQuery({
    queryKey: ["high-risks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risk_assessments")
        .select("id, type, level, resident_id, residents(full_name)")
        .eq("level", "high")
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell title="Today">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Residents" value={residents.data?.length ?? 0} icon={Users} to="/residents" />
        <StatCard label="Notes awaiting approval" value={drafts.data?.length ?? 0} icon={ClipboardList} to="/residents" />
        <StatCard label="High-risk flags" value={highRisks.data?.length ?? 0} icon={AlertTriangle} to="/alerts" />
      </div>

      <Section title="Notes awaiting approval" icon={ClipboardList}>
        {drafts.data?.length ? (
          <ul className="divide-y rounded-2xl border bg-card">
            {drafts.data.map((n) => (
              <li key={n.id}>
                <Link
                  to="/residents/$id"
                  params={{ id: n.resident_id }}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-accent/30"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{n.residents?.full_name}</span>
                      <Badge variant="secondary" className="text-[10px]">{domainLabel(n.domain)}</Badge>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{n.content}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyHint text="No draft notes — all caught up." />
        )}
      </Section>

      <Section title="High-risk residents" icon={Bell}>
        {highRisks.data?.length ? (
          <ul className="divide-y rounded-2xl border bg-card">
            {highRisks.data.map((r) => (
              <li key={r.id}>
                <Link to="/residents/$id" params={{ id: r.resident_id }} className="flex items-center justify-between px-4 py-3 hover:bg-accent/30">
                  <div>
                    <div className="text-sm font-medium">{r.residents?.full_name}</div>
                    <div className="text-xs text-muted-foreground">{riskLabel(r.type as RiskType)}</div>
                  </div>
                  <Badge className={RISK_LEVEL_COLOR.high}>High</Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyHint text="No high-risk flags right now." />
        )}
      </Section>
    </AppShell>
  );
}

function StatCard({ label, value, icon: Icon, to }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; to: string }) {
  return (
    <Link to={to} className="rounded-2xl border bg-card p-4 transition hover:shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
    </Link>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center gap-2 px-1">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">{text}</div>;
}
