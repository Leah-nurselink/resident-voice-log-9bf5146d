import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Heart, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/family")({
  head: () => ({ meta: [{ title: "Family · ForgeAI" }] }),
  component: FamilyPage,
});

function FamilyPage() {
  const recent = useQuery({
    queryKey: ["family-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_notes")
        .select("id, content, created_at, residents(full_name)")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell title="Family portal">
      <div className="mb-4 rounded-2xl border bg-secondary/40 p-4">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Approved updates families can see</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Only notes marked as approved are shared with linked family members.
        </p>
      </div>

      {recent.data?.length ? (
        <ul className="space-y-2">
          {recent.data.map((n) => (
            <li key={n.id} className="rounded-2xl border bg-card p-3">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{n.residents?.full_name}</span>
                <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
              </div>
              <p className="text-sm">{n.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
          <MessageCircle className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No approved updates yet.</p>
        </div>
      )}
    </AppShell>
  );
}
