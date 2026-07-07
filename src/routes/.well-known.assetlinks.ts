// Digital Asset Links file.
//
// Serves /.well-known/assetlinks.json so Android can verify that the
// CareCore APK is allowed to auto-open https://resident-voice-log.lovable.app
// links (App Links). The SHA-256 fingerprint of the APK signing cert is
// injected at build time via VITE_ANDROID_APP_SHA256 (the CI workflow
// prints it in the release notes).
//
// If the fingerprint is not configured we return `[]` so the file still
// exists (Android caches 404s aggressively) but doesn't associate any app.

import { createFileRoute } from "@tanstack/react-router";

const PACKAGE_NAME = "app.lovable.residentvoicelog";
const SHA256 = (import.meta.env.VITE_ANDROID_APP_SHA256 as string | undefined)?.trim();

export const Route = createFileRoute("/.well-known/assetlinks")({
  server: {
    handlers: {
      GET: () => {
        const body = SHA256
          ? [
              {
                relation: ["delegate_permission/common.handle_all_urls"],
                target: {
                  namespace: "android_app",
                  package_name: PACKAGE_NAME,
                  sha256_cert_fingerprints: [SHA256],
                },
              },
            ]
          : [];
        return new Response(JSON.stringify(body, null, 2), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
