import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { generateHandover, SECTION_KEYS } from "@/lib/handover.functions";
import { ClipboardList, Sparkles, Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const SECTION_LABELS: Record<string, string> = {
  important_changes: "Important changes",
  risks: "Risks",
  actions: "Actions",
  appointments: "Appointments",
  medication: "Medication",
  clinical_communications: "Clinical communications",
  family_matters: "Family matters",
  outstanding_tasks: "Outstanding tasks",
};

type Sections = Record<string, string[]>;

export const Route = createFileRoute("/_authenticated/handover")({
  head: () => ({
    meta: [
      { title: "Handover · CareCore" },
      { name: "description", content: "A shift handover drafted from approved care records and reviewed by staff before use." },
      { property: "og:title", content: "Handover · CareCore" },
      { property: "og:description", content: "A shift handover drafted from approved care records and reviewed by staff before use." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HandoverPage,
});

function HandoverPage() {
  const qc = useQueryClient();
  const generate = useServerFn(generateHandover);
  const [shift, setShift] = useState("day");
  const [hours, setHours] = useState("12");
  const [draft, setDraft] = useState<Sections | null>(null);
  const [notes, setNotes] = useState("");
  const [period, setPeriod] = useState<{ since: string; until: string } | null>(null);

  const recent = useQuery({
    queryKey: ["handovers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("handovers").select("*").order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });

  const build = useMutation({
    mutationFn: async () => await generate({ data: { hours: Number(hours) } }),
    onSuccess: (out: any) => {
      setDraft(out.sections as Sections);
      setPeriod({ since: out.since, until: out.until });
      toast.success("Draft ready — please review");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not build the handover"),
  });

  const approve = useMutation({
    mutationFn: async () => {
      if (!draft || !period) throw new Error("Nothing to save");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("handovers").insert({
        shift,
        shift_date: new Date().toISOString().slice(0, 10),
        period_start: period.since,
        period_end: period.until,
        sections: draft,
        notes: notes || null,
        status: "approved",
        prepared_by: u.user!.id,
        approved_by: u.user!.id,
        approved_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Handover approved and saved");
      setDraft(null); setNotes(""); setPeriod(null);
      qc.invalidateQueries({ queryKey: ["handovers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const editLine = (key: string, idx: number, value: string) =>
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, [key]: [...(d[key] ?? [])] };
      next[key][idx] = value;
      return next;
    });

  const removeLine = (key: string, idx: number) =>
    setDraft((d) => (d ? { ...d, [key]: (d[key] ?? []).filter((_, i) => i !== idx) } : d));

  return (
    <AppShell title="Handover" subtitle="Drafted from approved records — a person checks it before it is used">
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Shift</Label>
              <Select value={shift} onValueChange={setShift}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="night">Night</SelectItem>
                  <SelectItem value="twilight">Twilight</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Covering the last</Label>
              <Select value={hours} onValueChange={setHours}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">8 hours</SelectItem>
                  <SelectItem value="12">12 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => build.mutate()} disabled={build.isPending}>
              <Sparkles className="mr-1 h-4 w-4" />
              {build.isPending ? "Preparing…" : "Prepare handover"}
            </Button>
          </CardContent>
        </Card>

        {draft && (
          <div className="space-y-3 rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Draft handover — review and edit before approving</span>
            </div>

            {SECTION_KEYS.map((key) => (
              <div key={key}>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{SECTION_LABELS[key]}</h3>
                  <Badge variant="secondary" className="text-[10px]">{(draft[key] ?? []).length}</Badge>
                </div>
                {(draft[key] ?? []).length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">Nothing to report.</p>
                ) : (
                  <ul className="mt-1 space-y-1.5">
                    {(draft[key] ?? []).map((line, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Textarea
                          rows={2}
                          value={line}
                          onChange={(e) => editLine(key, i, e.target.value)}
                          className="text-sm"
                        />
                        <Button size="sm" variant="ghost" className="text-xs" onClick={() => removeLine(key, i)}>
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            <div>
              <Label className="text-xs">Anything else to pass on</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="flex gap-2">
              <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
                <Check className="mr-1 h-4 w-4" />Approve handover
              </Button>
              <Button variant="ghost" onClick={() => { setDraft(null); setPeriod(null); }}>Discard</Button>
            </div>
          </div>
        )}

        <div>
          <h2 className="mb-2 text-sm font-semibold">Recent handovers</h2>
          {recent.data?.length ? (
            <ul className="space-y-2">
              {recent.data.map((h: any) => (
                <li key={h.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {format(new Date(h.shift_date), "d MMM yyyy")} · {h.shift} shift
                    </span>
                    <Badge variant={h.status === "approved" ? "default" : "outline"} className="text-[10px]">{h.status}</Badge>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {SECTION_KEYS.map((key) => {
                      const lines: string[] = (h.sections?.[key] ?? []) as string[];
                      if (!lines.length) return null;
                      return (
                        <div key={key}>
                          <div className="text-xs font-medium">{SECTION_LABELS[key]}</div>
                          <ul className="ml-4 list-disc text-xs text-muted-foreground">
                            {lines.map((l, i) => <li key={i}>{l}</li>)}
                          </ul>
                        </div>
                      );
                    })}
                    {h.notes && <p className="text-xs"><span className="font-medium">Also:</span> {h.notes}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No handovers saved yet.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
