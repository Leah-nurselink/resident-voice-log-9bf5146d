import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, FileText, Shield, FileSignature, Brain, Pill } from "lucide-react";
import { format, differenceInCalendarDays, addDays } from "date-fns";
import { domainLabel, riskLabel, type CarePlanDomain, type RiskType } from "@/lib/care-domains";

export const Route = createFileRoute("/_authenticated/reviews")({
  head: () => ({
    meta: [
      { title: "Reviews due · CareCore" },
      { name: "description", content: "Every care plan, risk assessment, consent and capacity review that is due or overdue, across all residents." },
      { property: "og:title", content: "Reviews due · CareCore" },
      { property: "og:description", content: "Every care plan, risk assessment, consent and capacity review that is due or overdue, across all residents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewsPage,
});

type Item = {
  id: string;
  residentId: string;
  residentName: string;
  type: "Care plan" | "Risk assessment" | "Consent" | "Capacity assessment" | "Medication";
  label: string;
  due: string; // yyyy-mm-dd
};

const ICON: Record<Item["type"], React.ReactNode> = {
  "Care plan": <FileText className="h-3.5 w-3.5" />,
  "Risk assessment": <Shield className="h-3.5 w-3.5" />,
  Consent: <FileSignature className="h-3.5 w-3.5" />,
  "Capacity assessment": <Brain className="h-3.5 w-3.5" />,
  Medication: <Pill className="h-3.5 w-3.5" />,
};

const CARE_PLAN_REVIEW_DAYS = 90;

function ReviewsPage() {
  const { data } = useQuery({
    queryKey: ["reviews-due"],
    queryFn: async () => {
      const [plans, risks, consents, mca] = await Promise.all([
        supabase.from("care_plans").select("id, domain, last_review, resident_id, residents(full_name)"),
        supabase.from("risk_assessments").select("id, type, review_date, resident_id, residents(full_name)"),
        supabase.from("consents").select("id, consent_type, review_date, resident_id, residents(full_name)"),
        supabase.from("mca_assessments").select("id, decision, review_date, resident_id, residents(full_name)"),
      ]);

      const items: Item[] = [];
      const name = (r: { full_name?: string | null } | null) => r?.full_name ?? "Unknown resident";

      (plans.data ?? []).forEach((p) => {
        if (!p.last_review) return;
        items.push({
          id: `cp-${p.id}`, residentId: p.resident_id, residentName: name(p.residents),
          type: "Care plan", label: domainLabel(p.domain as CarePlanDomain),
          due: format(addDays(new Date(p.last_review), CARE_PLAN_REVIEW_DAYS), "yyyy-MM-dd"),
        });
      });
      (risks.data ?? []).forEach((r) => {
        if (!r.review_date) return;
        items.push({
          id: `ra-${r.id}`, residentId: r.resident_id, residentName: name(r.residents),
          type: "Risk assessment", label: riskLabel(r.type as RiskType), due: r.review_date,
        });
      });
      (consents.data ?? []).forEach((c) => {
        if (!c.review_date) return;
        items.push({
          id: `co-${c.id}`, residentId: c.resident_id, residentName: name(c.residents),
          type: "Consent", label: c.consent_type, due: c.review_date,
        });
      });
      (mca.data ?? []).forEach((m) => {
        if (!m.review_date) return;
        items.push({
          id: `mc-${m.id}`, residentId: m.resident_id, residentName: name(m.residents),
          type: "Capacity assessment", label: m.decision, due: m.review_date,
        });
      });

      return items.sort((a, b) => a.due.localeCompare(b.due));
    },
  });

  const items = data ?? [];
  const days = (d: string) => differenceInCalendarDays(new Date(d), new Date());
  const overdue = items.filter((i) => days(i.due) < 0);
  const thisWeek = items.filter((i) => days(i.due) >= 0 && days(i.due) <= 7);
  const soon = items.filter((i) => days(i.due) > 7 && days(i.due) <= 30);

  return (
    <AppShell title="Reviews due" subtitle="Care plans, risk assessments, consents and capacity assessments across all residents">
      <div className="space-y-4">
        <Section title="Overdue" tone="destructive" items={overdue} />
        <Section title="Due in the next 7 days" tone="warning" items={thisWeek} />
        <Section title="Due within 30 days" tone="muted" items={soon} />
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">
            Nothing has a review date set yet. Add review dates on care plans, risk assessments, consents and capacity assessments.
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Section({ title, tone, items }: { title: string; tone: "destructive" | "warning" | "muted"; items: Item[] }) {
  if (!items.length) return null;
  const toneClass =
    tone === "destructive" ? "text-destructive"
      : tone === "warning" ? "text-care-attention"
      : "text-muted-foreground";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`flex items-center gap-2 text-base ${toneClass}`}>
          <CalendarClock className="h-4 w-4" /> {title}
          <Badge variant="outline" className="ml-1 text-[10px]">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {items.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="text-muted-foreground">{ICON[i.type]}</span>
              <div className="min-w-[12rem] flex-1">
                <p className="text-sm font-medium">{i.residentName}</p>
                <p className="text-xs text-muted-foreground">{i.type} — {i.label}</p>
              </div>
              <span className={`text-xs ${toneClass}`}>{format(new Date(i.due), "d MMM yyyy")}</span>
              <Button asChild size="sm" variant="outline">
                <Link to="/residents/$id" params={{ id: i.residentId }}>Open</Link>
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
