import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DAY_LABELS, STATUS_CLASSES, STATUS_LABELS, hhmm, shiftStatus, type ShiftRow } from "@/lib/rota";
import { fmtDate } from "@/lib/rota-rules";

export const Route = createFileRoute("/_authenticated/my-rota")({
  head: () => ({
    meta: [
      { title: "My rota · CareCore" },
      { name: "description", content: "Your shifts, your availability and your extra-shifts preference." },
      { property: "og:title", content: "My rota · CareCore" },
      { property: "og:description", content: "Your shifts, availability and extra-shifts preference." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyRotaPage,
});

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
function fmtDay(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function MyRotaPage() {
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const weekStart = mondayOf(new Date());
  const fromISO = fmtDate(weekStart);
  const toISO = fmtDate(addDays(weekStart, 34));

  const profile = useQuery({
    queryKey: ["my-rota-profile", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_profiles")
        .select("wants_extra_shifts")
        .eq("user_id", uid!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const shifts = useQuery({
    queryKey: ["my-rota-shifts", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .eq("staff_user_id", uid!)
        .gte("shift_date", fromISO)
        .lte("shift_date", toISO)
        .order("shift_date")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as unknown as ShiftRow[];
    },
  });

  const availability = useQuery({
    queryKey: ["my-rota-availability", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_availability").select("*").eq("user_id", uid!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const leave = useQuery({
    queryKey: ["my-rota-leave", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_leave")
        .select("id, leave_type, start_date, end_date")
        .eq("user_id", uid!)
        .gte("end_date", fromISO)
        .order("start_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const setExtraShifts = async (v: boolean) => {
    const { error } = await supabase
      .from("staff_profiles")
      .upsert({ user_id: uid, wants_extra_shifts: v } as never, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    toast.success(v ? "Thanks — we'll offer you extra shifts" : "You're set as not wanting extra shifts");
    qc.invalidateQueries({ queryKey: ["my-rota-profile"] });
  };

  const setDay = async (dow: number, patch: { available?: boolean; from_time?: string | null; to_time?: string | null }) => {
    const existing = (availability.data ?? []).find((d) => d.day_of_week === dow);
    const row = {
      user_id: uid,
      day_of_week: dow,
      available: patch.available ?? existing?.available ?? true,
      from_time: patch.from_time !== undefined ? patch.from_time : (existing?.from_time ?? null),
      to_time: patch.to_time !== undefined ? patch.to_time : (existing?.to_time ?? null),
    };
    const { error } = await supabase.from("staff_availability").upsert(row as never, { onConflict: "user_id,day_of_week" });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["my-rota-availability"] });
  };

  const rows = shifts.data ?? [];
  const weekRows = rows.filter((s) => s.shift_date >= fromISO && s.shift_date <= fmtDate(addDays(weekStart, 6)));
  const laterRows = rows.filter((s) => s.shift_date > fmtDate(addDays(weekStart, 6)));

  const ShiftCard = ({ sh }: { sh: ShiftRow }) => {
    const status = shiftStatus(sh, false);
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3 text-sm">
          <span className="font-medium">{fmtDay(sh.shift_date)}</span>
          <span>{hhmm(sh.start_time)}–{hhmm(sh.end_time)}</span>
          {sh.location && <Badge variant="outline">{sh.location}</Badge>}
          <span className={cn("ml-auto rounded border px-1.5 py-0.5 text-xs", STATUS_CLASSES[status])}>
            {STATUS_LABELS[status]}
          </span>
        </CardContent>
      </Card>
    );
  };

  return (
    <AppShell title="My rota" subtitle="Your shifts, your availability and your extra-shifts preference">
      <div className="space-y-6">
        <section>
          <h2 className="mb-2 text-sm font-semibold">This week</h2>
          <div className="grid gap-2">
            {weekRows.map((sh) => <ShiftCard key={sh.id} sh={sh} />)}
            {!weekRows.length && <p className="text-sm text-muted-foreground">No shifts this week.</p>}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Coming up</h2>
          <div className="grid gap-2">
            {laterRows.map((sh) => <ShiftCard key={sh.id} sh={sh} />)}
            {!laterRows.length && <p className="text-sm text-muted-foreground">Nothing further in the next five weeks.</p>}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Extra shifts</h2>
          <Card>
            <CardContent className="p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={profile.data?.wants_extra_shifts ?? false}
                  onCheckedChange={(v) => setExtraShifts(!!v)}
                />
                Yes — offer me extra shifts when cover is needed
              </label>
              <p className="mt-1 text-xs text-muted-foreground">People who opt in are asked first when the home needs cover.</p>
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">My availability</h2>
          <Card>
            <CardContent className="space-y-2 p-3">
              <p className="text-xs text-muted-foreground">Your usual pattern. Managers use it when planning the rota.</p>
              {DAY_LABELS.map((label, dow) => {
                const d = (availability.data ?? []).find((x) => x.day_of_week === dow);
                const available = d?.available ?? true;
                return (
                  <div key={label} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                    <span className="w-24 text-sm">{label}</span>
                    <label className="flex items-center gap-1 text-xs">
                      <Checkbox checked={available} onCheckedChange={(v) => setDay(dow, { available: !!v })} />
                      Available
                    </label>
                    <Input
                      type="time"
                      className="w-28"
                      disabled={!available}
                      value={d?.from_time?.slice(0, 5) ?? ""}
                      onChange={(e) => setDay(dow, { from_time: e.target.value || null })}
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="time"
                      className="w-28"
                      disabled={!available}
                      value={d?.to_time?.slice(0, 5) ?? ""}
                      onChange={(e) => setDay(dow, { to_time: e.target.value || null })}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">My leave</h2>
          <div className="grid gap-2">
            {(leave.data ?? []).map((l) => (
              <Card key={l.id}>
                <CardContent className="flex flex-wrap items-center gap-2 p-3 text-sm">
                  <Badge variant="outline">{l.leave_type === "annual_leave" ? "Annual leave" : l.leave_type === "sick" ? "Sick" : "Other"}</Badge>
                  <span className="text-muted-foreground">{l.start_date} to {l.end_date}</span>
                </CardContent>
              </Card>
            ))}
            {!(leave.data ?? []).length && <p className="text-sm text-muted-foreground">No leave recorded. Managers record leave on the Rota page.</p>}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
