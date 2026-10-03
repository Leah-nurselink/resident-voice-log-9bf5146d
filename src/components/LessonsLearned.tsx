import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Lesson = { id: string; incident_type: string; lessons_learned: string; lessons_shared_until: string; occurred_at: string };
type Read = { incident_id: string; user_id: string; read_at: string };

export function useActiveLessons() {
  return useQuery({
    queryKey: ["active-lessons"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: lessons } = await db.from("incidents")
        .select("id, incident_type, lessons_learned, lessons_shared_until, occurred_at")
        .gt("lessons_shared_until", new Date().toISOString())
        .not("lessons_learned", "is", null)
        .order("occurred_at", { ascending: false });
      const list = ((lessons ?? []) as Lesson[]).filter((l) => l.lessons_learned?.trim());
      const ids = list.map((l) => l.id);
      const { data: reads } = ids.length
        ? await db.from("incident_lesson_reads").select("incident_id, user_id, read_at").in("incident_id", ids)
        : { data: [] };
      return { userId: u.user?.id ?? null, lessons: list, reads: (reads ?? []) as Read[] };
    },
    staleTime: 60_000,
  });
}

/** Blocks the app until the signed-in user has marked every active lesson as read. */
export function LessonsGate() {
  const { data } = useActiveLessons();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (!data?.userId) return null;
  const unread = data.lessons.filter((l) => !data.reads.some((r) => r.incident_id === l.id && r.user_id === data.userId));
  const current = unread[0];
  if (!current) return null;
  const markRead = async () => {
    setBusy(true);
    const { error } = await db.from("incident_lesson_reads").insert({ incident_id: current.id, user_id: data.userId });
    setBusy(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["active-lessons"] });
  };
  return (
    <Dialog open>
      <DialogContent className="max-w-lg [&>button]:hidden" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Lesson learned — please read</DialogTitle>
          <DialogDescription>{current.incident_type} · {new Date(current.occurred_at).toLocaleDateString()}{unread.length > 1 ? ` · ${unread.length} to read` : ""}</DialogDescription>
        </DialogHeader>
        <p className="whitespace-pre-wrap text-sm">{current.lessons_learned}</p>
        <DialogFooter><Button className="w-full sm:w-auto" onClick={markRead} disabled={busy}>I have read and understood this</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Handover card: active lessons plus who has / has not read them. */
export function HandoverLessons() {
  const { data } = useActiveLessons();
  const { data: staff } = useQuery({
    queryKey: ["lesson-staff"],
    queryFn: async () => {
      const { data: roles } = await db.from("user_roles").select("user_id").eq("approved", true).eq("is_active", true);
      const ids = [...new Set(((roles ?? []) as { user_id: string }[]).map((r) => r.user_id))];
      const { data: profs } = ids.length ? await db.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
      return ids.map((id) => ({ id, name: (profs ?? []).find((p: { id: string }) => p.id === id)?.full_name ?? "Staff member" }));
    },
  });
  if (!data?.lessons.length) return null;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Lessons learned from incidents</h3>
        {data.lessons.map((l) => {
          const reads = data.reads.filter((r) => r.incident_id === l.id);
          const readNames = reads.map((r) => `${staff?.find((s) => s.id === r.user_id)?.name ?? "Staff"} (${new Date(r.read_at).toLocaleDateString()})`);
          const notRead = (staff ?? []).filter((s) => !reads.some((r) => r.user_id === s.id)).map((s) => s.name);
          return (
            <div key={l.id} className="space-y-1 rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{l.incident_type} · shown until {new Date(l.lessons_shared_until).toLocaleDateString()}</p>
              <p className="whitespace-pre-wrap text-sm">{l.lessons_learned}</p>
              <p className="text-xs"><span className="font-medium">Read ({reads.length}):</span> {readNames.join(", ") || "No one yet"}</p>
              <p className="text-xs text-destructive"><span className="font-medium">Not read ({notRead.length}):</span> {notRead.join(", ") || "Everyone has read it"}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
