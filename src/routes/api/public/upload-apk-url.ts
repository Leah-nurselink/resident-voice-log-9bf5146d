import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const uploadRequestSchema = z.object({
  object: z.string().regex(/^(?:carecore-[0-9a-f]{40}\.apk|latest\.json)$/),
});

/**
 * Mints a short-lived signed upload URL for `carecore.apk` in the private
 * `app-downloads` Supabase Storage bucket. Called by the GitHub Actions
 * workflow so CI never needs the SUPABASE_SERVICE_ROLE_KEY — it only needs
 * the shared APK_UPLOAD_TOKEN.
 *
 * Auth: `Authorization: Bearer <APK_UPLOAD_TOKEN>` (timing-safe compare).
 * Response: { url: string } — PUT the APK bytes to that URL to upload.
 */
export const Route = createFileRoute("/api/public/upload-apk-url")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const APK_UPLOAD_TOKEN = process.env.APK_UPLOAD_TOKEN;

        if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !APK_UPLOAD_TOKEN) {
          return new Response("Upload service not configured", { status: 503 });
        }

        const authHeader = request.headers.get("authorization") ?? "";
        const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

        // Timing-safe compare
        const a = Buffer.from(provided);
        const b = Buffer.from(APK_UPLOAD_TOKEN);
        let ok = a.length === b.length;
        const len = Math.max(a.length, b.length);
        for (let i = 0; i < len; i++) {
          if ((a[i] ?? 0) !== (b[i] ?? 0)) ok = false;
        }
        if (!ok) {
          return new Response("Unauthorized", { status: 401 });
        }

        let objectName = "carecore.apk";
        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const parsed = uploadRequestSchema.safeParse(await request.json());
          if (!parsed.success) {
            return new Response("Invalid upload object", { status: 400 });
          }
          objectName = parsed.data.object;
        }

        const signRes = await fetch(
          `${SUPABASE_URL}/storage/v1/object/upload/sign/app-downloads/${objectName}`,
          {
            method: "POST",
            headers: {
              apikey: SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          },
        );

        if (!signRes.ok) {
          const detail = await signRes.text();
          console.error(`[upload-apk-url] Sign failed [${signRes.status}]: ${detail}`);
          return new Response(`Failed to create upload URL: ${detail}`, {
            status: 502,
          });
        }

        const body = (await signRes.json()) as { url?: string };
        if (!body.url) {
          return new Response("Sign response missing url", { status: 502 });
        }
        const absoluteUrl = body.url.startsWith("http")
          ? body.url
          : `${SUPABASE_URL}/storage/v1${body.url}`;

        return Response.json({ url: absoluteUrl });
      },
    },
  },
});
