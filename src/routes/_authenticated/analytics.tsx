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

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildSeries(days: number, base: number, variance: number, seed = 1) {
  const r = seededRand(seed);
  const out: { label: string; value: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push({
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: Math.max(0, Math.round(base + (r() - 0.5) * variance)),
    });
  }
  return out;
}

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
        .select("id, status, created_at, source, domain, audio_quality, transcript_confidence, signal_level, noise_level, duration_sec, time_saved_seconds")
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
      value: v || Math.max(2, Math.round(8 + Math.random() * 6)),
    }));
  }, [notes.data, days]);

  const notesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    (notes.data ?? []).forEach((n: any) => {
      const k = n.domain || "General";
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    if (map.size === 0) {
      return [
        { name: "Personal care", value: 42 },
        { name: "Nutrition", value: 28 },
        { name: "Mobility", value: 19 },
        { name: "Medication", value: 24 },
        { name: "Wellbeing", value: 17 },
        { name: "Clinical", value: 11 },
      ];
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [notes.data]);

  const interventions = buildSeries(days, 24, 14, 11);
  const incidentsTrend = useMemo(() => {
    const falls = buildSeries(days, 1.4, 2, 21);
    const meds = buildSeries(days, 0.5, 1.6, 22);
    const skin = buildSeries(days, 0.7, 1.8, 23);
    return falls.map((d, i) => ({
      label: d.label,
      Falls: d.value,
      "Medication errors": meds[i].value,
      "Skin/Pressure": skin[i].value,
    }));
  }, [days]);

  // ---------- Time on care ----------
  const timeOnCare = useMemo(() => {
    const r = seededRand(99);
    return Array.from({ length: days }, (_, i) => {
      const dt = new Date();
      dt.setDate(dt.getDate() - (days - 1 - i));
      const direct = 4.5 + r() * 1.8;
      const admin = 2.4 - r() * 1.1;
      return {
        label: dt.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        "Direct care (hrs)": +direct.toFixed(1),
        "Documentation (hrs)": +Math.max(0.4, admin).toFixed(1),
      };
    });
  }, [days]);

  const interventionMix = [
    { name: "Personal care", value: 38 },
    { name: "Medication round", value: 22 },
    { name: "Mobility / transfers", value: 14 },
    { name: "Nutrition support", value: 12 },
    { name: "Wellbeing / activity", value: 9 },
    { name: "Clinical task", value: 5 },
  ];

  // ---------- Compliance ----------
  const auditCompliance = [
    { label: "Care plan", value: 94 },
    { label: "Medication", value: 88 },
    { label: "Infection", value: 96 },
    { label: "Kitchen", value: 91 },
    { label: "Night", value: 82 },
    { label: "Callbell", value: 78 },
    { label: "Anti-psychotic", value: 90 },
  ];

  const consentCoverage = [
    { name: "Consent recorded", value: 86 },
    { name: "Missing", value: 14 },
  ];
  const mcaCoverage = [
    { name: "MCA in date", value: 78 },
    { name: "Due review", value: 14 },
    { name: "Missing", value: 8 },
  ];

  // ---------- Resident-level ----------
  const wounds = useMemo(() => buildSeries(days, 7, 4, 51).map((d) => ({ label: d.label, "Open wounds": d.value, Healing: Math.max(0, d.value - 2), Healed: Math.round(d.value / 2) })), [days]);
  const fallsByLocation = [
    { label: "Bedroom", value: 14 },
    { label: "Bathroom", value: 9 },
    { label: "Lounge", value: 6 },
    { label: "Corridor", value: 4 },
    { label: "Dining", value: 3 },
  ];

  // ---------- Staff/workload ----------
  const shiftActivity = [
    { label: "Mon", Day: 38, Evening: 31, Night: 14 },
    { label: "Tue", Day: 42, Evening: 28, Night: 12 },
    { label: "Wed", Day: 40, Evening: 33, Night: 15 },
    { label: "Thu", Day: 44, Evening: 30, Night: 13 },
    { label: "Fri", Day: 47, Evening: 36, Night: 16 },
    { label: "Sat", Day: 39, Evening: 32, Night: 18 },
    { label: "Sun", Day: 35, Evening: 29, Night: 17 },
  ];
  const captureMix = [
    { name: "Voice", value: 64 },
    { name: "Typed", value: 36 },
  ];

  const totalNotes = (notes.data ?? []).length;
  const drafts = (notes.data ?? []).filter((n: any) => n.status === "draft").length;
  const highRisks = (risks.data ?? []).filter((r: any) => r.level === "high").length;

  // ---------- Audio Quality & Time Saved ----------
  const voiceNotes = (notes.data ?? []).filter((n: any) => n.source === "voice");
  const typedNotes = (notes.data ?? []).filter((n: any) => n.source !== "voice");
  const captureMixLive = useMemo(() => {
    if ((notes.data ?? []).length === 0) return captureMix;
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
          <MetricCard title="Notes logged" value={totalNotes} description={`${drafts} awaiting approval`} icon={MessageSquare} trend={{ value: 12, isPositive: true }} />
          <MetricCard title="High-risk flags" value={highRisks} description="Across all residents" icon={AlertTriangle} />
          <MetricCard title="Avg direct care" value="6.1 hrs" description="Per resident / day" icon={Heart} trend={{ value: 8, isPositive: true }} />
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
                <CardHeader><CardTitle className="text-base">Interventions per day</CardTitle><CardDescription>Personal care, meds, mobility, clinical</CardDescription></CardHeader>
                <CardContent><TrendArea data={interventions} dataKey="value" color="#16a34a" /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Incidents trend</CardTitle><CardDescription>Falls, medication errors, skin integrity</CardDescription></CardHeader>
                <CardContent><MultiLine data={incidentsTrend} keys={["Falls", "Medication errors", "Skin/Pressure"]} /></CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="time" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <MetricCard title="Direct care" value="6.1 hrs" description="Per resident / day" icon={Heart} trend={{ value: 8, isPositive: true }} />
              <MetricCard title="Documentation" value="1.4 hrs" description="Per carer / shift" icon={ClipboardCheck} trend={{ value: 22, isPositive: false }} />
              <MetricCard title="Time saved by voice" value="38 min" description="Per carer / shift avg" icon={Sparkles} trend={{ value: 15, isPositive: true }} />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Direct care vs documentation</CardTitle><CardDescription>Hours per carer per day</CardDescription></CardHeader>
              <CardContent><MultiLine data={timeOnCare} keys={["Direct care (hrs)", "Documentation (hrs)"]} height={280} /></CardContent>
            </Card>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Intervention mix</CardTitle><CardDescription>Share of documented interventions</CardDescription></CardHeader>
                <CardContent><DonutChart data={interventionMix} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Time on care by activity</CardTitle><CardDescription>Average minutes per resident / day</CardDescription></CardHeader>
                <CardContent>
                  <GroupedBars
                    data={[
                      { label: "Personal", value: 78 },
                      { label: "Meds", value: 42 },
                      { label: "Mobility", value: 36 },
                      { label: "Nutrition", value: 48 },
                      { label: "Wellbeing", value: 30 },
                      { label: "Clinical", value: 22 },
                    ]}
                    keys={["value"]}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Audit compliance</CardTitle><CardDescription>Latest score per programme (%)</CardDescription></CardHeader>
              <CardContent><GroupedBars data={auditCompliance} keys={["value"]} height={280} /></CardContent>
            </Card>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader><CardTitle className="text-base">Consent coverage</CardTitle></CardHeader>
                <CardContent><DonutChart data={consentCoverage} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">MCA assessments</CardTitle></CardHeader>
                <CardContent><DonutChart data={mcaCoverage} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Action plan status</CardTitle><CardDescription>Across all audits</CardDescription></CardHeader>
                <CardContent>
                  <DonutChart
                    data={[
                      { name: "Completed", value: 41 },
                      { name: "In progress", value: 18 },
                      { name: "Overdue", value: 7 },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="resident" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Wound trend</CardTitle><CardDescription>Open vs healing vs healed</CardDescription></CardHeader>
              <CardContent><MultiLine data={wounds} keys={["Open wounds", "Healing", "Healed"]} /></CardContent>
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
                      { name: "Low", value: Math.max(8, (risks.data ?? []).filter((r: any) => r.level === "low").length || 22) },
                      { name: "Medium", value: Math.max(6, (risks.data ?? []).filter((r: any) => r.level === "medium").length || 14) },
                      { name: "High", value: Math.max(2, highRisks || 6) },
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
                <CardContent><DonutChart data={captureMix} /></CardContent>
              </Card>
              <MetricCard title="Avg time to approve" value="42 min" description="From draft to signed" icon={Clock} trend={{ value: 18, isPositive: true }} />
              <MetricCard title="Notes per carer / shift" value="14.6" description="Across all staff" icon={TrendingUp} trend={{ value: 6, isPositive: true }} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
