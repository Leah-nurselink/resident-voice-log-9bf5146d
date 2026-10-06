import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { analyseResident, type ResidentIntelligence } from "@/lib/care-intelligence";
import { detectDeviations, CATEGORY_LABELS, type Deviation, type DeviationCategory } from "@/lib/care-deviations";
import { useState } from "react";
import { TrendingDown, AlertTriangle, ShieldAlert, FileText, ChevronRight, Sparkles, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/intelligence")({
  head: () => ({
    meta: [
      { title: "Care Intelligence · CareCore" },
      { name: "description", content: "Deviations in resident care flagged by category for clinical review." },
      { property: "og:title", content: "Care Intelligence · CareCore" },
      { property: "og:description", content: "Deviations in resident care flagged by category for clinical review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntelligencePage,
});

type Row = {
  id: string;
  name: string;
  room: string | null;
  intel: ResidentIntelligence;
  deviations: Deviation[];
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
        supabase.from("daily_notes").select("id,resident_id,created_at,content,domain,category,risks,flags").in("resident_id", ids).order("created_at", { ascending: false }).limit(2000),
        supabase.from("care_plans").select("id,resident_id,domain,updated_at").in("resident_id", ids),
        supabase.from("risk_assessments").select("id,resident_id,type,level,updated_at").in("resident_id", ids),
      ]);
      return (residents ?? []).map<Row>((r) => {
        const rNotes = (notes.data ?? []).filter((n) => n.resident_id === r.id);
        const rPlans = (plans.data ?? []).filter((p) => p.resident_id === r.id);
        const rRisks = (risks.data ?? []).filter((rk) => rk.resident_id === r.id);
        const intel = analyseResident(rNotes as never, rPlans as never, rRisks as never);
        return { id: r.id, name: r.preferred_name || r.full_name || "Unnamed", room: r.room_number, intel, deviations: detectDeviations(rNotes) };
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

        <DeviationsSection rows={rows} />

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

function DeviationsSection({ rows }: { rows: Row[] }) {
  const [cat, setCat] = useState<DeviationCategory | "all">("all");
  const cats = Object.keys(CATEGORY_LABELS) as DeviationCategory[];
  const counts = Object.fromEntries(cats.map((c) => [c, rows.filter((r) => r.deviations.some((d) => d.category === c)).length])) as Record<DeviationCategory, number>;
  const items = rows
    .flatMap((r) => r.deviations.map((d) => ({ r, d })))
    .filter(({ d }) => cat === "all" || d.category === cat)
    .sort((a, b) => (a.d.severity === b.d.severity ? b.d.recent - a.d.recent : a.d.severity === "high" ? -1 : 1));

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-destructive/15 text-destructive"><Activity className="h-4 w-4" /></span>
        <h2 className="text-sm font-semibold">Care deviations (last 3 days vs usual)</h2>
        <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <Chip active={cat === "all"} onClick={() => setCat("all")}>All</Chip>
        {cats.map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
            {CATEGORY_LABELS[c]}{counts[c] ? ` · ${counts[c]}` : ""}
          </Chip>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border bg-card p-3 text-xs text-muted-foreground">No deviations flagged in this category.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map(({ r, d }) => (
            <li key={`${r.id}-${d.category}`}>
              <Link to="/residents/$id" params={{ id: r.id }} className="block rounded-xl border bg-card p-3 transition hover:bg-muted/40">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{r.name}{r.room && <span className="text-xs text-muted-foreground"> · Rm {r.room}</span>}</p>
                  <Badge variant={d.severity === "high" ? "destructive" : "secondary"} className="text-[10px]">{CATEGORY_LABELS[d.category]}</Badge>
                  <span className="text-[11px] text-muted-foreground">{d.recent} recent vs ~{d.baselinePerPeriod} usual</span>
                </div>
                {d.latest.excerpt && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {new Date(d.latest.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}: “{d.latest.excerpt}”
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs ${active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>
      {children}
    </button>
  );
}
