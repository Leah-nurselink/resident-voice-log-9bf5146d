import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Send, Mic, MicOff, Mail, Inbox, CheckCircle, Clock, AlertTriangle, Users } from "lucide-react";
import { composeCommunication, sendCommunication, generateFamilySummary } from "@/lib/communications.functions";
import { transcribeAudio } from "@/lib/ai.functions";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/communications")({
  head: () => ({ meta: [{ title: "Communications Hub · ForgeAI" }] }),
  component: Page,
});

type Resident = { id: string; full_name: string | null; preferred_name: string | null; date_of_birth: string | null };
type Pro = { id: string; name: string; role: string; organisation: string | null; email: string | null };
type Comm = {
  id: string; resident_id: string | null; professional_id: string | null;
  direction: "outbound" | "inbound"; channel: string; status: string;
  subject: string | null; body: string; ai_summary: string | null;
  recipient_email: string | null; recipient_name: string | null;
  sender_email: string | null; sender_name: string | null;
  family_summary: string | null; family_share_consent: boolean;
  sent_at: string | null; received_at: string | null; created_at: string;
};
type Task = {
  id: string; communication_id: string; resident_id: string | null;
  kind: string; title: string; detail: string | null; due_date: string | null;
  priority: string; status: string;
};

function Page() {
  return (
    <AppShell title="Smart Communications Hub" subtitle="Professional emails, letters, referrals & family updates">
      <Tabs defaultValue="compose" className="space-y-4">
        <TabsList>
          <TabsTrigger value="compose"><Mail className="mr-1 h-4 w-4" /> Compose</TabsTrigger>
          <TabsTrigger value="outbound"><Send className="mr-1 h-4 w-4" /> Outbound</TabsTrigger>
          <TabsTrigger value="inbound"><Inbox className="mr-1 h-4 w-4" /> Inbox</TabsTrigger>
          <TabsTrigger value="tasks"><CheckCircle className="mr-1 h-4 w-4" /> Action items</TabsTrigger>
        </TabsList>
        <TabsContent value="compose"><ComposeTab /></TabsContent>
        <TabsContent value="outbound"><CommsList direction="outbound" /></TabsContent>
        <TabsContent value="inbound"><CommsList direction="inbound" /></TabsContent>
        <TabsContent value="tasks"><TasksList /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

// ---------------- Compose ----------------
function ComposeTab() {
  const qc = useQueryClient();
  const residents = useQuery({
    queryKey: ["residents-min"],
    queryFn: async () => {
      const { data } = await supabase.from("residents")
        .select("id,full_name,preferred_name,date_of_birth")
        .order("full_name");
      return (data ?? []) as Resident[];
    },
  });
  const pros = useQuery({
    queryKey: ["pros-min"],
    queryFn: async () => {
      const { data } = await supabase.from("professionals")
        .select("id,name,role,organisation,email").eq("is_active", true).order("name");
      return (data ?? []) as Pro[];
    },
  });

  const compose = useServerFn(composeCommunication);
  const send = useServerFn(sendCommunication);

  const [residentId, setResidentId] = useState<string>("");
  const [proId, setProId] = useState<string>("");
  const [channel, setChannel] = useState<"email" | "letter" | "referral" | "summary">("email");
  const [concerns, setConcerns] = useState("");
  const [history, setHistory] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recording, setRecording] = useState(false);
  const [mediaRec, setMediaRec] = useState<MediaRecorder | null>(null);

  const resident = residents.data?.find((r) => r.id === residentId);
  const pro = pros.data?.find((p) => p.id === proId);

  const handleRecord = async () => {
    if (recording) { mediaRec?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        setRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType });
        const buf = await blob.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        try {
          const { text } = await transcribeAudio({ data: { audioBase64: b64, mimeType: blob.type } });
          setConcerns((c) => (c ? c + "\n" + text : text));
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Transcription failed");
        }
      };
      setMediaRec(rec);
      setRecording(true);
      rec.start();
    } catch {
      toast.error("Microphone permission denied");
    }
  };

  const draft = useMutation({
    mutationFn: async () => {
      if (!pro) throw new Error("Select a professional");
      if (!concerns.trim()) throw new Error("Describe the concern");
      const res = await compose({
        data: {
          residentName: resident?.full_name ?? undefined,
          residentDob: resident?.date_of_birth ?? undefined,
          professionalName: pro.name,
          professionalRole: pro.role,
          professionalOrg: pro.organisation ?? undefined,
          channel,
          concerns,
          history: history || undefined,
        },
      });
      setSubject(res.subject);
      setBody(res.body);
      return res;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "AI draft failed"),
  });

  const saveDraft = useMutation({
    mutationFn: async (status: "draft" | "approved") => {
      if (!body.trim()) throw new Error("No draft to save");
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("communications").insert({
        resident_id: residentId || null,
        professional_id: proId || null,
        direction: "outbound",
        channel,
        status,
        subject,
        body,
        raw_input: concerns,
        recipient_email: pro?.email ?? null,
        recipient_name: pro?.name ?? null,
        created_by: u.user?.id ?? null,
      } as never).select("id").single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["comms"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const sendNow = useMutation({
    mutationFn: async () => {
      if (!pro?.email) throw new Error("Professional has no email on file");
      const created = await saveDraft.mutateAsync("approved");
      await send({ data: { communicationId: created.id } });
    },
    onSuccess: () => {
      toast.success("Sent");
      setSubject(""); setBody(""); setConcerns(""); setHistory("");
      qc.invalidateQueries({ queryKey: ["comms"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Send failed"),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Compose a professional communication</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Resident</Label>
            <Select value={residentId} onValueChange={setResidentId}>
              <SelectTrigger><SelectValue placeholder="Select resident" /></SelectTrigger>
              <SelectContent>
                {residents.data?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.full_name}{r.preferred_name ? ` (${r.preferred_name})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Professional</Label>
            <Select value={proId} onValueChange={setProId}>
              <SelectTrigger><SelectValue placeholder="Select professional" /></SelectTrigger>
              <SelectContent>
                {pros.data?.length ? pros.data.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} · {p.role}</SelectItem>
                )) : <div className="px-2 py-3 text-xs text-muted-foreground">No professionals — <Link to="/professionals" className="text-primary underline">add one</Link></div>}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Format</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="letter">Letter</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="summary">Care summary</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label>What do you want to communicate?</Label>
            <Button type="button" size="sm" variant={recording ? "destructive" : "outline"} onClick={handleRecord}>
              {recording ? <><MicOff className="mr-1 h-3 w-3" /> Stop</> : <><Mic className="mr-1 h-3 w-3" /> Speak</>}
            </Button>
          </div>
          <Textarea rows={5} placeholder="Describe the concerns or request in plain English. ForgeAI will turn this into a professional message you can review." value={concerns} onChange={(e) => setConcerns(e.target.value)} />
        </div>

        <div>
          <Label>Relevant background (optional)</Label>
          <Textarea rows={3} placeholder="Recent notes, observations, vitals, weight changes etc." value={history} onChange={(e) => setHistory(e.target.value)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => draft.mutate()} disabled={draft.isPending}>
            <Sparkles className="mr-1 h-4 w-4" />{draft.isPending ? "Drafting…" : "Generate draft"}
          </Button>
        </div>

        {body && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <div>
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>Body (review before sending)</Label>
              <Textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => saveDraft.mutate("draft")}>Save draft</Button>
              <Button onClick={() => sendNow.mutate()} disabled={sendNow.isPending || !pro?.email}>
                <Send className="mr-1 h-4 w-4" />{sendNow.isPending ? "Sending…" : "Approve & send"}
              </Button>
              {!pro?.email && <span className="self-center text-xs text-muted-foreground">No email on file for this professional.</span>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------- Lists ----------------
function CommsList({ direction }: { direction: "outbound" | "inbound" }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<Comm | null>(null);
  const data = useQuery({
    queryKey: ["comms", direction],
    queryFn: async () => {
      const { data, error } = await supabase.from("communications")
        .select("*").eq("direction", direction)
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as Comm[];
    },
  });
  const send = useServerFn(sendCommunication);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {data.data?.map((c) => (
            <button key={c.id} className="block w-full text-left p-3 hover:bg-accent/30" onClick={() => setOpen(c)}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.subject ?? "(no subject)"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {direction === "outbound" ? `→ ${c.recipient_email ?? c.recipient_name ?? "—"}` : `← ${c.sender_email ?? c.sender_name ?? "—"}`}
                    {" · "}{format(new Date(c.sent_at ?? c.received_at ?? c.created_at), "d MMM HH:mm")}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            </button>
          ))}
          {!data.data?.length && <p className="p-6 text-center text-sm text-muted-foreground">No {direction} communications yet.</p>}
        </div>
      </CardContent>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{open?.subject ?? "Communication"}</DialogTitle></DialogHeader>
          {open && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <StatusBadge status={open.status} />
                <span>{open.channel}</span>
                {open.recipient_email && <span>→ {open.recipient_email}</span>}
                {open.sender_email && <span>← {open.sender_email}</span>}
              </div>
              {open.ai_summary && (
                <div className="rounded border bg-primary/5 p-2 text-xs"><strong>AI summary:</strong> {open.ai_summary}</div>
              )}
              <pre className="whitespace-pre-wrap rounded border bg-muted/40 p-3 font-sans text-sm">{open.body}</pre>
              {open.direction === "outbound" && open.status !== "sent" && open.recipient_email && (
                <Button onClick={async () => {
                  try { await send({ data: { communicationId: open.id } }); toast.success("Sent"); setOpen(null); qc.invalidateQueries({ queryKey: ["comms"] }); }
                  catch (e) { toast.error(e instanceof Error ? e.message : "Send failed"); }
                }}><Send className="mr-1 h-4 w-4" /> Approve & send</Button>
              )}
              {open.direction === "inbound" && (
                <FamilyShareControls comm={open} onChanged={() => { qc.invalidateQueries({ queryKey: ["comms"] }); }} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    sent: "bg-green-500/15 text-green-700 border-green-500/30",
    received: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    processed: "bg-violet-500/15 text-violet-700 border-violet-500/30",
    draft: "bg-muted text-muted-foreground border-border",
    pending_review: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    approved: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    failed: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] ${map[status] ?? "border-border"}`}>{status}</span>;
}

function FamilyShareControls({ comm, onChanged }: { comm: Comm; onChanged: () => void }) {
  const fam = useServerFn(generateFamilySummary);
  const [resident, setResident] = useState<Resident | null>(null);
  const [generating, setGenerating] = useState(false);
  useState(() => {
    if (comm.resident_id) {
      supabase.from("residents").select("id,full_name,preferred_name,date_of_birth")
        .eq("id", comm.resident_id).maybeSingle().then(({ data }) => setResident(data as Resident | null));
    }
    return undefined;
  });

  const generate = async () => {
    if (!resident) return;
    setGenerating(true);
    try {
      const { summary } = await fam({ data: { residentFirstName: (resident.preferred_name || resident.full_name || "Your relative").split(" ")[0], professionalText: comm.body } });
      await supabase.from("communications").update({ family_summary: summary } as never).eq("id", comm.id);
      toast.success("Family summary generated");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setGenerating(false); }
  };

  const toggleConsent = async (v: boolean) => {
    await supabase.from("communications").update({ family_share_consent: v } as never).eq("id", comm.id);
    onChanged();
  };

  return (
    <div className="rounded border p-3">
      <div className="flex items-center gap-2 text-xs font-medium"><Users className="h-3.5 w-3.5" /> Family layer</div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <Checkbox checked={comm.family_share_consent} onCheckedChange={(v) => toggleConsent(!!v)} id={`cs-${comm.id}`} />
        <label htmlFor={`cs-${comm.id}`}>Consent to share with family</label>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={generating || !comm.family_share_consent} onClick={generate}>
          <Sparkles className="mr-1 h-3 w-3" /> {comm.family_summary ? "Regenerate" : "Generate"} family summary
        </Button>
        {!comm.family_share_consent && <span className="text-xs text-muted-foreground">Requires consent.</span>}
      </div>
      {comm.family_summary && <p className="mt-2 whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs">{comm.family_summary}</p>}
    </div>
  );
}

// ---------------- Tasks ----------------
function TasksList() {
  const qc = useQueryClient();
  const tasks = useQuery({
    queryKey: ["comm-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("communication_tasks")
        .select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as Task[];
    },
  });

  const setStatus = async (id: string, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "done") patch.completed_at = new Date().toISOString();
    await supabase.from("communication_tasks").update(patch as never).eq("id", id);
    qc.invalidateQueries({ queryKey: ["comm-tasks"] });
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {tasks.data?.map((t) => (
            <div key={t.id} className="flex items-start gap-3 p-3">
              <div className="mt-1">
                {t.priority === "urgent" ? <AlertTriangle className="h-4 w-4 text-destructive" />
                 : t.priority === "high" ? <Clock className="h-4 w-4 text-amber-600" />
                 : <Clock className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{t.title}</p>
                  <Badge variant="secondary" className="text-[10px]">{t.kind}</Badge>
                  <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                  {t.due_date && <span className="text-[10px] text-muted-foreground">due {t.due_date}</span>}
                </div>
                {t.detail && <p className="mt-0.5 text-xs text-muted-foreground">{t.detail}</p>}
              </div>
              <Select value={t.status} onValueChange={(v) => setStatus(t.id, v)}>
                <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
          {!tasks.data?.length && <p className="p-6 text-center text-sm text-muted-foreground">No action items yet. They appear automatically from inbound professional emails.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
