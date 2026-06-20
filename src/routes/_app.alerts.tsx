import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { careNotes, residents } from "@/lib/mock-data";

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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI-detected incidents that need a senior to follow up.
        </p>
      </header>

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
    </div>
  );
}
