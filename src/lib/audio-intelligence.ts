// Audio Intelligence pipeline for ForgeAI care interactions.
//
// Wraps a MediaStream through a Web Audio graph that performs:
//   • Automatic Gain Control (AGC) via DynamicsCompressor + makeup gain
//   • Background-noise suppression via high-pass + low-shelf filters
//     and a noise-floor adaptive gate
//   • Voice Activity Detection (VAD) from frame RMS vs noise floor
//   • Live quality metrics: signal strength, noise level, quality score
//
// The processed audio is captured by MediaRecorder for transcription.
// Speech segments are timestamped and tagged with provisional speaker
// labels so future speaker-diarisation can replace them in place.

export interface AudioMetrics {
  signal: number;      // 0..1  current voice level
  noise: number;       // 0..1  background noise estimate
  quality: number;     // 0..1  composite quality score
  speaking: boolean;
}

export interface SpeechSegment {
  start: number;       // seconds from session start
  end: number;
  speakerTag: string;  // "Unknown Speaker 1" until diarisation
  rms: number;
}

export interface SessionAudio {
  blob: Blob;
  mimeType: string;
  durationSec: number;
  segments: SpeechSegment[];
  avgQuality: number;
  avgSignal: number;
  avgNoise: number;
}

const FRAME_MS = 100;
const VAD_HANG_MS = 600;       // keep "speaking" true for this long after RMS dips
const NOISE_EMA = 0.05;        // slow adapt for noise floor
const SIGNAL_EMA = 0.4;        // quick adapt for signal

export class AudioIntelligenceSession {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processedStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private rafId: number | null = null;
  private startedAt = 0;
  private noiseFloor = 0.02;
  private signalLevel = 0;
  private lastSpeechAt = 0;
  private currentSegment: SpeechSegment | null = null;
  private segments: SpeechSegment[] = [];
  private qualityHistory: number[] = [];
  private signalHistory: number[] = [];
  private noiseHistory: number[] = [];
  private speakerCount = 0;
  private lastSpeakerEnd = 0;
  private onMetrics?: (m: AudioMetrics) => void;

  async start(opts: { onMetrics?: (m: AudioMetrics) => void } = {}) {
    this.onMetrics = opts.onMetrics;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    const source = this.ctx.createMediaStreamSource(this.stream);

    // Noise reduction: roll off rumble & low-frequency HVAC/TV bass.
    const highpass = this.ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 120;
    const lowshelf = this.ctx.createBiquadFilter();
    lowshelf.type = "lowshelf";
    lowshelf.frequency.value = 200;
    lowshelf.gain.value = -8;

    // Automatic Gain Control: compressor tames spikes, then makeup gain
    // lifts quiet speech into a healthy range for transcription.
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -28;
    compressor.knee.value = 24;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.18;
    const makeup = this.ctx.createGain();
    makeup.gain.value = 1.6;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.3;

    const dest = this.ctx.createMediaStreamDestination();

    source.connect(highpass);
    highpass.connect(lowshelf);
    lowshelf.connect(compressor);
    compressor.connect(makeup);
    makeup.connect(this.analyser);
    makeup.connect(dest);

    this.processedStream = dest.stream;

    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
      .find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    this.recorder = new MediaRecorder(this.processedStream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => e.data.size > 0 && this.chunks.push(e.data);
    this.recorder.start();
    this.startedAt = performance.now();
    this.tick();
  }

  private tick = () => {
    if (!this.analyser || !this.ctx) return;
    const buf = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);

    // Adapt noise floor when not speaking; track signal quickly.
    const speakingNow = rms > this.noiseFloor * 2.2 && rms > 0.012;
    if (!speakingNow) this.noiseFloor = this.noiseFloor + NOISE_EMA * (rms - this.noiseFloor);
    this.signalLevel = this.signalLevel + SIGNAL_EMA * (rms - this.signalLevel);

    const nowSec = (performance.now() - this.startedAt) / 1000;
    if (speakingNow) {
      this.lastSpeechAt = performance.now();
      if (!this.currentSegment) {
        // Heuristic: long gap between segments -> different speaker.
        if (nowSec - this.lastSpeakerEnd > 2.5 || this.speakerCount === 0) {
          this.speakerCount = Math.min(2, this.speakerCount + 1);
        }
        this.currentSegment = {
          start: +nowSec.toFixed(2),
          end: +nowSec.toFixed(2),
          speakerTag: `Unknown Speaker ${this.speakerCount || 1}`,
          rms,
        };
      } else {
        this.currentSegment.end = +nowSec.toFixed(2);
        this.currentSegment.rms = Math.max(this.currentSegment.rms, rms);
      }
    } else if (this.currentSegment && performance.now() - this.lastSpeechAt > VAD_HANG_MS) {
      this.segments.push(this.currentSegment);
      this.lastSpeakerEnd = this.currentSegment.end;
      this.currentSegment = null;
    }

    const signal = Math.min(1, this.signalLevel * 12);
    const noise = Math.min(1, this.noiseFloor * 18);
    const snr = signal / Math.max(0.01, noise);
    const quality = Math.max(0, Math.min(1, (snr - 1) / 6 + (signal > 0.08 ? 0.2 : 0)));
    this.qualityHistory.push(quality);
    this.signalHistory.push(signal);
    this.noiseHistory.push(noise);

    this.onMetrics?.({ signal, noise, quality, speaking: !!this.currentSegment });
    this.rafId = window.setTimeout(this.tick, FRAME_MS) as unknown as number;
  };

  async stop(): Promise<SessionAudio> {
    if (this.rafId) clearTimeout(this.rafId);
    if (this.currentSegment) {
      this.segments.push(this.currentSegment);
      this.currentSegment = null;
    }
    const rec = this.recorder;
    const blob = await new Promise<Blob>((resolve) => {
      if (!rec) return resolve(new Blob());
      rec.onstop = () => resolve(new Blob(this.chunks, { type: rec.mimeType || "audio/webm" }));
      if (rec.state !== "inactive") rec.stop();
      else resolve(new Blob(this.chunks, { type: rec.mimeType || "audio/webm" }));
    });
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.ctx?.close();

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    return {
      blob,
      mimeType: rec?.mimeType || "audio/webm",
      durationSec: (performance.now() - this.startedAt) / 1000,
      segments: this.segments,
      avgQuality: avg(this.qualityHistory),
      avgSignal: avg(this.signalHistory),
      avgNoise: avg(this.noiseHistory),
    };
  }
}
