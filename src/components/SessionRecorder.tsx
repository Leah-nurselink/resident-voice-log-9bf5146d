import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Activity, Volume2, AudioLines, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { structureNote, transcribeAudio } from "@/lib/ai.functions";
import { AudioIntelligenceSession, type AudioMetrics, type SessionAudio } from "@/lib/audio-intelligence";

export type StructuredNote = {
  content: string;
  domain: string | null;
  risks: string[];
  flags: string[];
  transcript: string;
  transcriptConfidence?: number;
  audioQuality?: number;
  segments?: { start: number; end: number; speakerTag: string }[];
};

export function SessionRecorder({
  residentName,
  autoStart,
  onResult,
}: {
  residentName?: string;
  autoStart?: boolean;
  onResult: (n: StructuredNote) => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const [mode, setMode] = useState<"voice" | "type">("voice");
  const [typed, setTyped] = useState("");
  const [metrics, setMetrics] = useState<AudioMetrics>({ signal: 0, noise: 0, quality: 0, speaking: false });
  const [elapsed, setElapsed] = useState(0);
  const sessionRef = useRef<AudioIntelligenceSession | null>(null);
  const startedAtRef = useRef(0);
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const transcribe = useServerFn(transcribeAudio);
  const structure = useServerFn(structureNote);

  useEffect(() => {
    if (autoStart && state === "idle" && mode === "voice") void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  async function start() {
    try {
      const s = new AudioIntelligenceSession();
      await s.start({ onMetrics: setMetrics });
      sessionRef.current = s;
      startedAtRef.current = Date.now();
      setElapsed(0);
      elapsedTimer.current = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 500);
      setState("recording");
    } catch {
      toast.error("Microphone access denied");
    }
  }

  async function process(transcript: string, audio?: SessionAudio, confidence?: number) {
    setState("processing");
    try {
      const out = await structure({ data: { transcript, residentName } });
      onResult({
        ...out,
        transcript,
        transcriptConfidence: confidence,
        audioQuality: audio?.avgQuality,
        segments: audio?.segments.map((s) => ({ start: s.start, end: s.end, speakerTag: s.speakerTag })),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate note");
    } finally {
      setState("idle");
    }
  }

  async function stop() {
    if (!sessionRef.current) return;
    if (elapsedTimer.current) clearInterval(elapsedTimer.current);
    const audio = await sessionRef.current.stop();
    sessionRef.current = null;
    if (audio.blob.size < 2048 || audio.segments.length === 0) {
      toast.error(audio.segments.length === 0 ? "No speech detected" : "Recording too short");
      setState("idle");
      return;
    }
    setState("processing");
    try {
      const buf = await audio.blob.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      const { text } = await transcribe({ data: { audioBase64: b64, mimeType: audio.mimeType } });
      if (!text.trim()) {
        toast.error("Couldn't make out any speech");
        setState("idle");
        return;
      }
      // Simple transcript-confidence heuristic: words-per-second within
      // a plausible speech range × audio quality.
      const wps = text.trim().split(/\s+/).length / Math.max(1, audio.durationSec);
      const wpsScore = Math.max(0, Math.min(1, 1 - Math.abs(wps - 2.2) / 2.5));
      const confidence = +(0.5 * wpsScore + 0.5 * audio.avgQuality).toFixed(2);
      await process(text, audio, confidence);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transcription failed");
      setState("idle");
    }
  }

  if (mode === "type") {
    return (
      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <Textarea value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type the care interaction…" rows={4} className="resize-none" />
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode("voice")}><Mic className="mr-1 h-4 w-4" /> Voice</Button>
          <Button onClick={() => typed.trim() && process(typed.trim())} disabled={!typed.trim() || state === "processing"}>
            {state === "processing" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Generate note
          </Button>
        </div>
      </div>
    );
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const qScore = Math.round(metrics.quality * 100);

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={state === "recording" ? stop : start}
          disabled={state === "processing"}
          className={cn(
            "grid h-16 w-16 shrink-0 place-items-center rounded-full text-primary-foreground transition",
            state === "recording" ? "bg-destructive recording-pulse" : "bg-primary hover:opacity-90",
            state === "processing" && "opacity-60",
          )}
          aria-label={state === "recording" ? "End session" : "Start session"}
        >
          {state === "processing" ? <Loader2 className="h-7 w-7 animate-spin" /> :
            state === "recording" ? <Square className="h-7 w-7" fill="currentColor" /> : <Mic className="h-7 w-7" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">
              {state === "recording" ? "Care session — recording" : state === "processing" ? "Transcribing & structuring…" : "Ready"}
            </p>
            {state === "recording" && (
              <Badge variant={metrics.speaking ? "default" : "outline"} className="text-[10px]">
                {metrics.speaking ? "Speech" : "Silence"}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {state === "recording" ? `${mm}:${ss} · AGC + noise reduction on` : "Tap to start a session — capture stops on tap"}
          </p>
        </div>
      </div>

      {state === "recording" && (
        <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/30 p-3 text-xs">
          <Meter icon={<Volume2 className="h-3 w-3" />} label="Signal" value={metrics.signal} tone="green" />
          <Meter icon={<AudioLines className="h-3 w-3" />} label="Noise" value={metrics.noise} tone="amber" invert />
          <Meter icon={<Activity className="h-3 w-3" />} label={`Quality ${qScore}%`} value={metrics.quality} tone="primary" />
        </div>
      )}

      {state === "idle" && (
        <Button variant="ghost" size="sm" onClick={() => setMode("type")} className="w-full">
          <Type className="mr-1 h-4 w-4" /> Type instead
        </Button>
      )}
    </div>
  );
}

function Meter({ icon, label, value, tone, invert }: { icon: React.ReactNode; label: string; value: number; tone: "green" | "amber" | "primary"; invert?: boolean }) {
  const pct = Math.round(value * 100);
  const good = invert ? value < 0.4 : value > 0.4;
  const cls = tone === "green" ? (good ? "bg-emerald-500" : "bg-muted-foreground/40")
    : tone === "amber" ? (good ? "bg-emerald-500" : "bg-amber-500")
    : "bg-primary";
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-muted-foreground">{icon}<span>{label}</span></div>
      <Progress value={pct} className="h-1.5" indicatorClassName={cls} />
    </div>
  );
}
