import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Activity, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type NoteRow = {
  id: string;
  resident_id: string;
  content: string;
  domain: string | null;
  created_at: string;
  status: string;
  source: string | null;
};

type ResidentRow = { id: string; full_name: string };

export function LiveCareActivity() {
  const [live, setLive] = useState<NoteRow[]>([]);

  const initial = useQuery({
    queryKey: ["live-care-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_notes")
        .select("id, resident_id, content, domain, created_at, status, source")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as NoteRow[];
    },
  });

  const residents = useQuery({
    queryKey: ["live-care-residents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("residents").select("id, full_name");
      if (error) throw error;
      return new Map(((data ?? []) as ResidentRow[]).map((r) => [r.id, r.full_name]));
    },
  });

  useEffect(() => {
    if (initial.data) setLive(initial.data);
  }, [initial.data]);

  useEffect(() => {
    const channel = supabase
      .channel("live-care-activity")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "daily_notes" },
        (payload) => {
          const row = payload.new as NoteRow;
          setLive((prev) => [row, ...prev].slice(0, 8));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className="h-4 w-4 text-primary" />
          Live care activity
        </CardTitle>
        <Badge variant="outline" className="gap-1 text-[10px]">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          real-time
        </Badge>
      </CardHeader>
      <CardContent>
        {live.length === 0 ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            Waiting for carer activity…
          </div>
        ) : (
          <ul className="divide-y">
            {live.map((n) => {
              const name = residents.data?.get(n.resident_id) ?? "Resident";
              return (
                <li key={n.id} className="py-3">
                  <Link
                    to="/residents/$id"
                    params={{ id: n.resident_id }}
                    className="block hover:opacity-80"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{name}</div>
                        <div className="line-clamp-2 text-xs text-muted-foreground">
                          {n.content}
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(n.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="mt-1 flex gap-1">
                      {n.domain && (
                        <Badge variant="secondary" className="text-[10px]">
                          {n.domain}
                        </Badge>
                      )}
                      {n.source === "voice" && (
                        <Badge variant="outline" className="text-[10px]">
                          voice
                        </Badge>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
