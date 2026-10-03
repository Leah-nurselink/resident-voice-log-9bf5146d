import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { inviteFamily } from "@/lib/family.functions";
import { FamilyFeedbackList } from "@/components/FamilyFeedbackList";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/family")({
  head: () => ({ meta: [{ title: "Family · CareCore" }, { name: "description", content: "Give family members and LPAs access to a care summary." }] }),
  component: FamilyPage,
});

const RELATIONSHIPS = ["Daughter", "Son", "Spouse / partner", "Sibling", "LPA (Health & Welfare)", "LPA (Property & Finance)", "Other"];

function FamilyPage() {
  const qc = useQueryClient();
  const invite = useServerFn(inviteFamily);
  const [f, setF] = useState({ residentId: "", fullName: "", email: "", relationship: "Daughter", phone: "" });
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const residents = useQuery({
    queryKey: ["residents-min"],
    queryFn: async () => (await supabase.from("residents").select("id, full_name").is("discharge_date", null).order("full_name")).data ?? [],
  });
  const members = useQuery({
    queryKey: ["family-members"],
    queryFn: async () => (await supabase.from("family_members").select("id, full_name, relationship, email, user_id, residents(full_name)").order("created_at", { ascending: false })).data ?? [],
  });

  const submit = async () => {
    if (!f.residentId || !f.fullName.trim() || !f.email.trim()) return toast.error("Choose a resident and enter a name and email");
    const password = `Care-${crypto.getRandomValues(new Uint32Array(2)).join("").slice(0, 10)}`;
    setBusy(true);
    try {
      await invite({ data: { ...f, tempPassword: password } });
      await supabase.auth.resetPasswordForEmail(f.email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      setCreated({ email: f.email.trim(), password });
      setF({ residentId: "", fullName: "", email: "", relationship: "Daughter", phone: "" });
      qc.invalidateQueries({ queryKey: ["family-members"] });
      toast.success("Family access created — a set-password email has been sent");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create access"); }
    setBusy(false);
  };

  return (
    <AppShell title="Family" subtitle="Family and LPA access to a care summary">
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-4">
            <h3 className="text-sm font-semibold">Give a family member or LPA access</h3>
            <p className="text-xs text-muted-foreground">Admins and Managers only. They will see a short care overview for their relative and can leave feedback.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Resident</Label>
                <Select value={f.residentId} onValueChange={(v) => setF({ ...f, residentId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose resident" /></SelectTrigger>
                  <SelectContent>{(residents.data ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Relationship</Label>
                <Select value={f.relationship} onValueChange={(v) => setF({ ...f, relationship: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RELATIONSHIPS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Full name</Label><Input maxLength={120} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></div>
              <div><Label>Email (used to sign in)</Label><Input type="email" maxLength={255} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
              <div><Label>Phone (optional)</Label><Input maxLength={40} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            </div>
            <Button onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create family access"}</Button>
            {created && <p className="rounded-md bg-secondary/50 p-2 text-xs">Created for {created.email}. If the email doesn't arrive, temporary password: <span className="font-mono">{created.password}</span></p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4">
            <h3 className="text-sm font-semibold">Family members</h3>
            {!members.data?.length && <p className="text-sm text-muted-foreground">None yet.</p>}
            {(members.data ?? []).map((m) => (
              <div key={m.id} className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm last:border-0">
                <span>{m.full_name} <span className="text-muted-foreground">· {m.relationship} of {m.residents?.full_name}</span></span>
                <span className="text-xs text-muted-foreground">{m.user_id ? "Has login" : "No login"}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <FamilyFeedbackList />
      </div>
    </AppShell>
  );
}
