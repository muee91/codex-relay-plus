# Codex Relay

<p align="center">
  <img src="./docs/readme-assets/icon.png" alt="Codex Relay app icon" width="96" />
</p>

<p align="center">
  <strong>让 Codex 运行在你的电脑上，用手机在局域网或远程控制。<br />Run Codex on your computer. Control it from your phone — on LAN or remotely.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/codex-relay"><img alt="npm" src="https://img.shields.io/npm/v/codex-relay?style=flat-square"></a>
  <img alt="Node.js" src="https://img.shields.io/badge/node-%3E%3D22.14-111111?style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-111111?style=flat-square">
  <img alt="Local first" src="https://img.shields.io/badge/local--first-yes-111111?style=flat-square">
</p>

> [!IMPORTANT]
> **当前版本尚未上架任何应用市场，包括 Apple App Store 和 Google Play。**
> 本仓库中的项目状态、构建产物和说明以 GitHub 当前版本为准。
>
> **This version is not currently published in any app marketplace, including the Apple App Store or Google Play.**
> Treat the current GitHub repository, its build artifacts, and its documentation as the source of truth.

## 项目介绍 / Project Introduction

### 中文

Codex Relay 是 Codex CLI 的本地优先远程伴侣。Relay 运行在你的工作区中，让你可以通过手机查看 Codex 的实时输出、发送提示词、继续会话、处理审批和输入请求，并查看工作区状态；代码、Shell、Git 状态和 Codex 会话本身仍保留在你的电脑上。

独立运行的 Relay 使用电脑已有的网络路径。macOS 上的 Codex Relay Plus 额外提供桌面 Host，并内置 Tailcat，用于加密远程连接；不需要账号、tailnet、公网 IP 或路由器端口转发。在 **Auto** 模式下，移动端会优先使用已验证的局域网路径，在需要时回退到 Tailcat。

Codex Relay 是独立项目，与 OpenAI 或 OpenAI Codex 团队不存在隶属、背书或赞助关系。

### English

Codex Relay is a local-first remote companion for the Codex CLI. It runs a
relay inside your workspace so you can follow live output, send prompts,
continue threads, handle approvals and input requests, and inspect workspace
state from your phone while your code, shell, git state, and Codex session stay
on the computer.

The standalone relay uses whatever network path your computer already has.
Codex Relay Plus on macOS adds a desktop host with bundled Tailcat for encrypted
remote connectivity — no account, tailnet, public IP, or router port forwarding.
In **Auto** mode, the mobile app prefers a verified LAN route and falls back to
Tailcat when needed.

Codex Relay is an independent project. It is not affiliated with, endorsed by,
or sponsored by OpenAI or the OpenAI Codex team.

<p align="center">
  <img src="./docs/readme-assets/demo.gif" alt="Codex Relay mobile demo" width="60%" />
</p>

<p align="center">
  <img src="./docs/readme-assets/chat.png" alt="Codex Relay chat screen" width="23%" />
  <img src="./docs/readme-assets/workspace-preview.png" alt="Codex Relay workspace preview screen" width="23%" />
  <img src="./docs/readme-assets/web-preview.png" alt="Codex Relay web preview screen" width="23%" />
  <img src="./docs/readme-assets/settings.png" alt="Codex Relay settings screen" width="23%" />
</p>

## What It Does

- Stream Codex output from a local workspace to a paired mobile app.
- Send prompts, continue threads, and respond when Codex needs input.
- Review active threads, queued inputs, approvals, and workspace state.
- Preview git changes, local web output, files, and terminal surfaces from
  mobile.
- Choose separate turn-complete and action-required push notifications.
- Keep pairing and session data under your local relay state.
- Use the bundled Tailcat data plane in Codex Relay Plus desktop builds for
  encrypted remote connectivity without an account or tailnet.

## Quick Start

### Requirements

- Node.js 22.14 or newer
- Codex CLI installed and signed in
- A compatible Codex Relay mobile build. This project is not currently distributed through any app marketplace.
- A network path from your phone to your computer, or the Codex Relay Plus
  desktop host with its built-in Tailcat transport

### 1. Start the relay

From the workspace where you want Codex to work:

```sh
npx codex-relay@latest
```

The relay prints a QR code, a mobile URL, and a `codex-relay://pair...` pairing
link.

The standalone npm relay uses the network already available on the computer.
The Codex Relay Plus macOS desktop host additionally bundles and starts Tailcat
for remote connectivity.

### 2. Pair the app

Open the mobile app and scan the QR code printed by the relay. If scanning is
not available, paste the full `codex-relay://pair...` link into the app.

When the app shows an approval code, approve it from your computer:

```sh
npx codex-relay@latest approve XXXX-XXXX
```

Your phone can now talk to your local Codex session.

With the Codex Relay Plus desktop host, the pairing QR also carries the Tailcat
bootstrap address. Native iOS and Android builds can establish the first remote
pairing through Tailcat and then automatically prefer a verified LAN path when
one is available.

### 3. Optional: share a live session with your terminal

The default relay uses its own Codex app-server process. To make mobile and a terminal TUI use the same shared app-server, start the relay with:

```sh
npx codex-relay@latest --shared-app-server
```

When a shared app-server is already running, the relay attaches to it instead of starting another one. If the relay's own socket connection resets, it reconnects without deliberately stopping the shared app-server.

Then attach a new terminal TUI. On macOS, Linux, or WSL:

```sh
codex resume --remote unix://
```

On native Windows:

```powershell
codex resume --remote ws://127.0.0.1:8788
```

An already-running standalone TUI cannot be converted in place. Exit it and reconnect with `--remote`. Shared mode requires a recent Codex CLI with app-server and remote-resume support. It uses a Unix socket on macOS, Linux, and WSL, or a loopback-only WebSocket on Windows.

Shared mode uses Codex's experimental app-server transport. A directly connected terminal TUI has its own WebSocket connection, which the relay cannot observe or reconnect. If that terminal reports a socket reset while the thread continues on mobile, reconnect it with the matching remote endpoint above and append the thread ID if needed.

### Push notifications

After pairing, open **Settings > Notifications** in the mobile app and enable either or both alerts:

- **Turn complete** for completed or failed Codex turns
- **Action required** for approval and input requests

The relay sends only a generic alert plus opaque thread and turn identifiers needed to open the conversation. It does not send prompts, responses, commands, or approval text through the push service. Push support requires a native mobile build that includes `expo-notifications`; an OTA update alone cannot add that native module.

## Local Builds and Artifacts

Final delivery files are kept under the repository root in `artifacts/`:

```text
artifacts/
├── macos/    # .app, .dmg, and the DMG SHA-256 file
└── android/  # release .apk and its SHA-256 file
```

Build both targets with:

```sh
pnpm build:artifacts
```

The macOS build uses a temporary directory and removes it after publishing,
while Expo/Gradle and the Tailcat AAR remain in their generated native
directories. Those paths are implementation caches, not delivery locations.
Set `ARTIFACTS_DIR` to use another root, or `ARTIFACT_DIR`/`OUTPUT_DIR` for a
platform-specific override.

## Network Setup

### Codex Relay Plus desktop host

The macOS desktop host starts Tailcat automatically alongside Relay. There is no
account, login, tailnet, public-IP, or router-port-forwarding setup.

The Host panel reports the Tailcat state directly:

- readiness;
- the current `tc…` Tailcat address;
- the Relay port carried by Tailcat;
- LAN, Relay, and Codex diagnostics.

The host keeps a persistent Tailcat server identity in Application Support, and
the mobile app keeps a persistent client identity. In **Auto** mode, the mobile
app uses a verified LAN route when available and falls back to Tailcat when the
phone leaves that LAN. Tailcat can establish a direct peer-to-peer path when NAT
traversal succeeds and uses DERP as its fallback transport.

If Tailcat is still starting or unavailable, the Host panel reports that state
explicitly and LAN access remains usable.

### Standalone npm relay

`npx codex-relay@latest` does not install a system-wide network overlay. The
phone must be able to reach the printed Relay URL through the LAN or another
network path you provide.

### Web previews

Tailcat in Codex Relay Plus carries the authenticated Relay connection. The app
does **not** expose every TCP port on the Mac through Tailcat, because doing so
would also expose unrelated localhost services outside Relay's authorization
boundary.

A Web Preview URL therefore still needs to be reachable by the phone itself,
for example on the same LAN or through a secure URL you explicitly provide. The
mobile app no longer offers an automatic Tailscale Serve action.

## Contributing

Please use English as the default language for GitHub issues, pull requests,
and maintainer-facing discussions. If English is difficult, start with a short
English summary and then include the rest in the language you are most
comfortable using.

Before opening a connection issue, confirm the network checklist in the issue
template. Most pairing failures happen because the phone cannot reach the relay
URL printed by the computer or because the desktop Tailcat transport is not yet
ready.

Changes to the published `codex-relay` package should include a changeset:

```sh
pnpm changeset
```

Commit the generated file with the change. The release workflow maintains a
release pull request and publishes it after that pull request is merged. See
[the Changesets guide](./.changeset/README.md) for the release process.

## Common Commands

| Command                                      | What it does                                        |
| -------------------------------------------- | --------------------------------------------------- |
| `npx codex-relay@latest`                     | Start the relay and print a pairing QR.             |
| `npx codex-relay@latest --bg`                | Keep the relay running in the background.           |
| `npx codex-relay@latest --shared-app-server` | Share live sessions with an attached terminal TUI.  |
| `npx codex-relay@latest qr`                  | Print the current pairing QR for an existing relay. |
| `npx codex-relay@latest approve XXXX-XXXX`   | Approve a pending mobile pairing request.           |
| `npx codex-relay@latest clear`               | Sign out every paired mobile app.                   |

## Configuration

The relay listens on `0.0.0.0:8787` by default.

| Variable                      | Purpose                                                             |
| ----------------------------- | ------------------------------------------------------------------- |
| `PORT`                        | Server port. Defaults to `8787`.                                    |
| `HOST`                        | Listen host. Defaults to `0.0.0.0`.                                 |
| `CODEX_RELAY_WORKSPACE_PATH`  | Workspace path Codex should use. Defaults to the current directory. |
| `CODEX_RELAY_AUTH_DB_PATH`    | Pairing and session database path.                                  |
| `CODEX_RELAY_APP_SERVER_MODE` | `socket` for shared terminal/mobile sessions; defaults to `stdio`.  |
| `CODEX_BIN`                   | Codex CLI executable path.                                          |
| `CODEX_HOME`                  | Codex home directory for reading local session metadata.            |

The desktop host additionally injects its bundled Tailcat status path and Relay
port into the Relay runtime. These are host-internal transport variables rather
than user setup fields.

Background mode writes runtime files under `.codex-relay/` in the current
workspace, including server logs, process state, and pairing data.

## Troubleshooting

If `qr` cannot find a server, start one first:

```sh
npx codex-relay@latest
```

If another process is using the local pairing database, use the existing server:

```sh
npx codex-relay@latest qr
```

For the desktop host, open **Host panel > Advanced & diagnostics** and check the
Tailcat row. A ready transport shows the `tc…` address and port. A warning means
remote transport is still starting or unavailable; LAN remains usable.

Connection checklist:

- Does the Host panel show **Tailcat** as ready for remote access?
- If using LAN, are the phone and computer on the same Wi-Fi or local network?
- Does the computer firewall allow inbound LAN traffic on the Relay port,
  usually `8787`?
- Is the mobile app a native iOS/Android build that contains the Tailcat bridge?
- For Web Preview, is that preview URL itself reachable from the phone?

## License

Codex Relay is licensed under the Apache License 2.0. See [LICENSE](./LICENSE).

The Codex Relay name, logos, app icons, screenshots, and other brand assets are
not licensed under Apache-2.0. See [TRADEMARKS.md](./TRADEMARKS.md).
