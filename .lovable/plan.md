## What the screenshot tells us
- Real repo (top breadcrumb): `Leah-nurselink/gh-repo-clone-lkampewu-ui-resident-voice-log-78cb0d8a`
- Actions tab is empty ("Get started with GitHub Actions") → the workflow file `.github/workflows/android-apk.yml` hasn't reached GitHub yet.

My previous edit changed `APK_REPO` to `lkampewu-ui/resident-voice-log-78cb0d8a` — that was the wrong repo (it was the "Clone repository" panel from the earlier screenshot, not the actual connected repo). I need to revert it.

## Fix in code (1 line)
Revert `src/routes/_authenticated/downloads.tsx` `APK_REPO` back to:
`Leah-nurselink/gh-repo-clone-lkampewu-ui-resident-voice-log-78cb0d8a`

## Why Actions is empty — what you do
The workflow file lives in your Lovable project at `.github/workflows/android-apk.yml`, but the connected GitHub repo doesn't have it yet. To get it there:

1. In Lovable, open the Plus (+) menu → **GitHub** → make sure the project is synced/pushed to `Leah-nurselink/gh-repo-clone-lkampewu-ui-resident-voice-log-78cb0d8a`. If you see a "Push" or "Resync" option, use it.
2. Once synced, refresh the GitHub Actions tab — you should now see **Build Android APK** listed on the left.
3. Click **Build Android APK** → **Run workflow** → `main` → **Run workflow**.
4. Wait 5–10 minutes. When it goes green, refresh the Downloads page in your app and the APK button will work.

If after step 1 the workflow still doesn't appear on the Actions tab, check the repo's file tree in GitHub — browse to `.github/workflows/`. If that folder is missing, the sync didn't include hidden dotfiles; tell me and I'll advise the next step (usually opening Lovable's Code Editor and forcing a fresh commit).