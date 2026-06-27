import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export function RecentActivity() {
  const { data } = useQuery({
    queryKey: ["recent-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_notes")
        .select("id, content, created_at, resident_id, residents(full_name)")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data?.length ? (
          data.map((n) => (
            <Link
              key={n.id}
              to="/residents/$id"
              params={{ id: n.resident_id }}
              className="block rounded-lg p-2 -mx-2 transition hover:bg-accent/40"
            >
              <p className="text-sm font-medium">{n.residents?.full_name}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{n.content}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
              </p>
            </Link>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        )}
      </CardContent>
    </Card>
  );
}
