import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { transcribeAudio } from "@/lib/ai.functions";
import { draftRotdFromConversation } from "@/lib/rotd-ai.functions";

export type RotdDraft = {
  residentWords: string | null;
  feedback: string;
  improvement: string;
  actions: { concern: string }[];
  transcript: string;
};

const MAX_SECONDS = 300; // keeps the upload small enough to send safely

/**
 * Record a natural conversation → transcribe (Azure UK) → AI drafts for staff to check.
 * The audio is never stored: it is sent for transcription and discarded.
 */
export function RotdConversationRecorder({
  residentName,
  department,
  disabled,
  disabledReason,
  label = "Record conversation",
  onResult,
}: {
  residentName?: string;
  department?: string;
  disabled?: boolean;
  disabledReason?: string;
  label?: string;
  onResult: (d: RotdDraft) => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing" | "drafting">("idle");
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const transcribe = useServerFn(transcribeAudio);
  const draft = useServerFn(draftRotdFromConversation);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  function stop() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1024) { toast.error("Recording was too short"); setState("idle"); return; }
        setState("transcribing");
        let transcript = "";
        try {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let bin = "";
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          const { text } = await transcribe({ data: { audioBase64: btoa(bin), mimeType: rec.mimeType || "audio/webm" } });
          transcript = text.trim();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Transcription failed");
          setState("idle");
          return;
        }
        if (!transcript) { toast.error("Couldn't make out any speech"); setState("idle"); return; }
        setState("drafting");
        try {
          const out = await draft({ data: { transcript: transcript.slice(0, 15000), residentName, department } });
          onResult({
            residentWords: out.residentWords ?? null,
            feedback: out.feedback ?? "",
            improvement: out.improvement ?? "",
            actions: out.actions ?? [],
            transcript,
          });
        } catch (e) {
          // Keep the words even if the AI draft fails.
          toast.error(e instanceof Error ? e.message : "Couldn't draft from the conversation");
          onResult({ residentWords: null, feedback: "", improvement: "", actions: [], transcript });
        } finally {
          setState("idle");
        }
      };
      rec.start();
      recRef.current = rec;
      setSeconds(0);
      setState("recording");
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) { stop(); return s + 1; }
          return s + 1;
        });
      }, 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  }

  const busy = state === "transcribing" || state === "drafting";
  const mm = String(Math.floor(seconds / 60)).padStart(1, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={state === "recording" ? "destructive" : "default"}
        className="h-8 gap-1.5 text-xs"
        disabled={(disabled && state === "idle") || busy}
        title={disabled ? disabledReason : undefined}
        onClick={() => (state === "recording" ? stop() : start())}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : state === "recording" ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
        {state === "recording" ? `Stop (${mm}:${ss})` : state === "transcribing" ? "Writing it down…" : state === "drafting" ? "AI is drafting…" : label}
      </Button>
      {disabled && state === "idle" && disabledReason && (
        <span className="text-[11px] text-muted-foreground">{disabledReason}</span>
      )}
      {state === "recording" && (
        <span className="text-[11px] text-muted-foreground">Speak naturally. Stops by itself at 5 minutes.</span>
      )}
    </div>
  );
}
