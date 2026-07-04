## Goal
Ship installable Android + macOS builds that scan real BLE beacons, since Chrome's `requestLEScan` won't work reliably.

## Reality check
- **Android (Capacitor)**: Great fit. Native BLE APIs work reliably. Real beacons detectable without Chrome flags. This will actually deliver your goal.
- **macOS (Electron)**: Electron's Web Bluetooth has the same limitations as Chrome. Real passive beacon scanning on macOS needs a native Node module (`@abandonware/noble`), which requires Bluetooth permission entitlements and works but is finicky. It will detect beacons, but is less polished than Android.
- Neither build can be produced *inside* this sandbox as a signed store-ready binary — you'll build/sign locally. I'll set up the projects and give exact commands.

## Plan

### 1. Abstract the beacon scanner
Introduce a `BeaconAdapter` interface in `src/lib/ble-advertisement-scanner.ts` with three implementations selected at runtime:
- `WebBleAdapter` — current `requestLEScan` path (browser).
- `CapacitorBleAdapter` — uses `@capacitor-community/bluetooth-le` `requestLEScan` (Android/iOS).
- `NobleAdapter` — Electron main process using `@abandonware/noble`, bridged to renderer via IPC (macOS/Windows/Linux desktop).

Detection order: Capacitor native → Electron preload flag → Web Bluetooth → simulator.

### 2. Android app (Capacitor)
- Add Capacitor: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor-community/bluetooth-le`.
- `capacitor.config.ts` with app id `app.lovable.residentvoicelog`, webDir `dist`.
- Add Android permissions: `BLUETOOTH_SCAN` (with `neverForLocation`), `BLUETOOTH_CONNECT`, `ACCESS_FINE_LOCATION` (Android ≤11).
- Provide `scripts/build-android.sh` and README with:
  ```
  bun run build
  npx cap sync android
  npx cap open android    # then Build → Generate Signed APK/Bundle
  ```

### 3. macOS app (Electron)
- Add `electron`, `@electron/packager`, `@abandonware/noble`, `electron-rebuild`.
- `electron/main.cjs` — creates BrowserWindow, loads built `dist/index.html`, owns `noble` scanner, forwards advertisements over IPC.
- `electron/preload.cjs` — exposes `window.electronBeacons.subscribe(...)` via `contextBridge`.
- Set `vite.config.ts` `base: './'` for `file://` loading.
- macOS Info.plist entry: `NSBluetoothAlwaysUsageDescription`.
- Provide `scripts/build-mac.sh`:
  ```
  bun run build
  npx electron-rebuild
  npx @electron/packager . "ResidentVoiceLog" --platform=darwin --arch=arm64 --out=release
  ```
- Note: unsigned build → user must right-click → Open the first time. Full notarization needs an Apple Developer account (out of scope).

### 4. UI updates
- Show detected runtime ("Android native", "macOS native", "Web Bluetooth", "Simulator") in the diagnostic card already added.
- Add a "Download apps" section on the Devices page linking to build instructions / releases folder.

### 5. Docs
Add `docs/native-builds.md` with prerequisites (Android Studio + JDK 17 for Android; Xcode command-line tools for macOS), signing notes, and how to sideload the APK.

## What I won't do
- Won't produce signed store-ready builds inside this sandbox (needs your local Android Studio / Xcode + signing keys).
- Won't publish to Play Store / Mac App Store — that's a manual account step.
- Won't touch business logic outside the scanner abstraction.

## Estimated impact
~15 new/edited files. No database or backend changes. Web app keeps working exactly as before.

Reply "go" to proceed, or tell me to trim scope (e.g. Android only first).