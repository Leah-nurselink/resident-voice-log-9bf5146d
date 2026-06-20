import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  ShieldAlert,
  HeartPulse,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CarePlanEditor } from "@/components/CarePlanEditor";
import { residents, type Resident } from "@/lib/mock-data";
import {
  CARE_PLAN_DOMAINS,
  RISK_ASSESSMENTS,
  deleteEntry,
  getEntries,
  type CarePlanEntry,
} from "@/lib/care-plan-data";

export const Route = createFileRoute("/_app/care-plans/$id")({
  loader: ({ params }) => {
    const resident = residents.find((r) => r.id === params.id);
    if (!resident) throw notFound();
    return { resident };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `Care plan · ${loaderData?.resident.name ?? "Resident"} · Caresound` },
      { name: "description", content: "Care plan domains and risk assessments." },
    ],
  }),
  notFoundComponent: () => (
    <div className="rounded-xl border border-border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">Resident not found.</p>
      <Link to="/care-plans" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
        Back to care plans
      </Link>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="rounded-xl border border-border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">Something went wrong.</p>
      <Button className="mt-3" onClick={reset}>Try again</Button>
    </div>
  ),
  component: CarePlanDetail,
});

function CarePlanDetail() {
  const { resident } = Route.useLoaderData() as { resident: Resident };
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CarePlanEntry | null>(null);
  const [preset, setPreset] = useState<{ kind: "domain" | "risk"; area: string } | null>(null);

  const entries = useMemo(() => getEntries(resident.id), [resident.id, tick]);
  const byArea = useMemo(() => {
    const map = new Map<string, CarePlanEntry>();
    for (const e of entries) {
      const prev = map.get(e.area);
      if (!prev || e.updatedAt > prev.updatedAt) map.set(e.area, e);
    }
    return map;
  }, [entries]);

  const openNew = (kind: "domain" | "risk", area: string) => {
    setEditing(null);
    setPreset({ kind, area });
    setOpen(true);
  };
  const openEdit = (entry: CarePlanEntry) => {
    setEditing(entry);
    setPreset(null);
    setOpen(true);
  };
  const remove = (id: string) => {
    deleteEntry(id);
    setTick((t) => t + 1);
  };

  // Apply preset by seeding a synthetic "existing" without id so editor shows defaults
  const editorExisting: CarePlanEntry | null = editing ?? (preset
    ? {
        id: "",
        residentId: resident.id,
        kind: preset.kind,
        area: preset.area as CarePlanEntry["area"],
        transcript: "",
        content: "",
        author: "",
        updatedAt: "",
      }
    : null);
  // editor treats id="" as "new" — pass null in that case but keep the preset by syncing via key
  const editorKey = `${open}-${editing?.id ?? preset?.area ?? "new"}`;

  return (
    <div className="space-y-6">
      <Link
        to="/care-plans"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All care plans
      </Link>

      <header className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start gap-4">
          <img src={resident.photo} alt="" className="h-16 w-16 rounded-2xl object-cover ring-2 ring-secondary" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{resident.name}</h1>
            <p className="text-sm text-muted-foreground">
              Room {resident.room} · {resident.unit} · {entries.length} plan entries
            </p>
          </div>
          <Button onClick={() => { setEditing(null); setPreset(null); setOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> New entry
          </Button>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Care plan domains
          </h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {CARE_PLAN_DOMAINS.map((d) => {
            const entry = byArea.get(d);
            return (
              <article key={d} className="rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium">{d}</h3>
                    {entry?.reviewDue && (
                      <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarClock className="h-3 w-3" />
                        Review {new Date(entry.reviewDue).toLocaleDateString("en-GB")}
                      </div>
                    )}
                  </div>
                  {entry ? (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(entry)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(entry.id)} aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => openNew("domain", d)}>
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  )}
                </div>
                {entry ? (
                  <>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{entry.content}</p>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      Updated {new Date(entry.updatedAt).toLocaleString("en-GB")} · {entry.author}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm italic text-muted-foreground">No entry yet.</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Risk assessments
          </h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {RISK_ASSESSMENTS.map((r) => {
            const entry = byArea.get(r);
            return (
              <article key={r} className="rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium">{r}</h3>
                    {entry?.reviewDue && (
                      <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarClock className="h-3 w-3" />
                        Review {new Date(entry.reviewDue).toLocaleDateString("en-GB")}
                      </div>
                    )}
                  </div>
                  {entry ? (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(entry)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(entry.id)} aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => openNew("risk", r)}>
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  )}
                </div>
                {entry ? (
                  <>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{entry.content}</p>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      Updated {new Date(entry.updatedAt).toLocaleString("en-GB")} · {entry.author}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm italic text-muted-foreground">Not assessed yet.</p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <CarePlanEditor
        key={editorKey}
        resident={resident}
        open={open}
        onOpenChange={setOpen}
        existing={editorExisting}
        onSaved={() => setTick((t) => t + 1)}
      />
    </div>
  );
}
