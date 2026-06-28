// Resident-scoped Communications timeline + per-communication audit trail.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Phone, Mail, FileText, ArrowDownLeft, ArrowUpRight, History, Sparkles,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

type Comm = {
  id: string;
  direction: "outbound" | "inbound";
  channel: string;
  status: string;
  subject: string | null;
  body: string | null;
  ai_summary: string | null;
  transcript: string | null;
  outcome: string | null;
  call_provider: string | null;
  call_status: string | null;
  call_duration_seconds: number | null;
  contact_type: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  recipient_name: string | null;
  sender_name: string | null;
  created_at: string;
  sent_at: string | null;
  received_at: string | null;
};

type AuditRow = {
  id: string;
  action: string;
  actor_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

function channelIcon(c: string) {
  if (c === "phone") return <Phone className="h-3.5 w-3.5" />;
  if (c === "email") return <Mail className="h-3.5 w-3.5" />;
  return <FileText className="h-3.5 w-3.5" />;
}

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function CommunicationsTab({ residentId }: { residentId: string }) {
  const [filter, setFilter] = useState<"all" | "phone" | "email" | "inbound" | "outbound">("all");
  const [open, setOpen] = useState<Comm | null>(null);

  const comms = useQuery({
    queryKey: ["resident-comms", residentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communications")
        .select(
          "id,direction,channel,status,subject,body,ai_summary,transcript,outcome,call_provider,call_status,call_duration_seconds,contact_type,contact_name,contact_phone,recipient_name,sender_name,created_at,sent_at,received_at"
        )
        .eq("resident_id", residentId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Comm[];
    },
  });

  const filtered = (comms.data ?? []).filter((c) => {
    if (filter === "all") return true;
    if (filter === "phone" || filter === "email") return c.channel === filter;
    return c.direction === filter;
  });

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="phone">Calls</TabsTrigger>
          <TabsTrigger value="email">Emails</TabsTrigger>
          <TabsTrigger value="outbound">Outbound</TabsTrigger>
          <TabsTrigger value="inbound">Inbound</TabsTrigger>
        </TabsList>
        <TabsContent value={filter} className="mt-3">
          {comms.isLoading && <p className="text-sm text-muted-foreground">Loading communications…</p>}
          {!comms.isLoading && filtered.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No communications recorded for this resident yet. Use the <strong>Call</strong> button at the top of the profile to capture a call, or compose a message from the Communications hub.
              </CardContent>
            </Card>
          )}
          <ol className="space-y-2">
            {filtered.map((c) => {
              const partner = c.contact_name
                ?? (c.direction === "outbound" ? c.recipient_name : c.sender_name)
                ?? "Contact";
              const ts = c.sent_at ?? c.received_at ?? c.created_at;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setOpen(c)}
                    className="w-full rounded-lg border bg-card p-3 text-left hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary">
                          {channelIcon(c.channel)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {c.channel === "phone" ? "Call" : c.channel === "email" ? "Email" : c.channel} · {partner}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {format(new Date(ts), "d MMM yyyy HH:mm")} · {formatDistanceToNow(new Date(ts), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {c.direction === "outbound" ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownLeft className="h-3 w-3 mr-1" />}
                          {c.direction}
                        </Badge>
                        {c.channel === "phone" && c.call_duration_seconds ? (
                          <span className="text-[10px] text-muted-foreground">{formatDuration(c.call_duration_seconds)}</span>
                        ) : null}
                      </div>
                    </div>
                    {(c.ai_summary || c.subject) && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        {c.ai_summary ?? c.subject}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </TabsContent>
      </Tabs>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {open?.channel === "phone" ? "Call" : open?.channel === "email" ? "Email" : open?.channel}
              {" · "}{open?.contact_name ?? open?.recipient_name ?? open?.sender_name ?? "Contact"}
            </DialogTitle>
            {open && (
              <DialogDescription>
                {format(new Date(open.sent_at ?? open.received_at ?? open.created_at), "EEEE d MMM yyyy 'at' HH:mm")}
                {open.call_provider ? ` · via ${open.call_provider.replace(/_/g, " ")}` : ""}
              </DialogDescription>
            )}
          </DialogHeader>
          {open && <CommDetail comm={open} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CommDetail({ comm }: { comm: Comm }) {
  return (
    <Tabs defaultValue="summary">
      <TabsList>
        <TabsTrigger value="summary"><Sparkles className="h-3 w-3 mr-1" /> Summary</TabsTrigger>
        {comm.transcript && <TabsTrigger value="transcript">Transcript</TabsTrigger>}
        <TabsTrigger value="audit"><History className="h-3 w-3 mr-1" /> Audit trail</TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="mt-3 space-y-3 text-sm">
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px] capitalize">Status: {comm.status}</Badge>
          {comm.call_status && <Badge variant="outline" className="text-[10px] capitalize">Call: {comm.call_status.replace(/_/g, " ")}</Badge>}
          {comm.call_duration_seconds ? <Badge variant="outline" className="text-[10px]">Duration {formatDuration(comm.call_duration_seconds)}</Badge> : null}
          {comm.contact_phone && <Badge variant="outline" className="text-[10px]">{comm.contact_phone}</Badge>}
        </div>
        {comm.ai_summary && (
          <div className="rounded border bg-primary/5 p-3 text-sm">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">AI summary</p>
            <p className="whitespace-pre-wrap">{comm.ai_summary}</p>
          </div>
        )}
        {comm.outcome && (
          <div className="rounded border p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Outcome / next steps</p>
            <p className="whitespace-pre-wrap">{comm.outcome}</p>
          </div>
        )}
        {comm.body && (
          <div className="rounded border p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">Record</p>
            <pre className="whitespace-pre-wrap font-sans text-sm">{comm.body}</pre>
          </div>
        )}
      </TabsContent>

      {comm.transcript && (
        <TabsContent value="transcript" className="mt-3">
          <div className="max-h-[50vh] overflow-y-auto rounded border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
            {comm.transcript}
          </div>
        </TabsContent>
      )}

      <TabsContent value="audit" className="mt-3">
        <AuditTrail communicationId={comm.id} />
      </TabsContent>
    </Tabs>
  );
}

function AuditTrail({ communicationId }: { communicationId: string }) {
  const audit = useQuery({
    queryKey: ["comm-audit", communicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communication_audit")
        .select("id,action,actor_id,details,created_at")
        .eq("communication_id", communicationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  if (audit.isLoading) return <p className="text-sm text-muted-foreground">Loading audit…</p>;
  if (!audit.data?.length) return <p className="text-sm text-muted-foreground">No audit events recorded.</p>;

  return (
    <ol className="relative space-y-3 border-l pl-4">
      {audit.data.map((row) => (
        <li key={row.id} className="relative">
          <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-primary" />
          <div className="rounded border p-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium capitalize">{row.action.replace(/_/g, " ")}</span>
              <span className="text-muted-foreground">{format(new Date(row.created_at), "d MMM HH:mm:ss")}</span>
            </div>
            {row.actor_id && (
              <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">actor: {row.actor_id.slice(0, 8)}…</p>
            )}
            {row.details && Object.keys(row.details).length > 0 && (
              <pre className="mt-1 overflow-x-auto rounded bg-muted/40 p-1.5 text-[10px]">
                {JSON.stringify(row.details, null, 2)}
              </pre>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

