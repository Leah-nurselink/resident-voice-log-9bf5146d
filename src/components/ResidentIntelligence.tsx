import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { analyseResident, wellbeingSeries, type Trend } from "@/lib/care-intelligence";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, TrendingDown, TrendingUp, Minus, AlertTriangle, Activity, Sparkles, ShieldAlert, FileText } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function TrendIcon({ t }: { t: Trend }) {
  if (t === "declining") return <TrendingDown className="h-4 w-4 text-destructive" />;
  if (t === "improving") return <TrendingUp className="h-4 w-4 text-emerald-600" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

const SEV: Record<string, string> = {
  info: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  warning: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

export function ResidentIntelligence({ residentId }: { residentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["intel", residentId],
    queryFn: async () => {
      const [notes, plans, risks] = await Promise.all([
        supabase.from("daily_notes").select("id,created_at,content,domain,risks,flags").eq("resident_id", residentId).order("created_at", { ascending: false }).limit(400),
        supabase.from("care_plans").select("id,domain,updated_at").eq("resident_id", residentId),
        supabase.from("risk_assessments").select("id,type,level,updated_at").eq("resident_id", residentId),
      ]);
      const intel = analyseResident(
        (notes.data ?? []) as never,
        (plans.data ?? []) as never,
        (risks.data ?? []) as never,
      );
      const series = wellbeingSeries((notes.data ?? []) as never, 30);
      return { intel, series };
    },
  });

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Analysing care records…</p>;
  const { intel, series } = data;
  if (intel.noteCount === 0) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center">
        <Brain className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">No care records yet. Insights appear once notes start being recorded.</p>
      </div>
    );
  }

  const w = intel.wellbeing;
  const wbColor = w.score >= 80 ? "text-emerald-600" : w.score >= 65 ? "text-amber-600" : "text-destructive";

  return (
    <div className="space-y-4">
      {/* Wellbeing */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Wellbeing Score</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-4xl font-semibold ${wbColor}`}>{w.score}</span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-sm">
              <TrendIcon t={w.trend} /> <span className="capitalize">{w.label}</span>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]"><Sparkles className="mr-1 h-3 w-3" />AI advisory</Badge>
        </div>
        <Progress value={w.score} className="mt-3 h-2" />
        <div className="-mx-1 mt-3 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <defs>
                <linearGradient id="wb" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis domain={[0, 100]} hide />
              <Tooltip contentStyle={{ fontSize: 11 }} labelFormatter={(v) => v} />
              <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" fill="url(#wb)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recommendations */}
      {intel.recommendations.length > 0 && (
        <Section icon={<Sparkles className="h-4 w-4" />} title="AI Recommendations" subtitle="Advisory — clinician must review">
          <ul className="space-y-2">
            {intel.recommendations.map((r) => (
              <li key={r.id} className={`rounded-xl border p-3 ${SEV[r.severity]}`}>
                <p className="text-sm font-medium">{r.title}</p>
                <p className="mt-0.5 text-xs opacity-90">{r.detail}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Risk predictions */}
      {intel.risks.length > 0 && (
        <Section icon={<AlertTriangle className="h-4 w-4" />} title="Risk Prediction">
          <ul className="space-y-2">
            {intel.risks.map((r) => (
              <li key={r.key} className="rounded-xl border bg-card p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{r.label}</p>
                  <Badge variant={r.confidence === "High" ? "destructive" : r.confidence === "Medium" ? "default" : "outline"} className="text-[10px]">
                    Confidence: {r.confidence}
                  </Badge>
                </div>
                <Progress value={r.score * 100} className="mt-2 h-1.5" />
                <p className="mt-1.5 text-xs text-muted-foreground">{r.recommendation}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{r.signals.join(" · ")}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Domain trends */}
      {intel.domains.length > 0 && (
        <Section icon={<Activity className="h-4 w-4" />} title="Trend Analysis">
          <ul className="space-y-2">
            {intel.domains.map((d) => (
              <li key={d.key} className="flex items-start gap-2 rounded-xl border bg-card p-3">
                <TrendIcon t={d.trend} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium capitalize">{d.label}</p>
                  <p className="text-xs text-muted-foreground">{d.message}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Recent: {d.recent} · Prior: {d.prior}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Care plan reviews */}
      {intel.planReviews.length > 0 && (
        <Section icon={<FileText className="h-4 w-4" />} title="Care Plan Review Assistant">
          <ul className="space-y-2">
            {intel.planReviews.map((p, i) => (
              <li key={i} className="rounded-xl border bg-card p-3">
                <p className="text-sm font-medium capitalize">{p.domain}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.reason}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Safeguarding signals */}
      {intel.safeguarding.length > 0 && (
        <Section icon={<ShieldAlert className="h-4 w-4" />} title="Safeguarding Intelligence" subtitle="Manager review only · Not an automatic alert">
          <ul className="space-y-2">
            {intel.safeguarding.map((s) => (
              <li key={s.signal} className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive">{s.signal}</p>
                <Badge variant="destructive" className="text-[10px]">{s.count} signals</Badge>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="px-1 pb-2 text-[11px] text-muted-foreground">
        Insights derived from {intel.noteCount} care records. All recommendations are advisory and require professional judgement.
      </p>
    </div>
  );
}

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/15 text-primary">{icon}</span>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
