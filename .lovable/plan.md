## Goal
Give users a real "Download" experience — a page inside the app with buttons to grab the Android APK and macOS `.app`, plus produce the actual binaries (or a repeatable one-command build) so those buttons point at real files.

## Current state
The native shells already exist (`capacitor.config.ts`, `electron/main.cjs`, `electron/preload.cjs`, `src/lib/native-beacon-bridge.ts`) and `docs/native-builds.md` explains how to build locally. What's missing: (a) built binaries hosted somewhere the app can link to, and (b) an in-app download page. This plan closes both gaps.

## Plan

### 1. Build the binaries in the sandbox
- **Android APK**: run `npx cap add android` + `npx cap sync android` + Gradle `assembleDebug` inside the sandbox to produce an **unsigned debug APK** (`android/app/build/outputs/apk/debug/app-debug.apk`). Requires installing Android SDK cmdline-tools + platform 34 + build-tools via `nix run nixpkgs#...`. If Gradle can't run in the sandbox, fall back to shipping only the source project and a one-command script.
- **macOS `.app`**: cannot be built here (needs macOS + Xcode for the noble native module). Ship a `scripts/build-mac.sh` one-liner and clear instructions instead — no binary from the sandbox.
- Copy any successful build artifact to `/mnt/documents/` so it's downloadable, and also to `public/downloads/` so the deployed web app can serve it directly.

### 2. In-app Downloads page
- New route `src/routes/_authenticated/downloads.tsx` with three cards:
  - **Android APK** — direct download button (`/downloads/carecore-android.apk`), install instructions (enable "Install unknown apps", `adb install` alternative), required permissions.
  - **macOS app** — download button if a `.zip` exists, otherwise a "Build locally" card with the exact commands from `docs/native-builds.md` and a copy-to-clipboard button.
  - **Web / PWA** — "Add to Home Screen" instructions for iOS/Android/desktop Chrome as a zero-install fallback.
- Add "Downloads" entry to `src/components/AppSidebar.tsx`.
- Link to the Downloads page from the existing "Native app mode" banner on the Devices page.

### 3. Make the APK actually usable
- Update `capacitor.config.ts` `server.url` so the shell points at the published site (already does — verify).
- Ensure the debug APK is built with `android:usesCleartextTraffic="false"` and the BLE permissions listed in `docs/native-builds.md` end up in the generated `AndroidManifest.xml`.

### 4. Docs refresh
- Update `docs/native-builds.md` with the new `scripts/build-android.sh` and `scripts/build-mac.sh` wrappers so a developer can rebuild with one command.

## Out of scope
- Play Store / Mac App Store publishing (needs developer accounts + signing keys you own).
- Code-signed / notarized macOS build (needs Apple Developer ID).
- iOS build (needs Xcode + Apple Developer account; can add later).
- Auto-update channel.

## Files touched
- New: `src/routes/_authenticated/downloads.tsx`, `scripts/build-android.sh`, `scripts/build-mac.sh`, `public/downloads/README.md` (+ APK if build succeeds).
- Edited: `src/components/AppSidebar.tsx`, `src/routes/_authenticated/devices.tsx`, `docs/native-builds.md`.

Reply "go" to proceed. If the sandbox Android build fails, I'll ship the Downloads page + build scripts and flag the APK as "build locally" instead of blocking the whole task.
