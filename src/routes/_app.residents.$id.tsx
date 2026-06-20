import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Mic, Phone, ShieldAlert, Tag, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Timeline } from "@/components/Timeline";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { careNotes as seedNotes, residents, type CareNote, type Resident } from "@/lib/mock-data";
import { RESIDENT_RISKS, RISK_LABEL, RISK_TONE } from "@/lib/care-links";

export const Route = createFileRoute("/_app/residents/$id")({
  loader: ({ params }) => {
    const resident = residents.find((r) => r.id === params.id);
    if (!resident) throw notFound();
    return { resident };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.resident.name ?? "Resident"} · Caresound` },
      { name: "description", content: "Resident timeline, care plan and AI-assisted documentation." },
    ],
  }),
  notFoundComponent: () => (
    <div className="rounded-xl border border-border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">Resident not found.</p>
      <Link to="/residents" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
        Back to residents
      </Link>
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div className="rounded-xl border border-border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">Something went wrong loading this resident.</p>
      <Button className="mt-3" onClick={reset}>Try again</Button>
    </div>
  ),
  component: ResidentDetail,
});

const riskTones = {
  low: "bg-success/15 text-success",
  medium: "bg-warning/20 text-warning-foreground",
  high: "bg-destructive/15 text-destructive",
} as const;

function ResidentDetail() {
  const { resident } = Route.useLoaderData() as { resident: Resident };
  const [open, setOpen] = useState(false);
  const [extraNotes, setExtraNotes] = useState<CareNote[]>([]);

  const notes = useMemo(
    () =>
      [...extraNotes, ...seedNotes]
        .filter((n) => n.residentId === resident.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [extraNotes, resident.id],
  );

  return (
    <div className="space-y-6">
      <Link
        to="/residents"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All residents
      </Link>

      <header className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start gap-5">
          <img
            src={resident.photo}
            alt=""
            className="h-20 w-20 rounded-2xl object-cover ring-2 ring-secondary"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{resident.name}</h1>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${riskTones[resident.riskLevel]}`}
              >
                {resident.riskLevel} risk
              </span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Prefers <span className="text-foreground">{resident.preferredName}</span> · Room{" "}
              {resident.room} · {resident.unit}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Tag className="h-3 w-3" /> Tag {resident.tagId}
              </span>
              <span>DOB {new Date(resident.dob).toLocaleDateString("en-GB")}</span>
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {resident.emergencyContact.name} ({resident.emergencyContact.relation})
              </span>
            </div>
          </div>
          <Button size="lg" onClick={() => setOpen(true)} className="gap-2">
            <Mic className="h-5 w-5" />
            Document care
          </Button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Care timeline
          </h2>
          <Timeline notes={notes} />
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <h3 className="text-sm font-semibold">Care plan domains</h3>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {resident.carePlanDomains.map((d) => (
                <li
                  key={d}
                  className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
                >
                  {d}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <h3 className="text-sm font-semibold">Risk assessments</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {["Falls", "Skin integrity", "Nutrition (MUST)", "Moving & handling"].map((r) => (
                <li key={r} className="flex items-center justify-between">
                  <span>{r}</span>
                  <span className="text-xs text-muted-foreground">Reviewed 12 Jun</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-card">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="h-4 w-4 text-primary" /> Family
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              {resident.family.map((f) => (
                <li key={f.name}>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {f.relation} · {f.phone}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      <VoiceRecorder
        resident={resident}
        open={open}
        onOpenChange={setOpen}
        onSave={(n) => setExtraNotes((prev) => [n, ...prev])}
      />
    </div>
  );
}
