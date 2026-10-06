import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Prototype — facial-expression analysis.
 * Analyses observable facial movements associated with pain from a few still frames.
 * NOT facial recognition: no identity matching, no frames stored. Frames live only for this request.
 * To plug in a validated model later, add a provider below and switch FACIAL_PROVIDER — the Pain module stays unchanged.
 */
export const FACIAL_INDICATORS = [
  ["brow", "Brow lowering / furrowing"],
  ["eyes", "Eye tightening / squeezing"],
  ["nose_cheek", "Nose wrinkling / cheek raising"],
  ["upper_lip", "Upper lip raising"],
  ["mouth_jaw", "Mouth stretching / jaw clenching"],
  ["grimace", "Grimacing-type expression"],
] as const;

const level = z.enum(["not_seen", "some", "clear"]);
const schema = z.object({
  face_visible: z.boolean(),
  quality: z.number(),
  quality_issues: z.array(z.string()),
  indicators: z.array(z.object({ key: z.enum(FACIAL_INDICATORS.map((i) => i[0]) as [string, ...string[]]), level, observation: z.string() })),
});
export type FacialResult = z.infer<typeof schema> & { model: string };

type Provider = (frames: string[], key: string) => Promise<FacialResult>;

const lovableVision: Provider = async (frames, key) => {
  const model = "openai/gpt-6-astra";
  const { createOpenAI } = await import("@ai-sdk/openai");
  const { streamText, Output } = await import("ai");
  const openai = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const list = FACIAL_INDICATORS.map(([k, l]) => `${k}: ${l}`).join("; ");
  const result = streamText({
    model: openai.responses(model),
    system:
      "You describe observable facial muscle movements in still frames to support a UK care staff pain observation. " +
      "Do NOT identify, name, or describe who the person is, their age, ethnicity, or any identity traits. Do NOT diagnose or state that the person is in pain. " +
      `For each indicator (${list}) give level not_seen, some, or clear, and a short neutral observation (max 12 words). ` +
      "quality is 0–1 for how clearly the face is visible across frames (lighting, angle, blur, obstruction); list issues. If no face is clearly visible, set face_visible false and all indicators not_seen.",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: `${frames.length} frames captured about 0.7s apart. Return every indicator.` },
        ...frames.map((f) => ({ type: "image" as const, image: f })),
      ],
    }],
    output: Output.object({ schema }),
    maxRetries: 0,
    providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", store: false } },
  });
  const out = await result.output;
  return { ...out, quality: Math.max(0, Math.min(1, out.quality)), model: `prototype:${model}` };
};

const PROVIDERS: Record<string, Provider> = { lovable_vision: lovableVision };
const FACIAL_PROVIDER = "lovable_vision";

export const analyseFacialPain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      residentId: z.string().uuid(),
      consentConfirmed: z.literal(true),
      frames: z.array(z.string().regex(/^data:image\/jpeg;base64,/).max(400_000)).min(1).max(5),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: consent } = await context.supabase.from("consents").select("id")
      .eq("resident_id", data.residentId).eq("status", "given").ilike("consent_type", "%facial%").limit(1);
    if (!consent?.length) throw new Error("No recorded consent for facial expression analysis.");
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    try {
      return await PROVIDERS[FACIAL_PROVIDER](data.frames, key);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("429")) throw new Error("Analysis is busy. Try again shortly.");
      if (msg.includes("402")) throw new Error("AI credits exhausted. Add credits to continue.");
      if (msg.includes("403")) throw new Error("AI access is not available for this workspace.");
      throw new Error("Facial analysis failed. Continue with observations instead.");
    }
  });
