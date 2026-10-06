import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const priorityColor: Record<string, string> = {
  high: "bg-care-urgent/15 text-care-urgent border-care-urgent/40",
  urgent: "bg-care-urgent/15 text-care-urgent border-care-urgent/40",
  medium: "bg-care-attention/20 text-care-attention border-care-attention/40",
  low: "bg-care-on-track/15 text-care-on-track border-care-on-track/40",
};

export function TasksList() {
  const { data = [] } = useQuery({
    queryKey: ["dashboard-open-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communication_tasks")
        .select("id, title, due_date, priority, status, residents(full_name)")
        .neq("status", "done")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          Open Tasks
        </CardTitle>
        <Link to="/tasks" className="text-xs text-primary hover:underline">View all</Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.length === 0 && <p className="text-sm text-muted-foreground">No open tasks.</p>}
        {data.map((t: any) => {
          const overdue = t.due_date && t.due_date < today;
          return (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                <p className={`text-xs ${overdue ? "text-care-urgent" : "text-muted-foreground"}`}>
                  {t.residents?.full_name ?? "No resident"}
                  {t.due_date ? ` · due ${t.due_date}${overdue ? " (overdue)" : ""}` : ""}
                </p>
              </div>
              <Badge variant="outline" className={priorityColor[t.priority] ?? ""}>{t.priority}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
