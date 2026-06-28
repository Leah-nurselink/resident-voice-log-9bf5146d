import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useEffect } from "react";

export function NotificationBell() {
  const qc = useQueryClient();
  const notifs = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications").select("*")
        .order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  // Realtime subscription
  useEffect(() => {
    const ch = supabase.channel("notifications-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const unread = (notifs.data ?? []).filter((n) => !n.read_at).length;

  const markRead = async (id?: string) => {
    if (id) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    } else {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    }
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-3">
          <div className="text-sm font-medium">Notifications</div>
          {unread > 0 && (
            <button className="text-xs text-primary hover:underline" onClick={() => markRead()}>Mark all read</button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifs.data?.length ? notifs.data.map((n) => (
            <Link
              key={n.id}
              to={n.link ?? "/alerts"}
              onClick={() => markRead(n.id)}
              className={`block border-b p-3 text-sm hover:bg-accent/30 ${!n.read_at ? "bg-primary/5" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">{n.title}</div>
                {n.severity === "critical" && <Badge className="bg-destructive/15 text-destructive border-destructive/30 border text-[10px]">!</Badge>}
              </div>
              {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
              <p className="mt-1 text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
            </Link>
          )) : (
            <p className="p-4 text-center text-xs text-muted-foreground">No notifications</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
