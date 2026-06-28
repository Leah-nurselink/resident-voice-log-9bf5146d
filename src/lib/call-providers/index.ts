// Call provider abstraction for ForgeAI Communication Hub.
//
// Today, ForgeAI captures the conversation through the device microphone while
// staff dial on a separate phone. Tomorrow, we want to plug in WebRTC (e.g.
// Twilio Voice, LiveKit, Daily) or SIP/PBX gateways without rewriting the
// recorder UI or the data model.
//
// The contract below is what `CallRecorder` (and any future call surface) talks
// to. Concrete providers implement `CallProvider` and register themselves with
// `registerCallProvider(...)`. The communications row stores `call_provider`
// (e.g. "device_mic", "webrtc_twilio", "sip_freepbx") plus an optional
// `provider_call_id` so each backend's own call record can be reconciled later.

export type CallProviderId =
  | "device_mic"
  | "webrtc_twilio"
  | "webrtc_livekit"
  | "webrtc_daily"
  | "sip_freepbx"
  | "sip_generic";

export type CallDirection = "outbound" | "inbound";

export type CallParticipant = {
  name: string;
  phone?: string | null;
  email?: string | null;
};

export type StartCallOptions = {
  direction: CallDirection;
  participant: CallParticipant;
  /** Resident the call is about (for audit + routing). */
  residentId?: string | null;
};

export type CallHandle = {
  /** Provider-side call identifier. Stored on the communications row. */
  providerCallId: string | null;
  /** Live audio stream to feed into the audio-intelligence pipeline. */
  stream: MediaStream;
  /** Wall-clock start time. */
  startedAt: Date;
  /** Hang up / release the call. Resolves with any final provider state. */
  end: () => Promise<{ endedAt: Date }>;
};

export interface CallProvider {
  readonly id: CallProviderId;
  readonly label: string;
  /** True when the provider can actually place calls from this device. */
  canPlaceCalls: boolean;
  /** Probe the runtime (perms, SDK availability) before showing in the UI. */
  isAvailable: () => Promise<boolean>;
  /**
   * Start a call. For `device_mic` this only opens the microphone; the human
   * dials on their phone. For WebRTC/SIP this also initiates the actual call.
   */
  start: (opts: StartCallOptions) => Promise<CallHandle>;
}

// --- Device-microphone provider (current behaviour) -------------------------

const deviceMicProvider: CallProvider = {
  id: "device_mic",
  label: "Device microphone (manual dial)",
  canPlaceCalls: false,
  isAvailable: async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
    return true;
  },
  start: async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return {
      providerCallId: null,
      stream,
      startedAt: new Date(),
      end: async () => {
        stream.getTracks().forEach((t) => t.stop());
        return { endedAt: new Date() };
      },
    };
  },
};

// --- Registry --------------------------------------------------------------

const registry = new Map<CallProviderId, CallProvider>();
registry.set(deviceMicProvider.id, deviceMicProvider);

export function registerCallProvider(provider: CallProvider) {
  registry.set(provider.id, provider);
}

export function getCallProvider(id: CallProviderId = "device_mic"): CallProvider {
  return registry.get(id) ?? deviceMicProvider;
}

export async function listAvailableProviders(): Promise<CallProvider[]> {
  const out: CallProvider[] = [];
  for (const p of registry.values()) {
    if (await p.isAvailable()) out.push(p);
  }
  return out;
}

// --- Stubs for future providers --------------------------------------------
// These are intentionally not registered. When the time comes, implement
// `start()`/`isAvailable()` against the SDK of choice and call
// `registerCallProvider(...)` from the app bootstrap.

export const webrtcProviderStub: Pick<CallProvider, "id" | "label"> = {
  id: "webrtc_twilio",
  label: "WebRTC (Twilio Voice) — coming soon",
};

export const sipProviderStub: Pick<CallProvider, "id" | "label"> = {
  id: "sip_generic",
  label: "SIP / PBX — coming soon",
};
