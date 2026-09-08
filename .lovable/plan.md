# Fix the Windows companion build failure

## What is wrong

The Windows build installs the Bluetooth library with the version request
`@abandonware/noble@1`. That library has never published a plain `1.x`
release — every release is named like `1.9.2-26`, which counts as a
"pre-release" and is deliberately excluded when you ask for `1`. So the
install step stops with "No matching version found".

Confirmed against the package registry: the newest and only current release
line is `1.9.2-26`. The other tools in the same command (`electron@31`,
`@electron/packager@18`, `electron-rebuild@3`) all resolve fine.

Nothing is wrong with the Bluetooth setup itself — only the version number
written in the build scripts.

## The change

Replace the unmatched `@abandonware/noble@1` with the exact working release
`@abandonware/noble@1.9.2-26` in the three places that install it:

- `.github/workflows/windows-companion.yml` (the failing step)
- `scripts/build-windows.ps1` (local Windows build)
- `scripts/build-mac.sh` (local macOS build, same latent failure)

Also update the same command shown in `docs/native-builds.md` so the
instructions match.

No other change: the Bluetooth library stays, the native scanner stays, the
bridge into the app stays, no new endpoints.

## Technical notes

Exact pin rather than a range, because the whole release line is
pre-release-tagged and any caret/major range silently fails to match.
`electron-rebuild -f -w @abandonware/noble` is unaffected.

## What happens after

The workflow already runs automatically on any push to `main` that touches
`.github/workflows/**`, so syncing this change to GitHub starts a fresh build
by itself — no manual GitHub editing needed.

Then we check the run: it should get past `Install desktop-only deps`. If a
later step fails (native module compile, packaging, or upload), we read that
error and fix it next rather than guessing now.
