import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { riskLabel, RISK_LEVEL_COLOR, type RiskType } from "@/lib/care-domains";
import { updateAlertStatus } from "@/lib/approvals";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, Flag, Check, Eye, X, Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Alert Centre · ForgeAI" }] }),
  component: AlertsPage,
});

const SEV: Record<string, string> = {
  info: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  warning: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

function AlertsPage() {
  const [tab, setTab] = useState("open");
  const qc = useQueryClient();

  const alerts = useQuery({
    queryKey: ["alerts-centre", tab],
    queryFn: async () => {
      const statuses = tab === "open" ? ["open", "acknowledged"] : tab === "resolved" ? ["resolved"] : ["dismissed"];
      const { data, error } = await supabase
        .from("alerts")
        .select("*, residents(full_name, preferred_name)")
        .in("status", statuses)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const flagged = useQuery({
    queryKey: ["flagged-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_notes")
        .select("id, content, flags, created_at, resident_id, residents(full_name)")
        .not("flags", "eq", "{}")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []).filter((n) => (n.flags as string[]).length > 0);
    },
  });

  const highRisks = useQuery({
    queryKey: ["high-risks-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risk_assessments")
        .select("id, type, level, resident_id, residents(full_name)")
        .in("level", ["medium", "high"])
        .order("level", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const ack = useMutation({
    mutationFn: (id: string) => updateAlertStatus(id, "acknowledge"),
    onSuccess: () => { toast.success("Acknowledged"); qc.invalidateQueries({ queryKey: ["alerts-centre"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const resolve = useMutation({
    mutationFn: (id: string) => updateAlertStatus(id, "resolve"),
    onSuccess: () => { toast.success("Resolved"); qc.invalidateQueries({ queryKey: ["alerts-centre"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const dismiss = useMutation({
    mutationFn: (id: string) => updateAlertStatus(id, "dismiss"),
    onSuccess: () => { toast.success("Dismissed"); qc.invalidateQueries({ queryKey: ["alerts-centre"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <AppShell title="Alert Centre">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-3 space-y-2">
          <div className="mb-2 flex items-center gap-2 px-1">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">Clinical alerts</h2>
          </div>
          {alerts.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!alerts.isLoading && (alerts.data?.length ?? 0) === 0 && (
            <div className="rounded-2xl border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
              No {tab} alerts.
            </div>
          )}
          {alerts.data?.map((a) => {
            const resident = a.residents as { full_name: string | null; preferred_name: string | null } | null;
            const name = resident?.preferred_name || resident?.full_name || "—";
            return (
              <div key={a.id} className={`rounded-2xl border p-3 ${SEV[a.severity] ?? ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide opacity-70">{a.kind.replace(/_/g, " ")}</p>
                    <p className="mt-0.5 text-sm font-medium">{a.message}</p>
                    {a.resident_id && (
                      <Link to="/residents/$id" params={{ id: a.resident_id }} className="mt-1 inline-flex items-center gap-1 text-xs underline">
                        {name} <ChevronRight className="h-3 w-3" />
                      </Link>
                    )}
                    <p className="mt-1 text-[10px] opacity-70">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      {a.status === "acknowledged" && " · Acknowledged"}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{a.severity}</Badge>
                </div>
                {tab === "open" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {a.status === "open" && (
                      <Button size="sm" variant="outline" onClick={() => ack.mutate(a.id)} disabled={ack.isPending}>
                        <Eye className="mr-1 h-3.5 w-3.5" />Acknowledge
                      </Button>
                    )}
                    <Button size="sm" onClick={() => resolve.mutate(a.id)} disabled={resolve.isPending}>
                      <Check className="mr-1 h-3.5 w-3.5" />Resolve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => dismiss.mutate(a.id)} disabled={dismiss.isPending}>
                      <X className="mr-1 h-3.5 w-3.5" />Dismiss
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>
      </Tabs>

      {tab === "open" && (
        <>
          <section className="mt-6">
            <div className="mb-2 flex items-center gap-2 px-1">
              <Flag className="h-4 w-4 text-destructive" />
              <h2 className="text-sm font-semibold tracking-tight">Flagged in AI notes</h2>
            </div>
            {flagged.data?.length ? (
              <ul className="divide-y rounded-2xl border bg-card">
                {flagged.data.map((n) => (
                  <li key={n.id}>
                    <Link to="/residents/$id" params={{ id: n.resident_id }} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/30">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{n.residents?.full_name}</div>
                        <p className="line-clamp-2 text-sm text-muted-foreground">{n.content}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(n.flags as string[]).map((f) => (
                            <Badge key={f} className="bg-destructive/15 text-destructive border-destructive/30 border text-[10px]">
                              <AlertTriangle className="mr-1 h-3 w-3" />{f.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-2xl border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">No flagged notes.</div>
            )}
          </section>

          <section className="mt-6">
            <div className="mb-2 flex items-center gap-2 px-1">
              <AlertTriangle className="h-4 w-4 text-warning-foreground" />
              <h2 className="text-sm font-semibold tracking-tight">Active risk assessments</h2>
            </div>
            {highRisks.data?.length ? (
              <ul className="divide-y rounded-2xl border bg-card">
                {highRisks.data.map((r) => (
                  <li key={r.id}>
                    <Link to="/residents/$id" params={{ id: r.resident_id }} className="flex items-center justify-between px-4 py-3 hover:bg-accent/30">
                      <div>
                        <div className="text-sm font-medium">{r.residents?.full_name}</div>
                        <div className="text-xs text-muted-foreground">{riskLabel(r.type as RiskType)}</div>
                      </div>
                      <Badge className={RISK_LEVEL_COLOR[r.level as "low"|"medium"|"high"]}>{r.level}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-2xl border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">No active risks above low.</div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
