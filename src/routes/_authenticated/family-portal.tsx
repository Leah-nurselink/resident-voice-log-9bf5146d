import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Heart, LogOut, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getFamilySummary } from "@/lib/family.functions";
import { FAMILY_PERIODS } from "@/lib/resident-highlights";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/family-portal")({
  head: () => ({ meta: [
    { title: "Family care summary · CareCore" },
    { name: "description", content: "A short overview of your relative's care and a place to share feedback." },
  ] }),
  component: FamilyPortal,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function FamilyPortal() {
  const router = useRouter();
  const qc = useQueryClient();
  const fetchSummary = useServerFn(getFamilySummary);
  const [period, setPeriod] = useState<"24h" | "7d" | "14d">("7d");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ["family-summary", period], queryFn: () => fetchSummary({ data: { period } }) });
  const fb = useQuery({
    queryKey: ["my-feedback"],
    queryFn: async () => (await db.from("family_feedback").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const submit = async () => {
    if (!rating) return toast.error("Please choose a star rating");
    const { data: u } = await supabase.auth.getUser();
    setBusy(true);
    const { error } = await db.from("family_feedback").insert({
      resident_id: q.data?.residentId, family_member_id: q.data?.familyMemberId, user_id: u.user?.id,
      period, rating, comment: comment.trim().slice(0, 2000) || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Thank you — your feedback has been sent to the home");
    setRating(0); setComment("");
    qc.invalidateQueries({ queryKey: ["my-feedback"] });
  };

  const signOut = async () => { await supabase.auth.signOut(); router.navigate({ to: "/auth" }); };

  return (
    <div className="mx-auto min-h-screen max-w-2xl space-y-4 bg-background p-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Heart className="h-5 w-5 text-primary" /><h1 className="text-lg font-semibold">Family care summary</h1></div>
        <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="mr-1 h-4 w-4" />Sign out</Button>
      </header>

      {q.data && !q.data.summary ? (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">Your account isn't linked to a resident yet. Please contact the home.</CardContent></Card>
      ) : (
        <>
          <div className="flex gap-2">
            {FAMILY_PERIODS.map((p) => (
              <Button key={p.id} size="sm" variant={period === p.id ? "default" : "outline"} className="flex-1" onClick={() => setPeriod(p.id)}>{p.label}</Button>
            ))}
          </div>
          <Card>
            <CardContent className="space-y-2 p-4">
              <h2 className="font-semibold">{q.data?.summary?.name ?? "…"}</h2>
              {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
                <ul className="list-disc space-y-1 pl-5 text-sm">{q.data?.summary?.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
              )}
              <p className="text-xs text-muted-foreground">A general overview from approved care records. For anything specific, please speak to the team.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <h2 className="font-semibold">How do you feel about the care?</h2>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-label={`${n} stars`} onClick={() => setRating(n)} className="p-1">
                    <Star className={`h-8 w-8 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
              <Textarea placeholder="Tell us what's going well or what we could do better (optional)" value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} />
              <Button className="w-full" onClick={submit} disabled={busy}>Send feedback</Button>
            </CardContent>
          </Card>
        </>
      )}

      {!!fb.data?.length && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="font-semibold">Your feedback and replies</h2>
            {fb.data.map((f: { id: string; rating: number; comment: string | null; created_at: string; manager_response: string | null; responded_at: string | null }) => (
              <div key={f.id} className="space-y-1 rounded-md border p-3 text-sm">
                <p className="text-xs text-muted-foreground">{"★".repeat(f.rating)} · {new Date(f.created_at).toLocaleDateString()}</p>
                {f.comment && <p className="whitespace-pre-wrap">{f.comment}</p>}
                {f.manager_response
                  ? <div className="rounded bg-secondary/50 p-2"><p className="text-xs font-medium">Reply from the home · {f.responded_at && new Date(f.responded_at).toLocaleDateString()}</p><p className="whitespace-pre-wrap">{f.manager_response}</p></div>
                  : <p className="text-xs text-muted-foreground">Awaiting reply</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
