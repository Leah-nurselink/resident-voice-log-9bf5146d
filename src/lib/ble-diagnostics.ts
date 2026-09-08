export type BleDiagnosticStage =
  | "native-shell"
  | "plugin"
  | "scan"
  | "native-advertisement"
  | "bridge"
  | "parser"
  | "match"
  | "resident"
  | "save";

export type BleDiagnosticOutcome = "waiting" | "passed" | "failed";

export interface BleDiagnosticEvent {
  id: number;
  at: string;
  stage: BleDiagnosticStage;
  outcome: BleDiagnosticOutcome;
  message: string;
  details?: Record<string, string | number | boolean | null>;
}

export interface BleDiagnosticStageState {
  stage: BleDiagnosticStage;
  outcome: BleDiagnosticOutcome;
  at: string | null;
  message: string;
  details?: BleDiagnosticEvent["details"];
}

export const BLE_DIAGNOSTIC_STAGES: Array<{
  id: BleDiagnosticStage;
  label: string;
}> = [
  { id: "native-shell", label: "Android shell" },
  { id: "plugin", label: "Bluetooth plugin" },
  { id: "scan", label: "BLE scan" },
  { id: "native-advertisement", label: "Native advertisement" },
  { id: "bridge", label: "JavaScript bridge" },
  { id: "parser", label: "App parser" },
  { id: "match", label: "Registered beacon" },
  { id: "resident", label: "Resident" },
  { id: "save", label: "Saved session" },
];

const MAX_EVENTS = 200;
let nextId = 1;
let events: BleDiagnosticEvent[] = [];
let listeners: Array<(events: BleDiagnosticEvent[]) => void> = [];

function snapshot(): BleDiagnosticEvent[] {
  return events.map((event) => ({ ...event, details: event.details ? { ...event.details } : undefined }));
}

function emit(): void {
  const current = snapshot();
  for (const listener of listeners) listener(current);
}

export function traceBleDiagnostic(
  stage: BleDiagnosticStage,
  outcome: BleDiagnosticOutcome,
  message: string,
  details?: BleDiagnosticEvent["details"],
): void {
  const event: BleDiagnosticEvent = {
    id: nextId,
    at: new Date().toISOString(),
    stage,
    outcome,
    message,
    details,
  };
  nextId += 1;
  events = [...events.slice(-(MAX_EVENTS - 1)), event];
  emit();
}

export function getBleDiagnosticEvents(): BleDiagnosticEvent[] {
  return snapshot();
}

export function clearBleDiagnosticEvents(): void {
  events = [];
  emit();
}

export function subscribeBleDiagnostics(
  listener: (events: BleDiagnosticEvent[]) => void,
): () => void {
  listeners.push(listener);
  listener(snapshot());
  return () => {
    listeners = listeners.filter((item) => item !== listener);
  };
}

export function summarizeBleDiagnosticStages(
  diagnosticEvents: BleDiagnosticEvent[],
): BleDiagnosticStageState[] {
  return BLE_DIAGNOSTIC_STAGES.map(({ id, label }) => {
    const latest = [...diagnosticEvents].reverse().find((event) => event.stage === id);
    return {
      stage: id,
      outcome: latest?.outcome ?? "waiting",
      at: latest?.at ?? null,
      message: latest?.message ?? `${label} has not been checked yet`,
      details: latest?.details,
    };
  });
}

export function formatBleDiagnosticReport(
  diagnosticEvents: BleDiagnosticEvent[],
): string {
  const stages = summarizeBleDiagnosticStages(diagnosticEvents);
  const lines = ["CareCore BLE diagnostic report", `Generated: ${new Date().toISOString()}`, ""];
  for (const stage of stages) {
    const label = BLE_DIAGNOSTIC_STAGES.find((item) => item.id === stage.stage)?.label ?? stage.stage;
    lines.push(`${label}: ${stage.outcome.toUpperCase()} — ${stage.message}`);
    if (stage.at) lines.push(`  Time: ${stage.at}`);
    if (stage.details) {
      for (const [key, value] of Object.entries(stage.details)) {
        lines.push(`  ${key}: ${String(value)}`);
      }
    }
  }
  return lines.join("\n");
}
