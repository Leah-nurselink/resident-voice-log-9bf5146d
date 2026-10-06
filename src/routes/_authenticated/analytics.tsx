import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  AudioLines,
  ClipboardCheck,
  Clock,
  Heart,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { TrendArea, GroupedBars, DonutChart, MultiLine } from "@/components/analytics/AnalyticsCharts";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics · CareCore" }] }),
  component: AnalyticsPage,
});

const RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
type RangeKey = keyof typeof RANGES;


function AnalyticsPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const days = RANGES[range];

  const residents = useQuery({
    queryKey: ["analytics-residents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("residents").select("id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const notes = useQuery({
    queryKey: ["analytics-notes", days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data, error } = await supabase
        .from("daily_notes")
        .select("id, status, created_at, updated_at, category, source, domain, audio_quality, transcript_confidence, signal_level, noise_level, duration_sec, time_saved_seconds")
        .gte("created_at", since.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  const risks = useQuery({
    queryKey: ["analytics-risks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("risk_assessments").select("id, type, level");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---------- Care operations ----------
  const notesPerDay = useMemo(() => {
    const buckets = new Map<string, number>();
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    (notes.data ?? []).forEach((n: any) => {
      const k = (n.created_at ?? "").slice(0, 10);
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
    });
    return Array.from(buckets.entries()).map(([k, v]) => ({
      label: new Date(k).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: v,
    }));
  }, [notes.data, days]);

  const ops = useQuery({
    queryKey: ["analytics-ops", days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceIso = since.toISOString();
      const [inc, wnd, sh, con, mca, ses, meds] = await Promise.all([
        supabase.from("incidents").select("incident_type, occurred_at, location").gte("occurred_at", sinceIso),
        supabase.from("wounds").select("date_noticed, date_healed"),
        supabase.from("shifts").select("shift_date, staff_user_id").gte("shift_date", sinceIso.slice(0, 10)),
        supabase.from("consents").select("resident_id, status"),
        supabase.from("mca_assessments").select("resident_id, review_date"),
        supabase.from("care_sessions").select("started_at, ended_at").gte("started_at", sinceIso),
        supabase.from("medication_administrations").select("status").gte("administered_at", sinceIso),
      ]);
      for (const r of [inc, wnd, sh, con, mca, ses, meds]) if (r.error) throw r.error;
      return {
        incidents: inc.data ?? [], wounds: wnd.data ?? [], shifts: sh.data ?? [], consents: con.data ?? [],
        mca: mca.data ?? [], sessions: ses.data ?? [], meds: meds.data ?? [],
      };
    },
  });

  const dayKeys = useMemo(
    () => Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      return d.toISOString().slice(0, 10);
    }),
    [days],
  );
  const lbl = (k: string) => new Date(k).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const countBy = <T,>(rows: T[], key: (r: T) => string) => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(key(r), (m.get(key(r)) ?? 0) + 1));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };
  const pretty = (s: string) => (s[0]?.toUpperCase() ?? "") + s.slice(1).replace(/_/g, " ");

  const notesByCategory = useMemo(
    () => countBy(notes.data ?? [], (n: any) => pretty(n.domain || "general")),
    [notes.data],
  );

  const interventions = useMemo(
    () => dayKeys.map((k) => ({
      label: lbl(k),
      value: (notes.data ?? []).filter((n: any) => n.status === "approved" && n.created_at.slice(0, 10) === k).length,
    })),
    [notes.data, dayKeys],
  );

  const incidentsTrend = useMemo(() => {
    const inc = ops.data?.incidents ?? [];
    const on = (k: string, re: RegExp) => inc.filter((i) => i.occurred_at.slice(0, 10) === k && re.test(i.incident_type)).length;
    return dayKeys.map((k) => ({
      label: lbl(k),
      Falls: on(k, /fall/i),
      "Medication errors": on(k, /medic/i),
      "Skin/Pressure": on(k, /skin|pressure|wound/i),
    }));
  }, [ops.data, dayKeys]);

  // ---------- Time on care ----------
  const timeOnCare = useMemo(() => dayKeys.map((k) => {
    const sessionSec = (ops.data?.sessions ?? [])
      .filter((s) => s.ended_at && s.started_at.slice(0, 10) === k)
      .reduce((a, s) => a + (new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime()) / 1000, 0);
    const recSec = (notes.data ?? [])
      .filter((n: any) => n.created_at.slice(0, 10) === k)
      .reduce((a: number, n: any) => a + (Number(n.duration_sec) || 0), 0);
    return {
      label: lbl(k),
      "Care sessions (hrs)": +(sessionSec / 3600).toFixed(1),
      "Voice recording (hrs)": +(recSec / 3600).toFixed(2),
    };
  }), [ops.data, notes.data, dayKeys]);
  const sessionHrs = timeOnCare.reduce((a, d) => a + d["Care sessions (hrs)"], 0);
  const recordingHrs = timeOnCare.reduce((a, d) => a + d["Voice recording (hrs)"], 0);

  const interventionMix = useMemo(
    () => countBy(notes.data ?? [], (n: any) => pretty(n.category || "uncategorised")),
    [notes.data],
  );
  const medsByStatus = useMemo(
    () => countBy(ops.data?.meds ?? [], (m) => pretty(m.status)).map((d) => ({ label: d.name, value: d.value })),
    [ops.data],
  );

  // ---------- Compliance ----------
  const residentIds = (residents.data ?? []).map((r) => r.id);
  const consented = new Set((ops.data?.consents ?? []).filter((c) => c.status === "given").map((c) => c.resident_id));
  const consentCoverage = [
    { name: "Consent recorded", value: residentIds.filter((id) => consented.has(id)).length },
    { name: "Missing", value: residentIds.filter((id) => !consented.has(id)).length },
  ];
  const today = new Date().toISOString().slice(0, 10);
  const mcaState = new Map<string, "ok" | "due">();
  (ops.data?.mca ?? []).forEach((m) => {
    const s = !m.review_date || m.review_date >= today ? "ok" : "due";
    if (mcaState.get(m.resident_id) !== "ok") mcaState.set(m.resident_id, s);
  });
  const mcaCoverage = [
    { name: "MCA in date", value: residentIds.filter((id) => mcaState.get(id) === "ok").length },
    { name: "Due review", value: residentIds.filter((id) => mcaState.get(id) === "due").length },
    { name: "Missing", value: residentIds.filter((id) => !mcaState.has(id)).length },
  ];

  // ---------- Resident-level ----------
  const wounds = useMemo(() => {
    const w = ops.data?.wounds ?? [];
    const start = dayKeys[0];
    return dayKeys.map((k) => ({
      label: lbl(k),
      "Open wounds": w.filter((x) => x.date_noticed <= k && (!x.date_healed || x.date_healed > k)).length,
      Healed: w.filter((x) => x.date_healed && x.date_healed >= start && x.date_healed <= k).length,
    }));
  }, [ops.data, dayKeys]);
  const fallsByLocation = useMemo(
    () => countBy((ops.data?.incidents ?? []).filter((i) => /fall/i.test(i.incident_type)), (i) => i.location || "Not recorded")
      .map((d) => ({ label: d.name, value: d.value })),
    [ops.data],
  );

  // ---------- Staff/workload ----------
  const shiftActivity = useMemo(() => {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const rows = names.map((label) => ({ label, Day: 0, Evening: 0, Night: 0 }));
    (notes.data ?? []).forEach((n: any) => {
      const d = new Date(n.created_at);
      const h = d.getHours();
      const slot = h >= 7 && h < 14 ? "Day" : h >= 14 && h < 21 ? "Evening" : "Night";
      rows[d.getDay()][slot as "Day"]++;
    });
    return [...rows.slice(1), rows[0]];
  }, [notes.data]);

  const staffedShifts = (ops.data?.shifts ?? []).filter((s) => s.staff_user_id).length;
  const approvedNotes = (notes.data ?? []).filter((n: any) => n.status === "approved" && n.updated_at);
  const avgApproveMin = approvedNotes.length
    ? Math.round(approvedNotes.reduce((a: number, n: any) => a + (new Date(n.updated_at).getTime() - new Date(n.created_at).getTime()), 0) / approvedNotes.length / 60000)
    : null;

  const totalNotes = (notes.data ?? []).length;
  const notesPerShift = staffedShifts ? +(totalNotes / staffedShifts).toFixed(1) : null;
  const drafts = (notes.data ?? []).filter((n: any) => n.status === "draft").length;
  const highRisks = (risks.data ?? []).filter((r: any) => r.level === "high").length;

  // ---------- Audio Quality & Time Saved ----------
  const voiceNotes = (notes.data ?? []).filter((n: any) => n.source === "voice");
  const typedNotes = (notes.data ?? []).filter((n: any) => n.source !== "voice");
  const captureMixLive = useMemo(() => {
    
    return [
      { name: "Voice", value: voiceNotes.length },
      { name: "Typed", value: typedNotes.length },
    ];
  }, [notes.data, voiceNotes.length, typedNotes.length]);

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const qualityVals = voiceNotes.map((n: any) => Number(n.audio_quality)).filter((v) => Number.isFinite(v));
  const confVals = voiceNotes.map((n: any) => Number(n.transcript_confidence)).filter((v) => Number.isFinite(v));
  const signalVals = voiceNotes.map((n: any) => Number(n.signal_level)).filter((v) => Number.isFinite(v));
  const noiseVals = voiceNotes.map((n: any) => Number(n.noise_level)).filter((v) => Number.isFinite(v));
  const savedSecondsArr = (notes.data ?? []).map((n: any) => Number(n.time_saved_seconds)).filter((v) => Number.isFinite(v));
  const totalSavedSec = savedSecondsArr.reduce((a, b) => a + b, 0);
  const totalSavedHrs = totalSavedSec / 3600;
  const avgSavedPerNote = savedSecondsArr.length ? totalSavedSec / savedSecondsArr.length : 0;

  const qualityByDay = useMemo(() => {
    const buckets = new Map<string, { q: number[]; c: number[] }>();
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), { q: [], c: [] });
    }
    voiceNotes.forEach((n: any) => {
      const k = (n.created_at ?? "").slice(0, 10);
      const b = buckets.get(k);
      if (!b) return;
      if (Number.isFinite(Number(n.audio_quality))) b.q.push(Number(n.audio_quality));
      if (Number.isFinite(Number(n.transcript_confidence))) b.c.push(Number(n.transcript_confidence));
    });
    return Array.from(buckets.entries()).map(([k, v]) => ({
      label: new Date(k).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      "Audio quality": Math.round(avg(v.q) * 100),
      "Transcript confidence": Math.round(avg(v.c) * 100),
    }));
  }, [voiceNotes, days]);

  const savedByDay = useMemo(() => {
    const buckets = new Map<string, number>();
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    (notes.data ?? []).forEach((n: any) => {
      const k = (n.created_at ?? "").slice(0, 10);
      if (!buckets.has(k)) return;
      const s = Number(n.time_saved_seconds);
      if (Number.isFinite(s)) buckets.set(k, (buckets.get(k) ?? 0) + s);
    });
    return Array.from(buckets.entries()).map(([k, v]) => ({
      label: new Date(k).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: Math.round((v / 60) * 10) / 10, // minutes saved
    }));
  }, [notes.data, days]);

  const qualityDistribution = useMemo(() => {
    const buckets = { Excellent: 0, Good: 0, Fair: 0, Poor: 0 };
    qualityVals.forEach((q) => {
      if (q >= 0.75) buckets.Excellent++;
      else if (q >= 0.55) buckets.Good++;
      else if (q >= 0.35) buckets.Fair++;
      else buckets.Poor++;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [qualityVals]);

  const avgQualityPct = Math.round(avg(qualityVals) * 100);
  const avgConfPct = Math.round(avg(confVals) * 100);
  const avgSignalPct = Math.round(avg(signalVals) * 100);
  const avgNoisePct = Math.round(avg(noiseVals) * 100);

  return (
    <AppShell title="Analytics" subtitle="Care operations, compliance and time-on-care insight">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Trends update from your care notes, risk assessments and audits. Pick a window to focus.
          </p>
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Residents" value={residents.data?.length ?? 0} description="In care today" icon={Users} />
          <MetricCard title="Notes logged" value={totalNotes} description={`${drafts} awaiting approval`} icon={MessageSquare} />
          <MetricCard title="High-risk flags" value={highRisks} description="Across all residents" icon={AlertTriangle} />
          <MetricCard title="Incidents" value={ops.data?.incidents.length ?? 0} description={`Reported · last ${days}d`} icon={Heart} />
        </div>

        <Tabs defaultValue="operations" className="space-y-4">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="operations"><Activity className="mr-1 h-4 w-4" />Care operations</TabsTrigger>
            <TabsTrigger value="time"><Clock className="mr-1 h-4 w-4" />Time on care</TabsTrigger>
            <TabsTrigger value="audio"><AudioLines className="mr-1 h-4 w-4" />Audio quality</TabsTrigger>
            <TabsTrigger value="compliance"><ShieldCheck className="mr-1 h-4 w-4" />Compliance & CQC</TabsTrigger>
            <TabsTrigger value="resident"><Stethoscope className="mr-1 h-4 w-4" />Resident-level</TabsTrigger>
            <TabsTrigger value="staff"><Sparkles className="mr-1 h-4 w-4" />Staff & workload</TabsTrigger>
          </TabsList>

          <TabsContent value="operations" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Care notes logged</CardTitle><CardDescription>Daily volume</CardDescription></CardHeader>
                <CardContent><TrendArea data={notesPerDay} dataKey="value" /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Notes by category</CardTitle><CardDescription>What care is being documented</CardDescription></CardHeader>
                <CardContent><DonutChart data={notesByCategory} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Approved notes per day</CardTitle><CardDescription>Care records signed off by staff</CardDescription></CardHeader>
                <CardContent><TrendArea data={interventions} dataKey="value" color="#16a34a" /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Incidents trend</CardTitle><CardDescription>Reported falls, medication and skin incidents</CardDescription></CardHeader>
                <CardContent><MultiLine data={incidentsTrend} keys={["Falls", "Medication errors", "Skin/Pressure"]} /></CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="time" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <MetricCard title="Care session time" value={`${sessionHrs.toFixed(1)} hrs`} description={`Recorded care sessions · last ${days}d`} icon={Heart} />
              <MetricCard title="Voice recording time" value={`${recordingHrs.toFixed(1)} hrs`} description={`Across voice notes · last ${days}d`} icon={ClipboardCheck} />
              <MetricCard
                title="Time saved by voice"
                value={totalSavedHrs >= 1 ? `${totalSavedHrs.toFixed(1)} hrs` : `${Math.round(totalSavedSec / 60)} min`}
                description={savedSecondsArr.length ? `${Math.round(avgSavedPerNote)}s avg per note · last ${days}d` : "No voice notes yet"}
                icon={Sparkles}
              />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Care sessions vs voice recording</CardTitle><CardDescription>Hours recorded per day</CardDescription></CardHeader>
              <CardContent><MultiLine data={timeOnCare} keys={["Care sessions (hrs)", "Voice recording (hrs)"]} height={280} /></CardContent>
            </Card>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Intervention mix</CardTitle><CardDescription>Share of documented interventions</CardDescription></CardHeader>
                <CardContent><DonutChart data={interventionMix} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Medication administrations</CardTitle><CardDescription>Recorded outcomes · last {days} days</CardDescription></CardHeader>
                <CardContent>
                  <GroupedBars data={medsByStatus} keys={["value"]} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="audio" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Audio quality"
                value={voiceNotes.length ? `${avgQualityPct}%` : "—"}
                description={voiceNotes.length ? `Across ${voiceNotes.length} voice notes` : "No voice notes yet"}
                icon={AudioLines}
              />
              <MetricCard
                title="Transcript confidence"
                value={voiceNotes.length ? `${avgConfPct}%` : "—"}
                description="AI-estimated accuracy"
                icon={Sparkles}
              />
              <MetricCard
                title="Signal level"
                value={voiceNotes.length ? `${avgSignalPct}%` : "—"}
                description={`Noise floor ${voiceNotes.length ? avgNoisePct + "%" : "—"}`}
                icon={Activity}
              />
              <MetricCard
                title="Documentation time saved"
                value={totalSavedHrs >= 1 ? `${totalSavedHrs.toFixed(1)} hrs` : `${Math.round(totalSavedSec / 60)} min`}
                description={`Last ${days} days`}
                icon={Clock}
              />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Audio quality & transcript confidence</CardTitle>
                <CardDescription>Daily average (%) across voice care notes</CardDescription>
              </CardHeader>
              <CardContent>
                <MultiLine data={qualityByDay} keys={["Audio quality", "Transcript confidence"]} height={280} />
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Minutes saved per day</CardTitle>
                  <CardDescription>Typing baseline vs voice + review</CardDescription>
                </CardHeader>
                <CardContent><TrendArea data={savedByDay} dataKey="value" color="#8b5cf6" /></CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quality distribution</CardTitle>
                  <CardDescription>How recordings score across the home</CardDescription>
                </CardHeader>
                <CardContent>
                  {qualityVals.length ? <DonutChart data={qualityDistribution} /> : (
                    <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                      Capture a voice care note to populate quality scores.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Audit compliance</CardTitle><CardDescription>Latest score per programme (%)</CardDescription></CardHeader>
              <CardContent>
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  Audit scores aren't saved in the app yet, so there's nothing to show here.
                </p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Consent coverage</CardTitle><CardDescription>Residents with at least one consent given</CardDescription></CardHeader>
                <CardContent><DonutChart data={consentCoverage} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">MCA assessments</CardTitle><CardDescription>Per resident</CardDescription></CardHeader>
                <CardContent><DonutChart data={mcaCoverage} /></CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="resident" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Wound trend</CardTitle><CardDescription>Open wounds each day and wounds healed in this period</CardDescription></CardHeader>
              <CardContent><MultiLine data={wounds} keys={["Open wounds", "Healed"]} /></CardContent>
            </Card>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Falls by location</CardTitle><CardDescription>Last {days} days</CardDescription></CardHeader>
                <CardContent><GroupedBars data={fallsByLocation} keys={["value"]} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Risk distribution</CardTitle><CardDescription>Level across active assessments</CardDescription></CardHeader>
                <CardContent>
                  <DonutChart
                    data={[
                      { name: "Low", value: (risks.data ?? []).filter((r: any) => r.level === "low").length },
                      { name: "Medium", value: (risks.data ?? []).filter((r: any) => r.level === "medium").length },
                      { name: "High", value: highRisks },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="staff" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Notes per shift</CardTitle><CardDescription>Day / Evening / Night</CardDescription></CardHeader>
              <CardContent><GroupedBars data={shiftActivity} keys={["Day", "Evening", "Night"]} height={280} /></CardContent>
            </Card>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader><CardTitle className="text-base">Voice vs typed</CardTitle><CardDescription>How notes are captured</CardDescription></CardHeader>
                <CardContent><DonutChart data={captureMixLive} /></CardContent>
              </Card>
              <MetricCard title="Avg time to approve" value={avgApproveMin != null ? `${avgApproveMin} min` : "—"} description="From draft to approved" icon={Clock} />
              <MetricCard title="Notes per staffed shift" value={notesPerShift != null ? notesPerShift : "—"} description={`${staffedShifts} staffed shifts · last ${days}d`} icon={TrendingUp} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
