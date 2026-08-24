import { createFileRoute } from "@tanstack/react-router";

/**
 * Public Windows companion app download endpoint.
 *
 * The `carecore-windows.zip` Electron build lives in the PRIVATE
 * `app-downloads` Supabase Storage bucket alongside the APK. This route
 * streams the zip with an attachment header so Windows browsers download it
 * directly without exposing the source repo or making the bucket public.
 */
export const Route = createFileRoute("/api/public/download-windows")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
          return new Response("Download service not configured", { status: 503 });
        }

        let objectName = "carecore-windows.zip";
        const latestRes = await fetch(
          `${SUPABASE_URL}/storage/v1/object/app-downloads/latest-win.json`,
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
            /^carecore-win-[0-9a-f]{40}\.zip$/.test(latest.object)
          ) {
            objectName = latest.object;
          }
        }

        const range = request.headers.get("range");
        const zipRes = await fetch(
          `${SUPABASE_URL}/storage/v1/object/app-downloads/${objectName}`,
          {
            headers: {
              apikey: SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
              ...(range ? { Range: range } : {}),
            },
          },
        );

        if (!zipRes.ok) {
          const detail = await zipRes.text();
          console.error(`[download-windows] Fetch failed [${zipRes.status}]: ${detail}`);
          return new Response("Windows app not available yet. Please try again shortly.", {
            status: 404,
          });
        }

        const headers = new Headers({
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="carecore-windows.zip"',
          "Cache-Control": "private, no-store",
          "Content-Location": objectName,
          "X-Content-Type-Options": "nosniff",
        });
        for (const name of ["content-length", "content-range", "accept-ranges", "etag"]) {
          const value = zipRes.headers.get(name);
          if (value) headers.set(name, value);
        }

        return new Response(zipRes.body, {
          status: zipRes.status,
          headers: {
            ...Object.fromEntries(headers),
          },
        });
      },
    },
  },
});
