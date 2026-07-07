## Goal

Stop treating ForgeAI as "a website that also runs on phones." Restructure it as a proper healthcare product:

- **Android app** (Capacitor) — the carer's tool. BLE, voice, camera, offline, AI notes.
- **Web dashboard** — the manager's tool. Residents, care plans, audits, analytics, governance. No Bluetooth.
- **One shared backend** — Lovable Cloud (Postgres + Auth + Storage + Realtime + RLS), which is already wired in.

Then focus everything on **one end-to-end milestone** before adding more features:

> A carer opens the Android app in a resident's room. BLE identifies the room + wearable, a care session auto-starts, the carer speaks, AI transcribes and structures the note, and it appears on the manager's web dashboard in real time.

## What already exists (don't rebuild)

- Supabase/Cloud backend with residents, care_sessions, daily_notes, devices, alerts, RLS, roles.
- BLE advertisement scanner + native bridge (`src/lib/ble-advertisement-scanner.ts`, `src/lib/native-beacon-bridge.ts`).
- Capacitor shell config, Electron shell, downloads page, build scripts.
- Voice capture + AI transcription + structured note generation (`SessionRecorder`, `ai.functions.ts`).
- Devices page with beacon registration.

The pieces are there but scattered across one unified web UI. This plan **separates the audiences**, hardens the Android path, and stitches the milestone flow end-to-end.

## Plan

### 1. Split the app into two audiences (same codebase, same backend)

Introduce a runtime "surface" concept driven by platform detection:

- `carer` surface — what the Android app (and small screens) shows: today's residents, quick session capture, alerts, tasks. Bluetooth-first.
- `manager` surface — what the web shows: dashboards, care plans, audits, analytics, safeguarding, family portal. No Bluetooth UI.

Implementation:
- New `src/lib/surface.ts` — detects Capacitor native + role and returns `"carer" | "manager"`.
- New route layout `src/routes/_authenticated/_carer/` (mobile-first shell) and `_authenticated/_manager/` (existing sidebar shell).
- `_authenticated/route.tsx` redirects to the right surface on first load; users can still deep-link to the other side via a menu toggle (useful for admins on desktop).
- Move existing routes into the correct subtree:
  - Carer: `devices`, `notes` (capture), `alerts`, `tasks`, resident quick view, calendar (today only).
  - Manager: `dashboard`, `residents`, `care-plans`, `audits`, `safeguarding`, `analytics`, `reports`, `admin`, `approvals`, `intelligence`, `regulatory`, `communications`, `family`, `feedback`, `professionals`, `action-plan`, `incident-review`.
- Sidebar (`AppSidebar.tsx`) only renders on the manager surface. Carer surface gets a bottom tab bar (`CarerTabBar.tsx`): **Today · Capture · Residents · Alerts**.

### 2. Nail the milestone flow (carer surface)

New route `src/routes/_authenticated/_carer/capture.tsx` — the "walk into room" screen:

1. On mount, start BLE scan via the native adapter (falls back to sim in browser).
2. Live-rank nearby beacons by RSSI; resolve room + resident from the `devices` table.
3. Show a confidence pill (room ✕ resident) and auto-start a `care_session` row once confidence ≥ threshold for N seconds.
4. Mount the existing `SessionRecorder` with `autoStart` and `residentName` prefilled.
5. On result, insert into `daily_notes` with `care_session_id`, `resident_id`, structured fields, transcript, audio metrics.
6. Toast + "View note" link; session marked `completed` with `ended_at`.

Backend touch (single migration):
- Ensure `care_sessions` has `beacon_confidence`, `room_id`, `started_via` (`'ble' | 'manual'`), `ended_at`.
- Ensure `daily_notes.care_session_id` FK exists.
- Enable Realtime on `daily_notes` and `care_sessions` so the manager dashboard updates live.
- Add missing indexes and GRANTs; policies stay scoped via `has_role`/`is_staff`.

(Only add columns that aren't already there — verify first with `supabase--read_query`.)

### 3. Manager dashboard: live feed of the milestone

- On `_manager/dashboard`, add a "Live care activity" panel subscribed to `care_sessions` + `daily_notes` inserts/updates. Shows resident, carer, room, confidence, and the AI note as it lands.
- Link each entry to the resident timeline.

This closes the loop the user described: carer walks in → manager sees the note instantly.

### 4. Android app hardening

- `capacitor.config.ts`: confirm `server.url` points at the published site, `androidScheme: "https"`, `allowNavigation` locked to the Lovable domain.
- Add `AndroidManifest.xml` guidance in `docs/native-builds.md` for `BLUETOOTH_SCAN` (with `neverForLocation`), `BLUETOOTH_CONNECT`, `ACCESS_FINE_LOCATION` (Android ≤11), `POST_NOTIFICATIONS`, `RECORD_AUDIO`, `CAMERA`.
- On first launch of the carer surface, run a permissions preflight (BLE + mic + notifications) with a clear rationale screen; block Capture until granted.
- Offline queue: wrap the note insert in a small IndexedDB-backed queue (`src/lib/offline-queue.ts`) that flushes when back online. Show a "queued" badge on the capture screen.

### 5. Web dashboard cleanup

- Remove Bluetooth/device UI from the manager surface (devices management stays for admins under `_manager/admin/devices`, but the daily "scan" UI is carer-only).
- Keep the Downloads page — it's how managers get carers set up.
- Add a "Get the Android app" prompt on first manager login pointing to Downloads.

### 6. What we're deliberately NOT doing in this pass

- iOS build (needs Apple Developer account).
- Play Store publishing / signing pipeline (documented, not automated).
- Predictive analytics changes.
- Family portal changes.
- Communications refactor.
- Any new AI features beyond what's already wired.

These stay untouched so the milestone lands cleanly.

## Files touched (high level)

**New**
- `src/lib/surface.ts`
- `src/lib/offline-queue.ts`
- `src/components/CarerTabBar.tsx`
- `src/routes/_authenticated/_carer/route.tsx`
- `src/routes/_authenticated/_carer/index.tsx` (Today)
- `src/routes/_authenticated/_carer/capture.tsx`
- `src/routes/_authenticated/_carer/residents.tsx`
- `src/routes/_authenticated/_carer/alerts.tsx`
- `src/routes/_authenticated/_manager/route.tsx` (wraps existing AppShell)
- `src/components/dashboard/LiveCareActivity.tsx`

**Moved** (into `_manager/`)
- All existing manager-only routes listed in step 1.

**Edited**
- `src/routes/_authenticated/route.tsx` — surface redirect.
- `src/components/AppSidebar.tsx` — manager-only.
- `src/routes/_authenticated/devices.tsx` — becomes admin-only under manager.
- `capacitor.config.ts`, `docs/native-builds.md`, `scripts/build-android.sh` — permissions + build polish.
- One migration adding session columns, FK, Realtime, indexes, GRANTs.

## How we'll know it works

1. `bun run build` passes.
2. On desktop web (manager role), you land on `/dashboard`; no Bluetooth UI visible.
3. On the Android APK (or Chrome mobile with the sim), you land on `/carer` with the bottom tab bar; Capture screen runs a BLE scan and shows detected beacons.
4. With a registered beacon in range, Capture auto-starts a session, records, and writes a `daily_notes` row.
5. A second browser open to `/dashboard` sees the note appear in the Live Care Activity panel within ~1s (Realtime).

---

Reply **"go"** to proceed. If you'd rather I sequence it (e.g. do the surface split first, then the capture flow, then Realtime), say so and I'll break it into stages.