import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Pill } from "lucide-react";
import { format } from "date-fns";
import {
  dueDosesForDay, statusMeta, type Administration, type Medication,
} from "@/lib/medications";
import { RecordDoseDialog } from "@/components/MedicationAdministration";

export const Route = createFileRoute("/_authenticated/medication-round")({
  head: () => ({
    meta: [
      { title: "Medication round · CareCore" },
      { name: "description", content: "Today's medication administration record: every dose due across all residents, with one-tap recording." },
      { property: "og:title", content: "Medication round · CareCore" },
      { property: "og:description", content: "Today's medication administration record across all residents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MedicationRound,
});

type Resident = { id: string; full_name: string; room_number: string | null; allergies: string | null };

function MedicationRound() {
  const today = new Date();
  const dateKey = format(today, "yyyy-MM-dd");
  const [recording, setRecording] = useState<{ med: Medication; time: string | null; allergies: string | null } | null>(null);
  const [onlyOutstanding, setOnlyOutstanding] = useState(true);

  const { data } = useQuery({
    queryKey: ["med-round", dateKey],
    queryFn: async () => {
      const [residents, meds, admins] = await Promise.all([
        supabase.from("residents").select("id, full_name, room_number, allergies").order("full_name"),
        supabase.from("medications").select("*").eq("status", "active"),
        supabase.from("medication_administrations").select("*").gte("administered_at", `${dateKey}T00:00:00`),
      ]);
      return {
        residents: (residents.data ?? []) as Resident[],
        meds: (meds.data ?? []) as unknown as Medication[],
        admins: (admins.data ?? []) as unknown as Administration[],
      };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    return data.residents
      .map((r) => {
        const meds = data.meds.filter((m) => m.resident_id === r.id);
        const admins = data.admins.filter((a) => a.resident_id === r.id);
        const due = dueDosesForDay(meds, admins, today);
        const prn = meds.filter((m) => m.is_prn);
        return { resident: r, due, prn };
      })
      .filter((row) => row.due.length > 0 || row.prn.length > 0);
  }, [data]);

  const outstanding = rows.reduce((n, r) => n + r.due.filter((d) => !d.administration).length, 0);

  return (
    <AppShell title="Medication round" subtitle={`${format(today, "EEEE d MMMM")} · ${outstanding} dose${outstanding === 1 ? "" : "s"} still to record`}>
      <div className="mb-3 flex gap-2">
        <Button size="sm" variant={onlyOutstanding ? "default" : "outline"} onClick={() => setOnlyOutstanding(true)}>Still to give</Button>
        <Button size="sm" variant={onlyOutstanding ? "outline" : "default"} onClick={() => setOnlyOutstanding(false)}>Everything today</Button>
      </div>

      {!data && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data && rows.length === 0 && <p className="text-sm text-muted-foreground">No medications are set up yet.</p>}

      <div className="space-y-4">
        {rows.map(({ resident, due, prn }) => {
          const visible = onlyOutstanding ? due.filter((d) => !d.administration) : due;
          if (onlyOutstanding && visible.length === 0) return null;
          return (
            <section key={resident.id} className="rounded-2xl border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <Link to="/residents/$id" params={{ id: resident.id }} className="text-sm font-semibold hover:underline">
                  {resident.full_name}
                </Link>
                {resident.room_number && <Badge variant="outline" className="text-[10px]">Room {resident.room_number}</Badge>}
              </div>

              <ul className="space-y-2">
                {visible.map((d) => (
                  <li key={d.key}>
                    <button
                      type="button"
                      onClick={() => !d.administration && setRecording({ med: d.medication, time: d.time, allergies: resident.allergies })}
                      className="flex w-full items-center justify-between rounded-xl border p-2.5 text-left"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{d.time}</span>
                        <span>{d.medication.name}</span>
                        <span className="text-xs text-muted-foreground">{d.medication.dose}</span>
                      </span>
                      {d.administration
                        ? <Badge className={statusMeta(d.administration.status).tone}>{statusMeta(d.administration.status).label}</Badge>
                        : <Badge variant="outline">Record</Badge>}
                    </button>
                  </li>
                ))}
                {!onlyOutstanding && prn.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setRecording({ med: m, time: null, allergies: resident.allergies })}
                      className="flex w-full items-center justify-between rounded-xl border border-dashed p-2.5 text-left"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <Pill className="h-3.5 w-3.5 text-muted-foreground" />
                        {m.name}
                        <span className="text-xs text-muted-foreground">{m.prn_indication ?? "as required"}</span>
                      </span>
                      <Badge variant="outline">PRN</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {recording && (
        <RecordDoseDialog
          medication={recording.med}
          scheduledDate={dateKey}
          scheduledTime={recording.time}
          allergies={recording.allergies}
          priorAdministrations={(data?.admins ?? []).filter((a) => a.medication_id === recording.med.id)}
          onClose={() => setRecording(null)}
        />
      )}
    </AppShell>
  );
}
