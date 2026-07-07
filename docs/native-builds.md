# Native builds (Android + macOS)

The Android APK and macOS `.app` are thin native shells around the
published web app. Both provide real BLE beacon scanning via native
platform APIs — no Chrome flag required.

Architecture: the shell loads `https://resident-voice-log.lovable.app`
in a WebView / BrowserWindow, and a native bridge (Capacitor plugin on
Android, `@abandonware/noble` on macOS) forwards beacon advertisements
into `window.__nativeBleAdapter`. The existing web scanner
automatically detects the bridge and uses it instead of `requestLEScan`.

To point either shell at a self-hosted deployment, edit the URL in
`capacitor.config.ts` (Android) and `electron/main.cjs` (macOS, env
`CARECORE_APP_URL`), then rebuild.

---

## Android APK (Capacitor)

Prerequisites:

- Node 20+, `bun install` already run
- Android Studio Hedgehog+ with Android SDK Platform 34
- JDK 17

Fast path (debug APK, side-load onto a phone):

```bash
./scripts/build-android.sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Manual equivalent:

```bash
# One-time: add the Android platform folder (already committed in this repo)
npx cap add android

# Every build
npx cap sync android
(cd android && ./gradlew assembleDebug)
# APK: android/app/build/outputs/apk/debug/app-debug.apk

# Or, for a signed release build:
npx cap open android     # Build → Generate Signed App Bundle / APK
```

The manifest at `android/app/src/main/AndroidManifest.xml` already declares
the permissions the BLE plugin needs:

```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"
                 android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"
                 android:maxSdkVersion="30" />
<uses-feature android:name="android.hardware.bluetooth_le"
              android:required="true" />
```

### First launch on device

1. Open CareCore, sign in, go to **Devices**.
2. Tap **Start scan** — Android prompts for **Nearby devices** permission. Allow.
3. If Bluetooth is off, the system enable dialog appears. Tap **Allow**.
4. The Devices page shows a green **Native app mode** banner and real
   beacons appear without the orange **Simulated** badge.

If the banner stays amber ("Simulator mode"), the WebView is not running
inside the Capacitor shell — reinstall the APK rather than opening the
site in Chrome.

Sideload the APK: `adb install -r app-debug.apk`.


---

## macOS app (Electron)

Prerequisites:

- Node 20+, Xcode command-line tools (`xcode-select --install`)
- Python 3 (needed by node-gyp to build the noble native module)

Install desktop-only dependencies (not in the main `package.json` to
keep the web install lean):

```bash
npm install --no-save electron@31 @electron/packager@18 \
  @abandonware/noble@1 electron-rebuild@3
```

Run in dev:

```bash
npx electron-rebuild -f -w @abandonware/noble
npx electron electron/main.cjs
```

Package:

```bash
npx @electron/packager . "CareCore" \
  --platform=darwin --arch=arm64 \
  --out=release --overwrite \
  --ignore='^/src' --ignore='^/public' --ignore='^/android' \
  --ignore='^/release'
```

Add to `Info.plist` (Packager will copy `electron/Info.plist` if
present, or edit `release/CareCore-darwin-arm64/CareCore.app/Contents/Info.plist`):

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>CareCore scans for BLE beacons near residents.</string>
```

First launch: right-click the `.app` → **Open** (unsigned build).
Full notarization requires an Apple Developer account and
`electron-osx-sign` — out of scope for this repo.
