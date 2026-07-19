## What's happening

The floating "Download app" arrow only shows when the browser's user agent contains "Android". On the published site the component is mounted, but if the UA check fails (some Android browsers/webviews report differently), or if you previously tapped the ✕, the prompt stays hidden. It also hides inside the installed CareCore app itself.

You also asked to show it to everyone, not just Android — so we'll drop the OS gate.

## Changes

1. **`src/components/AndroidDownloadPrompt.tsx`** — remove the Android-only user-agent check. Keep the one guard that hides it inside the native Capacitor shell (so the installed app doesn't show a "download the app" button to itself). Everyone else — Android, iPhone, desktop — sees the arrow.
2. **Dismiss behavior** — keep the ✕ + localStorage dismiss so users who close it don't see it again. If you want it to always reappear on every visit, say the word and I'll remove that too.
3. No other files change. The `/api/public/download-apk` route already redirects to the signed APK URL, so tapping the arrow on any device triggers the APK download (iPhone/desktop users will get an `.apk` file they can't install — that's expected; the button label stays "Download app").

## Result

- Published site on Android phone → arrow visible → tap → APK downloads. ✅
- Published site on iPhone/desktop → arrow visible (per your request). ✅
- Inside the installed CareCore Android app → arrow hidden. ✅

Approve and I'll make the change, then you can republish.
