import { useEffect, useRef, useState } from "react";
import { Mic, Square, Sparkles, Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  CARE_PLAN_DOMAINS,
  RISK_ASSESSMENTS,
  formatCarePlanText,
  upsertEntry,
  type CarePlanDomain,
  type CarePlanEntry,
  type CarePlanKind,
  type RiskAssessment,
} from "@/lib/care-plan-data";
import type { Resident } from "@/lib/mock-data";

type Stage = "idle" | "recording" | "processing" | "review";

const SAMPLE: Record<CarePlanKind, string[]> = {
  domain: [
    "Mary prefers a warm shower in the morning, female carer, lavender body wash, encourage independence with face and hands.",
    "John needs help with all transfers using a stand aid, two staff at all times, slide sheets in bed.",
    "Edie enjoys group activities, especially singing and reminiscence, low risk of social isolation.",
  ],
  risk: [
    "High risk of falls following near fall this week, walking frame in reach, sensor mat overnight, review weekly.",
    "Medium risk of pressure damage on heels, 2-hourly repositioning, pressure relieving mattress, daily skin check.",
    "Low risk MUST score, weight stable, fortified diet continues, weigh monthly.",
  ],
};

interface CarePlanEditorProps {
  resident: Resident;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: CarePlanEntry | null;
  onSaved: (entry: CarePlanEntry) => void;
}

export function CarePlanEditor({
  resident,
  open,
  onOpenChange,
  existing,
  onSaved,
}: CarePlanEditorProps) {
  const [kind, setKind] = useState<CarePlanKind>("domain");
  const [area, setArea] = useState<CarePlanDomain | RiskAssessment>("Personal care");
  const [transcript, setTranscript] = useState("");
  const [content, setContent] = useState("");
  const [reviewDue, setReviewDue] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      if (timerRef.current) clearInterval(timerRef.current);
      setStage("idle");
      setSeconds(0);
      return;
    }
    if (existing) {
      setKind(existing.kind);
      setArea(existing.area);
      setTranscript(existing.transcript);
      setContent(existing.content);
      setReviewDue(existing.reviewDue ?? "");
    } else {
      setKind("domain");
      setArea("Personal care");
      setTranscript("");
      setContent("");
      setReviewDue("");
    }
  }, [open, existing]);

  const changeKind = (k: CarePlanKind) => {
    setKind(k);
    setArea(k === "domain" ? CARE_PLAN_DOMAINS[0] : RISK_ASSESSMENTS[0]);
  };

  const startRec = () => {
    setStage("recording");
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopRec = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStage("processing");
    const sample = SAMPLE[kind][Math.floor(Math.random() * SAMPLE[kind].length)];
    setTimeout(() => {
      setTranscript(sample);
      setContent(formatCarePlanText(sample, resident.preferredName ?? resident.name));
      setStage("review");
    }, 900);
  };

  const reformat = (text: string) => {
    setTranscript(text);
    setContent(formatCarePlanText(text, resident.preferredName ?? resident.name));
  };

  const save = () => {
    const entry: CarePlanEntry = {
      id: existing?.id ?? `cp-${Date.now()}`,
      residentId: resident.id,
      kind,
      area,
      transcript,
      content,
      author: "Priya Singh (Nurse)",
      updatedAt: new Date().toISOString(),
      reviewDue: reviewDue || undefined,
    };
    upsertEntry(entry);
    onSaved(entry);
    onOpenChange(false);
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const options = kind === "domain" ? CARE_PLAN_DOMAINS : RISK_ASSESSMENTS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {existing ? "Update" : "New"} care plan entry · {resident.preferredName ?? resident.name}
          </DialogTitle>
          <DialogDescription>
            Type or dictate. AI formats it into clinical wording you can review before saving.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={kind} onValueChange={(v) => changeKind(v as CarePlanKind)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="domain">Care plan domain</TabsTrigger>
            <TabsTrigger value="risk">Risk assessment</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {kind === "domain" ? "Domain" : "Assessment"}
            </label>
            <Select value={area} onValueChange={(v) => setArea(v as CarePlanDomain | RiskAssessment)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Review due
            </label>
            <Input type="date" value={reviewDue} onChange={(e) => setReviewDue(e.target.value)} />
          </div>
        </div>

        {stage === "recording" ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <button
              onClick={stopRec}
              aria-label="Stop recording"
              className="recording-pulse grid h-20 w-20 place-items-center rounded-full bg-destructive text-destructive-foreground"
            >
              <Square className="h-8 w-8 fill-current" />
            </button>
            <div className="font-mono text-xl tabular-nums">{mm}:{ss}</div>
            <p className="text-xs text-muted-foreground">Listening… tap to stop.</p>
          </div>
        ) : stage === "processing" ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground">Formatting care plan entry…</p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notes / dictation
                </label>
                <Button size="sm" variant="outline" onClick={startRec} className="h-7">
                  <Mic className="h-3.5 w-3.5" /> Dictate
                </Button>
              </div>
              <Textarea
                value={transcript}
                onChange={(e) => reformat(e.target.value)}
                rows={3}
                placeholder={`e.g. ${SAMPLE[kind][0]}`}
                className="resize-none text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3 w-3" /> AI-formatted entry
              </label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                placeholder="The formatted clinical entry will appear here. You can edit before saving."
                className="text-sm leading-relaxed"
              />
            </div>
          </>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X /> Cancel
          </Button>
          {stage === "review" && (
            <Button variant="outline" onClick={() => setStage("idle")}>
              <Pencil /> Re-record
            </Button>
          )}
          <Button onClick={save} disabled={!content.trim()}>
            <Check /> {existing ? "Save changes" : "Save entry"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
