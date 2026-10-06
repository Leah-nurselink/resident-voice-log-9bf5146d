import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CalendarPlus, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/permissions";
import {
  STATUS_CLASSES,
  STATUS_LABELS,
  hhmm,
  shiftStatus,
  type ShiftRow,
  type StaffContext,
} from "@/lib/rota";
import { assignmentFlags, fmtDate, type LeaveRow } from "@/lib/rota-rules";
import { useCanWrite } from "@/hooks/useCanWrite";

export const Route = createFileRoute("/_authenticated/rota")({
  head: () => ({
    meta: [
      { title: "Rota · CareCore" },
      { name: "description", content: "Service-based rota for care home shifts and domiciliary visits, with leave and assignment checks." },
      { property: "og:title", content: "Rota · CareCore" },
      { property: "og:description", content: "Weekly rota, leave and assignment checks for each service." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RotaPage,
});

type ServiceRow = {
  id: string;
  name: string;
  service_type: string;
  address: string | null;
  settings: Record<string, unknown> | null;
  is_active: boolean;
};

type RotaStaff = {
  id: string;
  full_name: string | null;
  role: Role | null;
  profile: {
    skills: string[] | null;
    home_zone: string | null;
    max_weekly_hours: number | null;
    wants_extra_shifts: boolean | null;
    employment_status: string | null;
    restriction_tags: string[] | null;
    restrictions: string | null;
  } | null;
  serviceIds: string[];
};

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEAVE_LABELS: Record<string, string> = { annual_leave: "Annual leave", sick: "Sick", other: "Other" };

function mondayOf(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function fmtDay(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function RotaPage() {
  const qc = useQueryClient();
  const canManage = useCanWrite("manage_rota");
  const [serviceIdChoice, setServiceIdChoice] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [tab, setTab] = useState("rota");
  const [assignId, setAssignId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const weekEnd = addDays(weekStart, 6);
  const fromISO = fmtDate(weekStart);
  const toISO = fmtDate(weekEnd);

  const services = useQuery({
    queryKey: ["rota-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return (data ?? []) as unknown as ServiceRow[];
    },
  });

  const service = useMemo(
    () => (services.data ?? []).find((s) => s.id === serviceIdChoice) ?? services.data?.[0] ?? null,
    [services.data, serviceIdChoice],
  );

  const staff = useQuery({
    queryKey: ["rota-staff"],
    queryFn: async () => {
      const [{ data: profiles, error: pe }, { data: roles }, { data: sp }, { data: links }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").order("full_name"),
        // user_roles RLS only returns your own row; use the staff-safe helper for the team.
        supabase.rpc("list_staff_roles"),
        supabase.from("staff_profiles").select("user_id, skills, home_zone, max_weekly_hours, wants_extra_shifts, employment_status, restriction_tags, restrictions"),
        supabase.from("staff_services").select("user_id, service_id"),
      ]);
      if (pe) throw pe;
      return (profiles ?? [])
        .map((p) => ({
          id: p.id,
          full_name: p.full_name,
          role: ((roles ?? []).find((r) => r.user_id === p.id && r.approved && r.is_active)?.role ?? null) as Role | null,
          profile: (sp ?? []).find((s) => s.user_id === p.id) ?? null,
          serviceIds: (links ?? []).filter((l) => l.user_id === p.id).map((l) => l.service_id),
        }))
        .filter((s) => s.role && s.role !== "family") as unknown as RotaStaff[];
    },
  });

  const shifts = useQuery({
    queryKey: ["rota-shifts", service?.id, fromISO],
    enabled: !!service,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .eq("service_id", service!.id)
        .gte("shift_date", fromISO)
        .lte("shift_date", toISO)
        .order("shift_date")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as unknown as ShiftRow[];
    },
  });

  const availability = useQuery({
    queryKey: ["rota-availability"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_availability").select("user_id, day_of_week, available, from_time, to_time");
      if (error) throw error;
      return data ?? [];
    },
  });
  const quals = useQuery({
    queryKey: ["rota-quals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_qualifications").select("user_id, title, expiry_date");
      if (error) throw error;
      return data ?? [];
    },
  });
  const training = useQuery({
    queryKey: ["rota-training"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_training").select("user_id, course, renewal_due");
      if (error) throw error;
      return data ?? [];
    },
  });
  const leave = useQuery({
    queryKey: ["rota-leave"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_leave").select("*").order("start_date");
      if (error) throw error;
      return (data ?? []) as unknown as LeaveRow[];
    },
  });

  const restGap = Number((service?.settings as { rest_gap_hours?: number } | null)?.rest_gap_hours ?? 11);
  const allShifts = shifts.data ?? [];
  const allLeave = leave.data ?? [];

  const buildCtx = (uid: string): (StaffContext & { max_weekly_hours: number | null }) | null => {
    const s = (staff.data ?? []).find((x) => x.id === uid);
    if (!s) return null;
    return {
      role: s.role,
      availability: (availability.data ?? [])
        .filter((a) => a.user_id === uid)
        .map((a) => ({ day_of_week: a.day_of_week, available: a.available, from_time: a.from_time, to_time: a.to_time })),
      qualifications: (quals.data ?? []).filter((q) => q.user_id === uid).map((q) => ({ title: q.title, expiry_date: q.expiry_date })),
      training: (training.data ?? []).filter((t) => t.user_id === uid).map((t) => ({ course: t.course, renewal_due: t.renewal_due })),
      restrictions: s.profile?.restrictions ?? null,
      restrictionTags: s.profile?.restriction_tags ?? [],
      employmentStatus: s.profile?.employment_status ?? null,
      otherShifts: allShifts.filter((x) => x.staff_user_id === uid),
      max_weekly_hours: s.profile?.max_weekly_hours ?? null,
    };
  };

  const nameOf = (uid: string | null) => (staff.data ?? []).find((s) => s.id === uid)?.full_name ?? "Unknown";

  const selectedShift = allShifts.find((s) => s.id === assignId) ?? null;
  const serviceStaff = (staff.data ?? []).filter((s) => !service || s.serviceIds.includes(service.id));

  const assign = async (candidate: RotaStaff) => {
    if (!selectedShift) return;
    const { error } = await supabase
      .from("shifts")
      .update({ staff_user_id: candidate.id, role: candidate.role } as never)
      .eq("id", selectedShift.id);
    if (error) return toast.error(error.message);
    toast.success(`Assigned to ${candidate.full_name ?? "staff"}`);
    setAssignId(null);
    qc.invalidateQueries({ queryKey: ["rota-shifts"] });
  };

  const unassign = async () => {
    if (!selectedShift) return;
    const { error } = await supabase.from("shifts").update({ staff_user_id: null, role: null } as never).eq("id", selectedShift.id);
    if (error) return toast.error(error.message);
    setAssignId(null);
    qc.invalidateQueries({ queryKey: ["rota-shifts"] });
  };

  const deleteShift = async () => {
    if (!selectedShift) return;
    const { error } = await supabase.from("shifts").delete().eq("id", selectedShift.id);
    if (error) return toast.error(error.message);
    toast.success("Shift deleted");
    setAssignId(null);
    qc.invalidateQueries({ queryKey: ["rota-shifts"] });
  };

  return (
    <AppShell
      title="Rota"
      subtitle={service ? `${service.name} — ${service.service_type === "domiciliary" ? "domiciliary care" : "care home"}` : "Weekly rota by service"}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={service?.id ?? ""} onValueChange={setServiceIdChoice}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Choose a service" /></SelectTrigger>
          <SelectContent>
            {(services.data ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(mondayOf(new Date()))}>This week</Button>
          <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-1 text-xs text-muted-foreground">w/c {fmtDay(weekStart)}</span>
        </div>
        {canManage && service?.service_type === "care_home" && (
          <Button className="ml-auto" onClick={() => setAddOpen(true)}>
            <CalendarPlus className="mr-1 h-4 w-4" /> Add shift
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 sm:w-64">
          <TabsTrigger value="rota">Rota</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
        </TabsList>

        <TabsContent value="rota" className="mt-4">
          {!service && <p className="text-sm text-muted-foreground">No services yet.</p>}
          {service?.service_type === "domiciliary" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Domiciliary rota</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Visits, runs and area-zone planning arrive in Phase 2. This service's team is listed below and leave is already tracked.
                </CardContent>
              </Card>
              <TeamList staff={serviceStaff} />
            </div>
          )}
          {service?.service_type === "care_home" && (
            <div className="space-y-5">
              {DAY_SHORT.map((label, i) => {
                const date = addDays(weekStart, i);
                const iso = fmtDate(date);
                const dayShifts = allShifts.filter((s) => s.shift_date === iso);
                return (
                  <section key={iso}>
                    <h3 className="mb-2 text-sm font-semibold">
                      {label} {date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {iso === fmtDate(new Date()) && <span className="ml-2 text-xs font-normal text-primary">Today</span>}
                    </h3>
                    {dayShifts.length === 0 && <p className="text-xs text-muted-foreground">No shifts.</p>}
                    <div className="grid gap-2">
                      {dayShifts.map((sh) => {
                        const status = shiftStatus(sh, false);
                        const flags = assignmentFlags(sh, sh.staff_user_id ? buildCtx(sh.staff_user_id) : null, allShifts, allLeave, restGap);
                        return (
                          <Card
                            key={sh.id}
                            className={cn(
                              !sh.staff_user_id && "border-destructive/40",
                              canManage && "cursor-pointer transition-colors hover:bg-accent/40",
                            )}
                            onClick={() => canManage && setAssignId(sh.id)}
                          >
                            <CardContent className="flex flex-wrap items-center gap-2 p-3">
                              <span className="text-sm font-medium">{hhmm(sh.start_time)}–{hhmm(sh.end_time)}</span>
                              <Badge variant={sh.staff_user_id ? "outline" : "destructive"}>
                                {sh.staff_user_id ? nameOf(sh.staff_user_id) : "Unassigned"}
                              </Badge>
                              {sh.role && <Badge variant="secondary">{ROLE_LABELS[sh.role as Role]}</Badge>}
                              <span className={cn("ml-auto rounded border px-1.5 py-0.5 text-xs", STATUS_CLASSES[status])}>
                                {STATUS_LABELS[status]}
                              </span>
                              {flags.length > 0 && (
                                <span className="flex items-center gap-1 text-xs text-amber-700">
                                  <AlertTriangle className="h-3 w-3" /> {flags.length} to review
                                </span>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="leave" className="mt-4">
          <LeaveTab canManage={canManage} staffOptions={staff.data ?? []} leaveRows={allLeave} nameOf={nameOf} onChanged={() => qc.invalidateQueries({ queryKey: ["rota-leave"] })} />
        </TabsContent>
      </Tabs>

      <Sheet open={!!selectedShift} onOpenChange={(o) => !o && setAssignId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selectedShift && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {fmtDay(new Date(`${selectedShift.shift_date}T00:00:00`))} · {hhmm(selectedShift.start_time)}–{hhmm(selectedShift.end_time)}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-2 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Currently: {selectedShift.staff_user_id ? nameOf(selectedShift.staff_user_id) : "Unassigned"}
                </p>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Assign to</h4>
                  {serviceStaff.map((c) => {
                    const flags = assignmentFlags({ ...selectedShift, staff_user_id: c.id } as ShiftRow, buildCtx(c.id), allShifts, allLeave, restGap);
                    return (
                      <div key={c.id} className="rounded-md border p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-sm font-medium">{c.full_name ?? "Unnamed"}</span>
                            {c.role && <Badge variant="secondary">{ROLE_LABELS[c.role]}</Badge>}
                            {c.profile?.home_zone && <Badge variant="outline">{c.profile.home_zone}</Badge>}
                          </div>
                          <Button size="sm" variant={flags.length ? "outline" : "default"} onClick={() => assign(c)}>
                            Assign
                          </Button>
                        </div>
                        {flags.map((f, i) => (
                          <p key={i} className="mt-1 flex items-start gap-1 text-xs text-amber-700">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {f}
                          </p>
                        ))}
                      </div>
                    );
                  })}
                  {!serviceStaff.length && <p className="text-xs text-muted-foreground">No staff linked to this service yet — link them on the Staff page or via leave tab team list.</p>}
                </div>
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  {selectedShift.staff_user_id && (
                    <Button variant="outline" onClick={unassign}>Remove assignment</Button>
                  )}
                  <Button variant="destructive" onClick={deleteShift}><Trash2 className="mr-1 h-4 w-4" /> Delete shift</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {service && (
        <AddShiftSheet
          open={addOpen}
          onOpenChange={setAddOpen}
          serviceId={service.id}
          staffOptions={serviceStaff}
          defaultDate={fromISO}
          onSaved={() => qc.invalidateQueries({ queryKey: ["rota-shifts"] })}
        />
      )}
    </AppShell>
  );
}

function TeamList({ staff }: { staff: RotaStaff[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {staff.map((s) => (
        <Card key={s.id}>
          <CardContent className="p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{s.full_name ?? "Unnamed"}</span>
              {s.role && <Badge variant="secondary">{ROLE_LABELS[s.role]}</Badge>}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {s.profile?.home_zone ? `Zone: ${s.profile.home_zone} · ` : ""}
              {s.profile?.max_weekly_hours != null ? `${s.profile.max_weekly_hours}h max / week · ` : ""}
              {s.profile?.wants_extra_shifts ? "wants extra shifts" : ""}
            </div>
          </CardContent>
        </Card>
      ))}
      {!staff.length && <p className="text-xs text-muted-foreground">No staff linked to this service yet.</p>}
    </div>
  );
}

function AddShiftSheet({
  open,
  onOpenChange,
  serviceId,
  staffOptions,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  serviceId: string;
  staffOptions: RotaStaff[];
  defaultDate: string;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("15:00");
  const [role, setRole] = useState<string>("carer");
  const [staffId, setStaffId] = useState<string>("none");
  const [cover, setCover] = useState(false);

  const save = async () => {
    const { error } = await supabase.from("shifts").insert({
      shift_date: date,
      start_time: start,
      end_time: end,
      location: "Care home",
      staff_user_id: staffId === "none" ? null : staffId,
      role: staffId === "none" ? role : (staffOptions.find((s) => s.id === staffId)?.role ?? role),
      cover_required: cover,
      resident_ids: [],
      handover_status: "not_started",
      service_id: serviceId,
    } as never);
    if (error) return toast.error(error.message);
    toast.success("Shift added");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader><SheetTitle>Add shift</SheetTitle></SheetHeader>
        <div className="mt-4 grid gap-3">
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label>End</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div>
            <Label>Staff</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Leave unfilled</SelectItem>
                {staffOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.full_name ?? "Unnamed"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {staffId === "none" && (
            <div>
              <Label>Role needed</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r !== "family" && r !== "md").map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={cover} onCheckedChange={(v) => setCover(!!v)} /> Flag as needing cover
          </label>
          <Button onClick={save}>Add shift</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LeaveTab({
  canManage,
  staffOptions,
  leaveRows,
  nameOf,
  onChanged,
}: {
  canManage: boolean;
  staffOptions: RotaStaff[];
  leaveRows: LeaveRow[];
  nameOf: (uid: string | null) => string;
  onChanged: () => void;
}) {
  const [staffId, setStaffId] = useState<string>("");
  const [type, setType] = useState("annual_leave");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");

  const add = async () => {
    if (!staffId || !start || !end) return toast.error("Pick a person and both dates");
    if (end < start) return toast.error("End date must be on or after the start date");
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("staff_leave").insert({
      user_id: staffId,
      leave_type: type,
      start_date: start,
      end_date: end,
      notes: notes || null,
      created_by: auth.user?.id ?? null,
    } as never);
    if (error) return toast.error(error.message);
    toast.success("Leave recorded");
    setStaffId(""); setStart(""); setEnd(""); setNotes("");
    onChanged();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("staff_leave").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChanged();
  };

  const today = fmtDate(new Date());

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">People on leave are flagged when you try to assign them — the rota never blocks by itself.</p>
      {leaveRows.map((l) => (
        <Card key={l.id}>
          <CardContent className="flex flex-wrap items-center gap-2 p-3 text-sm">
            <span className="font-medium">{nameOf(l.user_id)}</span>
            <Badge variant="outline">{LEAVE_LABELS[l.leave_type] ?? l.leave_type}</Badge>
            <span className="text-muted-foreground">{l.start_date} to {l.end_date}</span>
            {l.end_date >= today && <span className="text-xs text-primary">current or upcoming</span>}
            {canManage && (
              <Button size="icon" variant="ghost" className="ml-auto" aria-label="Delete leave" onClick={() => remove(l.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
      {!leaveRows.length && <p className="text-sm text-muted-foreground">No leave recorded.</p>}
      {canManage && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Record leave</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div>
              <Label>Staff member</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger><SelectValue placeholder="Choose a person" /></SelectTrigger>
                <SelectContent>
                  {staffOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name ?? "Unnamed"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual_leave">Annual leave</SelectItem>
                  <SelectItem value="sick">Sick</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>From</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
              <div><Label>To</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            </div>
            <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <Button onClick={add}>Save leave</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
