# Keep repo private, host APK in Lovable Cloud Storage

Good call for a care app — resident data handling code shouldn't be public. Here's how we make downloads work without exposing the source.

## The approach

Instead of GitHub Releases (which require login for private repos), the GitHub Actions workflow uploads the built `carecore.apk` to a **public Lovable Cloud Storage bucket**. The download arrow in the app points to that bucket URL — anonymous phones can fetch it, but the source code stays private.

## What I'll change

1. **Create a public storage bucket** `app-downloads` in Lovable Cloud (APK files only, public read).
2. **Update the GitHub Actions workflow** (`.github/workflows/android-build.yml`) so after building the APK it uploads to the bucket via the Supabase Storage REST API using a service-role secret, replacing the "create GitHub Release" step.
3. **Add two GitHub Actions secrets** you'll paste in (I'll give exact values): `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — needed by the workflow to upload. These live in GitHub, not in the app.
4. **Update the download prompt** (`AndroidDownloadPrompt.tsx` + `.env`) to point `VITE_ANDROID_APK_URL` at the stable public bucket URL (`https://<project>.supabase.co/storage/v1/object/public/app-downloads/carecore.apk`) instead of the GitHub release URL.
5. **Remove** the now-unused `VITE_ANDROID_APK_REPO` env var.

## Result

- Repo stays private ✅
- Carers tap the arrow → APK downloads immediately, no login ✅
- Each new build overwrites `carecore.apk` in the bucket, so the download link never changes ✅

## One thing you'll need to do

After I set this up, you'll paste two values into **GitHub → your repo → Settings → Secrets and variables → Actions**. I'll give you both values and screenshots-worth of steps. That's it.

Approve and I'll build it.
