import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ExplainPopover } from "@/components/ExplainPopover";
import {
  reviewRecommendation,
  bulkReviewRecommendations,
} from "@/lib/approvals";
import { toast } from "sonner";
import { Check, X, FileText, Sparkles, ChevronRight, Telescope, Stethoscope, ShieldAlert, ClipboardCheck, ClipboardList } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";


export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({ meta: [{ title: "Approvals · ForgeAI" }] }),
  component: ApprovalsPage,
});

const KIND_LABEL: Record<string, string> = {
  recommendation: "Recommendation",
  care_gap: "Care plan gap",
  prediction: "Prediction",
  deterioration: "Deterioration",
  plan_review: "Plan review",
  safeguarding: "Safeguarding",
};

const KIND_ICON: Record<string, React.ReactNode> = {
  recommendation: <Sparkles className="h-4 w-4" />,
  care_gap: <FileText className="h-4 w-4" />,
  prediction: <Telescope className="h-4 w-4" />,
  deterioration: <Stethoscope className="h-4 w-4" />,
  plan_review: <FileText className="h-4 w-4" />,
  safeguarding: <ShieldAlert className="h-4 w-4" />,
};

const SEV: Record<string, string> = {
  info: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  warning: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

function ApprovalsPage() {
  const [tab, setTab] = useState("pending");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ai-recs"] });
    setSelected({});
  };

  const { data, isLoading } = useQuery({
    queryKey: ["ai-recs", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_recommendations")
        .select("*, residents(full_name, preferred_name)")
        .eq("status", tab)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) => reviewRecommendation(id, "approve"),
    onSuccess: () => { toast.success("Approved"); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const reject = useMutation({
    mutationFn: (id: string) => reviewRecommendation(id, "reject"),
    onSuccess: () => { toast.success("Rejected"); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const bulkReview = useMutation({
    mutationFn: (p: { ids: string[]; action: "approve" | "reject" }) =>
      bulkReviewRecommendations(p.ids, p.action),
    onSuccess: (_d, v) => { toast.success(`${v.ids.length} ${v.action}d`); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const createTask = useMutation({
    mutationFn: async (r: { id: string; title: string; detail: string | null; resident_id: string | null; severity: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("communication_tasks").insert({
        resident_id: r.resident_id,
        recommendation_id: r.id,
        source: "ai_recommendation",
        kind: "follow_up",
        title: r.title.slice(0, 160),
        detail: r.detail,
        priority: r.severity === "critical" ? "urgent" : r.severity === "warning" ? "high" : "normal",
        status: "open",
        created_by: u.user?.id ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Task created — see the Tasks page to assign it"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected],
  );


  return (
    <AppShell title="Clinical Approvals">
      <div className="mb-3 flex items-center gap-2 px-1">
        <ClipboardCheck className="h-4 w-4 text-primary" />
        <p className="text-sm text-muted-foreground">Review AI-generated insights. Approve, reject, or open the care plan to review it yourself — nothing is written into a care plan automatically.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setSelected({}); }}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="actioned">Actioned</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        {tab === "pending" && (data?.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-2 text-xs">
            <Checkbox
              checked={selectedIds.length > 0 && selectedIds.length === (data?.length ?? 0)}
              onCheckedChange={(c) => {
                if (c) setSelected(Object.fromEntries((data ?? []).map((r) => [r.id, true])));
                else setSelected({});
              }}
            />
            <span className="font-medium">
              {selectedIds.length ? `${selectedIds.length} selected` : "Select all"}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" onClick={() => bulkReview.mutate({ ids: selectedIds, action: "approve" })} disabled={!selectedIds.length || bulkReview.isPending}>
                <Check className="mr-1 h-3.5 w-3.5" />Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkReview.mutate({ ids: selectedIds, action: "reject" })} disabled={!selectedIds.length || bulkReview.isPending}>
                <X className="mr-1 h-3.5 w-3.5" />Reject
              </Button>
            </div>
          </div>
        )}

        <TabsContent value={tab} className="mt-3 space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && (data?.length ?? 0) === 0 && (
            <div className="rounded-2xl border border-dashed bg-card/50 p-8 text-center text-sm text-muted-foreground">
              Nothing here yet.
            </div>
          )}
          {data?.map((r) => {
            const resident = r.residents as { full_name: string | null; preferred_name: string | null } | null;
            const name = resident?.preferred_name || resident?.full_name || "Unknown";
            const payload = (r.payload as { evidence?: { date: string; kind: string; snippet: string }[] }) ?? {};
            return (
              <div key={r.id} className={`rounded-2xl border p-3 ${SEV[r.severity] ?? ""}`}>
                <div className="flex items-start gap-2">
                  {tab === "pending" && (
                    <Checkbox
                      className="mt-1"
                      checked={!!selected[r.id]}
                      onCheckedChange={(c) => setSelected((s) => ({ ...s, [r.id]: !!c }))}
                    />
                  )}
                  <div className="min-w-0 flex-1">

                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide opacity-80">
                      {KIND_ICON[r.kind]}{KIND_LABEL[r.kind] ?? r.kind}
                    </div>
                    <p className="mt-0.5 text-sm font-medium">{r.title}</p>
                    {r.detail && <p className="mt-0.5 text-xs opacity-90">{r.detail}</p>}

                    {payload.evidence && payload.evidence.length > 0 && (
                      <div className="mt-2 rounded-lg border bg-background/60 p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Evidence</p>
                        <ul className="mt-1 space-y-0.5">
                          {payload.evidence.slice(0, 5).map((ev, i) => (
                            <li key={i} className="text-xs opacity-90">
                              <span className="font-medium">{format(new Date(ev.date), "d MMM")}</span> — {ev.snippet}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {r.kind === "care_gap" && r.domain && r.resident_id && (
                      <p className="mt-2 text-xs font-medium">
                        Suggested review: {r.domain} care plan —{" "}
                        <Link to="/residents/$id" params={{ id: r.resident_id }} className="underline">open care plan</Link>
                      </p>
                    )}

                    <Link to="/residents/$id" params={{ id: r.resident_id ?? "" }} className="mt-1 inline-flex items-center gap-1 text-xs underline">
                      {name} <ChevronRight className="h-3 w-3" />
                    </Link>
                    <p className="mt-1 text-[10px] opacity-70">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{r.severity}</Badge>
                    {payload.evidence && payload.evidence.length > 0 && (
                      <ExplainPopover title={r.title} rationale={r.detail ?? ""} evidence={payload.evidence} />
                    )}
                  </div>
                </div>

                {tab === "pending" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => approve.mutate(r.id)} disabled={approve.isPending}>
                      <Check className="mr-1 h-3.5 w-3.5" />Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reject.mutate(r.id)} disabled={reject.isPending}>
                      <X className="mr-1 h-3.5 w-3.5" />Reject
                    </Button>
                    {r.kind === "care_gap" && r.domain && r.resident_id && (
                      <Button asChild size="sm" variant="secondary">
                        <Link to="/residents/$id" params={{ id: r.resident_id }}>
                          <FileText className="mr-1 h-3.5 w-3.5" />Review care plan
                        </Link>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => createTask.mutate(r)} disabled={createTask.isPending}>
                      <ClipboardList className="mr-1 h-3.5 w-3.5" />Create task
                    </Button>
                  </div>
                )}
                {r.reviewed_at && (
                  <p className="mt-2 text-[10px] opacity-70">
                    Reviewed {formatDistanceToNow(new Date(r.reviewed_at), { addSuffix: true })}
                  </p>
                )}
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
