import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { Check, ShieldCheck, Star } from "lucide-react";
import { RAG_CLASS, ragForDate, ragText, daysUntil } from "@/lib/rag";
import { DictateButton } from "@/components/DictateButton";
import { RotdConversationRecorder } from "@/components/RotdConversationRecorder";

export const Route = createFileRoute("/_authenticated/rotd")({
  head: () => ({ meta: [{ title: "Resident of the Day · CareCore" }] }),
  component: RotdPage,
});

// The new tables are not in the generated Supabase types yet, so use an untyped client here.
const db = supabase as any;

type Settings = {
  mode: "room_order" | "per_unit" | "manual";
  default_every_months: number;
  departments: string[];
};
const DEFAULT_SETTINGS: Settings = {
  mode: "room_order",
  default_every_months: 1,
  departments: ["care", "nursing", "maintenance", "housekeeping", "kitchen"],
};

type Resident = {
  id: string;
  full_name: string;
  preferred_name?: string | null;
  room_number: string | null;
  residency_status?: string | null;
  unit?: string | null;
  wing?: string | null;
};
type Day = {
  id: string;
  resident_id: string;
  day_date: string;
  unit: string | null;
  status: "planned" | "in_progress" | "awaiting_signoff" | "signed_off";
  resident_voice: string | null;
  spoke_for_resident: string | null;
  meeting_notes: string | null;
  next_steps: string | null;
  recording_consent?: boolean | null;
  consent_basis?: string | null;
  voice_transcript?: string | null;
  signed_off_by: string | null;
  signed_off_at: string | null;
};
type Review = { id: string; day_id: string; department: string; feedback: string | null; improvement: string | null; transcript?: string | null; completed_at: string | null };
type DraftAction = { department: string; concern: string; share?: boolean };
type Action = {
  id: string;
  day_id: string;
  resident_id: string;
  department: string;
  concern: string;
  owner_id: string | null;
  due_date: string | null;
  status: "draft" | "open" | "done";
  completed_at: string | null;
  signed_off_by: string | null;
  signed_off_at: string | null;
  share_with_family: boolean;
  created_at: string;
  residents?: { full_name: string | null; room_number: string | null } | null;
};

const ARCHIVED = ["Discharged", "Deceased"];
const todayISO = () => new Date().toLocaleDateString("en-CA");
const deptLabel = (d: string) => d.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const unitOf = (r: Resident) => r.unit ?? r.wing ?? null;
const roomKey = (r: Resident) => {
  const n = parseInt(r.room_number ?? "", 10);
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
};
function addMonthsISO(iso: string, m: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + m);
  return d.toLocaleDateString("en-CA");
}
async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
const joinText = (cur: string, add: string) => (cur ? `${cur} ${add}` : add);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

// ---------- data hooks ----------

function useSettings() {
  return useQuery({
    queryKey: ["rotd", "settings"],
    queryFn: async () => {
      const { data, error } = await db.from("rotd_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return (data ?? DEFAULT_SETTINGS) as Settings;
    },
  });
}
function useResidents() {
  return useQuery({
    queryKey: ["rotd", "residents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("residents").select("*").order("full_name");
      if (error) throw error;
      return ((data ?? []) as unknown as Resident[]).filter((r) => !ARCHIVED.includes(r.residency_status ?? ""));
    },
  });
}
function useDays() {
  return useQuery({
    queryKey: ["rotd", "days"],
    queryFn: async () => {
      const { data, error } = await db.from("rotd_days").select("*").order("day_date", { ascending: false }).limit(2000);
      if (error) throw error;
      return (data ?? []) as Day[];
    },
  });
}
function useFrequencies() {
  return useQuery({
    queryKey: ["rotd", "freq"],
    queryFn: async () => {
      const { data, error } = await db.from("rotd_resident_settings").select("resident_id, every_months");
      if (error) throw error;
      return new Map<string, number>(((data ?? []) as { resident_id: string; every_months: number }[]).map((r) => [r.resident_id, r.every_months]));
    },
  });
}
function useStaff() {
  return useQuery({
    queryKey: ["rotd", "staff"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").order("full_name"),
        supabase.rpc("list_staff_roles"),
      ]);
      const staffIds = new Set((roles ?? []).filter((r: { role: string }) => r.role !== "family").map((r: { user_id: string }) => r.user_id));
      return (profiles ?? []).filter((p) => staffIds.has(p.id)) as { id: string; full_name: string | null }[];
    },
  });
}
function useCanSign() {
  return useQuery({
    queryKey: ["rotd", "can-sign"],
    queryFn: async () => {
      const id = await currentUserId();
      if (!id) return false;
      const { data, error } = await db.rpc("can_sign_rotd", { _uid: id });
      return error ? false : !!data;
    },
  });
}

// ---------- page ----------

function RotdPage() {
  const settings = useSettings();
  const residents = useResidents();
  const days = useDays();
  const freq = useFrequencies();
  const staff = useStaff();
  const canSign = useCanSign();

  const s = settings.data ?? DEFAULT_SETTINGS;
  const staffName = (id: string | null) => staff.data?.find((p) => p.id === id)?.full_name ?? (id ? "Unknown" : "Unassigned");

  return (
    <AppShell title="Resident of the Day" subtitle="Every department listens, acts, and the manager signs it off">
      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="actions">Action log</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-4">
          <TodayTab
            settings={s}
            residents={residents.data ?? []}
            days={days.data ?? []}
            freq={freq.data ?? new Map()}
            canSign={!!canSign.data}
            staff={staff.data ?? []}
          />
        </TabsContent>
        <TabsContent value="actions" className="mt-4">
          <ActionLog canSign={!!canSign.data} staffName={staffName} departments={s.departments} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab
            settings={s}
            residents={residents.data ?? []}
            staff={staff.data ?? []}
            canSign={!!canSign.data}
            freq={freq.data ?? new Map()}
          />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

// ---------- today ----------

function TodayTab({
  settings, residents, days, freq, canSign, staff,
}: {
  settings: Settings; residents: Resident[]; days: Day[]; freq: Map<string, number>; canSign: boolean;
  staff: { id: string; full_name: string | null }[];
}) {
  const qc = useQueryClient();
  const today = todayISO();
  const todays = days.filter((d) => d.day_date === today);
  const [manualId, setManualId] = useState("");

  // Last day each resident had, and when they are next due.
  const lastDate = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of days) {
      if (d.day_date > today) continue;
      if (!m.has(d.resident_id) || d.day_date > (m.get(d.resident_id) as string)) m.set(d.resident_id, d.day_date);
    }
    return m;
  }, [days, today]);

  const dueDate = (r: Resident) => {
    const last = lastDate.get(r.id);
    return last ? addMonthsISO(last, freq.get(r.id) ?? settings.default_every_months) : "0000-00-00";
  };

  const proposed = useMemo(() => {
    if (settings.mode === "manual") return [] as Resident[];
    const taken = new Set(todays.map((d) => d.resident_id));
    const sorted = residents
      .filter((r) => !taken.has(r.id))
      .sort((a, b) => dueDate(a).localeCompare(dueDate(b)) || roomKey(a) - roomKey(b));
    if (settings.mode === "room_order") return sorted.slice(0, 1);
    const seen = new Set<string>();
    const out: Resident[] = [];
    for (const r of sorted) {
      const u = unitOf(r) ?? "No unit";
      if (seen.has(u)) continue;
      seen.add(u);
      out.push(r);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residents, days, settings]);

  const coverage = useMemo(() => {
    const covered = residents.filter((r) => dueDate(r) >= today).length;
    return { covered, total: residents.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residents, days, settings, freq]);

  const start = useMutation({
    mutationFn: async (r: Resident) => {
      const { error } = await db.from("rotd_days").insert({
        resident_id: r.id,
        day_date: today,
        unit: unitOf(r),
        status: "in_progress",
        created_by: await currentUserId(),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Resident of the Day started"); qc.invalidateQueries({ queryKey: ["rotd"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const nameOf = (id: string) => residents.find((r) => r.id === id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Star className="h-4 w-4 text-primary" />
        <span>
          {coverage.covered} of {coverage.total} residents are within their review period.
        </span>
      </div>

      {todays.map((d) => (
        <DayCard key={d.id} day={d} resident={nameOf(d.resident_id)} settings={settings} canSign={canSign} staff={staff} />
      ))}

      {(proposed.length > 0 || settings.mode === "manual") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {settings.mode === "manual" ? "Choose today's resident" : "Suggested for today"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {settings.mode !== "manual" && proposed.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <div>
                  <span className="font-medium">{r.preferred_name || r.full_name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {r.room_number ? `Room ${r.room_number}` : "No room"}{unitOf(r) ? ` · ${unitOf(r)}` : ""}
                    {lastDate.get(r.id) ? ` · last on ${format(new Date(lastDate.get(r.id) as string), "d MMM yyyy")}` : " · not had a day yet"}
                  </span>
                </div>
                <Button size="sm" onClick={() => start.mutate(r)} disabled={start.isPending}>Start</Button>
              </div>
            ))}
            <div className="flex flex-wrap items-end gap-2 pt-1">
              <div className="min-w-[14rem] flex-1">
                <Label className="text-xs">{settings.mode === "manual" ? "Resident" : "Or pick a different resident"}</Label>
                <Select value={manualId} onValueChange={setManualId}>
                  <SelectTrigger><SelectValue placeholder="Choose a resident" /></SelectTrigger>
                  <SelectContent>
                    {residents.filter((r) => !todays.some((d) => d.resident_id === r.id)).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.full_name}{r.room_number ? ` · Room ${r.room_number}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                disabled={!manualId || start.isPending}
                onClick={() => { const r = nameOf(manualId); if (r) start.mutate(r); setManualId(""); }}
              >
                Start
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {todays.length === 0 && proposed.length === 0 && settings.mode !== "manual" && (
        <p className="text-sm text-muted-foreground">No residents to suggest. Add residents first.</p>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<Day["status"], string> = {
  planned: "Planned",
  in_progress: "In progress",
  awaiting_signoff: "Awaiting sign-off",
  signed_off: "Signed off",
};

function DayCard({
  day, resident, settings, canSign, staff,
}: {
  day: Day; resident?: Resident; settings: Settings; canSign: boolean;
  staff: { id: string; full_name: string | null }[];
}) {
  const qc = useQueryClient();
  const locked = day.status === "signed_off";

  const reviews = useQuery({
    queryKey: ["rotd", "reviews", day.id],
    queryFn: async () => {
      const { data, error } = await db.from("rotd_reviews").select("*").eq("day_id", day.id);
      if (error) throw error;
      return (data ?? []) as Review[];
    },
  });
  const actions = useQuery({
    queryKey: ["rotd", "day-actions", day.id],
    queryFn: async () => {
      const { data, error } = await db.from("rotd_actions").select("*").eq("day_id", day.id).order("created_at");
      if (error) throw error;
      return (data ?? []) as Action[];
    },
  });

  const [voice, setVoice] = useState(day.resident_voice ?? "");
  const [spokeFor, setSpokeFor] = useState(day.spoke_for_resident ?? "");
  const [meeting, setMeeting] = useState(day.meeting_notes ?? "");
  const [nextSteps, setNextSteps] = useState(day.next_steps ?? "");
  const [consent, setConsent] = useState(!!day.recording_consent);
  const [basis, setBasis] = useState(day.consent_basis ?? "resident");
  const [voiceTranscript, setVoiceTranscript] = useState(day.voice_transcript ?? "");
  const [drafts, setDrafts] = useState<DraftAction[]>([]);

  const updateDay = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await db.from("rotd_days").update(patch).eq("id", day.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rotd"] }),
    onError: (e) => toast.error(errMsg(e)),
  });

  const saveNotes = () =>
    updateDay.mutate(
      { resident_voice: voice || null, spoke_for_resident: spokeFor || null, meeting_notes: meeting || null, next_steps: nextSteps || null, voice_transcript: voiceTranscript || null },
      { onSuccess: () => toast.success("Saved") },
    );

  const saveConsent = (c: boolean, b: string) => {
    setConsent(c);
    setBasis(b);
    updateDay.mutate({ recording_consent: c, consent_basis: c ? b : null });
  };
  const addDrafts = (department: string, list: { concern: string }[]) =>
    setDrafts((d) => [...d, ...list.map((a) => ({ department, concern: a.concern, share: false }))]);

  const reviewedCount = (reviews.data ?? []).filter((r) => r.completed_at).length;
  const name = resident?.preferred_name || resident?.full_name || "Resident";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              <Star className="mr-1 inline h-4 w-4 text-primary" />
              {name}
              {resident?.preferred_name && resident.full_name !== resident.preferred_name ? (
                <span className="ml-1 text-sm font-normal text-muted-foreground">({resident.full_name})</span>
              ) : null}
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {resident?.room_number ? `Room ${resident.room_number}` : "No room"}{day.unit ? ` · ${day.unit}` : ""} ·{" "}
              {reviewedCount} of {settings.departments.length} departments reviewed
              {resident && <> · <Link to="/residents/$id" params={{ id: resident.id }} className="underline">open file</Link></>}
            </p>
          </div>
          <Badge variant={locked ? "default" : "outline"}>{STATUS_LABEL[day.status]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!locked && (
          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={consent} onCheckedChange={(v) => saveConsent(!!v, basis)} className="mt-0.5" />
              <span>
                {name} (or their representative) has agreed to this conversation being recorded and written down.
                <span className="block text-[11px] text-muted-foreground">The sound is not kept. Only the written transcript is saved.</span>
              </span>
            </label>
            {consent && (
              <Select value={basis} onValueChange={(v) => saveConsent(true, v)}>
                <SelectTrigger className="h-8 w-full text-xs md:w-80"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="resident">The resident agreed</SelectItem>
                  <SelectItem value="best_interests">Best-interests decision (resident lacks capacity)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">In {name}'s own words</Label>
              {!locked && <DictateButton onText={(t) => setVoice((v) => joinText(v, t))} />}
            </div>
            <Textarea rows={3} value={voice} disabled={locked} onChange={(e) => setVoice(e.target.value)}
              placeholder="What did they say about their care, their day, what matters to them?" />
            {!locked && (
              <div className="mt-2">
                <RotdConversationRecorder
                  residentName={name}
                  department="resident (general chat)"
                  label="Record a chat with the resident"
                  disabled={!consent}
                  disabledReason="Tick the consent box first"
                  onResult={(r) => {
                    setVoice((v) => joinText(v, r.residentWords || r.transcript));
                    setVoiceTranscript((t) => joinText(t, r.transcript));
                    addDrafts(settings.departments[0] ?? "care", r.actions);
                    toast.success("Draft ready — check it, then Save notes");
                  }}
                />
              </div>
            )}
            {voiceTranscript && (
              <details className="mt-1 text-[11px] text-muted-foreground">
                <summary className="cursor-pointer">View transcript</summary>
                <p className="mt-1 whitespace-pre-wrap italic">{voiceTranscript}</p>
              </details>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">If they could not give their view, who spoke for them?</Label>
              {!locked && <DictateButton onText={(t) => setSpokeFor((v) => joinText(v, t))} />}
            </div>
            <Textarea rows={3} value={spokeFor} disabled={locked} onChange={(e) => setSpokeFor(e.target.value)}
              placeholder="e.g. daughter, advocate, key worker" />
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold">Department conversations</h4>
          <div className="grid gap-3 md:grid-cols-2">
            {settings.departments.map((dept) => (
              <DeptReview key={dept} day={day} dept={dept} existing={reviews.data?.find((r) => r.department === dept)} locked={locked} consent={consent} residentName={name} onDrafts={addDrafts} />
            ))}
          </div>
        </div>

        <ActionsPanel day={day} settings={settings} actions={actions.data ?? []} locked={locked} staff={staff} drafts={drafts} onDraftsChange={setDrafts} />

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Planning meeting notes</Label>
              {!locked && <DictateButton onText={(t) => setMeeting((v) => joinText(v, t))} />}
            </div>
            <Textarea rows={3} value={meeting} disabled={locked} onChange={(e) => setMeeting(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Next steps</Label>
              {!locked && <DictateButton onText={(t) => setNextSteps((v) => joinText(v, t))} />}
            </div>
            <Textarea rows={3} value={nextSteps} disabled={locked} onChange={(e) => setNextSteps(e.target.value)} />
          </div>
        </div>

        {locked ? (
          <p className="text-xs text-muted-foreground">
            Signed off {day.signed_off_at ? format(new Date(day.signed_off_at), "d MMM yyyy HH:mm") : ""}.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button variant="outline" onClick={saveNotes} disabled={updateDay.isPending}>Save notes</Button>
            {day.status !== "awaiting_signoff" && (
              <Button variant="outline" onClick={() => { saveNotes(); updateDay.mutate({ status: "awaiting_signoff" }); }}>
                Ready for sign-off
              </Button>
            )}
            {canSign ? (
              <Button
                onClick={async () => {
                  if (reviewedCount < settings.departments.length &&
                    !confirm(`Only ${reviewedCount} of ${settings.departments.length} departments have a review. Sign off anyway?`)) return;
                  updateDay.mutate(
                    { status: "signed_off", signed_off_by: await currentUserId(), signed_off_at: new Date().toISOString() },
                    { onSuccess: () => toast.success("Signed off") },
                  );
                }}
              >
                <ShieldCheck className="mr-1 h-4 w-4" /> Sign off day
              </Button>
            ) : (
              <p className="self-center text-xs text-muted-foreground">A manager, deputy or clinical lead signs this off.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeptReview({
  day, dept, existing, locked, consent, residentName, onDrafts,
}: {
  day: Day; dept: string; existing?: Review; locked: boolean; consent: boolean; residentName: string;
  onDrafts: (dept: string, list: { concern: string }[]) => void;
}) {
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState(existing?.feedback ?? "");
  const [improvement, setImprovement] = useState(existing?.improvement ?? "");
  const [transcript, setTranscript] = useState(existing?.transcript ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("rotd_reviews").upsert(
        {
          day_id: day.id, department: dept, feedback: feedback || null, improvement: improvement || null,
          transcript: transcript || null, source: transcript ? "conversation" : "typed",
          completed_by: await currentUserId(), completed_at: new Date().toISOString(),
        },
        { onConflict: "day_id,department" },
      );
      if (error) throw error;
    },
    onSuccess: () => { toast.success(`${deptLabel(dept)} saved`); qc.invalidateQueries({ queryKey: ["rotd", "reviews", day.id] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{deptLabel(dept)}</span>
        {existing?.completed_at && <Badge className="border border-emerald-500/40 bg-emerald-500/15 text-[10px] text-emerald-700"><Check className="mr-1 h-3 w-3" />Done</Badge>}
      </div>
      {!locked && (
        <RotdConversationRecorder
          residentName={residentName}
          department={deptLabel(dept)}
          disabled={!consent}
          disabledReason="Tick the consent box above first"
          onResult={(r) => {
            if (r.feedback) setFeedback((v) => joinText(v, r.feedback));
            if (r.improvement) setImprovement((v) => joinText(v, r.improvement));
            setTranscript((t) => joinText(t, r.transcript));
            if (r.actions.length) onDrafts(dept, r.actions);
            toast.success("Draft ready — check it, then Save");
          }}
        />
      )}
      <div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px]">How do they feel about the service?</Label>
          {!locked && <DictateButton onText={(t) => setFeedback((v) => joinText(v, t))} />}
        </div>
        <Textarea rows={2} value={feedback} disabled={locked} onChange={(e) => setFeedback(e.target.value)} />
      </div>
      <div>
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[11px]">What could we do to make it even better?</Label>
          {!locked && <DictateButton onText={(t) => setImprovement((v) => joinText(v, t))} />}
        </div>
        <Textarea rows={2} value={improvement} disabled={locked} onChange={(e) => setImprovement(e.target.value)} />
      </div>
      {transcript && (
        <details className="text-[11px] text-muted-foreground">
          <summary className="cursor-pointer">View transcript</summary>
          <p className="mt-1 whitespace-pre-wrap italic">{transcript}</p>
        </details>
      )}
      {!locked && (
        <Button size="sm" variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>Save {deptLabel(dept).toLowerCase()}</Button>
      )}
    </div>
  );
}

function ActionsPanel({
  day, settings, actions, locked, staff, drafts, onDraftsChange,
}: {
  day: Day; settings: Settings; actions: Action[]; locked: boolean; staff: { id: string; full_name: string | null }[];
  drafts: DraftAction[]; onDraftsChange: (d: DraftAction[]) => void;
}) {
  const qc = useQueryClient();
  const [concern, setConcern] = useState("");
  const [dept, setDept] = useState(settings.departments[0] ?? "care");
  const [owner, setOwner] = useState("none");
  const [due, setDue] = useState("");
  const [share, setShare] = useState(true);

  const add = useMutation({
    mutationFn: async () => {
      if (!concern.trim()) throw new Error("Write the concern or wish first");
      const { error } = await db.from("rotd_actions").insert({
        day_id: day.id, resident_id: day.resident_id, department: dept, concern: concern.trim(),
        owner_id: owner === "none" ? null : owner, due_date: due || null, status: "open",
        share_with_family: share, created_by: await currentUserId(),
      });
      if (error) throw error;
    },
    onSuccess: () => { setConcern(""); setDue(""); setOwner("none"); toast.success("Action added"); qc.invalidateQueries({ queryKey: ["rotd"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  // An AI-suggested action only becomes a real action when staff add it.
  const addDraft = useMutation({
    mutationFn: async (index: number) => {
      const d = drafts[index];
      if (!d || !d.concern.trim()) throw new Error("This suggestion is empty");
      const { error } = await db.from("rotd_actions").insert({
        day_id: day.id, resident_id: day.resident_id, department: d.department, concern: d.concern.trim(),
        status: "open", source: "ai_draft", share_with_family: !!d.share, created_by: await currentUserId(),
      });
      if (error) throw error;
    },
    onSuccess: (_d, index) => {
      onDraftsChange(drafts.filter((_, j) => j !== index));
      toast.success("Action added");
      qc.invalidateQueries({ queryKey: ["rotd"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">Actions from today</h4>

      {drafts.length > 0 && !locked && (
        <div className="mb-3 space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
          <p className="text-xs font-medium">Suggested from the conversation. Check each one, then add or dismiss.</p>
          {drafts.map((d, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Input
                className="min-w-[12rem] flex-1"
                value={d.concern}
                onChange={(e) => onDraftsChange(drafts.map((x, j) => (j === i ? { ...x, concern: e.target.value } : x)))}
              />
              <Badge variant="secondary" className="text-[10px]">{deptLabel(d.department)}</Badge>
              <label className="flex items-center gap-1 text-[11px]">
                <Checkbox
                  checked={!!d.share}
                  onCheckedChange={(v) => onDraftsChange(drafts.map((x, j) => (j === i ? { ...x, share: !!v } : x)))}
                />
                Family can see when done
              </label>
              <Button size="sm" onClick={() => addDraft.mutate(i)} disabled={addDraft.isPending}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => onDraftsChange(drafts.filter((_, j) => j !== i))}>Dismiss</Button>
            </div>
          ))}
        </div>
      )}

      {actions.length === 0 && <p className="mb-2 text-xs text-muted-foreground">No actions yet.</p>}
      <ul className="mb-3 space-y-1.5">
        {actions.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
            <span className="flex-1">{a.concern}</span>
            <Badge variant="secondary" className="text-[10px]">{deptLabel(a.department)}</Badge>
            <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
          </li>
        ))}
      </ul>
      {!locked && (
        <div className="grid gap-2 rounded-md border bg-muted/20 p-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[11px]">Concern or wish</Label>
              <DictateButton onText={(t) => setConcern((v) => joinText(v, t))} />
            </div>
            <Input value={concern} onChange={(e) => setConcern(e.target.value)} placeholder='e.g. "Would like my room painted blue"' />
          </div>
          <div>
            <Label className="text-[11px]">Department</Label>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{settings.departments.map((d) => <SelectItem key={d} value={d}>{deptLabel(d)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Owner</Label>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not assigned</SelectItem>
                {staff.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? "Unnamed"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Due date</Label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <Checkbox checked={share} onCheckedChange={(v) => setShare(!!v)} /> Show on the Family page when done
          </label>
          <div className="md:col-span-2">
            <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>Add action</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- action log ----------

function ActionLog({ canSign, staffName, departments }: { canSign: boolean; staffName: (id: string | null) => string; departments: string[] }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState("open");
  const [dept, setDept] = useState("all");

  const { data = [], isLoading } = useQuery({
    queryKey: ["rotd", "actions"],
    queryFn: async () => {
      const { data, error } = await db.from("rotd_actions").select("*, residents(full_name, room_number)").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Action[];
    },
  });

  const rows = data.filter((a) =>
    (dept === "all" || a.department === dept) &&
    (status === "all" || (status === "awaiting" ? a.status === "done" && !a.signed_off_by : a.status === status)));

  const patch = useMutation({
    mutationFn: async (p: { id: string; values: Record<string, unknown> }) => {
      const { error } = await db.from("rotd_actions").update(p.values).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rotd"] }),
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="awaiting">Done, awaiting sign-off</SelectItem>
            <SelectItem value="done">All done</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => <SelectItem key={d} value={d}>{deptLabel(d)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No actions here.</p>}

      <ul className="space-y-2">
        {rows.map((a) => {
          const rag = a.status === "done" ? "none" : ragForDate(a.due_date);
          return (
            <li key={a.id} className="rounded-xl border bg-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a.concern}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.residents?.full_name ?? "Resident"}{a.residents?.room_number ? ` · Room ${a.residents.room_number}` : ""} ·{" "}
                    {deptLabel(a.department)} · {staffName(a.owner_id)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {a.due_date && a.status !== "done" && (
                    <Badge className={`border text-[10px] ${RAG_CLASS[rag]}`}>
                      {ragText(daysUntil(a.due_date))}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                  {a.signed_off_by && <Badge className="border border-emerald-500/40 bg-emerald-500/15 text-[10px] text-emerald-700">Signed off</Badge>}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {a.status !== "done" && (
                  <Button size="sm" variant="outline" disabled={patch.isPending}
                    onClick={async () => patch.mutate({ id: a.id, values: { status: "done", completed_by: await currentUserId(), completed_at: new Date().toISOString() } })}>
                    <Check className="mr-1 h-3.5 w-3.5" />Mark done
                  </Button>
                )}
                {a.status === "done" && !a.signed_off_by && canSign && (
                  <Button size="sm" disabled={patch.isPending}
                    onClick={async () => patch.mutate({ id: a.id, values: { signed_off_by: await currentUserId(), signed_off_at: new Date().toISOString() } })}>
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />Sign off
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- settings ----------

function SettingsTab({
  settings, residents, staff, canSign, freq,
}: {
  settings: Settings; residents: Resident[]; staff: { id: string; full_name: string | null }[]; canSign: boolean; freq: Map<string, number>;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState(settings.mode);
  const [months, setMonths] = useState(String(settings.default_every_months));
  const [depts, setDepts] = useState(settings.departments.join(", "));
  const [resId, setResId] = useState("");
  const [resMonths, setResMonths] = useState("1");
  const [signerId, setSignerId] = useState("");
  const [signerTitle, setSignerTitle] = useState("");

  const signers = useQuery({
    queryKey: ["rotd", "signers"],
    queryFn: async () => {
      const { data, error } = await db.from("rotd_signers").select("*");
      if (error) throw error;
      return (data ?? []) as { user_id: string; title: string | null }[];
    },
  });

  const saveHome = useMutation({
    mutationFn: async () => {
      const list = depts.split(",").map((d) => d.trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean);
      if (list.length === 0) throw new Error("Add at least one department");
      const { error } = await db.from("rotd_settings").update({
        mode, default_every_months: Number(months), departments: list, updated_at: new Date().toISOString(), updated_by: await currentUserId(),
      }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["rotd"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const saveFreq = useMutation({
    mutationFn: async () => {
      if (!resId) throw new Error("Choose a resident");
      const { error } = await db.from("rotd_resident_settings").upsert(
        { resident_id: resId, every_months: Number(resMonths), updated_at: new Date().toISOString(), updated_by: await currentUserId() },
        { onConflict: "resident_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); setResId(""); qc.invalidateQueries({ queryKey: ["rotd"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const addSigner = useMutation({
    mutationFn: async () => {
      if (!signerId) throw new Error("Choose a person");
      const { error } = await db.from("rotd_signers").upsert(
        { user_id: signerId, title: signerTitle || null, added_by: await currentUserId() }, { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Added"); setSignerId(""); setSignerTitle(""); qc.invalidateQueries({ queryKey: ["rotd"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const removeSigner = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("rotd_signers").delete().eq("user_id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rotd"] }),
    onError: (e) => toast.error(errMsg(e)),
  });

  if (!canSign) {
    return <p className="text-sm text-muted-foreground">Settings are for managers, deputies and clinical leads.</p>;
  }

  const nameOf = (id: string) => staff.find((p) => p.id === id)?.full_name ?? "Unknown";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">How the home runs it</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs">How is today's resident suggested?</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as Settings["mode"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="room_order">One resident a day, following room numbers</SelectItem>
                <SelectItem value="per_unit">One resident per unit each day</SelectItem>
                <SelectItem value="manual">Manager chooses each day</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Each resident has a day every</Label>
            <Select value={months} onValueChange={setMonths}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 6, 12].map((m) => <SelectItem key={m} value={String(m)}>{m === 1 ? "month" : `${m} months`}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Departments (separate with commas)</Label>
            <Input value={depts} onChange={(e) => setDepts(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => saveHome.mutate()} disabled={saveHome.isPending}>Save</Button>
            {mode === "per_unit" && (
              <p className="mt-2 text-xs text-muted-foreground">
                "Per unit" uses the unit or wing recorded on each resident. Residents without one are grouped together.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Agreed with a resident or family</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[14rem] flex-1">
              <Label className="text-xs">Resident</Label>
              <Select value={resId} onValueChange={setResId}>
                <SelectTrigger><SelectValue placeholder="Choose a resident" /></SelectTrigger>
                <SelectContent>{residents.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Every</Label>
              <Select value={resMonths} onValueChange={setResMonths}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 6, 12].map((m) => <SelectItem key={m} value={String(m)}>{m === 1 ? "month" : `${m} months`}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => saveFreq.mutate()} disabled={saveFreq.isPending}>Save</Button>
          </div>
          {freq.size > 0 && (
            <ul className="text-xs text-muted-foreground">
              {Array.from(freq.entries()).map(([id, m]) => (
                <li key={id}>{residents.find((r) => r.id === id)?.full_name ?? "Resident"} — every {m} month{m === 1 ? "" : "s"}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Who can sign off</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Admins and Registered Managers can always sign off. Add deputies and clinical leads here.
          </p>
          <ul className="space-y-1">
            {(signers.data ?? []).map((s) => (
              <li key={s.user_id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>{nameOf(s.user_id)}{s.title ? ` · ${s.title}` : ""}</span>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeSigner.mutate(s.user_id)}>Remove</Button>
              </li>
            ))}
            {(signers.data ?? []).length === 0 && <li className="text-xs text-muted-foreground">No one added yet.</li>}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[14rem] flex-1">
              <Label className="text-xs">Person</Label>
              <Select value={signerId} onValueChange={setSignerId}>
                <SelectTrigger><SelectValue placeholder="Choose staff member" /></SelectTrigger>
                <SelectContent>{staff.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? "Unnamed"}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Title</Label>
              <Input value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} placeholder="Deputy manager" />
            </div>
            <Button variant="outline" onClick={() => addSigner.mutate()} disabled={addSigner.isPending}>Add</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
