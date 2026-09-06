"use strict";

const translations = Object.freeze({
  Threads: "会话",
  "Chat Preview": "聊天预览",
  "Show threads": "显示会话",
  "Hide threads": "隐藏会话",
  "Open threads": "打开会话",
  "Open thread search": "搜索会话",
  "Open new chat": "新建聊天",
  "Open settings": "打开设置",
  "Refresh chat": "刷新聊天",
  "Hide workspace preview": "隐藏工作区预览",
  "Show workspace preview": "显示工作区预览",
  "Workspace preview": "工作区预览",
  "Resize workspace preview": "调整工作区预览大小",
  "Copied to clipboard": "已复制到剪贴板",
  "Message Markdown copied.": "消息 Markdown 已复制。",
  "No matching conversations": "没有匹配的对话",
  "No chats in this workspace": "此工作区暂无聊天",
  "Couldn’t rename chat": "无法重命名聊天",
  "Unable to rename this chat.": "无法重命名此聊天。",
  "Rename chat": "重命名聊天",
  "Chat actions": "聊天操作",
  "Choose a clear title for this chat.": "为此聊天设置一个清晰的标题。",
  "Chat title": "聊天标题",
  "Cancel chat rename": "取消重命名聊天",
  "Save chat name": "保存聊天名称",
  Cancel: "取消",
  Save: "保存",
  "Unpin chat": "取消置顶聊天",
  "Pin chat": "置顶聊天",
  "Resize threads sidebar": "调整会话侧边栏大小",
  "Unable to load this Codex thread.": "无法加载此 Codex 会话。",
  "Unable to load workspace folders.": "无法加载工作区文件夹。",
  "Unable to create a new Codex Relay thread.": "无法创建新的 Codex Relay 会话。",
  "Unable to refresh projects.": "无法刷新项目。",
  "New chat": "新聊天",

  Settings: "设置",
  "File Editor": "文件编辑器",
  "Back to threads": "返回会话",
  Account: "账户",
  Project: "项目",
  Sponsor: "赞助",
  "Usage Limits": "用量限制",
  "Rate limits": "速率限制",
  "Checking current usage": "正在检查当前用量",
  "Unavailable from this runtime": "当前运行时不可用",
  "Connected Computer": "已连接的电脑",
  "No paired computer": "尚未配对电脑",
  Server: "服务器",
  "Pair this device from the main screen to choose a relay server.":
    "请从主界面配对此设备，然后选择 Relay 服务器。",
  Notifications: "通知",
  "Notifications unavailable": "通知不可用",
  "Generic alerts only. Chat content stays on your paired computer.":
    "仅发送通用提醒，聊天内容始终保留在已配对电脑上。",
  "Notify when a Codex turn ends": "Codex 一轮结束时通知",
  "When Codex completes or fails a turn": "Codex 完成或执行失败时",
  "Turn complete": "任务完成",
  "Notify when Codex needs action": "Codex 需要操作时通知",
  "When Codex needs approval or input": "Codex 需要批准或输入时",
  "Action required": "需要操作",
  "Push notifications are available in the iOS and Android apps.":
    "iOS 和 Android 客户端支持推送通知。",
  Session: "会话",
  "Sign out": "退出配对",
  "Pair again on this device": "在此设备上重新配对",
  Downloading: "正在下载",
  Restarting: "正在重启",
  Restart: "重启",
  "Restart app": "重启应用",
  "Preparing app update": "正在准备应用更新",
  "Clear HotUpdater logs": "清除 HotUpdater 日志",
  "Hide HotUpdater logs": "隐藏 HotUpdater 日志",
  Clear: "清除",
  Hide: "隐藏",
  "Server unavailable": "服务器不可用",
  CHECKING: "检查中",
  ACTIVE: "当前",
  USE: "使用",
  " · checking": " · 检查中",
  " · current": " · 已是最新",
  " · downloading": " · 下载中",
  " · restart ready": " · 可重启更新",
  " · check failed": " · 检查失败",

  "Connect to your computer": "连接到你的电脑",
  "Connecting to your computer": "正在连接电脑",
  "Reconnecting to your computer": "正在重新连接电脑",
  "No paired computer yet": "尚未配对电脑",
  "Pair this phone once": "配对此手机",
  "Run one command on your computer, scan the QR code, then approve the phone in that same terminal.":
    "在 Mac 上打开 Codex Relay Plus 桌面端，选择工作区，扫描二维码并在桌面端确认此手机。",
  "Start the relay": "打开 Mac 桌面端",
  "Open Terminal on your computer and run:": "打开 Codex Relay Plus 桌面端并选择要使用的工作区。",
  "Choose Wi-Fi or Tailscale": "选择 Wi‑Fi 或 Tailscale",
  "Same Wi-Fi is enough nearby. To use Codex Relay away from this Wi-Fi, install Tailscale on your computer and phone, sign in to the same account, and make sure both say Connected before scanning.":
    "附近使用时让手机和 Mac 连接同一 Wi‑Fi 即可。需要远程使用时，请在两端安装 Tailscale、登录同一账户，并确认两端均已连接后再扫码。",
  "Open Tailscale on App Store": "安装 Tailscale",
  "Open Tailscale on the App Store": "打开 Tailscale 下载页",
  "Scan and approve": "扫码并确认",
  "Scan the QR shown in Terminal. When a code appears, approve it on your computer.":
    "扫描 Mac 桌面端显示的二维码；出现确认码后，在桌面端允许此设备。",
  "Scan connection QR": "扫描连接二维码",
  "Scan QR": "扫码",
  "Refresh connection": "刷新连接",
  "Copy relay start command": "复制 Relay 启动命令",

  "Point the camera at the connection QR.": "将摄像头对准连接二维码。",
  "Camera access is off. Allow camera access to scan the connection QR.":
    "相机权限已关闭。请允许相机权限以扫描连接二维码。",
  "Camera access is off": "相机权限已关闭",
  "Allow camera access to scan the connection QR, or close this screen and pair another way.":
    "允许相机权限后即可扫描连接二维码，也可以关闭此页面并使用其他方式配对。",
  "Open app settings for camera access": "打开应用设置授权相机",
  "Try camera permission again": "再次请求相机权限",
  "Open Settings": "打开设置",
  "Try Again": "重试",
  "Close QR scanner": "关闭二维码扫描器",
  Close: "关闭",
  "QR detected. Pairing...": "已识别二维码，正在配对…",
  Pairing: "正在配对",
  "Pairing failed": "配对失败",
  "Invalid QR code": "无效二维码",
  "This is not the Codex Relay QR. Scan the QR shown on your computer.":
    "这不是 Codex Relay 配对二维码，请扫描 Mac 桌面端显示的二维码。",
  "Could not connect. Use the same Wi-Fi or turn on Tailscale, then scan again.":
    "无法连接。请让手机和 Mac 使用同一 Wi‑Fi，或开启 Tailscale 后重新扫码。",
  "Run npx codex-relay@latest on your computer, then scan the QR shown there.":
    "请在 Mac 上打开 Codex Relay Plus 桌面端，然后扫描其中显示的二维码。",
  "Use the same Wi-Fi on your phone and computer. If that is not possible, turn on Tailscale on both devices and scan again.":
    "请让手机和 Mac 使用同一 Wi‑Fi；如果无法做到，请在两端开启 Tailscale 后重新扫码。",
  "Approve this phone": "确认此手机",
  "Close pairing status": "关闭配对状态",
  "Finish pairing from the Terminal window where codex-relay is running.":
    "请在 Mac 桌面端完成最后的配对确认。",
  "QR recognized. Connecting to the relay...": "二维码已识别，正在连接 Relay…",
  "Approval code": "确认码",
  "Run this on your computer:": "如需命令行备用方式，可在电脑运行：",
  "Copy approval command": "复制确认命令",
  "Waiting for approval": "等待确认",
  Ready: "就绪",

  "Image limit reached": "已达到图片数量上限",
  "Image attach failed": "添加图片失败",
  "Could not read the selected image.": "无法读取所选图片。",
  "Some images were skipped": "部分图片已跳过",
  "Choose fewer or smaller images so the chat stays stable.":
    "请选择更少或更小的图片，以保持聊天稳定。",
  "Rewind chat?": "回退聊天？",
  "This removes this prompt and everything after it from the chat.":
    "这会删除此提示以及其后的全部聊天内容。",
  Rewind: "回退",
  "Couldn’t rewind chat": "无法回退聊天",
  "Unable to reach the Codex Relay server.": "无法连接 Codex Relay 服务器。",

  // Current mobile surfaces added after the original Chinese client.
  "Close image viewer": "关闭图片查看器",
  "Reset image zoom": "重置图片缩放",
  "Image unavailable": "图片不可用",
  "This attachment could not be opened.": "无法打开此附件。",
  "Open Codex Relay GitHub repository": "打开 Codex Relay GitHub 仓库",
  "Open gronxb GitHub Sponsors": "打开 gronxb GitHub Sponsors",
  "No OTA download events captured in this session.": "本次会话没有记录到 OTA 下载事件。",
  "Base URL": "基础 URL",
  Used: "已使用",
  Remaining: "剩余",
  "Discard changes?": "放弃更改？",
  "Your unsaved edits will be lost.": "未保存的编辑将会丢失。",
  "Close file editor": "关闭文件编辑器",
  Saving: "正在保存",
  "Missing file": "缺少文件",
  "No workspace file path was provided.": "未提供工作区文件路径。",
  "Loading file": "正在加载文件",
  "Unable to load file": "无法加载文件",
  "Binary file": "二进制文件",
  "This editor supports text files only.": "此编辑器仅支持文本文件。",
  "File too large": "文件过大",
  "Large truncated previews cannot be edited.": "无法编辑过大的截断预览。",
  "File not found": "未找到文件",
  "Select another file from Workspace Preview.": "请从工作区预览中选择其他文件。",
  "Keep Editing": "继续编辑",

  "Ask Codex anything. Try $skills or @files.": "向 Codex 提问。试试 $skills 或 @files。",
  "Ask Codex for a plan. Try $skills or @files.": "让 Codex 制定计划。试试 $skills 或 @files。",
  "Plan mode is on": "计划模式已开启",
  "Turns off Plan mode": "关闭计划模式",
  "Plan mode": "计划模式",
  "Open add menu": "打开添加菜单",
  Stop: "停止",
  Send: "发送",
  "Send running input": "发送运行中的输入",
  "Add context": "添加上下文",
  "Add photos from library": "从相册添加图片",
  Photos: "照片",
  "Opening photo library": "正在打开相册",
  "Choose images from your library": "从相册选择图片",
  "Turn off Plan mode": "关闭计划模式",
  "Turn on Plan mode": "开启计划模式",
  "Plan first, then wait": "先制定计划，再等待",
  "Ask Codex to plan before editing": "让 Codex 在编辑前先制定计划",
  "Connect to the Codex Relay server first": "请先连接 Codex Relay 服务器",
  "Usage limits": "用量限制",
  Weekly: "每周",
  Daily: "每天",
  left: "剩余",
  Goal: "目标",
  "Edit goal": "编辑目标",
  "Clear goal": "清除目标",
  "Goal objective": "目标内容",
  "Cancel goal edit": "取消编辑目标",
  "Save goal": "保存目标",
  "Do you want to implement this plan?": "要执行这个计划吗？",
  "Yes, implement this plan": "是，执行此计划",
  "Dismiss plan decision": "关闭计划决策",
  Ignore: "忽略",
  "Submit ↩": "提交 ↩",
  "Codex requested input, but no question was provided.": "Codex 请求输入，但未提供问题。",
  "Ignore input request": "忽略输入请求",
  "Submit input request answer": "提交输入请求答案",
  "Additional context for Codex": "Codex 的补充上下文",
  "Give Codex more context": "为 Codex 提供更多上下文",
  "Context usage": "上下文用量",
  "Usage unavailable": "用量不可用",
  "Usage limited": "用量受限",
  Steering: "引导中",
  Complete: "已完成",
  "Pause goal": "暂停目标",
  "Resume goal": "恢复目标",
  "Add context before implementing": "执行计划前添加上下文",
  "Implement plan": "执行计划",
  "Choose the model, reasoning effort, and response speed.": "选择模型、推理强度和回复速度。",
  "Balance faster replies with smarter reasoning.": "平衡回复速度与推理质量。",
  "Copied message Markdown": "复制消息 Markdown",
  "Copy message Markdown": "复制消息 Markdown",

  "Unable to open preview": "无法打开预览",
  "This workspace preview request is invalid.": "此工作区预览请求无效。",
  "Unable to open Markdown": "无法打开 Markdown",
  "This document is not inside the current workspace.": "此文档不在当前工作区内。",
  Retry: "重试",
  "Unable to load this conversation.": "无法加载此对话。",
  "Retry loading conversation": "重试加载对话",
  "Send a message to start the conversation.": "发送消息以开始对话。",
  "Scroll to latest message": "滚动到最新消息",
  "Loading conversation…": "正在加载对话…",
  "Working…": "工作中…",
  "Command copied": "命令已复制",
  "Copy failed": "复制失败",
  "1.5x speed, more usage": "1.5 倍速，消耗更多用量",
  Fast: "快速",
  Advanced: "高级",
  "Shows model, reasoning, and speed controls": "显示模型、推理强度和速度控制",
  Power: "强度",
  "Swipe up or down to adjust": "上下滑动调整",
  Model: "模型",
  Effort: "推理强度",
  Speed: "速度",
  Default: "默认",
  Standard: "标准",
  Custom: "自定义",
  "Minimal reasoning for the fastest replies": "最少推理，回复最快",
  "Fast replies with light reasoning": "轻量推理，快速回复",
  "Balanced reasoning for everyday work": "均衡推理，适合日常工作",
  "Deeper reasoning for complex work": "深度推理，适合复杂工作",
  "Extra reasoning for difficult problems": "额外推理，适合困难问题",
  "Maximum reasoning depth for the hardest problems": "最大推理深度，适合最棘手的问题",
  "Maximum reasoning with automatic task delegation": "最大推理并自动分配任务",
  "Consumes usage limits faster": "更快消耗用量限制",
  "Standard speed and usage": "标准速度和用量",

  Permissions: "权限",
  "Set how much permission Codex can use.": "设置 Codex 可使用的权限范围。",
  "Default permissions": "默认权限",
  "Ask before sensitive actions": "敏感操作前询问",
  Auto: "自动",
  "Run in workspace, ask after sandbox failures": "在工作区运行，沙箱失败后询问",
  "Full access": "完全访问",
  "Run without permission prompts": "运行时不再询问权限",

  Plan: "计划",
  "Updating plan": "正在更新计划",
  Subagents: "子代理",
  "Input requested": "需要输入",
  "Approval requested": "请求确认",
  "Approve command": "批准命令",
  "Approve files": "批准文件更改",
  "Approve permissions": "批准权限",
  "Approve input": "批准输入",
  "Approval failed": "批准失败",
  "Unable to respond.": "无法响应。",
  "Open details for Plan": "打开计划详情",
  "Type your answer": "输入答案",
  Approve: "批准",
  Deny: "拒绝",
  "Responded:": "已响应：",
  Collapse: "收起",
  Expand: "展开",
  "Patch preview unavailable": "补丁预览不可用",
  "[... patch preview truncated]": "[补丁预览已截断]",
  "Detail unavailable": "详情不可用",
  "Unable to load the full detail.": "无法加载完整详情。",
  chars: "字符",
  "Loading full detail": "正在加载完整详情",
  Searched: "已搜索",
  Thinking: "思考中",
  Called: "已调用",
  Read: "读取",
  Listed: "已列出",
  Ran: "已运行",
  Edited: "已编辑",
  "No details.": "没有详细信息。",
  Tool: "工具",
  Status: "状态",
  Raw: "原始数据",
  Query: "查询",
  Questions: "问题",
  Request: "请求",
  Reason: "原因",
  "Working Directory": "工作目录",
  Command: "命令",
  Output: "输出",
  Files: "文件",
  Patch: "补丁",
  "Reply to continue": "回复以继续",

  "No preview tabs": "暂无预览标签页",
  "Add Git, Files, Markdown, Web, or SSH to this workspace preview.":
    "向此工作区预览添加 Git、文件、Markdown、网页或 SSH。",
  "Add workspace preview tab": "添加工作区预览标签页",
  "Add Tab": "添加标签页",
  "All available tabs are already open.": "所有可用标签页都已打开。",
  "Back from workspace preview": "返回工作区预览",
  Explorer: "文件浏览器",
  "Filter current folder": "筛选当前文件夹",
  "Clear file search": "清除文件搜索",
  "Loading files": "正在加载文件",
  "Unable to load files": "无法加载文件",
  "No files found": "未找到文件",
  "Try another path or search term.": "请尝试其他路径或搜索词。",
  Edit: "编辑",
  "This preview shows text files only.": "此预览仅显示文本文件。",
  "Previewing the first": "正在预览前",
  "Select a file": "选择文件",
  "Search or pick a file to preview it here.": "搜索或选择文件以在此处预览。",
  "Unable to load changes": "无法加载更改",
  "Only untracked files changed": "仅未跟踪文件发生更改",
  "Git diff has no tracked-file patch to show yet.": "Git diff 暂无可显示的已跟踪文件补丁。",
  "No workspace changes": "工作区没有更改",
  "The current workspace is clean.": "当前工作区是干净的。",
  "Loading Git": "正在加载 Git",
  Publish: "发布",
  Branch: "分支",
  "Switch workspace branch": "切换工作区分支",
  "Switch Branch": "切换分支",
  "Branch name": "分支名称",
  "Create and switch branch": "创建并切换分支",
  "Switch branch": "切换分支",
  "Current branch": "当前分支",
  "Available branch": "可用分支",
  "No text patch available for this file.": "此文件没有可用的文本补丁。",
  "No Markdown file selected": "未选择 Markdown 文件",
  "Open a Markdown document from the chat attachment card.": "请从聊天附件卡片打开 Markdown 文档。",
  "Loading Markdown": "正在加载 Markdown",
  "Unable to load Markdown": "无法加载 Markdown",
  "Unable to load preview": "无法加载预览",
  "Open web preview URL": "打开网页预览地址",
  Go: "前往",
  "Retry web preview": "重试网页预览",
  "Go back in web preview": "在网页预览中后退",
  "Go forward in web preview": "在网页预览中前进",
  "Reload web preview": "重新加载网页预览",
  "Tailcat carries the Relay connection. A separate preview port must still be reachable from this phone over LAN or a secure URL you provide.":
    "Tailcat 负责 Relay 连接，但独立的预览端口仍需通过局域网或你提供的安全地址从手机访问。",
  "Loading editor": "正在加载编辑器",
  "Loading terminal": "正在加载终端",
  "Reconnect terminal session": "重新连接终端会话",
  Reconnect: "重新连接",
  "Show keyboard": "显示键盘",
  Escape: "退出",
  Tab: "制表键",
  "Control modifier": "Control 修饰键",
  Paste: "粘贴",
  "Copies this command to the clipboard": "将此命令复制到剪贴板",
  "More terminal shortcuts": "更多终端快捷键",
  Reset: "重置",
  "Left arrow": "左箭头",
  "Up arrow": "上箭头",
  "Down arrow": "下箭头",
  "Right arrow": "右箭头",
  "Create chat in current folder": "在当前文件夹创建聊天",
  "New Chat": "新建聊天",
  "New Chat Here": "在此处新建聊天",
  "Close menu": "关闭菜单",
  "Clear conversation search": "清除对话搜索",
  "Search conversations": "搜索对话",
  "Close folder picker": "关闭文件夹选择器",
  "Go to parent folder": "前往上级文件夹",
  "Open parent folder": "打开上级文件夹",
  "Loading folders…": "正在加载文件夹…",
  "No folders here": "此处没有文件夹",
  "Long press for chat actions": "长按打开聊天操作",
  "Show more": "显示更多",
  Pinned: "已置顶",
  Projects: "项目",
  "Codex Relay on GitHub": "GitHub 上的 Codex Relay",
  "Update relay": "更新 Relay",
  "Current relay": "当前 Relay",
  "Required relay": "所需 Relay",
  "Action failed": "操作失败",
  "Archive thread?": "归档会话？",
  "Document ·": "文档 ·",
  "Image attachment download failed": "图片附件下载失败",
  "Open branch switcher": "打开分支切换器",
  "Refresh projects": "刷新项目",
  "Rewind chat to before this message": "回退到此消息之前",
  "Collapse file explorer": "收起文件浏览器",
  "Expand file explorer": "展开文件浏览器",
  "Commit & Push": "提交并推送",
  "Create PR": "创建 PR",
  "Starting PR": "正在创建 PR",
});

const templateFragments = Object.freeze({
  "Connected · ": "已连接 · ",
  "Checking · ": "检查中 · ",
  "Offline · ": "离线 · ",
  "Waiting for ": "正在等待 ",
  "Version ": "版本 ",
  "Attach up to ": "每次最多添加 ",
  " images at a time.": " 张图片。",
  "Logs (": "日志 (",
  ", Advanced options": "，高级选项",
  "Service tier: ": "服务级别：",
  "Use ": "使用 ",
  " reasoning": " 推理",
  "Plan progress: ": "计划进度：",
  " of ": " / ",
  " steps completed": " 个步骤已完成",
  ", ": "，",
  " subagents, ": " 个子代理，",
  " active": " 个活跃",
  " done": " 个已完成",
  " stopped": " 个已停止",
  " failed": " 个失败",
  "Complete ": "已完成 ",
  "Load full ": "加载完整",
  "Insert ": "插入 ",
  " skill": " 技能",
  "Steer queued prompt ": "引导排队提示 ",
  "Restore queued prompt ": "恢复排队提示 ",
  " to composer": " 到输入框",
  "Remove queued prompt ": "移除排队提示 ",
  "Remove image ": "移除图片 ",
  "Open attached image ": "打开附件图片 ",
  "Open ": "打开 ",
  "Add ": "添加 ",
  " tab": " 标签页",
  "Show ": "显示 ",
  "Close ": "关闭 ",
  "Edited ": "已编辑 ",
  " file": " 个文件",
  " files": " 个文件",
  " more": " 更多",
  " questions to answer": " 个问题待回答",
  "Options: ": "选项：",
  " exited": " 已退出",
  "Run ": "运行 ",
  " in the server terminal.": "，在服务器终端中运行。",
  " files, +": " 个文件，新增 ",
  " files changed": " 个文件发生更改",
  " changed files.": " 个文件发生更改。",
  "% used": "% 已使用",
  " until ": "，重置于 ",
  "Showing first ": "显示前 ",
  " more diff lines": " 更多差异行",
});

function translateTemplateFragment(value) {
  return templateFragments[value] || value;
}

function normalized(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function translateText(value) {
  const direct = translations[value];
  if (direct) {
    return direct;
  }
  const key = normalized(value);
  const translated = translations[key];
  if (!translated) {
    return value;
  }
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

module.exports = function codexRelayZhCnPlugin({ types: t }) {
  return {
    name: "codex-relay-zh-cn",
    visitor: {
      Program(path, state) {
        const filename = state.filename || "";
        state.__codexRelayLocalize = /[/\\]apps[/\\]mobile[/\\]src[/\\]/.test(filename);
      },
      StringLiteral(path, state) {
        if (!state.__codexRelayLocalize) {
          return;
        }
        if (
          t.isImportDeclaration(path.parent) ||
          t.isExportNamedDeclaration(path.parent) ||
          t.isExportAllDeclaration(path.parent) ||
          (t.isObjectProperty(path.parent) && path.key === "key" && !path.parent.computed) ||
          (t.isObjectMethod(path.parent) && path.key === "key" && !path.parent.computed) ||
          (t.isClassMethod(path.parent) && path.key === "key" && !path.parent.computed) ||
          (t.isMemberExpression(path.parent) && path.key === "property" && !path.parent.computed)
        ) {
          return;
        }
        const translated = translateText(path.node.value);
        if (translated !== path.node.value) {
          path.node.value = translated;
        }

        if (
          process.env.CODEX_RELAY_PLATFORM === "android" &&
          path.node.value === "https://apps.apple.com/us/app/tailscale/id1470499037"
        ) {
          path.node.value = "https://play.google.com/store/apps/details?id=com.tailscale.ipn";
        }
      },
      JSXText(path, state) {
        if (!state.__codexRelayLocalize) {
          return;
        }
        const translated = translateText(path.node.value);
        if (translated !== path.node.value) {
          path.node.value = translated;
        }
      },
      TemplateElement(path, state) {
        if (!state.__codexRelayLocalize) {
          return;
        }
        const cooked = path.node.value.cooked;
        if (typeof cooked !== "string") {
          return;
        }
        const translated = translateTemplateFragment(cooked);
        if (translated === cooked) {
          return;
        }
        path.node.value.cooked = translated;
        path.node.value.raw = translated;
      },
      JSXAttribute(path, state) {
        if (!state.__codexRelayLocalize || process.env.CODEX_RELAY_DESKTOP_FIRST !== "1") {
          return;
        }
        const filename = state.filename || "";
        if (!filename.endsWith("ConnectionBanner.tsx")) {
          return;
        }
        if (!t.isJSXIdentifier(path.node.name, { name: "command" })) {
          return;
        }
        const value = path.node.value;
        if (
          t.isJSXExpressionContainer(value) &&
          t.isIdentifier(value.expression, { name: "relayStartCommand" })
        ) {
          path.remove();
        }
      },
    },
  };
};

module.exports.translations = translations;
module.exports.translateText = translateText;
module.exports.templateFragments = templateFragments;
module.exports.translateTemplateFragment = translateTemplateFragment;
