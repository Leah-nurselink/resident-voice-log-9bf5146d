## Plan

1. Add a “Check real beacon support” action on the Nearby Devices page.
   - It will check whether the browser exposes Web Bluetooth and `requestLEScan`.
   - It will show a clear result: ready for real beacons, missing Chrome flag, unsupported browser, or likely unsupported OS.

2. Improve the simulator warning.
   - Keep the existing warning, but make it more direct: simulated beacons are fake and real beacons require Chrome support for passive BLE scanning.
   - If the browser supports Web Bluetooth but not passive scanning, tell the user to enable “Experimental Web Platform features,” relaunch Chrome, then retry.

3. Prevent confusion while troubleshooting.
   - Add an option/status path that lets the user see “Real scanning available” before starting.
   - When real scanning is unavailable, keep simulator data visibly labeled as “Simulated.”

4. Technical details.
   - Update `src/lib/ble-advertisement-scanner.ts` with a small browser capability diagnostic helper.
   - Update `src/routes/_authenticated/devices.tsx` to display the diagnostic result and add the support-check button near the scan controls.
   - No backend/database changes.