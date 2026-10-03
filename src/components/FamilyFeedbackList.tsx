import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { respondToFeedback } from "@/lib/family.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
type Fb = { id: string; rating: number; comment: string | null; period: string; created_at: string; manager_response: string | null; responded_at: string | null; residents: { full_name: string } | null; family_members: { full_name: string; relationship: string | null } | null };

export function FamilyFeedbackList() {
  const qc = useQueryClient();
  const respond = useServerFn(respondToFeedback);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["family-feedback"],
    queryFn: async () => ((await db.from("family_feedback").select("*, residents(full_name), family_members(full_name, relationship)").order("created_at", { ascending: false }).limit(100)).data ?? []) as Fb[],
  });
  const list = q.data ?? [];
  const avg = list.length ? (list.reduce((s, f) => s + f.rating, 0) / list.length).toFixed(1) : null;

  const send = async (id: string) => {
    const text = (drafts[id] ?? "").trim();
    if (!text) return toast.error("Write a reply first");
    setBusy(id);
    try {
      const r = await respond({ data: { feedbackId: id, response: text } });
      toast.success(r.emailed ? "Reply saved and emailed to the family" : "Reply saved — the family will see it when they sign in (email could not be sent)");
      qc.invalidateQueries({ queryKey: ["family-feedback"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not send reply"); }
    setBusy(null);
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Family reviews of care</h3>
          {avg && <span className="text-sm text-muted-foreground">Average {avg} / 5 from {list.length}</span>}
        </div>
        {!list.length && <p className="text-sm text-muted-foreground">No family reviews yet.</p>}
        {list.map((f) => (
          <div key={f.id} className="space-y-2 rounded-md border p-3 text-sm">
            <p className="text-xs text-muted-foreground">
              {"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)} · {f.family_members?.full_name ?? "Family"}{f.family_members?.relationship ? ` (${f.family_members.relationship})` : ""} · about {f.residents?.full_name ?? "resident"} · {new Date(f.created_at).toLocaleDateString()}
            </p>
            {f.comment && <p className="whitespace-pre-wrap">{f.comment}</p>}
            {f.manager_response ? (
              <div className="rounded bg-secondary/50 p-2"><p className="text-xs font-medium">Home replied {f.responded_at && new Date(f.responded_at).toLocaleDateString()}</p><p className="whitespace-pre-wrap">{f.manager_response}</p></div>
            ) : (
              <div className="space-y-2">
                <Textarea placeholder="Reply to the family (Admin / Manager)" maxLength={2000} value={drafts[f.id] ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [f.id]: e.target.value }))} />
                <Button size="sm" onClick={() => send(f.id)} disabled={busy === f.id}>Send reply</Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
