import { useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { transcribeAudio } from "@/lib/ai.functions";

/** Tap to speak, tap again to stop; the transcript is passed to onText. */
export function DictateButton({ onText, label = "Speak" }: { onText: (t: string) => void; label?: string }) {
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const transcribe = useServerFn(transcribeAudio);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1024) { toast.error("Recording was too short"); setState("idle"); return; }
        setState("processing");
        try {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let bin = "";
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          const { text } = await transcribe({ data: { audioBase64: btoa(bin), mimeType: rec.mimeType || "audio/webm" } });
          if (text.trim()) onText(text.trim());
          else toast.error("Couldn't make out any speech");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Transcription failed");
        } finally {
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

  return (
    <Button
      type="button"
      size="sm"
      variant={state === "recording" ? "destructive" : "outline"}
      className="h-7 gap-1 px-2 text-xs"
      disabled={state === "processing"}
      onClick={() => (state === "recording" ? recRef.current?.stop() : start())}
    >
      {state === "processing" ? <Loader2 className="h-3 w-3 animate-spin" /> : state === "recording" ? <Square className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
      {state === "recording" ? "Stop" : state === "processing" ? "Writing…" : label}
    </Button>
  );
}
