# Build the CareCore Windows companion app locally on a Windows machine.
# Requires: Windows 10+, Node 20+, Visual Studio Build Tools (Desktop C++ workload)
# for the noble native Bluetooth module.
$ErrorActionPreference = "Stop"

Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "==> Installing desktop-only deps (not persisted to package.json)"
npm install --no-save `
  electron@31 `
  @electron/packager@18 `
  @abandonware/noble@1.9.2-26 `
  electron-rebuild@3

Write-Host "==> Rebuilding native BLE module for Electron"
npx electron-rebuild -f -w @abandonware/noble

Write-Host "==> Packaging CareCore for Windows (x64)"
npx @electron/packager . "CareCore" `
  --platform=win32 `
  --arch=x64 `
  --out=release `
  --overwrite `
  --ignore='^/src' `
  --ignore='^/public' `
  --ignore='^/android' `
  --ignore='^/release'

Write-Host "==> Zipping"
New-Item -ItemType Directory -Force dist-win | Out-Null
Compress-Archive -Path "release/CareCore-win32-x64/*" -DestinationPath "dist-win/carecore-windows.zip" -Force

Write-Host ""
Write-Host "Done. Zip: dist-win/carecore-windows.zip"
Write-Host "Run release/CareCore-win32-x64/CareCore.exe directly to test."
