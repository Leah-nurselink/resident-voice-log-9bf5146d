import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Apple, Copy, Download, Smartphone, Globe, Check, ExternalLink, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/downloads")({
  head: () => ({
    meta: [
      { title: "Download CareCore · Android & macOS" },
      {
        name: "description",
        content:
          "Install CareCore on Android or macOS for real BLE beacon scanning without browser flags.",
      },
    ],
  }),
  component: DownloadsPage,
});

// Direct link to the auto-built debug APK published by the
// `.github/workflows/android-apk.yml` workflow. Configure the repo via
// VITE_ANDROID_APK_REPO (e.g. "acme/carecore") in your env. Falls back to
// undefined, in which case the page shows setup instructions instead.
const APK_REPO =
  (import.meta.env.VITE_ANDROID_APK_REPO as string | undefined) ??
  "lkampewu-ui/resident-voice-log";
const APK_URL = `https://github.com/${APK_REPO}/releases/download/android-latest/carecore.apk`;

const MAC_BUILD = `# One-time
npm install --no-save electron@31 @electron/packager@18 \\
  @abandonware/noble@1 electron-rebuild@3

# Build
npx electron-rebuild -f -w @abandonware/noble
npx @electron/packager . "CareCore" \\
  --platform=darwin --arch=arm64 \\
  --out=release --overwrite`;

function CodeBlock({ code, id }: { code: string; id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        onClick={copy}
        className="absolute right-2 top-2 h-7 gap-1"
        aria-label={`Copy ${id} build commands`}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function DownloadsPage() {
  return (
    <AppShell title="Downloads" subtitle="Install CareCore on Android or macOS">
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold md:text-3xl">Download CareCore</h1>
          <p className="text-sm text-muted-foreground">
            Native shells give you real BLE beacon scanning without Chrome experimental flags. The
            app itself is the web app you already use — the shell just adds a Bluetooth bridge.
          </p>
        </header>

        {/* Android — one-tap install */}
        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                Android APK
                <Badge variant="secondary">Recommended for carers</Badge>
              </CardTitle>
              <CardDescription>
                Real BLE beacon scanning. Sideload — Google Play distribution comes later.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {APK_URL ? (
              <>
                <div className="rounded-lg border bg-primary/5 p-4">
                  <p className="text-sm">
                    Latest build is published as a GitHub Release. Open this page{" "}
                    <strong>on the Android phone</strong> and tap Download.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="lg" className="gap-2">
                      <a href={APK_URL}>
                        <Download className="h-4 w-4" />
                        Download carecore.apk
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="lg" className="gap-2">
                      <a
                        href={`https://github.com/${APK_REPO}/releases/tag/android-latest`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Release notes
                      </a>
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">On first launch</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-5">
                    <li>Tap the downloaded APK in Chrome / Files.</li>
                    <li>
                      Android will ask to allow installs from this source — tap{" "}
                      <em>Settings → Allow</em>, then <em>Install</em>.
                    </li>
                    <li>
                      Open <strong>CareCore</strong> from your app drawer (not Chrome), sign in, go
                      to <em>Devices</em>.
                    </li>
                    <li>
                      Tap <em>Start scan</em> and allow <em>Nearby devices</em>. You should see the
                      green "Native app mode" banner.
                    </li>
                  </ol>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-dashed p-4 text-sm">
                  <p className="font-medium">One-time setup required</p>
                  <p className="mt-1 text-muted-foreground">
                    To enable one-tap downloads, push this repo to GitHub and set{" "}
                    <code className="rounded bg-muted px-1">VITE_ANDROID_APK_REPO</code> to
                    your <code>owner/repo</code> (e.g. <code>acme/carecore</code>) in your Lovable
                    project env. The included workflow (
                    <code>.github/workflows/android-apk.yml</code>) will build the APK on every push
                    and publish it as the <code>android-latest</code> release. This button will then
                    link straight to <code>carecore.apk</code>.
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Meanwhile — build it locally</p>
                  <p className="mt-1">
                    On a machine with Android Studio + JDK 17:{" "}
                    <code className="rounded bg-muted px-1">./scripts/build-android.sh</code>, then{" "}
                    <code className="rounded bg-muted px-1">
                      adb install -r android/app/build/outputs/apk/debug/app-debug.apk
                    </code>
                    .
                  </p>
                </div>
              </>
            )}
            <Button asChild variant="ghost" size="sm">
              <a href="/docs/native-builds.md" target="_blank" rel="noreferrer">
                Full Android build guide →
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* macOS */}
        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Apple className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle>macOS app</CardTitle>
              <CardDescription>
                Electron shell with a native <code>noble</code> BLE scanner. Apple Silicon &amp;
                Intel.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-dashed p-4 text-sm">
              <p className="font-medium">Build required</p>
              <p className="mt-1 text-muted-foreground">
                The macOS build needs Xcode command-line tools to compile the native Bluetooth
                module. Build locally, then right-click the resulting <code>.app</code> and choose{" "}
                <em>Open</em> the first time (unsigned).
              </p>
            </div>
            <CodeBlock id="mac" code={MAC_BUILD} />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Permission</p>
              <p className="mt-1">
                macOS will ask for Bluetooth access the first time CareCore scans. Approve it in{" "}
                <em>System Settings → Privacy &amp; Security → Bluetooth</em>.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* PWA */}
        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Globe className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle>Install from the browser (no build)</CardTitle>
              <CardDescription>
                Zero-install option — works today, but real BLE scanning still needs the Android
                app.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">iOS Safari:</span> Share button →{" "}
              <em>Add to Home Screen</em>.
            </p>
            <p>
              <span className="font-medium text-foreground">Android Chrome:</span> ⋮ menu →{" "}
              <em>Install app</em>.
            </p>
            <p>
              <span className="font-medium text-foreground">Desktop Chrome/Edge:</span> address-bar
              install icon → <em>Install</em>.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
