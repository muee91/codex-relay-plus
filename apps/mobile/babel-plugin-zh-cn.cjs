"use strict";

const translations = Object.freeze({
  "Threads": "会话",
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
  "Cancel": "取消",
  "Save": "保存",
  "Unpin chat": "取消置顶聊天",
  "Pin chat": "置顶聊天",
  "Resize threads sidebar": "调整会话侧边栏大小",
  "Unable to load this Codex thread.": "无法加载此 Codex 会话。",
  "Unable to load workspace folders.": "无法加载工作区文件夹。",
  "Unable to create a new Codex Relay thread.": "无法创建新的 Codex Relay 会话。",
  "Unable to refresh projects.": "无法刷新项目。",
  "New chat": "新聊天",

  "Settings": "设置",
  "File Editor": "文件编辑器",
  "Back to threads": "返回会话",
  "Account": "账户",
  "Project": "项目",
  "Sponsor": "赞助",
  "Usage Limits": "用量限制",
  "Rate limits": "速率限制",
  "Checking current usage": "正在检查当前用量",
  "Unavailable from this runtime": "当前运行时不可用",
  "Connected Computer": "已连接的电脑",
  "No paired computer": "尚未配对电脑",
  "Server": "服务器",
  "Pair this device from the main screen to choose a relay server.": "请从主界面配对此设备，然后选择 Relay 服务器。",
  "Notifications": "通知",
  "Notifications unavailable": "通知不可用",
  "Generic alerts only. Chat content stays on your paired computer.": "仅发送通用提醒，聊天内容始终保留在已配对电脑上。",
  "Notify when a Codex turn ends": "Codex 一轮结束时通知",
  "When Codex completes or fails a turn": "Codex 完成或执行失败时",
  "Turn complete": "任务完成",
  "Notify when Codex needs action": "Codex 需要操作时通知",
  "When Codex needs approval or input": "Codex 需要批准或输入时",
  "Action required": "需要操作",
  "Push notifications are available in the iOS and Android apps.": "iOS 和 Android 客户端支持推送通知。",
  "Session": "会话",
  "Sign out": "退出配对",
  "Pair again on this device": "在此设备上重新配对",
  "Downloading": "正在下载",
  "Restarting": "正在重启",
  "Restart": "重启",
  "Restart app": "重启应用",
  "Preparing app update": "正在准备应用更新",
  "Clear HotUpdater logs": "清除 HotUpdater 日志",
  "Hide HotUpdater logs": "隐藏 HotUpdater 日志",
  "Clear": "清除",
  "Hide": "隐藏",
  "Server unavailable": "服务器不可用",
  "CHECKING": "检查中",
  "ACTIVE": "当前",
  "USE": "使用",
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
  "Run one command on your computer, scan the QR code, then approve the phone in that same terminal.": "在 Mac 上打开 Codex Relay Plus 桌面端，选择工作区，扫描二维码并在桌面端确认此手机。",
  "Start the relay": "打开 Mac 桌面端",
  "Open Terminal on your computer and run:": "打开 Codex Relay Plus 桌面端并选择要使用的工作区。",
  "Choose Wi-Fi or Tailscale": "选择 Wi‑Fi 或 Tailscale",
  "Same Wi-Fi is enough nearby. To use Codex Relay away from this Wi-Fi, install Tailscale on your computer and phone, sign in to the same account, and make sure both say Connected before scanning.": "附近使用时让手机和 Mac 连接同一 Wi‑Fi 即可。需要远程使用时，请在两端安装 Tailscale、登录同一账户，并确认两端均已连接后再扫码。",
  "Open Tailscale on App Store": "安装 Tailscale",
  "Open Tailscale on the App Store": "打开 Tailscale 下载页",
  "Scan and approve": "扫码并确认",
  "Scan the QR shown in Terminal. When a code appears, approve it on your computer.": "扫描 Mac 桌面端显示的二维码；出现确认码后，在桌面端允许此设备。",
  "Scan connection QR": "扫描连接二维码",
  "Scan QR": "扫码",
  "Refresh connection": "刷新连接",
  "Copy relay start command": "复制 Relay 启动命令",

  "Point the camera at the connection QR.": "将摄像头对准连接二维码。",
  "Camera access is off. Allow camera access to scan the connection QR.": "相机权限已关闭。请允许相机权限以扫描连接二维码。",
  "Camera access is off": "相机权限已关闭",
  "Allow camera access to scan the connection QR, or close this screen and pair another way.": "允许相机权限后即可扫描连接二维码，也可以关闭此页面并使用其他方式配对。",
  "Open app settings for camera access": "打开应用设置授权相机",
  "Try camera permission again": "再次请求相机权限",
  "Open Settings": "打开设置",
  "Try Again": "重试",
  "Close QR scanner": "关闭二维码扫描器",
  "Close": "关闭",
  "QR detected. Pairing...": "已识别二维码，正在配对…",
  "Pairing": "正在配对",
  "Pairing failed": "配对失败",
  "Invalid QR code": "无效二维码",
  "This is not the Codex Relay QR. Scan the QR shown on your computer.": "这不是 Codex Relay 配对二维码，请扫描 Mac 桌面端显示的二维码。",
  "Could not connect. Use the same Wi-Fi or turn on Tailscale, then scan again.": "无法连接。请让手机和 Mac 使用同一 Wi‑Fi，或开启 Tailscale 后重新扫码。",
  "Run npx codex-relay@latest on your computer, then scan the QR shown there.": "请在 Mac 上打开 Codex Relay Plus 桌面端，然后扫描其中显示的二维码。",
  "Use the same Wi-Fi on your phone and computer. If that is not possible, turn on Tailscale on both devices and scan again.": "请让手机和 Mac 使用同一 Wi‑Fi；如果无法做到，请在两端开启 Tailscale 后重新扫码。",
  "Approve this phone": "确认此手机",
  "Close pairing status": "关闭配对状态",
  "Finish pairing from the Terminal window where codex-relay is running.": "请在 Mac 桌面端完成最后的配对确认。",
  "QR recognized. Connecting to the relay...": "二维码已识别，正在连接 Relay…",
  "Approval code": "确认码",
  "Run this on your computer:": "如需命令行备用方式，可在电脑运行：",
  "Copy approval command": "复制确认命令",
  "Waiting for approval": "等待确认",
  "Ready": "就绪",

  "Image limit reached": "已达到图片数量上限",
  "Image attach failed": "添加图片失败",
  "Could not read the selected image.": "无法读取所选图片。",
  "Some images were skipped": "部分图片已跳过",
  "Choose fewer or smaller images so the chat stays stable.": "请选择更少或更小的图片，以保持聊天稳定。",
  "Rewind chat?": "回退聊天？",
  "This removes this prompt and everything after it from the chat.": "这会删除此提示以及其后的全部聊天内容。",
  "Rewind": "回退",
  "Couldn’t rewind chat": "无法回退聊天",
  "Unable to reach the Codex Relay server.": "无法连接 Codex Relay 服务器。"
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
