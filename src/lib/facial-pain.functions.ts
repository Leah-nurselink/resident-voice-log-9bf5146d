import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Prototype — facial-expression analysis (NOT a validated medical device).
 * Rates pain-relevant facial action units (FACS) 0–5 from a few still frames.
 * NOT facial recognition: no identity matching, no frames stored. Frames live only for this request.
 * Switch FACIAL_PROVIDER (env) to run on a self-hosted UK/EU model instead of Lovable — the Pain module stays unchanged.
 */

// Pain-relevant FACS action units (Prkachin & Solomon / Kunz pain literature).
export const FACIAL_INDICATORS = [
  ["au4",     "Brow lowering (AU4)"],
  ["au6",     "Cheek raising (AU6)"],
  ["au7",     "Eyelid tightening (AU7)"],
  ["au9",     "Nose wrinkling (AU9)"],
  ["au10",    "Upper-lip raising (AU10)"],
  ["au12",    "Lip-corner pull (AU12)"],
  ["au20",    "Lip stretch (AU20)"],
  ["au25_26", "Lips part / jaw drop (AU25/26)"],
  ["au43",    "Eye closure (AU43)"],
] as const;
export type FacialKey = (typeof FACIAL_INDICATORS)[number][0];

const schema = z.object({
  face_visible: z.boolean(),
  quality: z.number(),
  quality_issues: z.array(z.string()),
  indicators: z.array(z.object({
    key: z.enum(FACIAL_INDICATORS.map((i) => i[0]) as [string, ...string[]]),
    intensity: z.number().int().min(0).max(5), // FACS 0 (neutral) – 5 (max)
    observation: z.string(),
  })),
});
export type FacialResult = z.infer<typeof schema> & { model: string };

type Provider = (frames: string[]) => Promise<FacialResult>;

const clampQuality = (r: FacialResult): FacialResult => ({ ...r, quality: Math.max(0, Math.min(1, r.quality)) });

// Provider A — Lovable AI Gateway (general vision LLM). PROTOTYPE/DEV ONLY: US inference, no real health data.
const lovableVision: Provider = async (frames) => {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const model = "openai/gpt-6-astra";
  const { createOpenAI } = await import("@ai-sdk/openai");
  const { streamText, Output } = await import("ai");
  const openai = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const list = FACIAL_INDICATORS.map(([k, l]) => `${k} = ${l}`).join("; ");
  const result = streamText({
    model: openai.responses(model),
    system:
      "You rate observable facial muscle movements (FACS action units) in still frames to support a UK care-staff pain observation. " +
      "Do NOT identify, name, or describe who the person is, their age, ethnicity, or any identity trait. Do NOT diagnose or state the person is in pain. " +
      `For EACH action unit (${list}) return an intensity 0–5 (0 = not present, 5 = maximal) and a short neutral observation (max 12 words). ` +
      "quality is 0–1 for how clearly the face is visible across frames (lighting, angle, blur, obstruction); list issues. " +
      "If no face is clearly visible, set face_visible false, quality low, and every intensity 0.",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: `${frames.length} frames captured about 0.7s apart. Return every action unit.` },
        ...frames.map((f) => ({ type: "image" as const, image: f })),
      ],
    }],
    output: Output.object({ schema }),
    maxRetries: 0,
    providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", store: false } },
  });
  const out = await result.output;
  return clampQuality({ ...out, model: `prototype:${model}` });
};

// Provider B — self-hosted UK/EU action-unit model (e.g. OpenFace 2.0 wrapped in your own HTTPS service).
// Keeps images in infrastructure Eleni Care contracts for directly — no Lovable, no US hop.
// The service must return JSON matching `schema` above.
const selfHostedAU: Provider = async (frames) => {
  const endpoint = process.env.FACIAL_ENDPOINT; // e.g. https://facial.internal.elenicare.co.uk/analyse
  const key = process.env.FACIAL_API_KEY;
  if (!endpoint || !key) throw new Error("Missing FACIAL_ENDPOINT / FACIAL_API_KEY");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ frames }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const out = schema.parse(await res.json());
  return clampQuality({ ...out, model: "openface:self-hosted" });
};

const PROVIDERS: Record<string, Provider> = {
  lovable_vision: lovableVision,
  self_hosted_au: selfHostedAU,
};
// Default stays Lovable so nothing changes until you set FACIAL_PROVIDER=self_hosted_au in the environment.
const FACIAL_PROVIDER = process.env.FACIAL_PROVIDER ?? "lovable_vision";

export const analyseFacialPain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      residentId: z.string().uuid(),
      consentConfirmed: z.literal(true),
      frames: z.array(z.string().regex(/^data:image\/jpeg;base64,/).max(400_000)).min(1).max(8),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: consent } = await context.supabase.from("consents").select("id")
      .eq("resident_id", data.residentId).eq("status", "given")
      .or("consent_type.ilike.*facial*,consent_type.ilike.*care*treatment*").limit(1);
    if (!consent?.length) throw new Error("No recorded consent covering facial expression analysis (facial analysis or care and treatment).");
    const provider = PROVIDERS[FACIAL_PROVIDER];
    if (!provider) throw new Error(`Unknown FACIAL_PROVIDER: ${FACIAL_PROVIDER}`);
    try {
      return await provider(data.frames);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("429")) throw new Error("Analysis is busy. Try again shortly.");
      if (msg.includes("402")) throw new Error("AI credits exhausted. Add credits to continue.");
      if (msg.includes("403")) throw new Error("AI access is not available for this workspace.");
      throw new Error("Facial analysis failed. Continue with observations instead.");
    }
  });
