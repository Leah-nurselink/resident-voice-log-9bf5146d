import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Repeat, ClipboardCheck } from "lucide-react";
import { careNotes, residents } from "@/lib/mock-data";
import { detectRiskPatterns, RISK_LABEL } from "@/lib/care-links";

export const Route = createFileRoute("/_app/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts · Caresound" },
      { name: "description", content: "Incident and safeguarding alerts detected across the service." },
    ],
  }),
  component: Alerts,
});

function Alerts() {
  const flagged = careNotes
    .filter((n) => n.flags.length > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const patterns = detectRiskPatterns(careNotes, 7, 3);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI-detected incidents and patterns that need a senior to follow up.
        </p>
      </header>

      {/* Pattern detection */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pattern detection · review suggested
          </h2>
        </div>
        {patterns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No repeating risk patterns in the last 7 days.
          </div>
        ) : (
          <ul className="space-y-3">
            {patterns.map((p) => (
              <li
                key={`${p.residentId}-${p.risk}`}
                className="rounded-xl border border-warning/40 bg-warning/5 p-4 shadow-card"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-warning/20 text-warning-foreground">
                    <ClipboardCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{p.resident.name}</span>
                      <span className="text-xs text-muted-foreground">Room {p.resident.room}</span>
                      <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-medium text-warning-foreground">
                        {RISK_LABEL[p.risk]} · {p.count} notes / {p.windowDays}d
                      </span>
                    </div>
                    <p className="mt-1 text-sm">
                      Repeated {RISK_LABEL[p.risk].toLowerCase()} observations detected. Consider
                      reviewing the {RISK_LABEL[p.risk].toLowerCase()} risk assessment.
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <Link
                        to="/care-plans/$id"
                        params={{ id: p.residentId }}
                        className="font-medium text-primary hover:underline"
                      >
                        Review care plan →
                      </Link>
                      <Link
                        to="/residents/$id"
                        params={{ id: p.residentId }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        View timeline
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Incident flags */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Incident flags
          </h2>
        </div>
        <ul className="space-y-3">
          {flagged.map((n) => {
            const r = residents.find((x) => x.id === n.residentId);
            return (
              <li
                key={n.id}
                className="rounded-xl border border-destructive/30 bg-card p-4 shadow-card"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r?.name}</span>
                      <span className="text-xs text-muted-foreground">Room {r?.room}</span>
                      {n.flags.map((f) => (
                        <span
                          key={f}
                          className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-sm">{n.note}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{n.author}</span>
                      <Link
                        to="/residents/$id"
                        params={{ id: n.residentId }}
                        className="font-medium text-primary hover:underline"
                      >
                        Open resident →
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
          {flagged.length === 0 && (
            <li className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No active alerts.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
