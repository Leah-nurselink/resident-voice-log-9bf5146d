#!/usr/bin/env bash
# Build the CareCore Android shell (debug APK for side-loading).
# Requires: Node 20+, bun, Android Studio + SDK Platform 34, JDK 17,
#           ANDROID_HOME (or ANDROID_SDK_ROOT) exported.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d android ]; then
  echo "==> First run: adding Android platform"
  npx cap add android
fi

echo "==> Syncing Capacitor (links @capacitor-community/bluetooth-le)"
npx cap sync android

echo "==> Building debug APK with Gradle"
(cd android && ./gradlew assembleDebug)

APK=android/app/build/outputs/apk/debug/app-debug.apk
echo
echo "Done."
echo "  • APK:      $APK"
echo "  • Install:  adb install -r $APK"
echo
echo "First launch on device:"
echo "  1. Grant 'Nearby devices' (BLUETOOTH_SCAN) when prompted."
echo "  2. If Bluetooth is off, the app will pop the system enable dialog."
echo "  3. Devices page should show a green 'Native app mode' banner and"
echo "     real beacons — no 'Simulated' badge."
