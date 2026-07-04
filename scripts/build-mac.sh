#!/usr/bin/env bash
# Build the CareCore macOS Electron shell.
# Requires: macOS, Node 20+, Xcode command-line tools, Python 3.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing desktop-only deps (not persisted to package.json)"
npm install --no-save \
  electron@31 \
  @electron/packager@18 \
  @abandonware/noble@1 \
  electron-rebuild@3

echo "==> Rebuilding native BLE module for Electron"
npx electron-rebuild -f -w @abandonware/noble

echo "==> Packaging CareCore.app"
npx @electron/packager . "CareCore" \
  --platform=darwin \
  --arch="$(uname -m | sed 's/x86_64/x64/')" \
  --out=release \
  --overwrite \
  --ignore='^/src' \
  --ignore='^/public' \
  --ignore='^/android' \
  --ignore='^/release'

echo
echo "Done. App bundle: release/CareCore-darwin-*/CareCore.app"
echo "First launch: right-click the .app → Open (unsigned build)."
