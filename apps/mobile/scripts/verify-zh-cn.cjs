"use strict";

const plugin = require("../babel-plugin-zh-cn.cjs");

const required = {
  Settings: "设置",
  "Connect to your computer": "连接到你的电脑",
  "Pair this phone once": "配对此手机",
  "Scan QR": "扫码",
  "Approve this phone": "确认此手机",
  "Waiting for approval": "等待确认",
  "No matching conversations": "没有匹配的对话",
  "Sign out": "退出配对",
  "Ask Codex anything. Try $skills or @files.": "向 Codex 提问。试试 $skills 或 @files。",
  "Plan mode": "计划模式",
  "Loading conversation…": "正在加载对话…",
  "Add Git, Files, Markdown, Web, or SSH to this workspace preview.":
    "向此工作区预览添加 Git、文件、Markdown、网页或 SSH。",
  "Reconnect terminal session": "重新连接终端会话",
  "Add context before implementing": "执行计划前添加上下文",
  Weekly: "每周",
  Daily: "每天",
  left: "剩余",
};

for (const [source, expected] of Object.entries(required)) {
  const actual = plugin.translateText(source);
  if (actual !== expected) {
    throw new Error(`translation mismatch for ${source}: ${actual}`);
  }
}

const multiline =
  "\n  Run one command on your computer, scan the QR code, then approve the phone in that same terminal.\n";
if (!plugin.translateText(multiline).includes("Mac 上打开 Codex Relay Plus")) {
  throw new Error("multiline JSX translation is not normalized correctly");
}

if (plugin.translateTemplateFragment("Connected · ") !== "已连接 · ") {
  throw new Error("template connection fragment mismatch");
}
if (plugin.translateTemplateFragment("Version ") !== "版本 ") {
  throw new Error("template version fragment mismatch");
}
if (plugin.translateTemplateFragment(" until ") !== "，重置于 ") {
  throw new Error("template rate-limit reset fragment mismatch");
}

console.log(`zh-CN localization smoke test: ${Object.keys(plugin.translations).length} strings`);
