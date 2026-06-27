import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar, FileText, Target, User } from "lucide-react";
import { domainLabel, type CarePlanDomain } from "@/lib/care-domains";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/care-plans")({
  head: () => ({ meta: [{ title: "Care Plans · CareCore" }] }),
  component: CarePlansPage,
});

function CarePlansPage() {
  const { data = [] } = useQuery({
    queryKey: ["care-plans-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_plans")
        .select("id, domain, needs, outcome, content, last_review, updated_at, resident_id, residents(full_name)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell title="Care Plans" subtitle="Person-centred plans across all residents">
      <div className="space-y-4">
        {data.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
            <p className="text-sm text-muted-foreground">No care plans yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Open a resident to add a plan in any care domain.
            </p>
          </div>
        )}
        {data.map((plan) => {
          const filled = [plan.needs, plan.outcome, plan.content].filter(Boolean).length;
          const progress = (filled / 3) * 100;
          const stale =
            plan.last_review &&
            Date.now() - new Date(plan.last_review).getTime() > 90 * 86400000;

          return (
            <Card key={plan.id} className="transition hover:shadow-soft">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {domainLabel(plan.domain as CarePlanDomain)}
                    </CardTitle>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {plan.residents?.full_name}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Updated {formatDistanceToNow(new Date(plan.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {stale && (
                      <Badge className="bg-care-attention/20 text-care-attention border-care-attention/40">
                        Needs review
                      </Badge>
                    )}
                    <Badge className="bg-care-on-track/15 text-care-on-track border-care-on-track/40">
                      Active
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Target className="h-3 w-3" /> Plan completeness
                  </span>
                  <span className="text-muted-foreground">{filled} of 3 sections</span>
                </div>
                <Progress value={progress} className="h-2" />
                {plan.content && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{plan.content}</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/residents/$id" params={{ id: plan.resident_id }}>
                      <FileText className="mr-1 h-3 w-3" /> Open
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
