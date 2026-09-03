# Codex Relay Plus for macOS

Native AppKit + WKWebView shell for the local Codex Relay Plus Control Center.

## Build

Requirements: macOS 13+, Xcode Command Line Tools, Node.js 22.14+, pnpm 11.

```bash
pnpm install --frozen-lockfile
APP_VERSION=1.0.0 BUILD_NUMBER=1 ./apps/desktop-macos/build.sh
```

The build script compiles a native launcher, bundles the architecture-matched Node runtime and production Relay dependencies, derives `AppIcon.icns` from the canonical `apps/mobile/assets/images/icon.png`, signs the bundle, and creates a DMG.

The icon preparation step preserves the original artwork. It only removes a near-black background when that matte is connected to the image edge; existing transparent pixels are preserved and normalized so image conversion cannot introduce a black matte.

When Developer ID and notarization credentials are absent, the script creates an ad-hoc signed DMG for local testing. Release CI can use the following secrets for a signed/notarized build:

- `MACOS_CERTIFICATE_P12_BASE64`
- `MACOS_CERTIFICATE_PASSWORD`
- `MACOS_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_TEAM_ID`
- `APPLE_APP_PASSWORD`
