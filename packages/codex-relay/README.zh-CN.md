# Codex Relay Plus（简体中文）

这是 `gronxb/codex-relay` 的增强 fork，目标是在保留 local-first 安全模型的前提下，把启动、配对和诊断做得更接近普通桌面软件。

> 当前 fork 仍沿用上游 workspace/package 名称，尚未单独发布 npm 包。下面的开发命令用于本仓库源码；正式分发前应再确定独立包名与品牌资源。

## 桌面控制中心

本 fork 新增本机 Control Center。它只监听 `127.0.0.1`，不会暴露到局域网，并提供中英文界面。

开发环境：

```sh
pnpm install
pnpm codex-relay:cli desktop
```

构建后：

```sh
pnpm --filter codex-relay build
pnpm --filter codex-relay start -- desktop
```

`desktop` 命令会：

- 复用已经运行的 Relay；如果没有后台 Relay，则自动启动一个。
- 打开本机 Control Center。
- 显示手机可连接地址与配对 QR。
- 自动列出待确认的手机配对请求。
- 允许在网页中直接“允许 / 拒绝”，无需回终端输入 `approve XXXX-XXXX`。
- 查看已配对设备，并可单独断开或全部断开。
- 检查 Node.js、工作区、网络候选地址和 Tailscale 状态。

## 推荐配对流程

1. 在项目目录运行 `pnpm codex-relay:cli desktop`。
2. 手机打开 Codex Relay，扫描 Control Center 中的 QR。
3. 手机发起连接后，电脑页面会自动出现待确认设备和验证码。
4. 在电脑点击 **允许**。
5. 手机完成安全会话建立并进入工作区。

原有 CLI 配对方式仍然保留，可继续使用：

```sh
npx codex-relay@latest
npx codex-relay@latest approve XXXX-XXXX
```

## 安全模型

- Relay 仍然是 local-first；源码、shell、Git 状态和 Codex 会话保留在电脑上。
- 手机连接仍使用现有的加密配对协议，Control Center 只是把本地审批操作 GUI 化。
- Control Center 固定绑定 `127.0.0.1`。
- Control Center 的 API 使用每次进程启动时随机生成的控制令牌，避免普通跨站请求直接执行审批/注销操作。
- `--dangerously-auto-approve` 仍然不会成为默认行为。

## 网络

同一 Wi-Fi 通常可以直接使用。跨网络建议使用 Tailscale。Control Center 会显示 Relay 生成的候选连接地址，并检测当前机器是否安装 Tailscale。

## 上游同步建议

为了降低以后从上游同步的冲突，建议把 Plus 特性尽量放在外围：

- `packages/codex-relay/src/control-center.ts`
- `packages/codex-relay/src/control-center-page.ts`
- 少量 `cli.ts` / `index.ts` 接线

不要为了桌面体验重写 Codex app-server、流式消息或移动端核心数据层。
