# Codex Relay Plus

Codex Relay Plus 是一个 **mobile-first 的 Codex 远程工作界面**。

核心原则只有一条：

> **真正的日常产品在手机上；Mac 只负责让 Relay 和 Codex 稳定运行。**

代码、Git 状态、终端和 Codex runtime 仍留在电脑上，手机通过已配对的 Relay 继续会话、查看执行状态、处理审批和输入请求。

## 产品结构

### Android / Mobile：主产品

移动端承担日常使用：

- 查看、搜索、切换和继续 Codex 会话
- 新建任务、发送 prompt、追加输入和中断运行
- 处理 command / file change / permission / structured input 等 Codex 请求
- 选择 Codex 实际支持的模型、reasoning effort、runtime / permission 模式
- 查看运行状态、上下文使用量、rate limit、计划和 subagent 活动
- 添加图片、文件/技能引用
- 查看 workspace 文件、Git 变化、Web preview 和 terminal 等远程工作表面
- 在网络变化后继续恢复同一台已配对 Mac 的连接
- 接收 turn complete / action required 通知

移动端功能是否保留或调整，以 **当前 Codex app-server/CLI 的真实能力和 Relay 的实际映射**为依据，不因为界面看起来复杂就删除真实能力。

### macOS：后台 Host

macOS App 不是第二个 Codex 客户端，也不是日常控制台。

它只负责：

- 启动并保持 Relay / Codex runtime 运行
- 菜单栏显示 Relay 状态
- 添加手机和显示配对二维码
- 管理已配对设备和待批准设备
- 提供默认工作目录
- 重启 Relay
- 打开日志和基础诊断

应用启动后默认进入**菜单栏后台运行**，不会自动弹出主窗口，也不会抢占焦点。只有需要添加手机、检查状态或排障时才打开 Host 面板；关闭窗口不会停止 Relay。

## 正常使用流程

1. 在 Mac 安装并启动 **Codex Relay Plus**。
2. Relay 自动在后台启动，菜单栏显示运行状态。
3. 第一次使用时，从菜单栏选择“添加手机…”。
4. 手机扫描二维码，在 Mac 上批准该设备。
5. 关闭 Mac 窗口。
6. 之后主要在手机端使用 Codex；Mac 端保持后台运行即可。

正常使用不要求用户理解端口、DERP、Tailcat、Tailscale candidate 或其他传输实现细节。移动端负责在可用路径之间恢复连接；这些技术信息只属于诊断层。

## 网络与安全

- Control Center 只监听本机 `127.0.0.1`。
- 手机 API 使用配对 token 和现有 secure session 加密机制。
- LAN 可用时优先本地网络；跨网络时 Relay 可使用已配置的安全远程路径。
- 网络从 LAN → 远程 → LAN 切换时，目标是保持同一移动端会话连续，而不是要求用户重新配对。
- Sign out / unpair 必须同时清理移动端凭据和原生 transport 状态。

实现细节可以在诊断和开发文档中存在，但不应该成为正常移动 UI 的核心概念。

## 目录职责

```text
apps/mobile/          主产品：Expo / React Native 移动客户端
apps/desktop-macos/   Mac Host：AppKit 菜单栏壳和本地 Relay 启动器
packages/codex-relay/ Relay、配对、安全传输、Codex app-server 映射
```

新的产品功能默认优先进入移动端。只有以下类型的能力应该进入 macOS：

- Relay 生命周期
- 配对和设备管理
- 默认 workspace
- 日志和诊断

Codex 会话浏览、任务控制、模型/runtime 操作等日常能力不应在 Mac 再实现一套重复 UI。

## Android 构建

Android 包名为：

```text
com.muee91.codexrelayplus
```

本地构建环境需要 Node.js 22.14+、pnpm 11、Android SDK/JDK：

```bash
pnpm install --frozen-lockfile
pnpm --filter @codex-relay/mobile typecheck
pnpm --filter @codex-relay/mobile android
```

仓库保留 Android release artifact workflow，但不应因为普通源码改动频繁手动触发重型构建。

## macOS 构建

要求 macOS 13+、Xcode Command Line Tools、Node.js 22.14+ 和 pnpm 11：

```bash
pnpm install --frozen-lockfile
APP_VERSION=1.0.0 BUILD_NUMBER=1 ./apps/desktop-macos/build.sh
```

构建产物会包含匹配架构的 Node runtime 和 Relay，不要求普通用户另外启动终端命令。

## OTA

本项目当前**不使用 OTA / HotUpdater 作为发布路径**。

移动端更新通过正常安装包发布；仓库中的 OTA workflow、运行时检查和相关配置不应重新引入，除非产品方向明确重新决定支持自更新。

## 发布前必须验证

软件静态检查不能替代以下实机链路：

```text
Mac + Android 同一 Wi‑Fi
→ LAN 连接
→ 手机切到蜂窝/其他网络
→ 自动恢复远程连接
→ 手机回到 Wi‑Fi
→ 自动恢复 LAN
→ sign out / unpair
→ App 重启后旧 native proxy 不得恢复
```

Mac 侧同时需要确认：

- 启动后不自动弹主窗口
- Relay 在菜单栏后台正常运行
- 添加手机/二维码可用
- Relay 重启和日志入口可用
- 关闭 Host 面板后 Relay 继续运行

## 开发原则

- `main` 是实际工作分支。
- 优先完成一个功能闭环，再进入下一个功能。
- 不为“以后可能会用”新增 wrapper、第二套 API 或重复页面。
- 移动端能力以当前 Codex 实际能力为依据。
- Mac 端判断标准：**这个功能是否能让用户更少碰 Mac？** 如果不能，通常不应进入桌面 UI。
- 非必要不运行重型 CI；先使用源码检查、typecheck 和针对性测试。

## 上游

本仓库是 Codex Relay 的增强 fork。同步上游时优先保持 Relay 核心结构可合并，移动端产品层和 Mac Host 壳尽量保持边界明确，避免为了本 fork 的 UI 需求大面积改写上游协议层。
