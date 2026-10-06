import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { analyseResident, type ResidentIntelligence } from "@/lib/care-intelligence";
import { detectDeviations, CATEGORY_LABELS, type Deviation, type DeviationCategory } from "@/lib/care-deviations";
import { useState } from "react";
import { TrendingDown, AlertTriangle, ShieldAlert, FileText, ChevronRight, Sparkles, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { painPatterns, type PainPattern } from "@/lib/pain-check";
import { medicationObservations, type MedicationObservation } from "@/lib/medication-insights";

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
  medObs: MedicationObservation[];
  woundsDue: number;
  pain: PainPattern[];
};

function IntelligencePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["intel-org"],
    queryFn: async () => {
      const { data: residents } = await supabase
        .from("residents").select("id,full_name,preferred_name,room_number,residency_status")
        .neq("residency_status", "Discharged").neq("residency_status", "Deceased");
      const ids = (residents ?? []).map((r) => r.id);
      if (ids.length === 0) return { rows: [] as Row[], draftCount: 0, openTasks: 0 };
      const since14 = new Date(Date.now() - 14 * 86_400_000).toISOString();
      const today = new Date().toISOString().slice(0, 10);
      const [notes, plans, risks, meds, admins, drafts, wounds, tasks, pains] = await Promise.all([
        supabase.from("daily_notes").select("id,resident_id,created_at,content,domain,category,risks,flags").in("resident_id", ids).order("created_at", { ascending: false }).limit(2000),
        supabase.from("care_plans").select("id,resident_id,domain,updated_at").in("resident_id", ids),
        supabase.from("risk_assessments").select("id,resident_id,type,level,updated_at").in("resident_id", ids),
        supabase.from("medications").select("*").in("resident_id", ids).eq("status", "active"),
        supabase.from("medication_administrations").select("*").in("resident_id", ids).gte("administered_at", since14),
        supabase.from("daily_notes").select("id", { count: "exact", head: true }).in("resident_id", ids).eq("status", "draft"),
        supabase.from("wounds").select("id,resident_id").in("resident_id", ids).neq("status", "healed").lte("review_date", today),
        supabase.from("communication_tasks").select("id", { count: "exact", head: true }).neq("status", "done").neq("status", "completed"),
        supabase.from("pain_assessments").select("*").in("resident_id", ids).gte("assessed_at", since14),
      ]);
      const rows = (residents ?? []).map<Row>((r) => {
        const rNotes = (notes.data ?? []).filter((n) => n.resident_id === r.id);
        const rPlans = (plans.data ?? []).filter((p) => p.resident_id === r.id);
        const rRisks = (risks.data ?? []).filter((rk) => rk.resident_id === r.id);
        const intel = analyseResident(rNotes as never, rPlans as never, rRisks as never);
        const medObs = medicationObservations(
          (meds.data ?? []).filter((m) => m.resident_id === r.id) as never,
          (admins.data ?? []).filter((a) => a.resident_id === r.id) as never,
        );
        const woundsDue = (wounds.data ?? []).filter((w) => w.resident_id === r.id).length;
        const prnIds = new Set((meds.data ?? []).filter((m) => m.resident_id === r.id && m.is_prn).map((m) => m.id));
        const prnGiven = (admins.data ?? []).filter((a) => prnIds.has(a.medication_id) && a.status === "given");
        const pain = painPatterns((pains.data ?? []).filter((p) => p.resident_id === r.id), prnGiven);
        return { id: r.id, name: r.preferred_name || r.full_name || "Unnamed", room: r.room_number, intel, deviations: detectDeviations(rNotes), medObs, woundsDue, pain };
      });
      return { rows, draftCount: drafts.count ?? 0, openTasks: tasks.count ?? 0 };
    },
  });

  if (isLoading) return <AppShell title="Care Intelligence"><p className="p-4 text-sm text-muted-foreground">Analysing organisation-wide care records…</p></AppShell>;
  const rows = data?.rows ?? [];

  const declining = rows.filter((r) => r.intel.wellbeing.trend === "declining" || r.intel.wellbeing.score < 65);
  const escalating = rows.filter((r) => r.intel.risks.some((x) => x.confidence === "High" || x.score >= 0.6));
  const needPlanReview = rows.filter((r) => r.intel.planReviews.length > 0);
  const safeguarding = rows.filter((r) => r.intel.safeguarding.length > 0);

  // Needs Attention: only items worth a human look, highest priority first, capped.
  const attention: Attention[] = [];
  for (const r of rows) {
    for (const s of r.intel.safeguarding) attention.push({ r, level: "high", title: `Safeguarding: ${s.signal}`, detail: `${s.count} related signals in recent records.`, kind: "Pattern identified" });
    for (const d of r.deviations) attention.push({ r, level: d.severity, title: `${CATEGORY_LABELS[d.category]} change`, detail: `${d.recent} mention${d.recent === 1 ? "" : "s"} in the last 3 days (usually ${d.baselinePerPeriod}). Latest ${format(new Date(d.latest.at), "d MMM")}: “${d.latest.excerpt}”`, kind: "Change identified" });
    for (const m of r.medObs) attention.push({ r, level: "medium", title: m.title, detail: m.detail, kind: "Pattern identified" });
    for (const p of r.pain) attention.push({ r, level: "medium", title: `Pain: ${p.title}`, detail: p.detail, kind: "Pain pattern identified" });
    for (const p of r.intel.planReviews) attention.push({ r, level: "low", title: `Care plan review suggested: ${p.domain}`, detail: p.reason, kind: "Review suggested" });
  }
  const rank = { high: 0, medium: 1, low: 2 } as const;
  attention.sort((a, b) => rank[a.level] - rank[b.level]);
  const top = attention.slice(0, 8);

  const highCount = attention.filter((a) => a.level === "high").length;
  const medCount = rows.reduce((a, r) => a + r.medObs.length, 0);
  const woundCount = rows.reduce((a, r) => a + r.woundsDue, 0);
  const planCount = rows.reduce((a, r) => a + r.intel.planReviews.length, 0);

  return (
    <AppShell title="Care Intelligence" subtitle="What is changing, what needs attention, what may have been missed">
      <div className="space-y-4 p-4">
        <header className="space-y-1 sr-only">
          <h1>Care Intelligence</h1>
        </header>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Need attention" value={highCount} tone={highCount ? "bad" : "good"} />
          <Metric label="Care plan reviews" value={planCount} tone={planCount ? "warn" : "good"} />
          <Metric label="Notes awaiting review" value={data?.draftCount ?? 0} tone={data?.draftCount ? "warn" : "good"} />
          <Metric label="Medication patterns" value={medCount} tone={medCount ? "warn" : "good"} />
          <Metric label="Wound reviews due" value={woundCount} tone={woundCount ? "warn" : "good"} />
          <Metric label="Open actions" value={data?.openTasks ?? 0} tone={data?.openTasks ? "warn" : "good"} />
        </div>

        <section className="rounded-2xl border bg-card p-4">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Needs attention</h2>
            <span className="text-[11px] text-muted-foreground">{attention.length > 8 ? `Top 8 of ${attention.length}` : `${attention.length} items`}</span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Something worth looking at — not a diagnosis.</p>
          {top.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>
          ) : (
            <ul className="space-y-2">
              {top.map((a, i) => (
                <li key={i}>
                  <Link to="/residents/$id" params={{ id: a.r.id }} className="block rounded-xl border p-3 hover:bg-muted/50">
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.level === "high" ? "bg-destructive" : a.level === "medium" ? "bg-amber-500" : "bg-primary"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">{a.r.name}{a.r.room ? ` · Room ${a.r.room}` : ""} · {a.kind}</p>
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <DeviationsSection rows={rows} />

        <Group icon={<Activity className="h-4 w-4" />} title="Pain patterns (for staff review)" rows={rows.filter((r) => r.pain.length)}
          render={(r) => r.pain.map((p) => p.title).join(" · ")} />
        <Group icon={<TrendingDown className="h-4 w-4" />} title="Declining wellbeing" rows={declining}
          render={(r) => `${r.intel.wellbeing.score}/100 · ${r.intel.wellbeing.label}`} />
        <Group icon={<AlertTriangle className="h-4 w-4" />} title="Escalating risks" rows={escalating}
          render={(r) => r.intel.risks.slice(0, 2).map((x) => `${x.label} (${x.confidence})`).join(" · ")} />
        <Group icon={<FileText className="h-4 w-4" />} title="Care plans due for review" rows={needPlanReview}
          render={(r) => r.intel.planReviews.map((p) => p.domain).join(", ")} />
        <Group icon={<ShieldAlert className="h-4 w-4" />} title="Safeguarding signals" rows={safeguarding}
          render={(r) => r.intel.safeguarding.map((s) => s.signal).join(", ")} tone="bad" />

        <p className="flex items-center gap-1.5 px-1 pt-2 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3" /> Patterns come from records already in CareCore. All findings need professional review.
        </p>
      </div>
    </AppShell>
  );
}

type Attention = { r: Row; level: "high" | "medium" | "low"; title: string; detail: string; kind: string };

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
