
## What we know

The `Build Android APK` run failed after 1m 26s. The visible annotation is only a deprecation warning about Node.js 20 — that's **not** the failure. The failure is `Process completed with exit code 1` on the `build` job, and it happened fast (under 90s), which means it died in one of the early steps (checkout, JDK, Android SDK, bun install, `cap sync`, or the very start of Gradle). We need the actual step log to know which.

## Step 1 — Read the real error (you, in the browser)

1. On the failed run page, click the red **build** box.
2. Expand each step top-to-bottom until you find the one with a red ❌ (not the ones with green ✓).
3. Copy the last ~20 lines of that step's log and paste them into chat.

That tells us exactly which command exited 1. Everything below is the fix I'll apply once we know — but two of them are safe to do preemptively.

## Step 2 — Preemptive hardening of `.github/workflows/android-apk.yml`

These are the two most common causes of a sub-90s failure on a first run, and both are safe to fix now:

1. **`bun install --frozen-lockfile` fails** when `bun.lock` on GitHub doesn't exactly match `package.json` (very common right after Lovable's first push). Change to `bun install` so it can reconcile.
2. **`./gradlew` isn't executable** on the Linux runner because the executable bit didn't survive the push. Add `chmod +x android/gradlew` before the Gradle step.

Also bump the deprecated actions to silence the Node 20 warning (cosmetic, not the cause):
- `actions/setup-java@v4` → keep (already v4)
- `android-actions/setup-android@v3` → `@v3` is fine, warning comes from its internals; nothing to do
- `oven-sh/setup-bun@v2` → keep

## Step 3 — Re-run

After the workflow file is updated, Lovable auto-pushes to GitHub. On the repo:
- Actions → **Build Android APK** → **Run workflow** → main → **Run workflow**.
- Wait 5–10 min. Green ✅ = APK published. Refresh the Downloads page in the app.

## Technical detail (for reference)

Patch to `.github/workflows/android-apk.yml`:

```yaml
- name: Install JS deps
  run: bun install          # was: bun install --frozen-lockfile

- name: Make gradlew executable
  run: chmod +x android/gradlew

- name: Sync Capacitor (Android)
  run: bunx cap sync android
```

If Step 1's log points to a different failing step (e.g. `cap sync` complaining about a missing plugin, or Gradle failing on an SDK component), I'll adjust the patch to target that instead — please paste the failing step's log before I switch to build mode.
