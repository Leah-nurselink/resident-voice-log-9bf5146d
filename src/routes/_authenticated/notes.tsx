import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { domainLabel, type CarePlanDomain } from "@/lib/care-domains";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Daily Notes · CareCore" }] }),
  component: NotesPage,
});

function NotesPage() {
  const { data = [] } = useQuery({
    queryKey: ["all-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_notes")
        .select("id, content, domain, status, flags, created_at, resident_id, residents(full_name, room_number)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell title="Daily Notes" subtitle="Care observations across the home">
      <div className="space-y-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
            <MessageSquare className="h-4 w-4 text-primary" />
            Notes are captured by carers via voice or text and structured by AI. Open a resident's profile to add a new note.
          </CardContent>
        </Card>

        {data.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">
            No notes yet — record one from a resident profile.
          </div>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {data.map((n) => (
              <li key={n.id}>
                <Link
                  to="/residents/$id"
                  params={{ id: n.resident_id }}
                  className="flex items-start gap-3 px-4 py-3 transition hover:bg-accent/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{n.residents?.full_name}</span>
                      {n.residents?.room_number && (
                        <span className="text-xs text-muted-foreground">Room {n.residents.room_number}</span>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {domainLabel(n.domain as CarePlanDomain)}
                      </Badge>
                      {n.status === "draft" && (
                        <Badge variant="outline" className="text-[10px] border-care-attention/40 text-care-attention">
                          Draft
                        </Badge>
                      )}
                      {Array.isArray(n.flags) &&
                        n.flags.length > 0 && (
                          <Badge className="text-[10px] bg-care-urgent/15 text-care-urgent border-care-urgent/40">
                            Flag
                          </Badge>
                        )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.content}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
