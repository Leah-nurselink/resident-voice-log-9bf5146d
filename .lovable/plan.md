
## Current APK build fix

The Android project is configured to compile Java 21 (`JavaVersion.VERSION_21`) but the GitHub Actions workflow was installing JDK 17. That mismatch can make the Gradle `Build debug APK` step fail.

I updated `.github/workflows/android-apk.yml` to install **JDK 21** before building the APK.

## Next step in GitHub

1. Wait for Lovable to sync/push the latest workflow change to GitHub.
2. Go to **Actions** → **Build Android APK**.
3. Click **Run workflow** → branch `main` → **Run workflow**.
4. Open the newest run at the top — not an older re-run.

If it still fails, click the newest failed run, open the red **build** box, expand the step with the ❌, and paste the last ~20 lines from that failing step.
