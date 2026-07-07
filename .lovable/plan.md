## Goal
Make the BLE scanner work against **real beacons** (not the simulator) inside the actual Android app.

## Current state
- The JS bridge (`src/lib/native-beacon-bridge.ts`) already loads `@capacitor-community/bluetooth-le` and forwards real iBeacon / Eddystone / generic advertisements into the scanner.
- `startScanner()` already prefers the native adapter and only falls back to the simulator when no `window.Capacitor` shell is present or the native call throws.
- `capacitor.config.ts` points the WebView at the published site.
- Missing: no `android/` project has been generated, no permissions manifest, no runtime permission prompt, and no built APK — so on device the code path never activates and users only ever see simulated beacons.

## What I'll do

**1. Generate the Android project**
- Run `npx cap add android` (produces `android/` with a Gradle project).
- Run `npx cap sync android` so the BLE plugin is linked.

**2. Android manifest permissions**
Add to `android/app/src/main/AndroidManifest.xml`:
- `BLUETOOTH_SCAN` (with `usesPermissionFlags="neverForLocation"`)
- `BLUETOOTH_CONNECT`
- `ACCESS_FINE_LOCATION` (needed on Android ≤11)
- `<uses-feature android:name="android.hardware.bluetooth_le" android:required="true"/>`

**3. Runtime permission prompt**
Update `installCapacitorBridgeIfNeeded()` / `start()` in `native-beacon-bridge.ts` to:
- Call `BleClient.requestLEScan` behind a `requestPermissions()` / `isEnabled()` / `requestEnable()` preflight.
- Surface a clear error into `ScannerStatus.lastError` when the user denies permission or Bluetooth is off, instead of silently falling back to the simulator.

**4. Devices page UX**
- On `/devices`, when running in the native shell, hide the "simulator" fallback path and show a "Bluetooth off / permission denied" state with a Retry button that re-invokes the permission request.
- Add a small badge showing `status.mode` (`native-bridge` vs `simulator`) so the user can confirm they're on the real radio.

**5. Build & install docs**
Update `docs/native-builds.md` and `scripts/build-android.sh` with the exact commands:
```text
bun install
npx cap sync android
cd android && ./gradlew assembleDebug
# APK at android/app/build/outputs/apk/debug/app-debug.apk
adb install -r app-debug.apk
```
Plus a note that a debug APK works for side-loading on a physical phone; Play Store signing is out of scope for this pass.

## Not in scope
- iOS build
- Play Store release signing / upload
- Changes to the beacon parser or session-start logic (already correct)
- Electron/macOS shell (already wired via preload)

## After this
Sideload the debug APK, open the app, grant Bluetooth + Location permission on first launch, and the Devices page will show real nearby beacons with `mode: native-bridge` and no `simulated: true` flag.
