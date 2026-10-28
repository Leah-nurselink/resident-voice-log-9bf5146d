import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Stethoscope, ChevronDown, Download, Save, CheckCircle2, Info } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clinical-review")({
  head: () => ({ meta: [{ title: "Clinical Review · CareCore" }] }),
  component: ClinicalReviewPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">{(error as Error).message}</div>
  ),
});

type SectionDef = { key: string; num: string; title: string; prompt: string; auto: boolean };
const SECTIONS: SectionDef[] = [
  { key: "previous_actions", num: "1/11", title: "Review of previous week's action points", auto: true,
    prompt: "Care plans up to date and stating current interventions. Risk assessments and evaluations up to date and reflecting the care plan. All triangulation evidenced." },
  { key: "falls", num: "2/11", title: "Falls — witnessed and unwitnessed", auto: true,
    prompt: "New falls, residents falling regularly, falls care plans in place, equipment interventions (sensors/alarms), risk assessment updated after each fall, medication and footwear reviewed, falls clinic referrals, falls analysis for triggers/trends." },
  { key: "wounds", num: "3/11", title: "Wounds", auto: true,
    prompt: "Skin tear/bruise explained or unexplained, incident form completed, protocol followed, care plan updated, wound bundle + body map, dressings changed per plan, family informed, weekly wound audit, GP/Community Nursing/TVN referral, catering for protein/vit C/zinc." },
  { key: "pressure", num: "4/11", title: "At risk of pressure ulcer damage", auto: true,
    prompt: "Waterlow scores calculated, reduction plans for medium/high risk, damage above cat 2 on A&I, above cat 3 SUI/RCA + manager informed, GP/TVN referral, safeguarding + regulatory notification (England), specialist equipment/mattress in place." },
  { key: "medication", num: "5/11", title: "Medication", auto: true,
    prompt: "Medication errors this week, RCA and lessons learned, reflective practice + competency, incident form, GP informed, safeguarding/regulator notification, new or changed medications, care plans & MAR reflect changes, stock until next cycle." },
  { key: "nutrition", num: "6/11", title: "Nutrition and weight loss", auto: true,
    prompt: "Moderate/high MUST scores, weight loss discussion incl. catering, weight loss care plan, fortification/supplements, GP review / dietitian referral, food & fluid monitoring, food-first approach, frequency of weights, favourite foods." },
  { key: "choking", num: "7/11", title: "Choking incidents", auto: false,
    prompt: "Medium-to-high choking risk (swallowing disorder, history of choking, impulsive behaviour): GP review or SALT referral. Recent recommendations added to care plan and communicated to all colleagues." },
  { key: "infections", num: "8/11", title: "Infections", auto: false,
    prompt: "Antibiotics prescribed → short-term care plan + infection bundle. Impact on daily activity reflected in short-term care plan. Trends (type, number affected, location, onset). GP review requested. Medications available in home." },
  { key: "mca", num: "9/11", title: "MCAs — care, treatment, medication, bedrails, keypad use", auto: true,
    prompt: "Bedrail users have a completed assessment, least restrictive approach (consider low-rise bed + safety mats), incidents where bedrail use was a safety risk (entrapment, scaling, inappropriate use), checks completed to mitigate risk." },
  { key: "behaviours", num: "10/11", title: "Distressed behaviours", auto: true,
    prompt: "Recent distressed-behaviour incidents: antecedent/during/after, environmental factors (location, day/night, people, noise), recent environmental changes, medication regime changes, underlying causes, CMHT/GP involvement." },
  { key: "aob", num: "11/11", title: "AOB", auto: true,
    prompt: "MHRA alerts actioned and communicated. Safeguarding alerts of a clinical nature to review. Serious untoward clinical incidents requiring an SUI." },
];

type Row = Record<string, unknown>;
const sb = supabase as unknown as {
  from: (t: string) => any;
  auth: typeof supabase.auth;
};

function ClinicalReviewPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const since = useMemo(() => {
    const d = new Date(date + "T00:00:00"); d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  }, [date]);
  const weekEndIso = useMemo(() => {
    const d = new Date(date + "T00:00:00"); d.setDate(d.getDate() + 1);
    return d.toISOString();
  }, [date]);
  const sinceIso = since + "T00:00:00.000Z";

  const [sections, setSections] = useState<Record<string, { discussion: string; actions: string }>>({});
  const [attendees, setAttendees] = useState("");
  const [chair, setChair] = useState("");
  const [manager, setManager] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const residents = useQuery({
    queryKey: ["cr-residents"],
    queryFn: async () => (await sb.from("residents").select("id, full_name")).data ?? [],
  });
  const nameOf = (id: unknown) => (residents.data as Row[] | undefined)?.find((r) => r.id === id)?.full_name as string ?? "Unknown";

  // The meeting record for this date (if any).
  const meeting = useQuery({
    queryKey: ["clinical-review", date],
    queryFn: async () => {
      const { data } = await sb.from("clinical_review_meetings").select("*").eq("meeting_date", date).maybeSingle();
      const m = data as Row | null;
      setSections((m?.sections as Record<string, { discussion: string; actions: string }>) ?? {});
      setAttendees((m?.attendees as string) ?? "");
      setChair((m?.chair_name as string) ?? "");
      setManager((m?.home_manager_name as string) ?? "");
      return m;
    },
  });
  const finalised = (meeting.data?.status as string) === "finalised";

  // Previous finalised meeting (for Section 1 carry-forward).
  const previous = useQuery({
    queryKey: ["clinical-review-prev", date],
    queryFn: async () => {
      const { data } = await sb.from("clinical_review_meetings").select("meeting_date, sections, status")
        .lt("meeting_date", date).eq("status", "finalised").order("meeting_date", { ascending: false }).limit(1).maybeSingle();
      return data as Row | null;
    },
  });

  // Week-scoped incidents (classified client-side).
  const incidents = useQuery({
    queryKey: ["cr-incidents", since, date],
    queryFn: async () => (await sb.from("incidents")
      .select("id, resident_id, incident_type, severity, description, occurred_at, safeguarding_concern")
      .gte("occurred_at", sinceIso).lt("occurred_at", weekEndIso).order("occurred_at", { ascending: false })).data ?? [],
  });
  const woundAssess = useQuery({
    queryKey: ["cr-wound-assess", since, date],
    queryFn: async () => (await sb.from("wound_assessments")
      .select("id, wound_id, created_at, tissue_type").gte("created_at", sinceIso).lt("created_at", weekEndIso)).data ?? [],
  });
  const openWounds = useQuery({
    queryKey: ["cr-open-wounds"],
    queryFn: async () => (await sb.from("wounds").select("id, resident_id, wound_type, location, status").neq("status", "healed")).data ?? [],
  });
  const risks = useQuery({
    queryKey: ["cr-risks"],
    queryFn: async () => (await sb.from("resident_risk_assessments").select("resident_id, type, level, review_date").in("level", ["medium", "high"])).data ?? [],
  });
  const medsChanged = useQuery({
    queryKey: ["cr-meds", since, date],
    queryFn: async () => (await sb.from("medications")
      .select("resident_id, name, status, start_date, created_at, updated_at").gte("updated_at", sinceIso).lt("updated_at", weekEndIso)).data ?? [],
  });
  const mca = useQuery({
    queryKey: ["cr-mca", since, date],
    queryFn: async () => (await sb.from("mca_assessments")
      .select("resident_id, decision, assessment_date, updated_at").gte("updated_at", sinceIso).lt("updated_at", weekEndIso)).data ?? [],
  });
  const flaggedNotes = useQuery({
    queryKey: ["cr-flagged", since, date],
    queryFn: async () => (await sb.from("daily_notes")
      .select("resident_id, content, flags, created_at").gte("created_at", sinceIso).lt("created_at", weekEndIso)
      .overlaps("flags", ["aggressive_behaviour", "safeguarding"])).data ?? [],
  });
  const mhra = useQuery({
    queryKey: ["cr-mhra"],
    queryFn: async () => {
      const { data } = await sb.from("policies").select("title, source, effective_date, status").order("effective_date", { ascending: false });
      return (data as Row[] | null)?.filter((p) => /mhra|alert/i.test(String(p.source ?? "") + String(p.title ?? ""))) ?? [];
    },
  });
  // Wounds that staff have flagged as deteriorated or healed, not yet discussed.
  const flaggedWounds = useQuery({
    queryKey: ["cr-flagged-wounds"],
    queryFn: async () => (await sb.from("wounds")
      .select("id, resident_id, wound_type, location, clinical_flag, flag_note, flagged_at")
      .not("clinical_flag", "is", null).is("discussed_at", null)).data ?? [],
  });

  const inc = (incidents.data as Row[] | undefined) ?? [];
  const match = (keywords: RegExp) => inc.filter((i) => keywords.test(String(i.incident_type ?? "") + " " + String(i.description ?? "")));

  // Build the auto-pulled lines per section.
  const autoLines = (key: string): string[] => {
    switch (key) {
      case "previous_actions": {
        const prev = previous.data;
        if (!prev) return ["No previous finalised meeting found."];
        const s = (prev.sections as Record<string, { actions?: string }>) ?? {};
        const lines = SECTIONS.filter((x) => x.key !== "previous_actions")
          .map((x) => { const a = s[x.key]?.actions?.trim(); return a ? `${x.title}: ${a}` : ""; }).filter(Boolean);
        return lines.length ? [`From ${format(new Date(String(prev.meeting_date)), "d MMM yyyy")}:`, ...lines] : ["Previous meeting had no recorded actions."];
      }
      case "falls": {
        const falls = match(/fall/i);
        const highRisk = ((risks.data as Row[] | undefined) ?? []).filter((r) => r.type === "falls");
        return [
          ...falls.map((f) => `${format(new Date(String(f.occurred_at)), "d MMM")} — ${nameOf(f.resident_id)}: ${String(f.incident_type)} (${String(f.severity)})`),
          ...highRisk.map((r) => `At ${r.level} falls risk: ${nameOf(r.resident_id)}`),
        ];
      }
      case "wounds": {
        const wa = (woundAssess.data as Row[] | undefined) ?? [];
        const woundsById = new Map(((openWounds.data as Row[] | undefined) ?? []).map((w) => [w.id, w]));
        const skin = match(/skin tear|bruis|wound|laceration/i);
        const flagged = (flaggedWounds.data as Row[] | undefined) ?? [];
        return [
          ...flagged.map((w) => `FLAGGED ${String(w.clinical_flag).toUpperCase()}: ${nameOf(w.resident_id)} — ${String(w.wound_type ?? "wound")}${w.location ? ` (${String(w.location)})` : ""}${w.flag_note ? ` — ${String(w.flag_note)}` : ""}`),
          ...((openWounds.data as Row[] | undefined) ?? []).map((w) => `Open wound: ${nameOf(w.resident_id)} — ${String(w.wound_type ?? "wound")}${w.location ? ` (${String(w.location)})` : ""}`),
          ...wa.map((a) => { const w = woundsById.get(a.wound_id); return `Assessed ${format(new Date(String(a.created_at)), "d MMM")}: ${w ? nameOf(w.resident_id) : "wound"} — ${String(a.tissue_type ?? "")}`; }),
          ...skin.map((s) => `${format(new Date(String(s.occurred_at)), "d MMM")} — ${nameOf(s.resident_id)}: ${String(s.incident_type)}`),
        ];
      }
      case "pressure": {
        const pr = ((risks.data as Row[] | undefined) ?? []).filter((r) => r.type === "pressure");
        return pr.map((r) => `At ${r.level} pressure risk: ${nameOf(r.resident_id)}${r.review_date ? ` · review ${format(new Date(String(r.review_date)), "d MMM")}` : ""}`);
      }
      case "medication": {
        const errs = match(/medic|medication|mar|dose/i);
        const changed = (medsChanged.data as Row[] | undefined) ?? [];
        return [
          ...errs.map((e) => `${format(new Date(String(e.occurred_at)), "d MMM")} — ${nameOf(e.resident_id)}: ${String(e.incident_type)} (${String(e.severity)})`),
          ...changed.map((m) => `Changed/added: ${nameOf(m.resident_id)} — ${String(m.name)} (${String(m.status)})`),
        ];
      }
      case "nutrition": {
        const nr = ((risks.data as Row[] | undefined) ?? []).filter((r) => r.type === "nutrition");
        return nr.map((r) => `At ${r.level} nutrition risk: ${nameOf(r.resident_id)}`);
      }
      case "mca": {
        const m = (mca.data as Row[] | undefined) ?? [];
        const bedrail = match(/bedrail|bed rail|entrap/i);
        return [
          ...m.map((a) => `MCA updated: ${nameOf(a.resident_id)}${a.decision ? ` — ${String(a.decision)}` : ""}`),
          ...bedrail.map((b) => `${format(new Date(String(b.occurred_at)), "d MMM")} — ${nameOf(b.resident_id)}: ${String(b.incident_type)}`),
        ];
      }
      case "behaviours": {
        const beh = match(/behav|distress|aggress|agitat/i);
        const notes = (flaggedNotes.data as Row[] | undefined) ?? [];
        const behRisk = ((risks.data as Row[] | undefined) ?? []).filter((r) => r.type === "behavioural");
        return [
          ...beh.map((b) => `${format(new Date(String(b.occurred_at)), "d MMM")} — ${nameOf(b.resident_id)}: ${String(b.incident_type)}`),
          ...notes.filter((n) => Array.isArray(n.flags) && (n.flags as string[]).includes("aggressive_behaviour"))
            .map((n) => `Note ${format(new Date(String(n.created_at)), "d MMM")} — ${nameOf(n.resident_id)}: ${String(n.content).slice(0, 80)}`),
          ...behRisk.map((r) => `At ${r.level} behavioural risk: ${nameOf(r.resident_id)}`),
        ];
      }
      case "aob": {
        const sg = inc.filter((i) => i.safeguarding_concern === true);
        const sui = inc.filter((i) => i.severity === "critical");
        const alerts = (mhra.data as Row[] | undefined) ?? [];
        return [
          ...alerts.map((a) => `MHRA/alert: ${String(a.title)}${a.effective_date ? ` (${format(new Date(String(a.effective_date)), "d MMM")})` : ""}`),
          ...sg.map((s) => `Safeguarding concern ${format(new Date(String(s.occurred_at)), "d MMM")} — ${nameOf(s.resident_id)}`),
          ...sui.map((s) => `Possible SUI (critical) ${format(new Date(String(s.occurred_at)), "d MMM")} — ${nameOf(s.resident_id)}: ${String(s.incident_type)}`),
        ];
      }
      default: return [];
    }
  };

  const setField = (key: string, field: "discussion" | "actions", val: string) =>
    setSections((p) => ({ ...p, [key]: { discussion: p[key]?.discussion ?? "", actions: p[key]?.actions ?? "", [field]: val } }));

  const persist = async (finalise: boolean) => {
    setSaving(true);
    try {
      const { data: u } = await sb.auth.getUser();
      const payload: Row = {
        meeting_date: date, attendees: attendees || null, sections,
        chair_name: chair || null, home_manager_name: manager || null,
        status: finalise ? "finalised" : "draft",
      };
      if (!meeting.data) payload.created_by = u.user?.id;
      if (finalise) { payload.finalised_at = new Date().toISOString(); payload.chair_signed_at = chair ? new Date().toISOString() : null; payload.manager_signed_at = manager ? new Date().toISOString() : null; }
      const { error } = await sb.from("clinical_review_meetings").upsert(payload, { onConflict: "meeting_date" });
      if (error) throw error;
      if (finalise) {
        // Flagged wounds are now considered discussed at this meeting.
        await sb.from("wounds").update({ discussed_at: new Date().toISOString(), discussed_by: u.user?.id })
          .not("clinical_flag", "is", null).is("discussed_at", null);
        qc.invalidateQueries({ queryKey: ["cr-flagged-wounds"] });
        qc.invalidateQueries({ queryKey: ["wounds"] });
      }
      toast.success(finalise ? "Meeting finalised" : "Draft saved");
      qc.invalidateQueries({ queryKey: ["clinical-review", date] });
      qc.invalidateQueries({ queryKey: ["clinical-review-prev"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();
      doc.setFontSize(16); doc.text("Clinical Review Meeting", 14, 16);
      doc.setFontSize(10);
      doc.text(`Date: ${format(new Date(date + "T00:00:00"), "d MMMM yyyy")}`, 14, 23);
      if (attendees) doc.text(`Attendees: ${attendees}`, 14, 29);
      let y = attendees ? 35 : 29;
      for (const s of SECTIONS) {
        if (y > 250) { doc.addPage(); y = 16; }
        doc.setFontSize(12); doc.setTextColor(38, 94, 90);
        doc.text(`Section ${s.num}: ${s.title}`, 14, y); y += 2;
        doc.setTextColor(0, 0, 0);
        const auto = s.auto ? autoLines(s.key) : [];
        autoTable(doc, {
          startY: y + 2,
          head: [["Discussion", "Actions and by who"]],
          body: [[
            (sections[s.key]?.discussion ?? "") + (auto.length ? `\n\nData this week:\n- ${auto.join("\n- ")}` : ""),
            sections[s.key]?.actions ?? "",
          ]],
          styles: { fontSize: 8, cellPadding: 2, valign: "top" },
          headStyles: { fillColor: [38, 94, 90] },
          columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 62 } },
        });
        y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 6;
      }
      if (y > 250) { doc.addPage(); y = 16; }
      doc.setFontSize(10);
      doc.text(`Signature of Meeting Chair: ${chair || "____________________"}`, 14, y + 8);
      doc.text(`Signature of Home Manager: ${manager || "____________________"}`, 14, y + 16);
      doc.save(`clinical-review-${date}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't build the PDF");
    }
  };

  return (
    <AppShell
      title="Clinical Review"
      subtitle="Weekly clinical governance meeting"
      action={
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
        </Button>
      }
    >
      <div className="space-y-4 pb-24">
        <Card>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Meeting date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Attendees</Label><Input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="Names / roles present" disabled={finalised} /></div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Stethoscope className="h-3.5 w-3.5" />Pulling data for {format(new Date(since + "T00:00:00"), "d MMM")} – {format(new Date(date + "T00:00:00"), "d MMM yyyy")}
          {finalised && <Badge variant="secondary" className="ml-auto">Finalised</Badge>}
        </div>

        {SECTIONS.map((s) => {
          const auto = s.auto ? autoLines(s.key) : [];
          const isOpen = open[s.key];
          return (
            <section key={s.key} className="rounded-xl border bg-card">
              <div className="flex items-start gap-2 border-b p-3">
                <Badge variant="outline" className="shrink-0 text-[10px]">{s.num}</Badge>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold">{s.title}</h2>
                  <button type="button" onClick={() => setOpen((p) => ({ ...p, [s.key]: !p[s.key] }))}
                    className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <Info className="h-3 w-3" />What to review<ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && <p className="mt-1 text-xs text-muted-foreground">{s.prompt}</p>}
                </div>
              </div>
              <div className="space-y-3 p-3">
                {s.auto && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs">
                    <p className="mb-1 font-medium text-primary">Pulled from CareCore this week</p>
                    {auto.length ? (
                      <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">{auto.slice(0, 40).map((l, i) => <li key={i}>{l}</li>)}</ul>
                    ) : <p className="text-muted-foreground">No records this week.</p>}
                  </div>
                )}
                {!s.auto && <p className="text-xs text-muted-foreground italic">Not yet captured in CareCore — record the discussion manually.</p>}
                <div className="space-y-1.5"><Label className="text-xs">Discussion</Label>
                  <Textarea rows={2} value={sections[s.key]?.discussion ?? ""} onChange={(e) => setField(s.key, "discussion", e.target.value)} className="resize-none" disabled={finalised} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Actions and by who</Label>
                  <Textarea rows={2} value={sections[s.key]?.actions ?? ""} onChange={(e) => setField(s.key, "actions", e.target.value)} className="resize-none" disabled={finalised} /></div>
              </div>
            </section>
          );
        })}

        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Meeting chair</Label><Input value={chair} onChange={(e) => setChair(e.target.value)} placeholder="Name" disabled={finalised} /></div>
              <div className="space-y-1.5"><Label>Home manager</Label><Input value={manager} onChange={(e) => setManager(e.target.value)} placeholder="Name" disabled={finalised} /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!finalised && <Button onClick={() => persist(false)} disabled={saving} variant="outline" className="min-h-11"><Save className="h-4 w-4" />Save draft</Button>}
              {!finalised && <Button onClick={() => persist(true)} disabled={saving} className="min-h-11"><CheckCircle2 className="h-4 w-4" />Finalise & sign off</Button>}
              <Button onClick={exportPdf} variant="outline" className="min-h-11"><Download className="h-4 w-4" />Export PDF</Button>
            </div>
            <p className="text-xs text-muted-foreground">Finalising locks the record and timestamps sign-off. The auto-pulled data is a prompt for discussion, not a substitute for clinical judgement.</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
