import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { riskLabel, RISK_LEVEL_COLOR, type RiskType } from "@/lib/care-domains";
import { AlertTriangle, ChevronRight, Flag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Alerts · ForgeAI" }] }),
  component: AlertsPage,
});

function AlertsPage() {
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

  return (
    <AppShell title="Alerts">
      <section>
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
    </AppShell>
  );
}
