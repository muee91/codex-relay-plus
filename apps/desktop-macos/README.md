# Codex Relay Plus for macOS

The macOS app is a **background host for the mobile product**, not a second Codex client.

Its responsibilities are intentionally narrow:

- launch and keep the bundled Relay / Codex runtime running;
- launch the bundled Tailcat transport for encrypted remote access;
- expose Relay and Tailcat health from the menu bar and local Host panel;
- open the local Host panel when a phone needs to be paired or a device managed;
- restart Relay and open logs for maintenance;
- provide the default workspace used by the Relay runtime.

The app starts as a menu-bar accessory. It does **not** open the Host panel or take focus on normal launch. Closing the Host panel keeps Relay and Tailcat running.

Session browsing, task control, model/runtime controls, approvals, and other daily Codex workflows belong to `apps/mobile`.

## Tailcat remote access

Tailcat is bundled with the macOS host and starts automatically. It does not require a Tailscale account, tailnet, login, public IP address, or router port forwarding.

The Host panel reports:

- whether the Tailcat transport is ready;
- the current `tc…` Tailcat address;
- the Relay port carried by Tailcat;
- LAN and Relay diagnostics.

There is intentionally no account/setup form for Tailcat. The host maintains a persistent Tailcat server key in its Application Support directory so the remote address remains stable across normal restarts. The mobile app stores its own Tailcat client key and uses LAN when verified and available, falling back to Tailcat for remote connectivity.

If Tailcat is still starting or cannot become ready, Relay remains available on the LAN and the Host panel reports the degraded remote state instead of hiding it.

## Build

Requirements: macOS 13+, Xcode Command Line Tools, Node.js 22.14+, pnpm 11, and Go 1.27+.

```bash
pnpm install --frozen-lockfile
APP_VERSION=1.0.0 BUILD_NUMBER=1 ./apps/desktop-macos/build.sh
```

The build script compiles the native AppKit launcher and Tailcat helper, bundles the architecture-matched Node runtime and production Relay dependencies, derives `AppIcon.icns` from the canonical mobile icon, signs the bundle, and creates a DMG. Final files are published to `artifacts/macos/`; the default intermediate workspace is temporary and is removed after the build. Set `ARTIFACTS_DIR` or `ARTIFACT_DIR` to override the delivery location. `OUTPUT_DIR` remains available for overriding and retaining an internal build workspace.

When Developer ID and notarization credentials are absent, the script creates an ad-hoc signed DMG for local testing. Release CI can use:

- `MACOS_CERTIFICATE_P12_BASE64`
- `MACOS_CERTIFICATE_PASSWORD`
- `MACOS_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_TEAM_ID`
- `APPLE_APP_PASSWORD`
