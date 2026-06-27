import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ClipboardList, Filter, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetricLinkCard } from "@/components/governance/MetricLinkCard";
import {
  loadSubmissions,
  saveAllSubmissions,
  type AuditActionItem,
  type AuditSubmission,
  type ActionStatus,
} from "@/lib/audit-questions";

export const Route = createFileRoute("/_authenticated/action-plan")({
  head: () => ({ meta: [{ title: "Action Plan · CareCore" }] }),
  component: ActionPlanPage,
});

type Row = AuditActionItem & {
  auditTitle: string;
  auditKey: string;
  submissionId: string;
  completedAt: string;
  completedBy: string;
  unit?: string;
};

const PRIORITY_COLOUR: Record<string, string> = {
  high: "bg-status-critical text-white",
  medium: "bg-status-warning text-white",
  low: "bg-muted text-muted-foreground",
};
const STATUS_COLOUR: Record<ActionStatus, string> = {
  open: "bg-status-warning/20 text-status-warning",
  in_progress: "bg-primary/15 text-primary",
  done: "bg-status-stable/20 text-status-stable",
};
const STATUS_LABEL: Record<ActionStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

function flatten(subs: AuditSubmission[]): Row[] {
  return subs.flatMap((s) =>
    (s.actionPlan ?? []).map((a) => ({
      ...a,
      auditTitle: s.auditTitle,
      auditKey: s.auditKey,
      submissionId: s.id,
      completedAt: s.completedAt,
      completedBy: s.completedBy,
      unit: s.unit,
    })),
  );
}

function ActionPlanPage() {
  const [submissions, setSubmissions] = useState<AuditSubmission[]>(() => loadSubmissions());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ActionStatus>("all");
  const [auditFilter, setAuditFilter] = useState<string>("all");

  const rows = useMemo(() => flatten(submissions), [submissions]);

  const auditOptions = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach((r) => seen.set(r.auditKey, r.auditTitle));
    return Array.from(seen.entries()).map(([key, title]) => ({ key, title }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (statusFilter === "all" ? true : r.status === statusFilter))
      .filter((r) => (auditFilter === "all" ? true : r.auditKey === auditFilter))
      .filter((r) =>
        q
          ? [r.action, r.owner, r.auditTitle, r.questionText, r.unit].some((v) =>
              (v ?? "").toLowerCase().includes(q),
            )
          : true,
      )
      .sort((a, b) => {
        const order = (s: ActionStatus) => (s === "done" ? 2 : s === "in_progress" ? 1 : 0);
        if (order(a.status) !== order(b.status)) return order(a.status) - order(b.status);
        if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        const p = (x: string) => (x === "high" ? 0 : x === "medium" ? 1 : 2);
        return p(a.priority) - p(b.priority);
      });
  }, [rows, query, statusFilter, auditFilter]);

  const counts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: rows.length,
      open: rows.filter((r) => r.status === "open").length,
      inProgress: rows.filter((r) => r.status === "in_progress").length,
      overdue: rows.filter((r) => r.status !== "done" && r.dueDate && r.dueDate < today).length,
    };
  }, [rows]);

  const updateStatus = (submissionId: string, actionId: string, status: ActionStatus) => {
    const updated = submissions.map((s) =>
      s.id !== submissionId
        ? s
        : { ...s, actionPlan: (s.actionPlan ?? []).map((a) => (a.id === actionId ? { ...a, status } : a)) },
    );
    setSubmissions(updated);
    saveAllSubmissions(updated);
  };

  return (
    <AppShell title="Action Plan" subtitle="Every action from every audit, in one place">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricLinkCard label="Total actions" value={String(counts.total)} icon={ClipboardList} targetId="action-list" />
          <MetricLinkCard label="Open" value={String(counts.open)} icon={ClipboardList} targetId="action-list" />
          <MetricLinkCard label="In progress" value={String(counts.inProgress)} icon={ClipboardList} targetId="action-list" />
          <MetricLinkCard label="Overdue" value={String(counts.overdue)} icon={ClipboardList} targetId="action-list" />
        </div>

        <Card id="action-list" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="h-4 w-4 text-primary" />
              Filter actions
            </CardTitle>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              <Input
                placeholder="Search action, owner, audit…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
              <Select value={auditFilter} onValueChange={setAuditFilter}>
                <SelectTrigger><SelectValue placeholder="Audit" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All audits</SelectItem>
                  {auditOptions.map((o) => (
                    <SelectItem key={o.key} value={o.key}>{o.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No actions yet. Complete an audit on the <Link to="/audits" className="underline">Audits page</Link> — any "No" answer becomes an action here.
              </div>
            ) : (
              <ul className="space-y-3">
                {filtered.map((r) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const overdue = r.status !== "done" && r.dueDate && r.dueDate < today;
                  return (
                    <li key={`${r.submissionId}-${r.id}`} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{r.action || "(no action text)"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {r.auditTitle}{r.unit ? ` — ${r.unit}` : ""} · Owner: <strong className="text-foreground">{r.owner || "Unassigned"}</strong> · Due {r.dueDate || "—"}
                          </p>
                          {r.questionText && (
                            <p className="mt-1 text-xs text-muted-foreground italic">From: "{r.questionText}"</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={PRIORITY_COLOUR[r.priority]}>{r.priority}</Badge>
                          {overdue && <Badge className="bg-status-critical text-white">Overdue</Badge>}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={STATUS_COLOUR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                        {(["open", "in_progress", "done"] as ActionStatus[]).filter((s) => s !== r.status).map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(r.submissionId, r.id, s)}
                          >
                            Mark {STATUS_LABEL[s].toLowerCase()}
                          </Button>
                        ))}
                        <Link to="/audits" className="ml-auto text-xs text-primary hover:underline inline-flex items-center gap-1">
                          View audits <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
