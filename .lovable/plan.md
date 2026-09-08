# Diagnose and fix the existing Android BLE chain

## Confirmed current state

- The Android app already includes the native Bluetooth plugin and the required Bluetooth, nearby-device, and location permissions.
- The existing app already attempts to install `window.__nativeBleAdapter`, captures raw scan callbacks, parses iBeacon/Eddystone/generic advertisements, and exposes a Beacon diagnostics page.
- Resident matching only runs while **Nearby Devices** scanning is started or **Care capture** is open.
- The live backend currently has **2 residents but 0 registered beacons**. Therefore, even if a physical advertisement reaches the app, it cannot currently match a beacon to a resident. This confirms the setup for stage E is incomplete, but does not yet tell us whether stages B–D also fail.
- No recent browser/build error identifies the physical Android failure. Device-side evidence is still required before assigning A, B, C, or D.

## Implementation

### 1. Add a single ordered diagnostic trace

Extend the existing BLE diagnostic state rather than creating another scanner or API. Record timestamped checkpoints for:

1. Native shell and Bluetooth plugin detected
2. Permission/radio/location checks completed
3. Native scan request accepted or rejected
4. Native Android scan callback received
5. Callback delivered through `window.__nativeBleAdapter`
6. Advertisement processed by Resident Voice Log
7. Parsed beacon key produced, including protocol, identifier, UUID/major/minor when available, RSSI, and safe raw advertisement details
8. Registered-device match found or rejected, including the expected key and RSSI threshold
9. Resident resolved or reason not resolved
10. Authenticated save succeeded or failed

Keep this trace in memory on the device and avoid resident-sensitive data in console output.

### 2. Separate native detection from bridge delivery

Add minimal diagnostic logging around the existing Android Bluetooth plugin during the APK build, without replacing it:

- Log scan start success/failure in Android logs.
- Log each native advertisement before it is sent to JavaScript.
- Log the handoff into the plugin listener.
- Keep the current `@capacitor-community/bluetooth-le` scanner and `window.__nativeBleAdapter` contract unchanged.

This creates independent evidence for distinguishing:

- **B:** no native callback
- **C:** native callback exists, but no JavaScript callback
- **D:** JavaScript callback exists, but no parsed app observation

### 3. Make Beacon diagnostics show the earliest failing stage

Refine the existing authenticated diagnostics page into one clear chain with live status:

```text
Android scan → Native advertisement → JS bridge → App parser → Registered beacon → Resident → Saved session
```

For each stage, show **Waiting**, **Passed**, or **Failed**, the latest timestamp, and a concise reason. Show the latest beacon ID and RSSI, with expandable raw identifiers for troubleshooting. Never label the scan as working merely because the bridge is installed; require an actual advertisement callback.

Add a copyable diagnostic report so the result can be shared without screenshots or Android development tools.

### 4. Trace matching for one physical beacon and one resident

Use the existing registration flow and data model:

- Once the real beacon appears, register that detected advertisement as a **wearable tag** and assign it to one of the existing residents chosen during the test.
- Require the stored key to exactly match the parsed live key.
- Show whether the live RSSI clears the configured threshold.
- Show the matched resident on diagnostics and in Nearby Devices.
- Do not seed a fake beacon, create an anonymous route, or change multi-beacon rules.

### 5. Verify authenticated persistence

With a signed-in staff user and the matched beacon in range:

- Start the existing session manager.
- Confirm a resident-linked care session is created with the triggering device and signal evidence.
- Confirm the device's last-seen time/RSSI and session event are saved.
- Surface any permission or save error as stage **F**, rather than losing it in a generic scanner message.

## Validation sequence

1. Add focused tests for advertisement parsing, stage transitions, exact beacon-key matching, and RSSI threshold outcomes.
2. Confirm the web app builds cleanly and existing BLE parser tests still pass.
3. Build a fresh Android APK with the diagnostic instrumentation.
4. On the physical Android phone, open **Beacon diagnostics**, start scanning beside the known-working beacon, and read the earliest failed stage.
5. Fix only that earliest failing stage, rebuild, and repeat until the beacon reaches the app.
6. Register that detected beacon to one chosen existing resident and confirm the authenticated session/save stages pass.

## Scope boundaries

- No BLE architecture redesign.
- No Windows or browser-scanning work.
- No new HTTP API or unauthenticated endpoint.
- No simulator result will count as a successful physical-beacon test.
- No expansion to multiple beacons/residents until the one-to-one test passes.
