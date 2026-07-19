import { createFileRoute } from "@tanstack/react-router";

/**
 * Public APK download endpoint.
 *
 * The `carecore.apk` file lives in a PRIVATE Supabase Storage bucket
 * (`app-downloads`). This route streams the file with an attachment header so
 * Android browsers reliably download it without exposing the source repo or
 * making the bucket public.
 */
export const Route = createFileRoute("/api/public/download-apk")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
          return new Response("Download service not configured", { status: 503 });
        }

        let objectName = "carecore.apk";
        const latestRes = await fetch(
          `${SUPABASE_URL}/storage/v1/object/app-downloads/latest.json`,
          {
            headers: {
              apikey: SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            },
          },
        );
        if (latestRes.ok) {
          const latest = (await latestRes.json()) as { object?: unknown };
          if (
            typeof latest.object === "string" &&
            /^carecore-[0-9a-f]{40}\.apk$/.test(latest.object)
          ) {
            objectName = latest.object;
          }
        }

        const range = request.headers.get("range");
        const apkRes = await fetch(
          `${SUPABASE_URL}/storage/v1/object/app-downloads/${objectName}`,
          {
            headers: {
              apikey: SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
              ...(range ? { Range: range } : {}),
            },
          },
        );

        if (!apkRes.ok) {
          const detail = await apkRes.text();
          console.error(
            `[download-apk] Fetch failed [${apkRes.status}]: ${detail}`,
          );
          return new Response(
            "APK not available yet. Please try again shortly.",
            { status: 404 },
          );
        }

        const headers = new Headers({
          "Content-Type": "application/vnd.android.package-archive",
          "Content-Disposition": 'attachment; filename="carecore.apk"',
          "Cache-Control": "private, no-store",
          "Content-Location": objectName,
          "X-Content-Type-Options": "nosniff",
        });
        for (const name of ["content-length", "content-range", "accept-ranges", "etag"]) {
          const value = apkRes.headers.get(name);
          if (value) headers.set(name, value);
        }

        return new Response(apkRes.body, {
          status: apkRes.status,
          headers: {
            ...Object.fromEntries(headers),
          },
        });
      },
    },
  },
});
