import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  Clock,
  Mic,
  TrendingUp,
  Users,
  ListChecks,
} from "lucide-react";
import { careNotes, residents } from "@/lib/mock-data";
import { dueTasks } from "@/lib/care-links";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Dashboard · Caresound" },
      { name: "description", content: "AI care scribe — manager dashboard for care homes and nursing services." },
    ],
  }),
  component: Dashboard,
});

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Users;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const tones = {
    default: "bg-primary/10 text-primary",
    warning: "bg-warning/20 text-warning-foreground",
    danger: "bg-destructive/10 text-destructive",
    success: "bg-success/15 text-success",
  } as const;
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Dashboard() {
  const flagged = useMemo(() => careNotes.filter((n) => n.flags.length > 0), []);
  const awaitingApproval = useMemo(
    () =>
      careNotes
        .filter((n) => n.status === "draft")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [],
  );
  const tasks = useMemo(() => dueTasks(careNotes), []);
  const highRisk = residents.filter((r) => r.riskLevel === "high");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Good morning, Aisha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's what's happening across Lavender and Oakwood Wings today.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Residents" value={String(residents.length)} hint="Across 2 wings" icon={Users} />
        <StatCard
          label="Notes today"
          value={String(careNotes.length)}
          hint="Documented via voice"
          icon={Mic}
          tone="success"
        />
        <StatCard
          label="Tasks due"
          value={String(tasks.length)}
          hint="Across all residents"
          icon={ListChecks}
          tone="warning"
        />
        <StatCard
          label="Awaiting approval"
          value={String(awaitingApproval.length)}
          hint="AI notes to review"
          icon={ClipboardCheck}
          tone="danger"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {/* Requiring attention */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Residents requiring attention</h2>
            <span className="text-xs text-muted-foreground">{tasks.length} open</span>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {tasks.slice(0, 6).map((t, i) => (
              <li key={`${t.resident.id}-${t.kind}-${i}`} className="flex items-center gap-3 py-3">
                <img src={t.resident.photo} alt="" className="h-9 w-9 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="font-medium">{t.resident.name}</span>
                    <span className="text-xs text-muted-foreground">· Room {t.resident.room}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {t.kind} · {t.hoursOverdue}h overdue
                  </div>
                </div>
                <Link
                  to="/residents/$id"
                  params={{ id: t.resident.id }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Open
                </Link>
              </li>
            ))}
            {tasks.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                Everyone is up to date.
              </li>
            )}
          </ul>
        </div>

        {/* High-risk */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">High-risk residents</h2>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <ul className="mt-4 space-y-3">
            {highRisk.map((r) => (
              <li key={r.id}>
                <Link
                  to="/residents/$id"
                  params={{ id: r.id }}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary"
                >
                  <img src={r.photo} alt="" className="h-10 w-10 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Room {r.room} · {r.unit}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
            {highRisk.length === 0 && (
              <li className="text-sm text-muted-foreground">No high-risk residents.</li>
            )}
          </ul>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {/* Awaiting approval */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">AI notes awaiting approval</h2>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <ul className="mt-4 divide-y divide-border">
            {awaitingApproval.map((n) => {
              const r = residents.find((x) => x.id === n.residentId);
              return (
                <li key={n.id} className="flex items-start gap-3 py-3">
                  <div className="mt-1 grid h-8 w-8 place-items-center rounded-full bg-warning/20 text-warning-foreground">
                    <ClipboardCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 text-sm">
                      <span className="font-medium">{r?.name}</span>
                      <span className="text-xs text-muted-foreground">· {n.category}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.note}</p>
                  </div>
                  <Link
                    to="/residents/$id"
                    params={{ id: n.residentId }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Review
                  </Link>
                </li>
              );
            })}
            {awaitingApproval.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                No notes pending review.
              </li>
            )}
          </ul>
        </div>

        {/* Recent flagged */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Recent flags</h2>
            <Link to="/alerts" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {flagged.slice(0, 5).map((n) => {
              const r = residents.find((x) => x.id === n.residentId);
              return (
                <li key={n.id} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{r?.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{n.flags.join(", ")}</div>
                  </div>
                </li>
              );
            })}
            {flagged.length === 0 && (
              <li className="text-sm text-muted-foreground">No flags.</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
