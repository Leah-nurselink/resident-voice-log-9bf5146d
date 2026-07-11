## What this screen is telling us

You're on Lovable's **New GitHub connection** screen. "No installations available" means the Lovable GitHub App hasn't been installed on any of your GitHub accounts yet — that's why nothing shows up to pick from.

The repo `Leah-nurselink/gh-repo-clone-lkampewu-ui-resident-voice-log-78cb0d8a` exists on GitHub, but Lovable can't push to it until you give the Lovable app permission on that GitHub account.

## What you do (all in the browser, no code)

1. On this same screen, click **Add account** (bottom right).
2. A GitHub window opens. Sign in as **Leah-nurselink** (the account that owns the repo).
3. GitHub asks where to install the Lovable app — pick **Leah-nurselink**.
4. Choose **"Only select repositories"** and pick `gh-repo-clone-lkampewu-ui-resident-voice-log-78cb0d8a`. (Or "All repositories" if you prefer — either works.)
5. Click **Install**. You'll be sent back to Lovable.
6. Back on the "Select installation" screen, click **Refresh**. `Leah-nurselink` should now appear. Select it, then pick the repo and finish the connection.

## After it connects

- Lovable will push the full project (including `.github/workflows/android-apk.yml`) to that repo automatically.
- Go to the repo's **Actions** tab on GitHub — you should now see **Build Android APK** in the left sidebar.
- Click it → **Run workflow** → `main` → **Run workflow**. Wait 5–10 min.
- Refresh the Downloads page in your app — the green Download button will appear.

## If step 3 doesn't show Leah-nurselink

That means you're signed into GitHub as a different user in your browser. Open github.com in another tab, sign out, sign back in as Leah-nurselink, then click **Add account** again.

No code changes needed for this step — it's purely the GitHub install handshake.
