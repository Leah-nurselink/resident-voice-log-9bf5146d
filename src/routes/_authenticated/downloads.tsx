import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Apple, Copy, Download, Smartphone, Globe, Check } from "lucide-react";
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

const ANDROID_BUILD = `# One-time setup
npx cap add android

# Every rebuild
bun run build
npx cap sync android
npx cap open android      # Build → Generate Signed APK/Bundle in Android Studio`;

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

        {/* Android */}
        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                Android APK
                <Badge variant="secondary">Recommended</Badge>
              </CardTitle>
              <CardDescription>
                Wraps CareCore in a Capacitor shell and uses Android's native BLE scanner.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-dashed p-4 text-sm">
              <p className="font-medium">Build required</p>
              <p className="mt-1 text-muted-foreground">
                A signed APK needs Android Studio + your signing key, so we don't ship a prebuilt
                binary. Run the commands below on a machine with Android Studio + JDK 17 installed,
                then sideload the APK with <code className="rounded bg-muted px-1">adb install</code>{" "}
                or transfer it to the device.
              </p>
            </div>
            <CodeBlock id="android" code={ANDROID_BUILD} />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">On first launch</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>Grant Bluetooth &amp; Location permissions when prompted.</li>
                <li>
                  If Play Protect warns about "unknown app", tap <em>Install anyway</em> — the APK
                  isn't Play-Store distributed.
                </li>
              </ul>
            </div>
            <Button asChild variant="outline">
              <a href="/docs/native-builds.md" target="_blank" rel="noreferrer">
                Full Android build guide
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
                Zero-install option — works today, but real BLE scanning still needs one of the
                shells above.
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

        <div className="flex justify-center">
          <Button asChild size="lg" className="gap-2">
            <a href="/docs/native-builds.md" target="_blank" rel="noreferrer">
              <Download className="h-4 w-4" />
              Full build documentation
            </a>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
