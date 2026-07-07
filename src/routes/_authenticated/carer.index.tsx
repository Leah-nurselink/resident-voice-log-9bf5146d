import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mic, Users, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/carer/")({
  head: () => ({ meta: [{ title: "Today · ForgeAI" }] }),
  component: TodayPage,
});

function TodayPage() {
  const recent = useQuery({
    queryKey: ["carer-recent-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_sessions")
        .select("id, resident_id, started_at, ended_at, residents(full_name)")
        .order("started_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Good day</h1>
        <p className="text-sm text-muted-foreground">
          Walk into a resident's room to start a session automatically.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div>
            <div className="text-sm font-medium">Start a care session</div>
            <div className="text-xs text-muted-foreground">
              Bluetooth detects the room and resident.
            </div>
          </div>
          <Button asChild size="lg" className="rounded-full">
            <Link to="/carer/capture">
              <Mic className="mr-1 h-4 w-4" /> Capture
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium">Recent sessions</div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/residents">
                <Users className="mr-1 h-3.5 w-3.5" /> All residents
              </Link>
            </Button>
          </div>
          {recent.data && recent.data.length > 0 ? (
            <ul className="divide-y text-sm">
              {recent.data.map((s: any) => (
                <li key={s.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium">
                      {s.residents?.full_name ?? "Unknown resident"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.started_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {s.ended_at ? " · ended" : " · in progress"}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
