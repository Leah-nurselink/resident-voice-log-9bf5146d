## What's happening

The CareCore Android APK is a Capacitor WebView wrapper that loads the published website. It includes the native `@capacitor-community/bluetooth-le` plugin, but the JavaScript bridge wrapper (`BleClient`) can fail to initialize inside the remote web build. When that happens the app silently falls back to simulator mode.

## What I changed

1. **`src/lib/native-beacon-bridge.ts`**
   - Detects the native shell using `window.Capacitor` (the injected native bridge) rather than only the imported module.
   - Tries the `BleClient` wrapper first.
   - If `BleClient` fails, falls back to calling `window.Capacitor.Plugins.BluetoothLe` directly, bypassing any bundling/platform-detection mismatch.
   - Records the install attempt result so diagnostics can show exactly why the bridge succeeded or failed.
   - Parses raw advertisement bytes more defensively (DataView, ArrayBuffer, Uint8Array, base64, hex).

2. **`src/routes/_authenticated/beacon-diagnostics.tsx`**
   - Auto-attempts bridge installation when the page mounts.
   - Displays the last install attempt result in the "Bridge & scanner" card.

3. **`src/routes/_authenticated/devices.tsx`**
   - Eagerly installs the native bridge on page mount so the first scan can use it.

## Next steps

1. **Publish the app** in Lovable so the published site contains the new bridge code.
2. **Push to GitHub** (or wait for Lovable auto-sync) so the `Build Android APK` workflow runs on `main`.
3. **Wait** for the workflow to finish and upload a fresh APK.
4. **Uninstall** the old CareCore app from your Android phone.
5. **Download and install** the new APK from the published site.
6. Open **Beacon diagnostics** in the app and check:
   - Native shell: yes
   - Native BLE adapter installed: yes
   - Capacitor platform: android
   - Install attempt: installed
   - Raw native advertisements: your beacons appear here before any filtering.

If "Install attempt" still shows an error after reinstalling, screenshot that line and the "Bridge error" line and send it.
