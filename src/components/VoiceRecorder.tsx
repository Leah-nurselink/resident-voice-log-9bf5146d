import { useRef, useState } from "react";
import { Mic, Square, Loader2, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { structureNote, transcribeAudio } from "@/lib/ai.functions";

export type StructuredNote = {
  content: string;
  domain: string | null;
  risks: string[];
  flags: string[];
  transcript: string;
};

export function VoiceRecorder({ residentName, onResult }: { residentName?: string; onResult: (n: StructuredNote) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const [mode, setMode] = useState<"voice" | "type">("voice");
  const [typed, setTyped] = useState("");
  const chunksRef = useRef<Blob[]>([]);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const transcribe = useServerFn(transcribeAudio);
  const structure = useServerFn(structureNote);

  async function process(transcript: string) {
    setState("processing");
    try {
      const out = await structure({ data: { transcript, residentName } });
      onResult({ ...out, transcript });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate note");
    } finally {
      setState("idle");
    }
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1024) {
          toast.error("Recording was too short");
          setState("idle");
          return;
        }
        setState("processing");
        try {
          const buf = await blob.arrayBuffer();
          let binary = "";
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          const b64 = btoa(binary);
          const { text } = await transcribe({ data: { audioBase64: b64, mimeType: rec.mimeType || "audio/webm" } });
          if (!text.trim()) {
            toast.error("Couldn't make out any speech");
            setState("idle");
            return;
          }
          await process(text);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Transcription failed");
          setState("idle");
        }
      };
      rec.start();
      recRef.current = rec;
      setState("recording");
    } catch {
      toast.error("Microphone access denied");
    }
  }

  function stop() {
    recRef.current?.stop();
  }

  if (mode === "type") {
    return (
      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <Textarea
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Type the care interaction in your own words…"
          rows={4}
          className="resize-none"
        />
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode("voice")}>
            <Mic className="mr-1 h-4 w-4" /> Voice
          </Button>
          <Button
            onClick={() => typed.trim() && process(typed.trim())}
            disabled={!typed.trim() || state === "processing"}
          >
            {state === "processing" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Generate note
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6">
      <button
        type="button"
        onClick={state === "recording" ? stop : start}
        disabled={state === "processing"}
        className={cn(
          "grid h-20 w-20 place-items-center rounded-full text-primary-foreground transition",
          state === "recording" ? "bg-destructive recording-pulse" : "bg-primary hover:opacity-90",
          state === "processing" && "opacity-60",
        )}
        aria-label={state === "recording" ? "Stop recording" : "Start recording"}
      >
        {state === "processing" ? (
          <Loader2 className="h-8 w-8 animate-spin" />
        ) : state === "recording" ? (
          <Square className="h-8 w-8" fill="currentColor" />
        ) : (
          <Mic className="h-8 w-8" />
        )}
      </button>
      <p className="text-sm text-muted-foreground">
        {state === "recording" ? "Listening… tap to stop" : state === "processing" ? "AI is structuring your note…" : "Tap and speak naturally"}
      </p>
      <Button variant="ghost" size="sm" onClick={() => setMode("type")} disabled={state !== "idle"}>
        <Type className="mr-1 h-4 w-4" /> Type instead
      </Button>
    </div>
  );
}
