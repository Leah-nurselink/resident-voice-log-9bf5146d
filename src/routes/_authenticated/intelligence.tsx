import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { analyseResident, type ResidentIntelligence } from "@/lib/care-intelligence";
import { TrendingDown, AlertTriangle, ShieldAlert, FileText, ChevronRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/intelligence")({
  head: () => ({ meta: [{ title: "Care Intelligence · ForgeAI" }] }),
  component: IntelligencePage,
});

type Row = {
  id: string;
  name: string;
  room: string | null;
  intel: ResidentIntelligence;
};

function IntelligencePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["intel-org"],
    queryFn: async () => {
      const { data: residents } = await supabase
        .from("residents").select("id,full_name,preferred_name,room_number,residency_status")
        .neq("residency_status", "Discharged").neq("residency_status", "Deceased");
      const ids = (residents ?? []).map((r) => r.id);
      if (ids.length === 0) return [] as Row[];
      const [notes, plans, risks] = await Promise.all([
        supabase.from("daily_notes").select("id,resident_id,created_at,content,domain,risks,flags").in("resident_id", ids).order("created_at", { ascending: false }).limit(2000),
        supabase.from("care_plans").select("id,resident_id,domain,updated_at").in("resident_id", ids),
        supabase.from("risk_assessments").select("id,resident_id,type,level,updated_at").in("resident_id", ids),
      ]);
      return (residents ?? []).map<Row>((r) => {
        const rNotes = (notes.data ?? []).filter((n) => n.resident_id === r.id);
        const rPlans = (plans.data ?? []).filter((p) => p.resident_id === r.id);
        const rRisks = (risks.data ?? []).filter((rk) => rk.resident_id === r.id);
        const intel = analyseResident(rNotes as never, rPlans as never, rRisks as never);
        return { id: r.id, name: r.preferred_name || r.full_name || "Unnamed", room: r.room_number, intel };
      });
    },
  });

  if (isLoading) return <AppShell title="Care Intelligence"><p className="p-4 text-sm text-muted-foreground">Analysing organisation-wide care records…</p></AppShell>;
  const rows = data ?? [];

  const declining = rows.filter((r) => r.intel.wellbeing.trend === "declining" || r.intel.wellbeing.score < 65);
  const escalating = rows.filter((r) => r.intel.risks.some((x) => x.confidence === "High" || x.score >= 0.6));
  const needPlanReview = rows.filter((r) => r.intel.planReviews.length > 0);
  const safeguarding = rows.filter((r) => r.intel.safeguarding.length > 0);
  const avgWb = rows.length ? Math.round(rows.reduce((a, r) => a + r.intel.wellbeing.score, 0) / rows.length) : 0;

  return (
    <AppShell title="Care Intelligence" subtitle="Organisation-wide patterns from every resident">
      <div className="space-y-4 p-4">
        <header className="space-y-1 sr-only">
          <h1>Care Intelligence</h1>
        </header>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Avg wellbeing" value={`${avgWb}/100`} tone={avgWb >= 80 ? "good" : avgWb >= 65 ? "warn" : "bad"} />
          <Metric label="Declining residents" value={declining.length} tone={declining.length ? "warn" : "good"} />
          <Metric label="Escalating risks" value={escalating.length} tone={escalating.length ? "bad" : "good"} />
          <Metric label="Plans to review" value={needPlanReview.length} tone={needPlanReview.length ? "warn" : "good"} />
        </div>

        <Group icon={<TrendingDown className="h-4 w-4" />} title="Declining wellbeing" rows={declining}
          render={(r) => `${r.intel.wellbeing.score}/100 · ${r.intel.wellbeing.label}`} />
        <Group icon={<AlertTriangle className="h-4 w-4" />} title="Escalating risks" rows={escalating}
          render={(r) => r.intel.risks.slice(0, 2).map((x) => `${x.label} (${x.confidence})`).join(" · ")} />
        <Group icon={<FileText className="h-4 w-4" />} title="Care plans due for review" rows={needPlanReview}
          render={(r) => r.intel.planReviews.map((p) => p.domain).join(", ")} />
        <Group icon={<ShieldAlert className="h-4 w-4" />} title="Safeguarding signals" rows={safeguarding}
          render={(r) => r.intel.safeguarding.map((s) => s.signal).join(", ")} tone="bad" />

        <p className="flex items-center gap-1.5 px-1 pt-2 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3" /> Patterns derived from voice notes, sessions, risks and plans. All findings require professional review.
        </p>
      </div>
    </AppShell>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone: "good" | "warn" | "bad" }) {
  const c = tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-destructive";
  return (
    <div className="rounded-2xl border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${c}`}>{value}</p>
    </div>
  );
}

function Group({ icon, title, rows, render, tone }: { icon: React.ReactNode; title: string; rows: Row[]; render: (r: Row) => string; tone?: "bad" }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className={`grid h-6 w-6 place-items-center rounded-md ${tone === "bad" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
        <Badge variant="outline" className="text-[10px]">{rows.length}</Badge>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-3 text-xs text-muted-foreground">No residents flagged.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.id}>
              <Link to="/residents/$id" params={{ id: r.id }} className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3 transition hover:bg-muted/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.name} {r.room && <span className="text-xs text-muted-foreground">· Rm {r.room}</span>}</p>
                  <p className="truncate text-xs text-muted-foreground">{render(r)}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
