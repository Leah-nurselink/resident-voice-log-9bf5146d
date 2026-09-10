# Getting one beacon to reach one resident — assessment and minimum path

## What your two screenshots show

You are running Resident Voice Log **in the Chrome browser on your phone**, not
in the installed CareCore app. Three giveaways:

- the red error "Access to the feature bluetooth is disallowed" / "Failed to
  execute requestLEScan" — that is the browser refusing Bluetooth, not the app;
- the only beacon listed is "DEMO beacon (simulated)";
- the floating "Download app" button is showing, which is hidden inside the app.

So the reason you see no real beacons here is simply that a mobile browser is
not allowed to scan for them. This is not a fault in the beacon chain.

## Answers to your five questions

**1. Is the native scanner actually implemented?**
Yes. The installed Android app uses a real Bluetooth scanning plugin, asks for
Bluetooth and Location, starts a live scan, and passes every advertisement it
hears into the app.

**2. Is the bridge (`window.__nativeBleAdapter`) correctly implemented?**
Yes. The Android app installs it on start-up, and the app reads beacon identity
(iBeacon UUID / major / minor) from what it delivers. Nothing needs redesigning.

**3. Is the GitHub build failure blocking this?**
It blocks only the **Windows desktop** app. The **Android** build is separate
and is producing a working app, so it is not stopping your proof-of-concept.

**4. What is needed to get the first detection working?**
Most likely nothing new to build — first repeat the test **inside the installed
app** rather than in Chrome. If it still fails there, the app's Beacon
Diagnostics screen names the exact step that stops.

**5. Keep the current architecture or move to a separate native app?**
Keep it. A phone in a carer's pocket is the right hardware, and the Android app
already covers the whole chain end to end.

## Recommendation

Park the Windows desktop app. Prove the chain on the installed Android app with
one beacon and one test resident.

## Steps

1. **Confirm the Android app you have is the latest build.** The Devices screen
   shows a build stamp; if it is older than the diagnostics work, install the
   newest one from the Downloads page.
2. **Run the diagnostics screen with the beacon in hand.** Open Beacon
   Diagnostics, press Start, hold the beacon next to the phone, and copy the
   report. The report names the exact stage that stops.
3. **Fix only that stage.** Likely candidates, cheapest first:
   - permission or Location not granted on the phone (settings, no code),
   - the beacon broadcasts a format the app does not yet read (small parser
     addition, using the raw data the report shows),
   - the beacon is heard but not registered (register it from the raw list).
4. **Register the beacon against one dummy resident** in the Devices screen and
   confirm a detection is saved to that resident's record.
5. Only after that works, revisit the Windows companion app.

## Technical notes

- No new HTTP endpoints, no unauthenticated routes, no architecture change.
- Matching key is `ibeacon:<uuid>:<major>:<minor>`, produced identically by the
  scanner and by beacon registration; non-iBeacon formats fall back to the
  device address, which Android rotates — so a non-iBeacon beacon would need a
  parser addition rather than a config change.
- The Windows workflow stays as-is (already pinned to a valid Noble version);
  it simply is not on the critical path.

## What I need from you

The copied diagnostics report from step 2 (or a photo of the screen). That one
artefact replaces all further guessing.
