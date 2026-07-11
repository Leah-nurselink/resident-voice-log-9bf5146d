## Diagnosis

The failing step is Gradle evaluating `android/app/build.gradle` line 12:

```groovy
versionCode (System.getenv("CARECORE_VERSION_CODE") ?: "1") as Integer
versionName System.getenv("CARECORE_VERSION_NAME") ?: "1.0.0-dev"
```

Error: `A problem occurred evaluating project ':app'. > Value is null`.

Two problems in that expression:

1. **Groovy parsing ambiguity.** `versionCode (…)` with a leading space is parsed as the method call `versionCode(...)` — which returns `null` — and then `as Integer` is applied to that `null`. AGP's `versionCode` setter then sees `null` and throws "Value is null".
2. **Fragile `as Integer` coercion.** Even without the ambiguity, `"1" as Integer` via Groovy's dynamic coerce is brittle; `Integer.parseInt` is the standard idiom AGP examples use.

`versionName` on line 13 has the same "no parens" shape and will hit the same bug once line 12 is fixed.

## Fix

Rewrite the two lines in `android/app/build.gradle` to unambiguous, null-safe form:

```groovy
def envVersionCode = System.getenv("CARECORE_VERSION_CODE")
def envVersionName = System.getenv("CARECORE_VERSION_NAME")
versionCode envVersionCode ? Integer.parseInt(envVersionCode) : 1
versionName envVersionName ?: "1.0.0-dev"
```

That's the entire change. No workflow, Capacitor, or app-code changes needed.

## After the fix

1. Push (Lovable auto-syncs to `main`, which re-triggers the workflow via the `push` trigger).
2. Watch the run — the `Build debug APK` step should now succeed.
3. `carecore.apk` gets attached to the `android-latest` release, and the Downloads page's green button starts working.

If the run fails at a later step, paste the new error and I'll take it from there.
