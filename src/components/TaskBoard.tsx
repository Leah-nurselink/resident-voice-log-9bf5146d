import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Clock, Sparkles, Mail, User, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type Task = {
  id: string;
  resident_id: string | null;
  communication_id: string | null;
  recommendation_id: string | null;
  source: string;
  kind: string;
  title: string;
  detail: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
};

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "today", label: "Due today or overdue" },
  { value: "mine", label: "Assigned to me" },
  { value: "all", label: "All" },
] as const;

export function TaskBoard() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("open");

  const me = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  const staff = useQuery({
    queryKey: ["staff-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const residents = useQuery({
    queryKey: ["resident-names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("residents").select("id, full_name");
      if (error) throw error;
      return data;
    },
  });

  const tasks = useQuery({
    queryKey: ["tasks-board"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communication_tasks")
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as unknown as Task[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const list = (tasks.data ?? []).filter((t) => {
    if (filter === "all") return true;
    if (filter === "open") return t.status === "open" || t.status === "in_progress";
    if (filter === "mine") return t.assigned_to === me.data && t.status !== "done";
    if (filter === "today") return t.status !== "done" && !!t.due_date && t.due_date <= today;
    return true;
  });

  const residentName = (id: string | null) =>
    residents.data?.find((r) => r.id === id)?.full_name ?? null;

  async function patch(id: string, values: Record<string, unknown>) {
    const { error } = await supabase.from("communication_tasks").update(values as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["tasks-board"] });
    qc.invalidateQueries({ queryKey: ["comm-tasks"] });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{list.length} shown</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {list.map((t) => {
              const overdue = t.due_date && t.due_date < today && t.status !== "done";
              return (
                <div key={t.id} className="flex flex-wrap items-start gap-3 p-3">
                  <div className="mt-1">
                    {t.status === "done" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      : t.priority === "urgent" ? <AlertTriangle className="h-4 w-4 text-destructive" />
                      : <Clock className={`h-4 w-4 ${overdue ? "text-destructive" : "text-muted-foreground"}`} />}
                  </div>
                  <div className="min-w-[14rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm font-medium ${t.status === "done" ? "text-muted-foreground line-through" : ""}`}>
                        {t.title}
                      </p>
                      <Badge variant="secondary" className="text-[10px]">{t.kind.replace(/_/g, " ")}</Badge>
                      <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                      {t.source === "ai_recommendation"
                        ? <Badge variant="outline" className="gap-1 text-[10px]"><Sparkles className="h-3 w-3" />From AI insight</Badge>
                        : t.communication_id
                          ? <Badge variant="outline" className="gap-1 text-[10px]"><Mail className="h-3 w-3" />From message</Badge>
                          : null}
                      {t.due_date && (
                        <span className={`text-[10px] ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                          due {format(new Date(t.due_date), "d MMM")}
                        </span>
                      )}
                    </div>
                    {t.detail && <p className="mt-0.5 text-xs text-muted-foreground">{t.detail}</p>}
                    {t.resident_id && (
                      <Link
                        to="/residents/$id"
                        params={{ id: t.resident_id }}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <User className="h-3 w-3" />{residentName(t.resident_id) ?? "Resident"}
                      </Link>
                    )}
                  </div>

                  <Select
                    value={t.assigned_to ?? "unassigned"}
                    onValueChange={(v) => patch(t.id, { assigned_to: v === "unassigned" ? null : v })}
                  >
                    <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {(staff.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.full_name ?? "Staff member"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={t.status}
                    onValueChange={(v) =>
                      patch(t.id, {
                        status: v,
                        completed_at: v === "done" ? new Date().toISOString() : null,
                        completed_by: v === "done" ? me.data : null,
                      })
                    }
                  >
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                      <SelectItem value="dismissed">Dismissed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
            {!list.length && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nothing here. Tasks appear from inbound professional emails and from AI insights you turn into actions.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
