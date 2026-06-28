// Resident-Centred Communication Hub — in-app call recorder.
// Pick a contact for the resident → consent gate → record → transcribe (Lovable AI STT)
// → AI structured summary + action extraction → staff approval → write to
// `communications` (+ `communication_tasks`). Becomes part of the resident timeline.

import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { transcribeAudio } from "@/lib/ai.functions";
import { summariseCall } from "@/lib/communications.functions";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Mic, Square, Phone, ShieldCheck, Sparkles, ListChecks, AlertTriangle, Loader2,
} from "lucide-react";

type Contact = {
  id: string;
  kind: "family" | "professional";
  name: string;
  role: string;
  phone?: string | null;
  email?: string | null;
};

type Action = {
  kind: string;
  title: string;
  detail?: string;
  due_date?: string | null;
  priority: "low" | "normal" | "high" | "urgent";
};

type CallSummary = {
  reason: string;
  summary: string;
  outcome: string;
  participants: string[];
  sentiment: "positive" | "neutral" | "concerned" | "distressed";
  requires_follow_up: boolean;
  actions: Action[];
  escalate: boolean;
};

type Phase = "setup" | "recording" | "processing" | "review";

function fmt(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function CallRecorder({
  open,
  onOpenChange,
  residentId,
  residentName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  residentId: string;
  residentName: string;
}) {
  const qc = useQueryClient();
  const transcribe = useServerFn(transcribeAudio);
  const summarise = useServerFn(summariseCall);

  const residentSettings = useQuery({
    enabled: open,
    queryKey: ["resident-consent", residentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("residents")
        .select("transcription_enabled, recording_consent, recording_consent_date, recording_consent_notes")
        .eq("id", residentId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? { transcription_enabled: true, recording_consent: false }) as {
        transcription_enabled: boolean;
        recording_consent: boolean;
        recording_consent_date: string | null;
        recording_consent_notes: string | null;
      };
    },
  });

  const transcriptionDisabled = residentSettings.data?.transcription_enabled === false;
  const hasStandingConsent = !!residentSettings.data?.recording_consent;

  const contacts = useQuery({
    enabled: open && !transcriptionDisabled,
    queryKey: ["call-contacts", residentId],
    queryFn: async (): Promise<Contact[]> => {
      const [fam, pro, res] = await Promise.all([
        supabase
          .from("family_members")
          .select("id, full_name, relationship, phone, email")
          .eq("resident_id", residentId),
        supabase
          .from("professionals")
          .select("id, name, role, organisation, phone, email")
          .order("name"),
        supabase
          .from("residents")
          .select("next_of_kin, next_of_kin_relationship, next_of_kin_phone, next_of_kin_secondary, next_of_kin_secondary_relationship, next_of_kin_secondary_phone")
          .eq("id", residentId)
          .maybeSingle(),
      ]);
      const list: Contact[] = [];
      const nok = res.data as {
        next_of_kin: string | null;
        next_of_kin_relationship: string | null;
        next_of_kin_phone: string | null;
        next_of_kin_secondary: string | null;
        next_of_kin_secondary_relationship: string | null;
        next_of_kin_secondary_phone: string | null;
      } | null;
      const famRows = (fam.data ?? []) as Array<{ id: string; full_name: string; relationship: string | null; phone: string | null; email: string | null }>;
      const inFamily = (name: string | null | undefined) =>
        !!name && famRows.some((f) => f.full_name?.trim().toLowerCase() === name.trim().toLowerCase());
      if (nok?.next_of_kin && !inFamily(nok.next_of_kin)) {
        list.push({
          id: `nok:primary:${residentId}`,
          kind: "family",
          name: nok.next_of_kin,
          role: `Primary next of kin${nok.next_of_kin_relationship ? " · " + nok.next_of_kin_relationship : ""}`,
          phone: nok.next_of_kin_phone,
          email: null,
        });
      }
      if (nok?.next_of_kin_secondary && !inFamily(nok.next_of_kin_secondary)) {
        list.push({
          id: `nok:secondary:${residentId}`,
          kind: "family",
          name: nok.next_of_kin_secondary,
          role: `Secondary next of kin${nok.next_of_kin_secondary_relationship ? " · " + nok.next_of_kin_secondary_relationship : ""}`,
          phone: nok.next_of_kin_secondary_phone,
          email: null,
        });
      }
      famRows.forEach((f) =>
        list.push({
          id: `family:${f.id}`,
          kind: "family",
          name: f.full_name,
          role: f.relationship ?? "Family",
          phone: f.phone,
          email: f.email,
        }),
      );
      (pro.data ?? []).forEach((p) =>
        list.push({
          id: `pro:${p.id}`,
          kind: "professional",
          name: p.name,
          role: `${p.role}${p.organisation ? " · " + p.organisation : ""}`,
          phone: p.phone,
          email: p.email,
        }),
      );
      return list;
    },
  });



  const [contactId, setContactId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("setup");
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [editedSummary, setEditedSummary] = useState("");
  const [editedOutcome, setEditedOutcome] = useState("");
  const [callStatus, setCallStatus] = useState<"answered" | "voicemail" | "no_answer" | "engaged" | "wrong_number">("answered");
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  const contact = useMemo(
    () => contacts.data?.find((c) => c.id === contactId) ?? null,
    [contacts.data, contactId],
  );

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (hasStandingConsent) setConsent(true);
  }, [hasStandingConsent]);


  function reset() {
    stopMedia();
    setContactId("");
    setReason("");
    setConsent(false);
    setPhase("setup");
    setElapsed(0);
    setTranscript("");
    setSummary(null);
    setEditedSummary("");
    setEditedOutcome("");
    setCallStatus("answered");
    setSaving(false);
  }

  function stopMedia() {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch { /* noop */ }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCall() {
    if (transcriptionDisabled) return toast.error("Recording is disabled for this resident");
    if (!contact) return toast.error("Pick a contact first");
    if (!consent) return toast.error("Confirm consent before recording");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => void finaliseCall();
      mr.start();
      recorderRef.current = mr;
      startedAtRef.current = Date.now();
      setElapsed(0);
      tickRef.current = window.setInterval(
        () => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)),
        500,
      );
      setPhase("recording");
    } catch {
      toast.error("Microphone access denied");
    }
  }

  function endCall() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setPhase("processing");
  }

  async function finaliseCall() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      if (blob.size < 2048) {
        toast.error("Recording was empty — try again");
        setPhase("setup");
        return;
      }
      const audioBase64 = await blobToBase64(blob);
      const { text } = await transcribe({ data: { audioBase64, mimeType: blob.type } });
      const cleanText = (text ?? "").trim();
      setTranscript(cleanText);
      if (!cleanText) {
        toast.error("Couldn't hear anything in that recording");
        setPhase("setup");
        return;
      }
      const s = await summarise({
        data: {
          residentName,
          contactName: contact?.name ?? "Unknown contact",
          contactRole: contact?.role ?? "Contact",
          direction: "outbound",
          reason: reason || undefined,
          transcript: cleanText,
        },
      });
      setSummary(s as CallSummary);
      setEditedSummary((s as CallSummary).summary);
      setEditedOutcome((s as CallSummary).outcome ?? "");
      setPhase("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't process call");
      setPhase("setup");
    }
  }

  async function approveAndSave() {
    if (!summary || !contact) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id ?? null;

      const professionalId =
        contact.kind === "professional" ? contact.id.replace("pro:", "") : null;

      const subject =
        summary.reason || `Call with ${contact.name} re: ${residentName}`;

      const statusLabel = callStatus.replace(/_/g, " ");
      const body = [
        `Date: ${new Date().toLocaleString("en-GB")}`,
        `Call status: ${statusLabel}`,
        `Participants: ${(summary.participants?.length ? summary.participants : [contact.name]).join(", ")}`,
        `Reason: ${summary.reason || reason || "(not stated)"}`,
        "",
        "Discussion summary:",
        editedSummary,
        "",
        `Outcome: ${editedOutcome || "(none)"}`,
      ].join("\n");

      const { data: ins, error } = await supabase
        .from("communications")
        .insert({
          resident_id: residentId,
          professional_id: professionalId,
          direction: "outbound",
          channel: "phone",
          status: "approved",
          subject,
          body,
          raw_input: transcript,
          ai_summary: editedSummary,
          recipient_name: contact.name,
          recipient_email: contact.email ?? null,
          created_by: userId,
          approved_by: userId,
          approved_at: new Date().toISOString(),
          metadata: {
            contact_kind: contact.kind,
            contact_role: contact.role,
            contact_phone: contact.phone ?? null,
            duration_sec: elapsed,
            sentiment: summary.sentiment,
            outcome: editedOutcome,
            call_status: callStatus,
            reason: summary.reason || reason || null,
            requires_follow_up: summary.requires_follow_up,
          },
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      const commId = (ins as { id: string }).id;

      if (summary.actions.length > 0) {
        await supabase.from("communication_tasks").insert(
          summary.actions.map((a) => ({
            communication_id: commId,
            resident_id: residentId,
            kind: a.kind,
            title: a.title,
            detail: a.detail ?? null,
            due_date: a.due_date ?? null,
            priority: a.priority,
            status: "open",
          })) as never,
        );
      }

      // Mirror to daily_notes for the timeline (uses note_type 'communication' if present, else default)
      await supabase.from("daily_notes").insert({
        resident_id: residentId,
        author_id: userId,
        content: `Telephone call · ${contact.name} (${contact.role}) · ${callStatus.replace(/_/g, " ")}\n\n${editedSummary}\n\nOutcome: ${editedOutcome || "(none)"}`,
        status: "approved",
        source: "voice",
      } as never);

      if (summary.escalate) {
        await supabase.from("alerts").insert({
          resident_id: residentId,
          kind: "communication_escalation",
          severity: "high",
          title: `Escalation from call with ${contact.name}`,
          message: editedOutcome || summary.summary.slice(0, 280),
          status: "open",
        } as never);
      }

      toast.success("Call record saved");
      qc.invalidateQueries({ queryKey: ["timeline", residentId] });
      qc.invalidateQueries({ queryKey: ["communications"] });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save call record");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4" /> Call about {residentName}
          </DialogTitle>
          <DialogDescription>
            Capture a family or professional call, with consent, and let ForgeAI
            turn it into a documented care record with actions.
          </DialogDescription>
        </DialogHeader>

        {phase === "setup" && (
          <div className="space-y-4">
            {transcriptionDisabled && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Recording and transcription are <b>disabled</b> for {residentName}. An
                  admin or senior must enable it on the resident's Profile tab before
                  calls can be captured here.
                </span>
              </div>
            )}
            {!transcriptionDisabled && hasStandingConsent && (
              <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs text-foreground">
                <ShieldCheck className="h-3.5 w-3.5 mt-0.5 text-primary" />
                <span>
                  Standing consent on file for {residentName}
                  {residentSettings.data?.recording_consent_date ? ` (recorded ${residentSettings.data.recording_consent_date})` : ""}.
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Who are you calling?</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger><SelectValue placeholder="Pick a family member or professional" /></SelectTrigger>
                <SelectContent>
                  {(contacts.data ?? []).length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No contacts yet — add a family member, next of kin, or professional first.
                    </div>
                  )}
                  {(contacts.data ?? []).filter((c) => c.kind === "family").length > 0 && (
                    <div className="px-2 pt-1.5 pb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Family / Next of kin</div>
                  )}
                  {(contacts.data ?? []).filter((c) => c.kind === "family").map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} <span className="text-muted-foreground">· {c.role}{c.phone ? " · " + c.phone : ""}</span>
                    </SelectItem>
                  ))}
                  {(contacts.data ?? []).filter((c) => c.kind === "professional").length > 0 && (
                    <div className="px-2 pt-2 pb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">Professionals</div>
                  )}
                  {(contacts.data ?? []).filter((c) => c.kind === "professional").map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} <span className="text-muted-foreground">· {c.role}{c.phone ? " · " + c.phone : ""}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {contact?.phone && (
                <p className="text-xs text-muted-foreground">Phone on file: {contact.phone}</p>
              )}
              {contact && !contact.phone && (
                <p className="text-xs text-amber-600">No phone number on file for this contact — add one on the Profile tab.</p>
              )}
            </div>


            <div className="space-y-1.5">
              <Label>Reason for call (optional)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Update regarding reduced appetite"
                maxLength={200}
              />
            </div>

            <label className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Consent confirmed.</span> I have informed
                everyone on the call that it will be transcribed and an AI summary
                added to the resident's care record. Recording can be stopped at
                any time.
              </span>
            </label>

            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Audit-trailed · awaits staff approval before saving.
            </div>
          </div>
        )}

        {phase === "recording" && (
          <div className="space-y-3 py-4 text-center">
            <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-destructive/15 text-destructive">
              <Mic className="h-8 w-8" />
              <span className="absolute inset-0 animate-ping rounded-full bg-destructive/20" />
            </div>
            <p className="text-2xl font-semibold tabular-nums">{fmt(elapsed)}</p>
            <p className="text-xs text-muted-foreground">
              Speak naturally. Both sides of the conversation will be captured by the device microphone.
            </p>
          </div>
        )}

        {phase === "processing" && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm">Transcribing and summarising the call…</p>
            <p className="text-xs text-muted-foreground">This usually takes a few seconds.</p>
          </div>
        )}

        {phase === "review" && summary && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> AI summary
                </p>
                <Badge variant="outline" className="text-[10px]">Awaiting approval</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Reason: {summary.reason || reason || "(not stated)"} · Duration {fmt(elapsed)} · Sentiment {summary.sentiment}
              </p>
              <Textarea
                className="mt-2 min-h-[120px] text-sm"
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
              />
            </div>

            <div className="rounded-lg border bg-card p-3 space-y-2">
              <p className="text-sm font-medium">Call outcome</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Call status</Label>
                  <Select value={callStatus} onValueChange={(v) => setCallStatus(v as typeof callStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="answered">Answered</SelectItem>
                      <SelectItem value="voicemail">Voicemail left</SelectItem>
                      <SelectItem value="no_answer">No answer</SelectItem>
                      <SelectItem value="engaged">Engaged</SelectItem>
                      <SelectItem value="wrong_number">Wrong number</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Duration</Label>
                  <Input value={fmt(elapsed)} readOnly className="bg-muted/40" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Outcome / next steps</Label>
                <Textarea
                  className="min-h-[70px] text-sm"
                  value={editedOutcome}
                  onChange={(e) => setEditedOutcome(e.target.value)}
                  placeholder="What was agreed, what happens next, who is doing it…"
                />
              </div>
            </div>

            {summary.escalate && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                Clinical urgency detected — an alert will be raised on approval.
              </div>
            )}

            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5" /> Actions detected ({summary.actions.length})
              </p>
              {summary.actions.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">No follow-up actions identified.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {summary.actions.map((a, i) => (
                    <li key={i} className="rounded-md border p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{a.title}</span>
                        <Badge variant={a.priority === "urgent" || a.priority === "high" ? "destructive" : "secondary"} className="text-[10px]">
                          {a.priority}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground capitalize">{a.kind.replace(/_/g, " ")}{a.due_date ? ` · due ${a.due_date}` : ""}</p>
                      {a.detail && <p className="mt-1">{a.detail}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <details className="rounded-lg border p-3 text-xs">
              <summary className="cursor-pointer font-medium">View full transcript</summary>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{transcript}</p>
            </details>

            <p className="text-[11px] text-muted-foreground">Generated by AI — saved as a documented call record on approval.</p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {phase === "setup" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={startCall} disabled={!contact || !consent || transcriptionDisabled}>
                <Phone className="h-4 w-4 mr-1.5" /> Start call
              </Button>
            </>
          )}
          {phase === "recording" && (
            <Button variant="destructive" className="w-full" onClick={endCall}>
              <Square className="h-4 w-4 mr-1.5" /> End call
            </Button>
          )}
          {phase === "review" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Discard</Button>
              <Button onClick={approveAndSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1.5" />}
                Approve &amp; save
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
