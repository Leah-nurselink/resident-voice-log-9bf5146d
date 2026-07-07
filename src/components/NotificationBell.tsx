import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Bell, Github } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useMemo } from "react";
import { getGitHubNotifications, markGitHubNotificationRead } from "@/lib/github-notifications.functions";

type CareNotification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: string | null;
  created_at: string;
  read_at: string | null;
  source: "care";
};

type UnifiedNotification = CareNotification | Awaited<ReturnType<typeof getGitHubNotifications>>[number];

export function NotificationBell() {
  const qc = useQueryClient();
  const fetchGitHub = useServerFn(getGitHubNotifications);
  const markGitHubRead = useServerFn(markGitHubNotificationRead);

  const careNotifs = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications").select("*")
        .order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return (data ?? []).map((n): CareNotification => ({ ...n, source: "care" }));
    },
    refetchInterval: 30_000,
  });

  const gitHubNotifs = useQuery({
    queryKey: ["notifications", "github"],
    queryFn: async () => fetchGitHub(),
    refetchInterval: 60_000,
    retry: 1,
  });

  const allNotifications = useMemo(() => {
    const care = (careNotifs.data ?? []) as UnifiedNotification[];
    const github = (gitHubNotifs.data ?? []) as UnifiedNotification[];
    return [...care, ...github]
      .filter((n) => !n.read_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [careNotifs.data, gitHubNotifs.data]);

  // Realtime subscription for care notifications
  useEffect(() => {
    const ch = supabase.channel("notifications-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const unread = allNotifications.length;

  const markRead = async (n?: UnifiedNotification) => {
    if (!n) {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
      await Promise.all(
        (gitHubNotifs.data ?? [])
          .filter((g) => !g.read_at)
          .map((g) => markGitHubRead({ data: { threadId: g.thread_id } })),
      );
    } else if (n.source === "care") {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
    } else if (n.source === "github") {
      await markGitHubRead({ data: { threadId: n.thread_id } });
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
          {allNotifications.length ? allNotifications.map((n) => (
            <Link
              key={n.id}
              to={n.link ?? "/alerts"}
              onClick={() => markRead(n)}
              className="block border-b p-3 text-sm hover:bg-accent/30 bg-primary/5"
              target={n.source === "github" ? "_blank" : undefined}
              rel={n.source === "github" ? "noreferrer" : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium flex items-center gap-1.5">
                  {n.source === "github" && <Github className="h-3.5 w-3.5" />}
                  {n.title}
                </div>
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
