import { createFileRoute } from "@tanstack/react-router";

/**
 * Public APK download endpoint.
 *
 * The `carecore.apk` file lives in a PRIVATE Supabase Storage bucket
 * (`app-downloads`). This route mints a short-lived signed URL and 302-redirects
 * the phone to it, so anonymous devices can download without exposing the
 * source repo or making the bucket public.
 */
export const Route = createFileRoute("/api/public/download-apk")({
  server: {
    handlers: {
      GET: async () => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
          return new Response("Download service not configured", { status: 503 });
        }

        // Ask Supabase Storage for a 5-minute signed URL to the APK.
        const signRes = await fetch(
          `${SUPABASE_URL}/storage/v1/object/sign/app-downloads/carecore.apk`,
          {
            method: "POST",
            headers: {
              apikey: SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ expiresIn: 300 }),
          },
        );

        if (!signRes.ok) {
          const detail = await signRes.text();
          console.error(
            `[download-apk] Sign failed [${signRes.status}]: ${detail}`,
          );
          return new Response(
            "APK not available yet. Please try again shortly.",
            { status: 404 },
          );
        }

        const { signedURL } = (await signRes.json()) as { signedURL: string };
        const absoluteUrl = signedURL.startsWith("http")
          ? signedURL
          : `${SUPABASE_URL}/storage/v1${signedURL}`;

        return new Response(null, {
          status: 302,
          headers: {
            Location: absoluteUrl,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
