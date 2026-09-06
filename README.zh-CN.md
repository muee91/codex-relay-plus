# Codex Relay

<p align="center">
  <img src="./docs/readme-assets/icon.png" alt="Codex Relay 应用图标" width="96" />
</p>

<p align="center">
  <strong>让 Codex 运行在你的电脑上，用手机在局域网或远程控制。</strong>
</p>

<p align="center">
  <a href="./README.md">English</a> | 简体中文
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/codex-relay"><img alt="npm" src="https://img.shields.io/npm/v/codex-relay?style=flat-square"></a>
  <img alt="Node.js" src="https://img.shields.io/badge/node-%3E%3D22.14-111111?style=flat-square">
  <img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-111111?style=flat-square">
  <img alt="Local first" src="https://img.shields.io/badge/local--first-yes-111111?style=flat-square">
</p>

> [!IMPORTANT]
> **当前版本尚未上架任何应用市场，包括 Apple App Store 和 Google Play。**
> 本仓库中的当前代码、构建产物和文档是项目状态的准确信息来源。

## 项目介绍

Codex Relay 是 Codex CLI 的本地优先远程伴侣。Relay 运行在你的工作区中，让你可以通过手机查看 Codex 的实时输出、发送提示词、继续会话、处理审批和输入请求，并查看工作区状态；代码、Shell、Git 状态和 Codex 会话本身仍保留在你的电脑上。

独立运行的 Relay 使用电脑已有的网络路径。macOS 上的 Codex Relay Plus 额外提供桌面 Host，并内置 Tailcat，用于加密远程连接；不需要账号、tailnet、公网 IP 或路由器端口转发。在 **Auto** 模式下，移动端会优先使用已验证的局域网路径，在需要时回退到 Tailcat。

Codex Relay 是独立项目，与 OpenAI 或 OpenAI Codex 团队不存在隶属、背书或赞助关系。

<p align="center">
  <img src="./docs/readme-assets/demo.gif" alt="Codex Relay 移动端演示" width="60%" />
</p>

<p align="center">
  <img src="./docs/readme-assets/chat.png" alt="Codex Relay 聊天界面" width="23%" />
  <img src="./docs/readme-assets/workspace-preview.png" alt="Codex Relay 工作区预览界面" width="23%" />
  <img src="./docs/readme-assets/web-preview.png" alt="Codex Relay Web 预览界面" width="23%" />
  <img src="./docs/readme-assets/settings.png" alt="Codex Relay 设置界面" width="23%" />
</p>

## 功能

- 将本地工作区中的 Codex 输出流式同步到已配对的移动端。
- 发送提示词、继续会话，并在 Codex 需要输入时进行响应。
- 查看活动会话、排队输入、审批请求和工作区状态。
- 在移动端预览 Git 变更、本地 Web 输出、文件和终端界面。
- 分别配置“任务完成”和“需要操作”两类推送通知。
- 配对信息和会话数据由本地 Relay 状态管理。
- Codex Relay Plus 桌面版本内置 Tailcat 数据平面，无需账号或 tailnet 即可实现加密远程连接。

## 快速开始

### 环境要求

- Node.js 22.14 或更高版本
- 已安装并登录 Codex CLI
- 兼容的 Codex Relay 移动端构建；本项目当前未通过任何应用市场分发
- 手机到电脑之间存在可用网络路径，或者使用内置 Tailcat 传输的 Codex Relay Plus 桌面 Host

### 1. 启动 Relay

进入你希望 Codex 工作的目录：

```sh
npx codex-relay@latest
```

Relay 会输出二维码、移动端 URL 和一个 `codex-relay://pair...` 配对链接。

独立 npm Relay 使用电脑当前已有的网络连接。Codex Relay Plus 的 macOS 桌面 Host 会额外内置并启动 Tailcat，以提供远程连接能力。

### 2. 配对移动端

打开移动端应用并扫描 Relay 输出的二维码。如果无法扫码，也可以将完整的 `codex-relay://pair...` 链接粘贴到应用中。

移动端显示审批码后，在电脑上执行：

```sh
npx codex-relay@latest approve XXXX-XXXX
```

完成后，手机即可连接本地 Codex 会话。

使用 Codex Relay Plus 桌面 Host 时，配对二维码还会携带 Tailcat bootstrap 地址。原生 iOS 和 Android 构建可以通过 Tailcat 完成首次远程配对，并在局域网路径经过验证且可用时自动优先使用 LAN。

### 3. 可选：与终端共享实时会话

默认 Relay 使用自己的 Codex app-server 进程。如果希望移动端和终端 TUI 共用同一个 app-server，可使用：

```sh
npx codex-relay@latest --shared-app-server
```

如果已经存在共享 app-server，Relay 会连接到该进程，而不是新启一个。Relay 自己的 socket 连接重置时，也会尝试重连，而不会主动停止共享 app-server。

然后连接新的终端 TUI。在 macOS、Linux 或 WSL 上：

```sh
codex resume --remote unix://
```

在原生 Windows 上：

```powershell
codex resume --remote ws://127.0.0.1:8788
```

已经运行中的独立 TUI 无法原地切换为共享模式，需要先退出，再通过 `--remote` 重新连接。共享模式要求较新的 Codex CLI，并支持 app-server 和 remote-resume。在 macOS、Linux 和 WSL 上使用 Unix socket，在 Windows 上使用仅监听 loopback 的 WebSocket。

共享模式基于 Codex 的实验性 app-server 传输。直接连接的终端 TUI 拥有独立 WebSocket 连接，Relay 无法观察或替它重连。如果终端报告 socket reset，但移动端中的会话仍在继续，请使用上面对应的远程端点重新连接；必要时附加 thread ID。

### 推送通知

配对后，在移动端打开 **设置 > 通知**，可以单独启用以下两类提醒：

- **任务完成**：Codex turn 完成或失败
- **需要操作**：出现审批或输入请求

Relay 通过推送服务发送的只有通用提醒，以及用于打开对应会话的不透明 thread / turn 标识符。它不会通过推送服务发送提示词、回复内容、命令或审批文本。推送功能要求原生移动端构建包含 `expo-notifications`；仅靠 OTA 更新无法新增该原生模块。

## 本地构建与产物

最终交付文件位于仓库根目录的 `artifacts/`：

```text
artifacts/
├── macos/    # .app、.dmg 和 DMG SHA-256 文件
└── android/  # release .apk 和 SHA-256 文件
```

同时构建两个目标：

```sh
pnpm build:artifacts
```

macOS 构建过程使用临时目录，并在发布产物后清理。Expo/Gradle 以及 Tailcat AAR 会保留在各自生成的原生目录中；这些路径属于实现缓存，不是最终交付位置。

可以设置 `ARTIFACTS_DIR` 修改统一产物根目录，或通过 `ARTIFACT_DIR` / `OUTPUT_DIR` 覆盖特定平台的产物目录。

## 网络设置

### Codex Relay Plus 桌面 Host

macOS 桌面 Host 会与 Relay 一起自动启动 Tailcat。不需要账号、登录、tailnet、公网 IP，也不需要路由器端口转发。

Host 面板会直接显示 Tailcat 状态，包括：

- 是否就绪；
- 当前 `tc…` Tailcat 地址；
- Tailcat 承载的 Relay 端口；
- LAN、Relay 和 Codex 诊断信息。

Host 会在 Application Support 中保存持久化 Tailcat 服务端身份，移动端也会保存持久化客户端身份。在 **Auto** 模式下，移动端会优先使用已验证的 LAN 路径；离开该局域网后则回退到 Tailcat。NAT 穿透成功时，Tailcat 可以建立端到端直连；否则使用 DERP 作为回退传输。

如果 Tailcat 尚在启动或不可用，Host 面板会明确显示对应状态，LAN 访问仍然可以继续使用。

### 独立 npm Relay

`npx codex-relay@latest` 不会安装系统级网络 overlay。手机必须能够通过 LAN，或你自行提供的其他网络路径，访问 Relay 输出的地址。

### Web 预览

Codex Relay Plus 中的 Tailcat 承载经过认证的 Relay 连接。应用**不会**通过 Tailcat 暴露 Mac 上的所有 TCP 端口，因为这会让 Relay 授权边界之外的其他 localhost 服务也暴露出去。

因此，Web Preview URL 本身仍需要能被手机直接访问，例如处于同一 LAN，或者使用你明确提供的安全 URL。移动端已经不再提供自动 Tailscale Serve 操作。

## 参与贡献

GitHub issue、Pull Request 和面向维护者的讨论默认请使用英文。如果英文表达有困难，可以先提供一段简短英文摘要，再使用你更熟悉的语言补充其余内容。

提交连接问题前，请先确认 issue 模板中的网络检查项。大多数配对失败都来自两类情况：手机无法访问电脑输出的 Relay URL，或者桌面 Tailcat 传输尚未就绪。

涉及已发布 `codex-relay` npm 包的变更应包含 changeset：

```sh
pnpm changeset
```

请将生成的文件和代码变更一起提交。Release workflow 会维护 release PR，并在该 PR 合并后完成发布。具体流程参见 [Changesets 指南](./.changeset/README.md)。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npx codex-relay@latest` | 启动 Relay 并输出配对二维码。 |
| `npx codex-relay@latest --bg` | 让 Relay 在后台持续运行。 |
| `npx codex-relay@latest --shared-app-server` | 与已连接的终端 TUI 共享实时会话。 |
| `npx codex-relay@latest qr` | 为当前运行中的 Relay 输出配对二维码。 |
| `npx codex-relay@latest approve XXXX-XXXX` | 批准待处理的移动端配对请求。 |
| `npx codex-relay@latest clear` | 注销所有已配对的移动端。 |

## 配置

Relay 默认监听 `0.0.0.0:8787`。

| 变量 | 用途 |
| --- | --- |
| `PORT` | 服务端口，默认 `8787`。 |
| `HOST` | 监听地址，默认 `0.0.0.0`。 |
| `CODEX_RELAY_WORKSPACE_PATH` | Codex 使用的工作区路径，默认当前目录。 |
| `CODEX_RELAY_AUTH_DB_PATH` | 配对和会话数据库路径。 |
| `CODEX_RELAY_APP_SERVER_MODE` | `socket` 表示共享终端/移动端会话；默认 `stdio`。 |
| `CODEX_BIN` | Codex CLI 可执行文件路径。 |
| `CODEX_HOME` | 用于读取本地会话元数据的 Codex home 目录。 |

桌面 Host 还会向 Relay runtime 注入内置 Tailcat 状态路径和 Relay 端口。这些属于 Host 内部传输变量，而不是用户需要配置的字段。

后台模式会在当前工作区的 `.codex-relay/` 下写入运行时文件，包括服务日志、进程状态和配对数据。

## 故障排查

如果 `qr` 找不到服务，请先启动 Relay：

```sh
npx codex-relay@latest
```

如果本地配对数据库已被其他进程占用，请使用当前已经运行的服务：

```sh
npx codex-relay@latest qr
```

对于桌面 Host，请打开 **Host panel > Advanced & diagnostics** 并检查 Tailcat 行。就绪状态会显示 `tc…` 地址和端口；警告状态表示远程传输仍在启动或当前不可用，此时 LAN 仍可继续使用。

连接检查项：

- Host 面板中的 **Tailcat** 是否已经显示为可用于远程访问？
- 如果使用 LAN，手机和电脑是否处于同一个 Wi-Fi 或局域网？
- 电脑防火墙是否允许 Relay 端口（通常是 `8787`）的 LAN 入站连接？
- 移动端是否为包含 Tailcat bridge 的原生 iOS / Android 构建？
- 对于 Web Preview，该预览 URL 本身是否可以被手机访问？

## 许可证

Codex Relay 使用 Apache License 2.0。参见 [LICENSE](./LICENSE)。

Codex Relay 名称、Logo、应用图标、截图及其他品牌资产不包含在 Apache-2.0 许可范围内。参见 [TRADEMARKS.md](./TRADEMARKS.md)。
