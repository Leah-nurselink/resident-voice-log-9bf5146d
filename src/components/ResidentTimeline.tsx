import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import {
  FileText, Sparkles, Shield, Brain, FileSignature, AlertTriangle,
  Radio, Activity, Heart, Bandage, Telescope, Phone,
} from "lucide-react";
import { domainLabel, riskLabel, type RiskType, type CarePlanDomain } from "@/lib/care-domains";
import { analyseResident } from "@/lib/care-intelligence";
import { ExplainPopover } from "@/components/ExplainPopover";

type Event = {
  id: string;
  ts: string;
  kind: "note" | "session" | "care_plan" | "risk" | "consent" | "mca" | "wound" | "alert" | "comm";
  title: string;
  detail?: string;
  meta?: React.ReactNode;
};

const ICONS: Record<Event["kind"], React.ReactNode> = {
  note: <FileText className="h-3.5 w-3.5" />,
  session: <Radio className="h-3.5 w-3.5" />,
  care_plan: <Activity className="h-3.5 w-3.5" />,
  risk: <Shield className="h-3.5 w-3.5" />,
  consent: <FileSignature className="h-3.5 w-3.5" />,
  mca: <Brain className="h-3.5 w-3.5" />,
  wound: <Bandage className="h-3.5 w-3.5" />,
  alert: <AlertTriangle className="h-3.5 w-3.5" />,
};

const TONES: Record<Event["kind"], string> = {
  note: "bg-primary/15 text-primary",
  session: "bg-emerald-500/15 text-emerald-600",
  care_plan: "bg-sky-500/15 text-sky-600",
  risk: "bg-amber-500/15 text-amber-600",
  consent: "bg-violet-500/15 text-violet-600",
  mca: "bg-violet-500/15 text-violet-600",
  wound: "bg-rose-500/15 text-rose-600",
  alert: "bg-destructive/15 text-destructive",
};

export function ResidentTimeline({ residentId }: { residentId: string }) {
  const { data } = useQuery({
    queryKey: ["timeline", residentId],
    queryFn: async () => {
      const [notes, sessions, plans, risks, consents, mca, wounds, alerts, notesAll, plansAll] = await Promise.all([
        supabase.from("daily_notes").select("*").eq("resident_id", residentId).order("created_at", { ascending: false }).limit(50),
        supabase.from("care_sessions").select("*").eq("resident_id", residentId).order("started_at", { ascending: false }).limit(20),
        supabase.from("care_plan_history").select("*").eq("resident_id", residentId).order("changed_at", { ascending: false }).limit(20),
        supabase.from("risk_assessment_history").select("*").eq("resident_id", residentId).order("changed_at", { ascending: false }).limit(20),
        supabase.from("consents").select("*").eq("resident_id", residentId).order("updated_at", { ascending: false }).limit(20),
        supabase.from("mca_assessments").select("*").eq("resident_id", residentId).order("assessment_date", { ascending: false }).limit(20),
        supabase.from("wounds").select("*").eq("resident_id", residentId).order("created_at", { ascending: false }).limit(20),
        supabase.from("alerts").select("*").eq("resident_id", residentId).order("created_at", { ascending: false }).limit(20),
        supabase.from("daily_notes").select("id,created_at,content,domain,risks,flags").eq("resident_id", residentId).order("created_at", { ascending: false }).limit(400),
        supabase.from("care_plans").select("id,domain,updated_at").eq("resident_id", residentId),
      ]);

      const events: Event[] = [];
      (notes.data ?? []).forEach((n) => {
        events.push({
          id: `n-${n.id}`, ts: n.created_at, kind: "note",
          title: n.source === "voice" ? "AI care note" : "Care note",
          detail: n.content,
          meta: (
            <div className="flex flex-wrap gap-1">
              {n.domain && <Badge variant="secondary" className="text-[10px]">{domainLabel(n.domain)}</Badge>}
              {(n.risks as string[]).map((r) => <Badge key={r} variant="outline" className="text-[10px]">{riskLabel(r as RiskType)}</Badge>)}
              {(n.flags as string[]).map((f) => (
                <Badge key={f} className="bg-destructive/15 text-destructive border-destructive/30 border text-[10px]">{f.replace(/_/g, " ")}</Badge>
              ))}
              <Badge variant={n.status === "approved" ? "secondary" : "outline"} className="text-[10px]">{n.status}</Badge>
            </div>
          ),
        });
      });
      (sessions.data ?? []).forEach((s) => {
        events.push({
          id: `s-${s.id}`, ts: s.started_at, kind: "session",
          title: s.auto_initiated ? "Care session auto-started" : "Care session",
          detail: s.ended_at ? `Ended ${formatDistanceToNow(new Date(s.ended_at), { addSuffix: true })}` : "In progress",
          meta: typeof s.confidence === "number" ? (
            <Badge variant="outline" className="text-[10px]">Confidence {Math.round(s.confidence * 100)}%</Badge>
          ) : undefined,
        });
      });
      (plans.data ?? []).forEach((p) => events.push({
        id: `p-${p.id}`, ts: p.changed_at, kind: "care_plan",
        title: `Care plan updated · ${domainLabel(p.domain as CarePlanDomain)}`,
        detail: p.outcome ?? p.content ?? undefined,
      }));
      (risks.data ?? []).forEach((r) => events.push({
        id: `r-${r.id}`, ts: r.changed_at, kind: "risk",
        title: `Risk assessment updated · ${riskLabel(r.type as RiskType)}`,
        meta: <Badge variant="outline" className="text-[10px]">Level: {r.level}</Badge>,
      }));
      (consents.data ?? []).forEach((c) => events.push({
        id: `c-${c.id}`, ts: c.updated_at, kind: "consent",
        title: `Consent · ${c.consent_type}`,
        meta: <Badge variant="outline" className="text-[10px]">{c.status}</Badge>,
      }));
      (mca.data ?? []).forEach((m) => events.push({
        id: `m-${m.id}`, ts: m.assessment_date, kind: "mca",
        title: "MCA assessment",
        detail: m.decision,
      }));
      (wounds.data ?? []).forEach((w) => events.push({
        id: `w-${w.id}`, ts: w.created_at, kind: "wound",
        title: `Wound · ${w.location ?? "site"}`,
        detail: w.wound_type ?? undefined,
      }));
      (alerts.data ?? []).forEach((a) => events.push({
        id: `a-${a.id}`, ts: a.created_at, kind: "alert",
        title: a.kind ?? "Alert",
        detail: a.message ?? undefined,
      }));

      events.sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
      const ai = analyseResident(
        (notesAll.data ?? []) as never,
        (plansAll.data ?? []) as never,
        [],
      );
      return { events, predictions: ai.predictions };
    },
  });

  if (!data) return <p className="px-1 text-sm text-muted-foreground">Loading timeline…</p>;
  if (data.events.length === 0 && data.predictions.length === 0)
    return <p className="px-1 text-sm text-muted-foreground">No events yet.</p>;

  // Group by day for the "daily story" feel.
  const groups = new Map<string, Event[]>();
  for (const e of data.events) {
    const key = format(new Date(e.ts), "EEEE d MMM yyyy");
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }

  return (
    <div className="space-y-5">
      {data.predictions.length > 0 && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/15 text-primary">
              <Telescope className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Looking ahead</p>
              <p className="text-[10px] text-muted-foreground">Forward-looking signals based on recent patterns</p>
            </div>
          </div>
          <ul className="space-y-2">
            {data.predictions.map((p, i) => (
              <li key={i} className="rounded-xl border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.title}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{p.horizon}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={p.likelihood === "High" ? "destructive" : p.likelihood === "Medium" ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {p.likelihood}
                    </Badge>
                    <ExplainPopover title={p.title} rationale={p.rationale} evidence={p.evidence} />
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{p.rationale}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {Array.from(groups.entries()).map(([day, events]) => (
        <div key={day}>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Heart className="h-3 w-3" /> {day}
          </div>
          <ol className="relative space-y-3 border-l pl-4">
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span className={`absolute -left-[22px] grid h-6 w-6 place-items-center rounded-full ${TONES[e.kind]}`}>
                  {ICONS[e.kind]}
                </span>
                <div className="rounded-xl border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{e.title}</p>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(e.ts), "HH:mm")}</span>
                  </div>
                  {e.detail && <p className="mt-1 text-sm text-muted-foreground">{e.detail}</p>}
                  {e.meta && <div className="mt-2">{e.meta}</div>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
      <div className="flex items-center gap-1.5 px-1 pt-2 text-[11px] text-muted-foreground">
        <Sparkles className="h-3 w-3" /> Auto-compiled from notes, sessions, plans, risks, consents & alerts.
      </div>
    </div>
  );
}
