# Getting one beacon to reach one resident — assessment and minimum path

## Answers to your five questions

**1. Is the native scanner actually implemented?**
Yes. The Android app uses a real Bluetooth scanning plugin, asks for Bluetooth
and Location, starts a live scan, and passes every advertisement it hears into
the app. This code exists and is wired up today.

**2. Is the bridge (`window.__nativeBleAdapter`) correctly implemented?**
Yes. The Android shell installs it on start-up, and the app reads beacon
identity (iBeacon UUID / major / minor) from what it delivers. The same bridge
name is also used by the desktop shell, so nothing needs redesigning.

**3. Is the GitHub build failure blocking this?**
It blocks only the **Windows desktop** app. The **Android** build is separate
and has been producing a working app. So the Windows failure is not stopping
your proof-of-concept.

**4. What is needed to get the first detection working?**
Almost certainly nothing new to build — what is missing is a recorded run on
the phone showing which step stops. The app already has a Beacon Diagnostics
screen that shows each step in order (shell, Bluetooth plugin, scan started,
advertisement heard, bridge handover, app read it, matched a registered
beacon, matched a resident, saved). We use that instead of guessing.

**5. Keep the current architecture or move to a separate native app?**
Keep it. Phone-in-pocket is the right hardware for care staff, and the current
Android shell already covers the whole chain. A separate desktop scanner is a
nice-to-have, not the route to your proof-of-concept.

## Recommendation

Park the Windows desktop app entirely for now. Prove the chain on Android with
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
