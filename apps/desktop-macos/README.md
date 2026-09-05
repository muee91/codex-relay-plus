# Codex Relay Plus for macOS

The macOS app is a **background host for the mobile product**, not a second Codex client.

Its responsibilities are intentionally narrow:

- launch and keep the bundled Relay / Codex runtime running;
- expose Relay health from the menu bar;
- open the local Host panel when a phone needs to be paired or a device managed;
- restart Relay and open logs for maintenance;
- provide the default workspace used by the Relay runtime.

The app starts as a menu-bar accessory. It does **not** open the Host panel or take focus on normal launch. Closing the Host panel keeps Relay running.

Session browsing, task control, model/runtime controls, approvals, and other daily Codex workflows belong to `apps/mobile`.

## Build

Requirements: macOS 13+, Xcode Command Line Tools, Node.js 22.14+, pnpm 11.

```bash
pnpm install --frozen-lockfile
APP_VERSION=1.0.0 BUILD_NUMBER=1 ./apps/desktop-macos/build.sh
```

The build script compiles the native AppKit launcher, bundles the architecture-matched Node runtime and production Relay dependencies, derives `AppIcon.icns` from the canonical mobile icon, signs the bundle, and creates a DMG.

When Developer ID and notarization credentials are absent, the script creates an ad-hoc signed DMG for local testing. Release CI can use:

- `MACOS_CERTIFICATE_P12_BASE64`
- `MACOS_CERTIFICATE_PASSWORD`
- `MACOS_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_TEAM_ID`
- `APPLE_APP_PASSWORD`
