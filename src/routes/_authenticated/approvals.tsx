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
  reviewRecommendation, applyCareGapToCarePlan,
  bulkReviewRecommendations, bulkApplyCareGaps,
} from "@/lib/approvals";
import { toast } from "sonner";
import { Check, X, FileText, Sparkles, ChevronRight, Telescope, Stethoscope, ShieldAlert, ClipboardCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";


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
    onSuccess: () => { toast.success("Approved"); qc.invalidateQueries({ queryKey: ["ai-recs"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const reject = useMutation({
    mutationFn: (id: string) => reviewRecommendation(id, "reject"),
    onSuccess: () => { toast.success("Rejected"); qc.invalidateQueries({ queryKey: ["ai-recs"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const apply = useMutation({
    mutationFn: (rec: Parameters<typeof applyCareGapToCarePlan>[0]) => applyCareGapToCarePlan(rec),
    onSuccess: () => { toast.success("Applied to care plan"); qc.invalidateQueries({ queryKey: ["ai-recs"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <AppShell title="Clinical Approvals">
      <div className="mb-3 flex items-center gap-2 px-1">
        <ClipboardCheck className="h-4 w-4 text-primary" />
        <p className="text-sm text-muted-foreground">Review AI-generated insights. Approve, reject, or apply to a care plan.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="actioned">Actioned</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

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
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide opacity-80">
                      {KIND_ICON[r.kind]}{KIND_LABEL[r.kind] ?? r.kind}
                    </div>
                    <p className="mt-0.5 text-sm font-medium">{r.title}</p>
                    {r.detail && <p className="mt-0.5 text-xs opacity-90">{r.detail}</p>}
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
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => apply.mutate({
                          id: r.id, resident_id: r.resident_id, domain: r.domain,
                          title: r.title, detail: r.detail,
                        })}
                        disabled={apply.isPending}
                      >
                        <FileText className="mr-1 h-3.5 w-3.5" />Apply to care plan
                      </Button>
                    )}
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
