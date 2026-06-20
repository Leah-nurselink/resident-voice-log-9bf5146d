import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, ArrowRight } from "lucide-react";
import { residents } from "@/lib/mock-data";
import { getEntries } from "@/lib/care-plan-data";

export const Route = createFileRoute("/_app/care-plans/")({
  head: () => ({
    meta: [
      { title: "Care plans · Caresound" },
      { name: "description", content: "Manage and update resident care plans and risk assessments." },
    ],
  }),
  component: CarePlansIndex,
});

function CarePlansIndex() {
  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Care plans</h1>
          <p className="text-sm text-muted-foreground">
            Document or update care plan domains and risk assessments — by typing or by voice.
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {residents.map((r) => {
          const entries = getEntries(r.id);
          return (
            <Link
              key={r.id}
              to="/care-plans/$id"
              params={{ id: r.id }}
              className="group rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-3">
                <img src={r.photo} alt="" className="h-12 w-12 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Room {r.room} · {r.unit}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{entries.length} entries</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground capitalize">
                  {r.riskLevel} risk
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
