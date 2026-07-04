#!/usr/bin/env bash
# Build the CareCore Android shell.
# Requires: Node 20+, bun, Android Studio + SDK Platform 34, JDK 17.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d android ]; then
  echo "==> First run: adding Android platform"
  npx cap add android
fi

echo "==> Building web bundle (webDir stub)"
bun run build

echo "==> Syncing Capacitor"
npx cap sync android

echo
echo "Done. Next steps:"
echo "  • Debug APK:   (cd android && ./gradlew assembleDebug)"
echo "                 output: android/app/build/outputs/apk/debug/app-debug.apk"
echo "  • Signed APK:  npx cap open android   (Build → Generate Signed APK/Bundle)"
