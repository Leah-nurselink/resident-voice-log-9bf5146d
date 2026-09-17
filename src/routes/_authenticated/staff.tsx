import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { DAY_LABELS, EMPLOYMENT_STATUSES, RESTRICTION_TAGS, hhmm } from "@/lib/rota";
import { useCanWrite } from "@/hooks/useCanWrite";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Staff profiles · CareCore" },
      { name: "description", content: "Staff employment details, availability, qualifications, training, competencies and restrictions." },
      { property: "og:title", content: "Staff profiles · CareCore" },
      { property: "og:description", content: "Employment details, availability and training for every staff member." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffPage,
});

type StaffRow = {
  id: string;
  full_name: string | null;
  role: Role | null;
  profile: {
    id: string;
    job_title: string | null;
    employment_status: string;
    contracted_hours: number | null;
    start_date: string | null;
    leaving_date: string | null;
    phone: string | null;
    restrictions: string | null;
    restriction_tags: string[];
    notes: string | null;
  } | null;
};

function StaffPage() {
  const qc = useQueryClient();
  const canManage = useCanWrite("manage_rota");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const staff = useQuery({
    queryKey: ["staff-directory"],
    queryFn: async () => {
      const [{ data: profiles, error: pe }, { data: roles }, { data: sp }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").order("full_name"),
        supabase.from("user_roles").select("user_id, role, approved, is_active"),
        supabase.from("staff_profiles").select("*"),
      ]);
      if (pe) throw pe;
      return (profiles ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        role: ((roles ?? []).find((r) => r.user_id === p.id && r.approved && r.is_active)?.role ?? null) as Role | null,
        profile: ((sp ?? []).find((s) => s.user_id === p.id) ?? null) as StaffRow["profile"],
      })) as StaffRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (staff.data ?? []).filter((s) =>
      !q || [s.full_name, s.role, s.profile?.job_title].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [staff.data, search]);

  const selected = filtered.find((s) => s.id === openId) ?? (staff.data ?? []).find((s) => s.id === openId) ?? null;

  return (
    <AppShell title="Staff" subtitle="Employment details, availability, qualifications, training and restrictions">
      <div className="mb-4 flex items-center gap-2">
        <Input
          placeholder="Search staff by name, role or job title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((s) => (
          <Card key={s.id} className="cursor-pointer transition-colors hover:bg-accent/40" onClick={() => setOpenId(s.id)}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="h-4 w-4 text-primary" />
                {s.full_name ?? "Unnamed"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              <div className="flex flex-wrap items-center gap-1">
                {s.role && <Badge variant="secondary">{ROLE_LABELS[s.role]}</Badge>}
                <Badge variant="outline">
                  {EMPLOYMENT_STATUSES.find((e) => e.value === (s.profile?.employment_status ?? "employed"))?.label}
                </Badge>
              </div>
              {s.profile?.job_title && <div className="text-muted-foreground">{s.profile.job_title}</div>}
              {s.profile?.contracted_hours != null && (
                <div className="text-muted-foreground">{s.profile.contracted_hours} contracted hours / week</div>
              )}
              {!!s.profile?.restriction_tags?.length && (
                <div className="text-amber-700">Restrictions: {s.profile.restriction_tags.join(", ")}</div>
              )}
            </CardContent>
          </Card>
        ))}
        {!filtered.length && <p className="text-sm text-muted-foreground">No staff found.</p>}
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.full_name ?? "Unnamed"}</SheetTitle>
              </SheetHeader>
              <StaffDetail
                staff={selected}
                canManage={canManage}
                onSaved={() => qc.invalidateQueries({ queryKey: ["staff-directory"] })}
              />
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function StaffDetail({ staff, canManage, onSaved }: { staff: StaffRow; canManage: boolean; onSaved: () => void }) {
  return (
    <Tabs defaultValue="details" className="mt-4">
      <TabsList className="grid grid-cols-4">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="availability">Availability</TabsTrigger>
        <TabsTrigger value="training">Training</TabsTrigger>
        <TabsTrigger value="restrictions">Restrictions</TabsTrigger>
      </TabsList>

      <TabsContent value="details" className="mt-4">
        <DetailsForm staff={staff} canManage={canManage} onSaved={onSaved} />
      </TabsContent>
      <TabsContent value="availability" className="mt-4">
        <AvailabilityForm userId={staff.id} canManage={canManage} />
      </TabsContent>
      <TabsContent value="training" className="mt-4 space-y-6">
        <QualificationsList userId={staff.id} canManage={canManage} />
        <TrainingList userId={staff.id} canManage={canManage} />
        <CompetenciesList userId={staff.id} canManage={canManage} />
      </TabsContent>
      <TabsContent value="restrictions" className="mt-4">
        <RestrictionsForm staff={staff} canManage={canManage} onSaved={onSaved} />
      </TabsContent>
    </Tabs>
  );
}

async function upsertProfile(userId: string, patch: Record<string, unknown>) {
  const { error } = await supabase
    .from("staff_profiles")
    .upsert({ user_id: userId, ...patch } as never, { onConflict: "user_id" });
  if (error) throw error;
}

function DetailsForm({ staff, canManage, onSaved }: { staff: StaffRow; canManage: boolean; onSaved: () => void }) {
  const p = staff.profile;
  const [jobTitle, setJobTitle] = useState(p?.job_title ?? "");
  const [status, setStatus] = useState(p?.employment_status ?? "employed");
  const [hours, setHours] = useState(p?.contracted_hours?.toString() ?? "");
  const [startDate, setStartDate] = useState(p?.start_date ?? "");
  const [leavingDate, setLeavingDate] = useState(p?.leaving_date ?? "");
  const [phone, setPhone] = useState(p?.phone ?? "");

  const save = async () => {
    try {
      await upsertProfile(staff.id, {
        job_title: jobTitle || null,
        employment_status: status,
        contracted_hours: hours ? Number(hours) : null,
        start_date: startDate || null,
        leaving_date: leavingDate || null,
        phone: phone || null,
      });
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="text-xs text-muted-foreground">Role: {staff.role ? ROLE_LABELS[staff.role] : "Not set"} — roles are set on the Admin page.</div>
      <div><Label>Job title</Label><Input disabled={!canManage} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div>
      <div>
        <Label>Employment status</Label>
        <Select disabled={!canManage} value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {EMPLOYMENT_STATUSES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Contracted hours / week</Label><Input disabled={!canManage} type="number" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
        <div><Label>Phone</Label><Input disabled={!canManage} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Start date</Label><Input disabled={!canManage} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div><Label>Leaving date</Label><Input disabled={!canManage} type="date" value={leavingDate} onChange={(e) => setLeavingDate(e.target.value)} /></div>
      </div>
      {canManage && <Button onClick={save}>Save details</Button>}
    </div>
  );
}

function RestrictionsForm({ staff, canManage, onSaved }: { staff: StaffRow; canManage: boolean; onSaved: () => void }) {
  const [tags, setTags] = useState<string[]>(staff.profile?.restriction_tags ?? []);
  const [text, setText] = useState(staff.profile?.restrictions ?? "");

  const toggle = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const save = async () => {
    try {
      await upsertProfile(staff.id, { restriction_tags: tags, restrictions: text || null });
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        {RESTRICTION_TAGS.map((t) => (
          <label key={t} className="flex items-center gap-2 text-sm">
            <Checkbox disabled={!canManage} checked={tags.includes(t)} onCheckedChange={() => toggle(t)} />
            {t}
          </label>
        ))}
      </div>
      <div><Label>Other restrictions</Label><Textarea disabled={!canManage} rows={3} value={text} onChange={(e) => setText(e.target.value)} /></div>
      {canManage && <Button onClick={save}>Save restrictions</Button>}
    </div>
  );
}

function AvailabilityForm({ userId, canManage }: { userId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["staff-availability", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_availability").select("*").eq("user_id", userId);
      if (error) throw error;
      return data;
    },
  });

  const setDay = async (dow: number, patch: { available?: boolean; from_time?: string | null; to_time?: string | null }) => {
    const existing = (list.data ?? []).find((d) => d.day_of_week === dow);
    const row = {
      user_id: userId,
      day_of_week: dow,
      available: patch.available ?? existing?.available ?? true,
      from_time: patch.from_time !== undefined ? patch.from_time : (existing?.from_time ?? null),
      to_time: patch.to_time !== undefined ? patch.to_time : (existing?.to_time ?? null),
    };
    const { error } = await supabase.from("staff_availability").upsert(row as never, { onConflict: "user_id,day_of_week" });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["staff-availability", userId] });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Usual working pattern. Used to flag shifts that fall outside it.</p>
      {DAY_LABELS.map((label, dow) => {
        const d = (list.data ?? []).find((x) => x.day_of_week === dow);
        const available = d?.available ?? true;
        return (
          <div key={label} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
            <span className="w-24 text-sm">{label}</span>
            <label className="flex items-center gap-1 text-xs">
              <Checkbox disabled={!canManage} checked={available} onCheckedChange={(v) => setDay(dow, { available: !!v })} />
              Available
            </label>
            <Input
              disabled={!canManage || !available}
              type="time"
              className="w-28"
              value={d?.from_time?.slice(0, 5) ?? ""}
              onChange={(e) => setDay(dow, { from_time: e.target.value || null })}
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              disabled={!canManage || !available}
              type="time"
              className="w-28"
              value={d?.to_time?.slice(0, 5) ?? ""}
              onChange={(e) => setDay(dow, { to_time: e.target.value || null })}
            />
          </div>
        );
      })}
    </div>
  );
}

function QualificationsList({ userId, canManage }: { userId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("");
  const [awarded, setAwarded] = useState("");
  const [expiry, setExpiry] = useState("");

  const list = useQuery({
    queryKey: ["staff-qualifications", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_qualifications").select("*").eq("user_id", userId).order("title");
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    if (!title.trim()) return toast.error("Give the qualification a title");
    const { error } = await supabase.from("staff_qualifications").insert({
      user_id: userId, title, level: level || null, awarded_date: awarded || null, expiry_date: expiry || null,
    } as never);
    if (error) return toast.error(error.message);
    setTitle(""); setLevel(""); setAwarded(""); setExpiry("");
    qc.invalidateQueries({ queryKey: ["staff-qualifications", userId] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("staff_qualifications").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["staff-qualifications", userId] });
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Qualifications</h3>
      {(list.data ?? []).map((q) => (
        <div key={q.id} className="flex items-center justify-between rounded-md border p-2 text-xs">
          <div>
            <div className="font-medium">{q.title}{q.level ? ` — ${q.level}` : ""}</div>
            <div className="text-muted-foreground">
              {q.awarded_date ? `Awarded ${q.awarded_date}` : "No award date"}
              {q.expiry_date ? ` · expires ${q.expiry_date}` : ""}
              {q.expiry_date && q.expiry_date < today ? " · expired" : ""}
            </div>
          </div>
          {canManage && (
            <Button size="icon" variant="ghost" onClick={() => remove(q.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
          )}
        </div>
      ))}
      {!list.data?.length && <p className="text-xs text-muted-foreground">None recorded.</p>}
      {canManage && (
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input placeholder="Level" value={level} onChange={(e) => setLevel(e.target.value)} />
          <Input type="date" value={awarded} onChange={(e) => setAwarded(e.target.value)} />
          <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          <Button className="col-span-2" variant="outline" onClick={add}><Plus className="mr-1 h-4 w-4" /> Add qualification</Button>
        </div>
      )}
    </div>
  );
}

function TrainingList({ userId, canManage }: { userId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [course, setCourse] = useState("");
  const [completed, setCompleted] = useState("");
  const [renewal, setRenewal] = useState("");

  const list = useQuery({
    queryKey: ["staff-training", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_training").select("*").eq("user_id", userId).order("course");
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    if (!course.trim()) return toast.error("Give the course a name");
    const { error } = await supabase.from("staff_training").insert({
      user_id: userId, course, completed_date: completed || null, renewal_due: renewal || null,
    } as never);
    if (error) return toast.error(error.message);
    setCourse(""); setCompleted(""); setRenewal("");
    qc.invalidateQueries({ queryKey: ["staff-training", userId] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("staff_training").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["staff-training", userId] });
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Training</h3>
      {(list.data ?? []).map((t) => (
        <div key={t.id} className="flex items-center justify-between rounded-md border p-2 text-xs">
          <div>
            <div className="font-medium">{t.course}</div>
            <div className="text-muted-foreground">
              {t.completed_date ? `Completed ${t.completed_date}` : "Not completed"}
              {t.renewal_due ? ` · renewal due ${t.renewal_due}` : ""}
              {t.renewal_due && t.renewal_due < today ? " · overdue" : ""}
            </div>
          </div>
          {canManage && (
            <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
          )}
        </div>
      ))}
      {!list.data?.length && <p className="text-xs text-muted-foreground">None recorded.</p>}
      {canManage && (
        <div className="grid grid-cols-2 gap-2">
          <Input className="col-span-2" placeholder="Course" value={course} onChange={(e) => setCourse(e.target.value)} />
          <Input type="date" value={completed} onChange={(e) => setCompleted(e.target.value)} />
          <Input type="date" value={renewal} onChange={(e) => setRenewal(e.target.value)} />
          <Button className="col-span-2" variant="outline" onClick={add}><Plus className="mr-1 h-4 w-4" /> Add training</Button>
        </div>
      )}
    </div>
  );
}

function CompetenciesList({ userId, canManage }: { userId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [skill, setSkill] = useState("");
  const [level, setLevel] = useState("");
  const [date, setDate] = useState("");

  const list = useQuery({
    queryKey: ["staff-competencies", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_competencies").select("*").eq("user_id", userId).order("skill");
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    if (!skill.trim()) return toast.error("Name the competency");
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("staff_competencies").insert({
      user_id: userId, skill, level: level || null, signed_off_date: date || null, signed_off_by: auth.user?.id ?? null,
    } as never);
    if (error) return toast.error(error.message);
    setSkill(""); setLevel(""); setDate("");
    qc.invalidateQueries({ queryKey: ["staff-competencies", userId] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("staff_competencies").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["staff-competencies", userId] });
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Competencies</h3>
      {(list.data ?? []).map((c) => (
        <div key={c.id} className="flex items-center justify-between rounded-md border p-2 text-xs">
          <div>
            <div className="font-medium">{c.skill}{c.level ? ` — ${c.level}` : ""}</div>
            {c.signed_off_date && <div className="text-muted-foreground">Signed off {c.signed_off_date}</div>}
          </div>
          {canManage && (
            <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
          )}
        </div>
      ))}
      {!list.data?.length && <p className="text-xs text-muted-foreground">None recorded.</p>}
      {canManage && (
        <div className="grid grid-cols-2 gap-2">
          <Input className="col-span-2" placeholder="Skill" value={skill} onChange={(e) => setSkill(e.target.value)} />
          <Input placeholder="Level" value={level} onChange={(e) => setLevel(e.target.value)} />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button className="col-span-2" variant="outline" onClick={add}><Plus className="mr-1 h-4 w-4" /> Add competency</Button>
        </div>
      )}
    </div>
  );
}

export { hhmm };
