# Codex Relay Plus

Codex Relay Plus 是基于 Codex Relay 的增强 fork，重点补齐两类日常入口：

- **macOS 原生桌面端**：直接启动本机 Relay、选择工作区、显示配对二维码、批准/拒绝手机、管理已配对设备和环境诊断，不需要先打开终端执行启动命令。
- **Android 简体中文 APK**：面向桌面端优先的配对流程，保留原有聊天、工作区、模型、图片附件和会话能力，并提供独立 Android 包名，避免与原版客户端安装冲突。

> 当前 npm 包名仍沿用上游 `codex-relay`。本 fork 尚未以独立 npm 包名发布；桌面正式版会把 Node.js、Relay 以及 Relay 依赖的 `@openai/codex` runtime 一并打进应用包，因此普通 Mac 用户不需要单独安装或运行 Relay/Codex CLI。已有 Codex 登录状态仍沿用用户本机的 Codex 配置。

## macOS 桌面端

桌面代码位于 `apps/desktop-macos`，使用原生 AppKit + WKWebView。应用启动后会：

1. 首次运行弹出原生文件夹选择器，让你选择 Codex 工作区；之后自动记住最近的工作区。
2. 从应用包内启动 Node.js + Codex Relay，自动选择可用的 Relay/Control Center 端口。
3. 在桌面窗口中打开只监听 `127.0.0.1` 的 Control Center。
4. 直接在 GUI 中查看二维码、批准或拒绝手机、断开设备、复制连接地址、查看环境诊断。
5. 退出桌面应用时先向 Relay 发送优雅终止信号，最多等待 2 秒，再对异常残留进程兜底强制结束。

“文件”菜单提供：切换工作区、重启 Relay、重新载入控制中心和打开 Relay 日志。日志写入 `~/Library/Logs/Codex Relay Plus/relay.log`，达到 5 MiB 后轮转一份 `relay.log.1`。

### 原版图标处理

`apps/mobile/assets/images/icon.png` 是唯一图标母版。桌面构建不会重新设计 logo，也不会改变原图的形状、比例或颜色：

- 如果原 PNG 已经有透明背景，母版按字节保留；
- 如果四角不是已知的近黑色 matte，同样按字节保留；
- 只有检测到**从图片边缘连通的近黑色背景**时，才会透明化该背景；
- 内部不与边缘连通的黑色细节不会被删除。

随后由该母版生成标准 macOS `.icns` 尺寸链，避免 Finder、Dock 或 DMG 中出现转换造成的黑色方底。

### 构建 DMG

在 macOS 13+、Xcode Command Line Tools、Node.js 22.14+ 和 pnpm 11 环境中：

```bash
pnpm install --frozen-lockfile
APP_VERSION=1.0.0 BUILD_NUMBER=1 ./apps/desktop-macos/build.sh
```

构建脚本会校验嵌入 Node 的 CPU 架构、实际执行随包 Relay 的 `--help` 烟雾测试、显式签名所有 Mach-O 载荷，并对最终 `.app` 做 `codesign --deep --strict` 校验。

GitHub Actions 的 **macOS Desktop** 工作流同时构建：

- Apple Silicon：`arm64`
- Intel：`x86_64`

没有 Developer ID 凭据时可生成 ad-hoc 签名 DMG 用于本机测试。要生成可正常 Gatekeeper 分发并完成 Apple notarization/stapling 的版本，请配置：

- `MACOS_CERTIFICATE_P12_BASE64`
- `MACOS_CERTIFICATE_PASSWORD`
- `MACOS_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_TEAM_ID`
- `APPLE_APP_PASSWORD`

## Android 简体中文 APK

中文 APK 使用现有 Expo/React Native 客户端源码，不复制业务逻辑。构建时通过 `CODEX_RELAY_LOCALE=zh-CN` 启用中文资源转换，因此默认上游/iOS 构建路径不被强制改成中文。

中文版重点覆盖实际使用路径：

- Mac 桌面端优先的首次配对引导
- QR 扫描、相机权限、配对确认和错误提示
- 会话抽屉、搜索、新建聊天、置顶/重命名
- 设置、服务器切换、通知、退出配对
- 图片附件、聊天回退和常见连接错误

Android 包名为 `com.muee91.codexrelayplus`，与原版 `com.gronstudio.codexrelay` 分离。GitHub 构建时使用 `github.run_number` 作为递增 `versionCode`，便于后续覆盖升级。

### 构建与签名

GitHub Actions 的 **Android APK (zh-CN)** 工作流会：

1. 校验中文转换表；
2. 对 mobile workspace 执行 TypeScript typecheck；
3. 使用 Expo `prebuild --platform android --clean` 生成原生 Android 工程；
4. 构建 `:app:assembleRelease`；
5. 对 APK 执行 `zipalign` 和 `apksigner`；
6. 验证 APK 内确实包含中文配对界面标记；
7. 校验独立包名并生成 SHA-256 文件。

如配置以下四个 Secrets，流水线会使用你的正式 keystore 重新签名：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

如果没有配置正式 keystore，流水线会生成**可直接侧载安装**的 fallback 签名 APK，适合自用和功能验收；它不应作为 Google Play 的最终签名密钥。以后准备上架时应固定使用自己的 release keystore，否则不同签名之间不能直接覆盖升级。

## 配对方式

正式桌面使用路径不要求命令行：

1. 在 Mac 打开 **Codex Relay Plus**；
2. 选择要使用的工作区；
3. 在 Android 中文客户端点“扫码”；
4. 扫描桌面端二维码；
5. 在 Mac 桌面端“待确认设备”中允许该手机。

同一 Wi‑Fi 最简单；跨网络使用时可让 Mac 和手机加入同一 Tailscale 网络。

CLI 仍保留用于开发、自动化和故障排查，例如 `npx codex-relay@latest`、`approve`、`qr`、`clear`、`stop`，但它不再是 Mac 正式桌面用户的必经入口。

## 安全设计

- Control Center 只监听 `127.0.0.1`；
- API 需要每进程随机 Control Token；
- 校验 Host Header，降低 DNS rebinding 风险；
- 设置 CSP、`X-Frame-Options: DENY`、`nosniff`、`no-store`；
- 手机仍使用现有加密配对/session 机制；
- 单设备断开时同时清理对应 push subscription；
- 桌面只终止自己启动的 Relay 实例。

## 开发与回归检查

核心 workspace：

```bash
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm lint
pnpm --filter codex-relay test
node apps/mobile/scripts/verify-zh-cn.cjs
```

macOS 原生壳必须在 macOS runner 上完成真实编译、签名和 DMG 验证；Android APK 必须在 Android SDK/JDK 环境中完成 Gradle 构建和签名验证。仓库为这两类产物分别提供独立手动工作流，避免普通源码提交无条件消耗双架构 Mac 和 Android 构建额度。

## 上游同步

这是 fork，建议持续保留上游远端并定期同步，而不是大范围改写上游包结构。桌面壳、中文 APK 构建和本机 Control Center 尽量以独立层实现，降低后续吸收上游更新时的冲突成本。
