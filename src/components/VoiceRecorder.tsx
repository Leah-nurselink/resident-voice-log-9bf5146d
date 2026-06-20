import { useEffect, useRef, useState } from "react";
import { Mic, Square, Sparkles, Check, X, AlertTriangle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  type CareCategory,
  type CareNote,
  type Resident,
  detectFlags,
  formatProfessionalNote,
  inferCategory,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type Stage = "idle" | "recording" | "processing" | "review";

const CATEGORIES: CareCategory[] = [
  "Personal care",
  "Nutrition & hydration",
  "Mobility",
  "Skin integrity",
  "Emotional wellbeing",
  "Family communication",
  "Medication",
  "Continence",
  "Sleep",
  "Safeguarding",
];

const SAMPLE_TRANSCRIPTS = [
  "Assisted with personal care. Skin intact. No concerns noted.",
  "Ate about half of lunch and drank a full glass of water.",
  "Walked to the lounge with one staff assisting. Steady on feet.",
  "Seemed a bit low in mood this morning. Sat with them for a while.",
  "Spoke with the daughter about the GP appointment on Friday.",
];

interface VoiceRecorderProps {
  resident: Resident;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (note: CareNote) => void;
}

export function VoiceRecorder({ resident, open, onOpenChange, onSave }: VoiceRecorderProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<CareCategory>("Personal care");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      // reset on close
      setStage("idle");
      setSeconds(0);
      setTranscript("");
      setNote("");
      setCategory("Personal care");
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [open]);

  const start = () => {
    setStage("recording");
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStage("processing");
    // Simulate AI processing
    const sample =
      SAMPLE_TRANSCRIPTS[Math.floor(Math.random() * SAMPLE_TRANSCRIPTS.length)];
    setTimeout(() => {
      setTranscript(sample);
      setCategory(inferCategory(sample));
      setNote(formatProfessionalNote(sample, resident.preferredName ?? resident.name));
      setStage("review");
    }, 1100);
  };

  const reformat = (text: string) => {
    setTranscript(text);
    setCategory(inferCategory(text));
    setNote(formatProfessionalNote(text, resident.preferredName ?? resident.name));
  };

  const flags = detectFlags(`${transcript} ${note}`);

  const save = () => {
    const newNote: CareNote = {
      id: `n-${Date.now()}`,
      residentId: resident.id,
      category,
      transcript,
      note,
      author: "Aisha Khan (Care Assistant)",
      createdAt: new Date().toISOString(),
      flags,
      status: "approved",
    };
    onSave(newNote);
    onOpenChange(false);
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Document care for {resident.preferredName ?? resident.name}
          </DialogTitle>
          <DialogDescription>
            Resident identified via tag {resident.tagId} · Room {resident.room}
          </DialogDescription>
        </DialogHeader>

        {stage === "idle" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <button
              onClick={start}
              aria-label="Start recording"
              className="grid h-24 w-24 place-items-center rounded-full bg-primary text-primary-foreground shadow-elevated transition-transform hover:scale-105 active:scale-95"
            >
              <Mic className="h-10 w-10" />
            </button>
            <p className="max-w-xs text-center text-sm text-muted-foreground">
              Press to record. Speak naturally about the care you've just delivered.
            </p>
          </div>
        )}

        {stage === "recording" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <button
              onClick={stop}
              aria-label="Stop recording"
              className="recording-pulse grid h-24 w-24 place-items-center rounded-full bg-destructive text-destructive-foreground"
            >
              <Square className="h-9 w-9 fill-current" />
            </button>
            <div className="font-mono text-2xl tabular-nums">{mm}:{ss}</div>
            <p className="text-sm text-muted-foreground">Listening… tap to stop.</p>
          </div>
        )}

        {stage === "processing" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              Generating professional care note…
            </p>
          </div>
        )}

        {stage === "review" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Transcript
              </label>
              <Textarea
                value={transcript}
                onChange={(e) => reformat(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3 w-3" /> AI-formatted note
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={5}
                className="text-sm leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Category
                </label>
                <Select value={category} onValueChange={(v) => setCategory(v as CareCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Detected flags
                </label>
                <div className={cn(
                  "flex h-9 flex-wrap items-center gap-1.5 rounded-md border border-input px-2 text-sm",
                  flags.length === 0 && "text-muted-foreground",
                )}>
                  {flags.length === 0 ? (
                    "None"
                  ) : (
                    flags.map((f) => (
                      <Badge key={f} variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {f}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>

            {flags.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                  <div>
                    <div className="font-medium text-destructive">Incident detected</div>
                    <p className="text-xs text-muted-foreground">
                      A follow-up form will be created for the senior on shift to review.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                <X /> Cancel
              </Button>
              <Button variant="outline" onClick={() => setStage("idle")}>
                <Pencil /> Re-record
              </Button>
              <Button onClick={save}>
                <Check /> Approve & save
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
