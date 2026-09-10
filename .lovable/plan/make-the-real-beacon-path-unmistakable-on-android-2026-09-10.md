# Make the real-beacon path unmistakable on Android

## Confirmed diagnosis

Both screenshots are from **Chrome**, not the installed CareCore Android app:

- the Android page still shows the **Download app** button, which the project hides inside the native app;
- the scan error names Chrome’s `requestLEScan` browser feature;
- the listed “DEMO beacon” is explicitly marked **SIMULATED**.

Chrome is refusing passive Bluetooth scanning with `SecurityError: Access to the feature "bluetooth" is disallowed`. The existing native Android scanner and JavaScript bridge are not being reached in these screenshots, so they do not yet prove a native BLE failure.

## Changes

1. **Prevent misleading browser scans on Android**
   - Do not start `requestLEScan` when the page is running in mobile Chrome and passive scanning is blocked.
   - Keep simulated data clearly separate from real-beacon results.

2. **Give one direct next action**
   - Replace the long browser error with a concise message directing the user to download/open the installed CareCore app for real beacon scanning.
   - Keep the existing download button available in Chrome and hidden inside the installed app.

3. **Make native status obvious**
   - On Devices and Beacon Diagnostics, show whether the current screen is the installed app or a browser before scanning starts.
   - In the installed app, continue using the existing native BLE → JavaScript bridge → beacon matching → resident workflow without changing its architecture.

4. **Verify both paths**
   - Browser: no raw `requestLEScan` security error; clear installed-app instruction; simulated entries remain labelled.
   - Installed Android app: native adapter is selected, the download button is absent, and diagnostics can identify the first failed native stage if no advertisement arrives.

## Physical acceptance test

Install the newly built APK, open **CareCore** from the Android app list—not Chrome—then open **Beacon Diagnostics**, press **Start**, keep one known beacon close, and copy the report. Success requires one real advertisement to pass through the native bridge and appear without a **SIMULATED** badge.

## Not changing

- No Windows work.
- No HTTP BLE service.
- No removal of the native BLE plugin.
- No redesign of the existing beacon-to-resident architecture.
