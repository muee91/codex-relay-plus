export function renderControlCenterPage(controlToken: string) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="codex-relay-control-token" content="${escapeHtml(controlToken)}" />
  <title>Codex Relay Plus</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #191919; color: #f2f2f2; min-height: 100vh; }
    button, select { font: inherit; }
    button { border: 0; cursor: pointer; }
    .shell { max-width: 1120px; margin: 0 auto; padding: 28px 22px 48px; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .logo { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: linear-gradient(135deg, #3e96ff, #7868ff 58%, #c06dff); font-weight: 800; }
    h1 { font-size: 20px; line-height: 1.2; margin: 0; }
    .subtitle { color: #9a9a9a; font-size: 13px; margin-top: 3px; }
    .lang { background: #2a2a2a; color: #f2f2f2; border: 1px solid rgba(132,145,165,.24); border-radius: 9px; padding: 7px 9px; }
    .hero { display: grid; grid-template-columns: 1.35fr .65fr; gap: 16px; }
    .card { background: #232323; border: 1px solid rgba(132,145,165,.22); border-radius: 14px; padding: 18px; }
    .status-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .status-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #2ca36f; box-shadow: 0 0 0 5px rgba(44,163,111,.12); flex: 0 0 auto; }
    .dot.warn { background: #d6a84b; box-shadow: 0 0 0 5px rgba(214,168,75,.12); }
    .dot.bad { background: #d84f4f; box-shadow: 0 0 0 5px rgba(216,79,79,.12); }
    .title { font-size: 15px; font-weight: 700; }
    .meta { color: #9a9a9a; font-size: 12px; margin-top: 4px; overflow-wrap: anywhere; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .btn { min-height: 36px; padding: 0 13px; border-radius: 9px; color: #f2f2f2; background: #383838; border: 1px solid rgba(255,255,255,.05); }
    .btn:hover { background: #444; }
    .btn.primary { background: #f2f2f2; color: #191919; font-weight: 700; }
    .btn.danger { background: rgba(216,79,79,.15); color: #ffb6b6; border-color: rgba(216,79,79,.28); }
    .btn.small { min-height: 30px; font-size: 12px; padding: 0 10px; }
    .section { margin-top: 16px; }
    .section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
    .section h2 { margin: 0; font-size: 14px; }
    .muted { color: #9a9a9a; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
    .list { display: grid; gap: 8px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 58px; padding: 11px 12px; border-radius: 10px; background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.04); }
    .row-main { min-width: 0; }
    .code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: .02em; }
    .pair-code { font-size: 17px; font-weight: 800; letter-spacing: .08em; }
    .empty { padding: 22px 12px; border: 1px dashed rgba(132,145,165,.24); border-radius: 10px; color: #9a9a9a; text-align: center; font-size: 13px; }
    .qr-wrap { display: grid; place-items: center; min-height: 260px; background: #fff; color: #000; border-radius: 12px; overflow: auto; padding: 14px; }
    .qr { margin: 0; font-family: "SFMono-Regular", Consolas, monospace; font-size: 8px; line-height: .92; letter-spacing: 0; white-space: pre; }
    .payload { margin-top: 10px; background: rgba(255,255,255,.04); border-radius: 9px; padding: 10px; font-size: 11px; overflow-wrap: anywhere; }
    .diag { display: grid; grid-template-columns: 18px minmax(130px,.8fr) 1.2fr; align-items: center; gap: 8px; padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,.05); font-size: 12px; }
    .diag:last-child { border-bottom: 0; }
    .diag-icon { width: 9px; height: 9px; border-radius: 50%; background: #2ca36f; }
    .diag-icon.warn { background: #d6a84b; }
    .diag-icon.bad { background: #d84f4f; }
    .toast { position: fixed; right: 18px; bottom: 18px; padding: 11px 13px; background: #f2f2f2; color: #191919; border-radius: 9px; font-size: 12px; font-weight: 700; opacity: 0; transform: translateY(8px); pointer-events: none; transition: .18s ease; }
    .toast.show { opacity: 1; transform: translateY(0); }
    @media (max-width: 760px) { .hero, .grid { grid-template-columns: 1fr; } .topbar { align-items: flex-start; } .status-row { align-items: flex-start; flex-direction: column; } }
  </style>
</head>
<body>
  <main class="shell">
    <div class="topbar">
      <div class="brand"><div class="logo">R+</div><div><h1>Codex Relay Plus</h1><div class="subtitle" data-i18n="tagline">本机控制中心 · Local-first</div></div></div>
      <select class="lang" id="language"><option value="zh-CN">简体中文</option><option value="en-US">English</option></select>
    </div>

    <div class="hero">
      <div class="card">
        <div class="status-row">
          <div class="status-main"><span class="dot" id="relay-dot"></span><div><div class="title" id="relay-title">Relay 正在运行</div><div class="meta code" id="relay-meta">—</div></div></div>
          <div class="actions"><button class="btn" id="copy-mobile" data-i18n="copyMobile">复制手机地址</button><button class="btn primary" id="copy-pair" data-i18n="copyPair">复制配对链接</button></div>
        </div>
        <div class="section"><div class="section-head"><h2 data-i18n="workspace">当前工作区</h2></div><div class="row"><div class="row-main"><div class="title code" id="workspace">—</div><div class="meta" id="shared-mode">—</div></div></div></div>
        <div class="section"><div class="section-head"><h2 data-i18n="pending">待确认设备</h2><span class="muted" id="pending-count">0</span></div><div class="list" id="pending-list"></div></div>
      </div>

      <div class="card">
        <div class="section-head"><h2 data-i18n="pairPhone">添加手机</h2><span class="muted" data-i18n="scanHint">扫码后在左侧确认</span></div>
        <div class="qr-wrap"><pre class="qr" id="pairing-qr"></pre></div>
        <div class="payload code" id="pairing-payload">—</div>
      </div>
    </div>

    <div class="grid section">
      <section class="card"><div class="section-head"><h2 data-i18n="devices">已配对设备</h2><button class="btn danger small" id="clear-all" data-i18n="disconnectAll">断开全部</button></div><div class="list" id="session-list"></div></section>
      <section class="card"><div class="section-head"><h2 data-i18n="diagnostics">环境诊断</h2><button class="btn small" id="refresh" data-i18n="refresh">刷新</button></div><div id="diagnostics"></div></section>
    </div>
  </main>
  <div class="toast" id="toast"></div>
  <script>
    (function () {
      var token = document.querySelector('meta[name="codex-relay-control-token"]').content;
      var state = null;
      var lastPendingCodes = new Set();
      var translations = {
        "zh-CN": {
          tagline: "本机控制中心 · Local-first", relayRunning: "Relay 正在运行", copyMobile: "复制手机地址", copyPair: "复制配对链接", workspace: "当前工作区", pending: "待确认设备", pairPhone: "添加手机", scanHint: "扫码后在左侧确认", devices: "已配对设备", disconnectAll: "断开全部", diagnostics: "环境诊断", refresh: "刷新", approve: "允许", reject: "拒绝", disconnect: "断开", noPending: "暂无待确认设备", noDevices: "暂无已配对设备", expires: "过期时间", sharedOn: "共享终端会话：已开启", sharedOff: "共享终端会话：未开启", copied: "已复制", actionDone: "操作完成", confirmClear: "确定断开所有已配对设备？", unknownDevice: "未命名设备", justNow: "刚刚", optional: "可选"
        },
        "en-US": {
          tagline: "Local control center · Local-first", relayRunning: "Relay is running", copyMobile: "Copy mobile URL", copyPair: "Copy pairing link", workspace: "Workspace", pending: "Pending devices", pairPhone: "Add phone", scanHint: "Scan, then approve on the left", devices: "Paired devices", disconnectAll: "Disconnect all", diagnostics: "Diagnostics", refresh: "Refresh", approve: "Allow", reject: "Reject", disconnect: "Disconnect", noPending: "No pending devices", noDevices: "No paired devices", expires: "Expires", sharedOn: "Shared terminal session: on", sharedOff: "Shared terminal session: off", copied: "Copied", actionDone: "Done", confirmClear: "Disconnect every paired device?", unknownDevice: "Unnamed device", justNow: "Just now", optional: "Optional"
        }
      };
      var language = localStorage.getItem("codex-relay-language") || (navigator.language && navigator.language.toLowerCase().indexOf("zh") === 0 ? "zh-CN" : "en-US");
      if (!translations[language]) language = "zh-CN";
      document.getElementById("language").value = language;

      function t(key) { return translations[language][key] || key; }
      function escape(value) { return String(value == null ? "" : value).replace(/[&<>\"']/g, function (char) { return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[char]; }); }
      function applyLanguage() { document.documentElement.lang = language; document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); }); render(); }
      function api(path, options) { options = options || {}; options.headers = Object.assign({}, options.headers || {}, {"x-codex-relay-control-token": token}); return fetch(path, options).then(async function (response) { var body = await response.json().catch(function () { return {}; }); if (!response.ok) throw new Error(body.error || ("HTTP " + response.status)); return body; }); }
      function toast(message) { var el = document.getElementById("toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(function () { el.classList.remove("show"); }, 1600); }
      function copy(value) { if (!value) return; navigator.clipboard.writeText(value).then(function () { toast(t("copied")); }).catch(function (error) { toast(error.message); }); }
      function act(promise) { promise.then(function () { toast(t("actionDone")); return refresh(); }).catch(function (error) { toast(error.message); }); }
      function relativeTime(timestamp) { if (!timestamp) return ""; var delta = Math.max(0, Date.now() - timestamp); if (delta < 60000) return t("justNow"); var minutes = Math.floor(delta / 60000); if (minutes < 60) return minutes + "m"; var hours = Math.floor(minutes / 60); if (hours < 48) return hours + "h"; return new Date(timestamp).toLocaleDateString(language); }
      function render() {
        if (!state) return;
        document.getElementById("relay-title").textContent = t("relayRunning");
        document.getElementById("relay-meta").textContent = state.relay.connectUrl + " · PID " + state.relay.pid;
        document.getElementById("workspace").textContent = state.relay.workspacePath;
        document.getElementById("shared-mode").textContent = state.relay.sharedAppServerRemoteAddress ? t("sharedOn") + " · codex resume --remote " + state.relay.sharedAppServerRemoteAddress : t("sharedOff");
        document.getElementById("pairing-qr").textContent = state.pairingQr || "";
        document.getElementById("pairing-payload").textContent = state.pairingPayload || "";
        document.getElementById("pending-count").textContent = String(state.pendingPairings.length);
        var pending = document.getElementById("pending-list");
        pending.innerHTML = state.pendingPairings.length ? state.pendingPairings.map(function (item) { return '<div class="row"><div class="row-main"><div class="pair-code code">' + escape(item.approvalCode) + '</div><div class="meta">' + escape(item.clientName || t("unknownDevice")) + ' · ' + t("expires") + ' ' + escape(new Date(item.expiresAt).toLocaleTimeString(language, {hour:"2-digit", minute:"2-digit"})) + '</div></div><div class="actions"><button class="btn small" data-reject="' + escape(item.approvalCode) + '">' + t("reject") + '</button><button class="btn primary small" data-approve="' + escape(item.approvalCode) + '">' + t("approve") + '</button></div></div>'; }).join("") : '<div class="empty">' + t("noPending") + '</div>';
        var sessions = document.getElementById("session-list");
        sessions.innerHTML = state.sessions.length ? state.sessions.map(function (item) { return '<div class="row"><div class="row-main"><div class="title">' + escape(item.clientName || t("unknownDevice")) + '</div><div class="meta code">' + escape(item.clientSessionId || item.displayId) + ' · ' + escape(relativeTime(item.updatedAt)) + '</div></div><button class="btn danger small" data-disconnect="' + escape(item.tokenHash) + '">' + t("disconnect") + '</button></div>'; }).join("") : '<div class="empty">' + t("noDevices") + '</div>';
        var diagnostics = document.getElementById("diagnostics");
        diagnostics.innerHTML = state.diagnostics.map(function (item) { return '<div class="diag"><span class="diag-icon ' + escape(item.status) + '"></span><strong>' + escape(item.label) + '</strong><span class="muted code">' + escape(item.value) + '</span></div>'; }).join("");
        bindActions();
      }
      function bindActions() {
        document.querySelectorAll("[data-approve]").forEach(function (button) { button.onclick = function () { act(api("/api/pairings/" + encodeURIComponent(button.dataset.approve) + "/approve", {method:"POST"})); }; });
        document.querySelectorAll("[data-reject]").forEach(function (button) { button.onclick = function () { act(api("/api/pairings/" + encodeURIComponent(button.dataset.reject), {method:"DELETE"})); }; });
        document.querySelectorAll("[data-disconnect]").forEach(function (button) { button.onclick = function () { act(api("/api/sessions/" + encodeURIComponent(button.dataset.disconnect), {method:"DELETE"})); }; });
      }
      function maybeNotifyPending(nextState) {
        nextState.pendingPairings.forEach(function (item) {
          if (!lastPendingCodes.has(item.approvalCode) && lastPendingCodes.size > 0 && "Notification" in window && Notification.permission === "granted") new Notification("Codex Relay Plus", {body:(item.clientName || t("unknownDevice")) + " · " + item.approvalCode});
        });
        lastPendingCodes = new Set(nextState.pendingPairings.map(function (item) { return item.approvalCode; }));
      }
      function refresh() { return api("/api/state").then(function (next) { maybeNotifyPending(next); state = next; render(); }).catch(function (error) { document.getElementById("relay-title").textContent = error.message; document.getElementById("relay-dot").className = "dot bad"; }); }
      document.getElementById("language").onchange = function (event) { language = event.target.value; localStorage.setItem("codex-relay-language", language); applyLanguage(); };
      document.getElementById("copy-mobile").onclick = function () { copy(state && state.relay.connectUrl); };
      document.getElementById("copy-pair").onclick = function () { copy(state && state.pairingPayload); };
      document.getElementById("refresh").onclick = refresh;
      document.getElementById("clear-all").onclick = function () { if (!confirm(t("confirmClear"))) return; act(api("/api/sessions/clear", {method:"POST"})); };
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(function () {});
      applyLanguage(); refresh(); setInterval(refresh, 2000);
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
