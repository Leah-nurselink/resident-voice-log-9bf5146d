import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor Android shell for CareCore.
//
// The web app is a TanStack Start SSR site — we do NOT ship a static
// bundle inside the APK. Instead the WebView loads the published site
// and a native BLE bridge (installCapacitorBridgeIfNeeded in
// src/lib/native-beacon-bridge.ts) forwards real beacon advertisements
// to the page.
//
// To point the APK at your own deployment, change `server.url` below
// and rerun `npx cap sync android`.

const config: CapacitorConfig = {
  appId: "app.lovable.residentvoicelog",
  appName: "CareCore",
  webDir: "dist-shell",
  server: {
    url: "https://resident-voice-log.lovable.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: "Scanning for beacons…",
        cancel: "Stop scan",
        availableDevices: "Available devices",
        noDeviceFound: "No beacons found",
      },
    },
  },
};

export default config;
