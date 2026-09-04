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
    :root {
      color-scheme: dark;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", sans-serif;
      --bg: #0f1012;
      --panel: rgba(29, 30, 34, .92);
      --panel-soft: rgba(255, 255, 255, .035);
      --border: rgba(255, 255, 255, .085);
      --border-strong: rgba(255, 255, 255, .13);
      --text: #f4f4f5;
      --muted: #96979d;
      --faint: #696b72;
      --accent: #8b7cff;
      --accent-2: #5ea1ff;
      --ok: #42c78a;
      --warn: #e3ad52;
      --bad: #ff6b78;
    }
    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(900px 520px at 78% -18%, rgba(99, 86, 255, .12), transparent 64%),
        radial-gradient(760px 420px at 8% -12%, rgba(65, 143, 255, .08), transparent 66%),
        var(--bg);
      -webkit-font-smoothing: antialiased;
    }
    button, select { font: inherit; }
    button { border: 0; cursor: pointer; }
    button:disabled { cursor: default; opacity: .42; }
    .shell { width: min(1180px, calc(100% - 44px)); margin: 0 auto; padding: 28px 0 42px; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 22px; }
    .brand { min-width: 0; }
    .eyebrow { color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 6px; }
    h1 { margin: 0; font-size: 25px; line-height: 1.1; letter-spacing: -.025em; }
    .subtitle { color: var(--muted); font-size: 13px; margin-top: 7px; }
    .top-actions { display: flex; align-items: center; gap: 10px; }
    .lang {
      min-height: 34px;
      padding: 0 30px 0 11px;
      border-radius: 9px;
      border: 1px solid var(--border);
      color: var(--text);
      background: rgba(255,255,255,.055);
    }
    .connection-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 34px;
      padding: 0 11px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: rgba(255,255,255,.045);
      color: #d7d7da;
      font-size: 12px;
      font-weight: 650;
      white-space: nowrap;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--warn); box-shadow: 0 0 0 4px rgba(227,173,82,.10); flex: 0 0 auto; }
    .dot.ok { background: var(--ok); box-shadow: 0 0 0 4px rgba(66,199,138,.11); }
    .dot.bad { background: var(--bad); box-shadow: 0 0 0 4px rgba(255,107,120,.11); }
    .notice {
      display: none;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 14px;
      padding: 13px 14px;
      border-radius: 12px;
      border: 1px solid rgba(255,107,120,.22);
      background: rgba(255,107,120,.08);
      color: #ffd1d6;
      font-size: 12px;
      line-height: 1.45;
    }
    .notice.show { display: flex; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 356px; gap: 14px; align-items: start; }
    .stack { display: grid; gap: 14px; }
    .card {
      border: 1px solid var(--border);
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(33,34,38,.96), rgba(25,26,29,.96));
      box-shadow: 0 14px 42px rgba(0,0,0,.14);
      overflow: hidden;
    }
    .card-body { padding: 18px; }
    .card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 15px; }
    .card-title { margin: 0; font-size: 14px; font-weight: 760; letter-spacing: -.01em; }
    .card-desc { color: var(--muted); font-size: 12px; line-height: 1.45; margin-top: 5px; }
    .relay-hero { padding: 20px; }
    .relay-main { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
    .relay-copy { min-width: 0; }
    .relay-title-row { display: flex; align-items: center; gap: 10px; }
    .relay-title { font-size: 17px; font-weight: 780; letter-spacing: -.015em; }
    .relay-meta { margin-top: 7px; color: var(--muted); font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .btn {
      min-height: 34px;
      padding: 0 12px;
      border-radius: 9px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,.065);
      color: var(--text);
      font-size: 12px;
      font-weight: 680;
      transition: background .15s ease, border-color .15s ease, transform .15s ease;
    }
    .btn:hover:not(:disabled) { background: rgba(255,255,255,.105); border-color: var(--border-strong); }
    .btn:active:not(:disabled) { transform: translateY(1px); }
    .btn.primary { color: white; background: linear-gradient(135deg, #7669ee, #5b8df4); border-color: rgba(148,133,255,.45); }
    .btn.primary:hover:not(:disabled) { background: linear-gradient(135deg, #8376f5, #6697fb); }
    .btn.danger { color: #ffb7bf; background: rgba(255,107,120,.08); border-color: rgba(255,107,120,.20); }
    .btn.small { min-height: 29px; padding: 0 9px; font-size: 11px; }
    .session-strip { display: grid; grid-template-columns: 1.1fr .9fr; gap: 10px; margin-top: 18px; }
    .info-box { min-width: 0; padding: 13px 14px; border: 1px solid rgba(255,255,255,.055); border-radius: 11px; background: var(--panel-soft); }
    .info-label { color: var(--faint); font-size: 10px; font-weight: 730; letter-spacing: .06em; text-transform: uppercase; }
    .info-value { margin-top: 6px; font-size: 12px; font-weight: 680; line-height: 1.4; overflow-wrap: anywhere; }
    .info-sub { margin-top: 4px; color: var(--muted); font: 10px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
    .list { display: grid; gap: 8px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 58px; padding: 11px 12px; border: 1px solid rgba(255,255,255,.055); border-radius: 11px; background: rgba(255,255,255,.028); }
    .row-main { min-width: 0; }
    .row-title { font-size: 12px; font-weight: 720; overflow-wrap: anywhere; }
    .meta { color: var(--muted); font-size: 11px; line-height: 1.45; margin-top: 4px; overflow-wrap: anywhere; }
    .code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .pair-code { font: 800 16px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .10em; }
    .empty { padding: 22px 14px; border: 1px dashed rgba(255,255,255,.10); border-radius: 11px; color: var(--muted); text-align: center; font-size: 12px; }
    .pair-card { position: sticky; top: 16px; }
    .qr-shell { padding: 16px; border-radius: 15px; background: #fff; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); }
    .qr-stage { min-height: 286px; display: grid; place-items: center; position: relative; }
    #pairing-qr { display: none; width: min(100%, 270px); height: auto; image-rendering: pixelated; }
    #pairing-qr.ready { display: block; }
    .qr-loading { color: #666; font-size: 12px; text-align: center; line-height: 1.5; }
    .qr-fallback { display: none; margin: 0; color: #000; font: 7px/.9 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre; }
    .qr-fallback.show { display: block; }
    .pair-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
    .pair-actions .primary { grid-column: 1 / -1; }
    .payload { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.06); color: var(--muted); font: 9.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
    .diag { display: grid; grid-template-columns: 9px minmax(100px,.62fr) 1.38fr; align-items: center; gap: 9px; padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,.05); font-size: 11px; }
    .diag:last-child { border-bottom: 0; }
    .diag-icon { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); }
    .diag-icon.warn { background: var(--warn); }
    .diag-icon.bad { background: var(--bad); }
    .diag-value { color: var(--muted); overflow-wrap: anywhere; }
    .foot { margin-top: 14px; display: flex; justify-content: space-between; gap: 12px; color: var(--faint); font-size: 10px; }
    .toast { position: fixed; right: 18px; bottom: 18px; max-width: 340px; padding: 10px 12px; border-radius: 10px; background: #f1f1f2; color: #17181a; font-size: 11px; font-weight: 700; opacity: 0; transform: translateY(7px); pointer-events: none; transition: .16s ease; box-shadow: 0 14px 42px rgba(0,0,0,.28); }
    .toast.show { opacity: 1; transform: translateY(0); }
    @media (max-width: 820px) {
      .shell { width: min(100% - 28px, 680px); padding-top: 18px; }
      .topbar { align-items: flex-start; }
      .top-actions { align-items: flex-end; flex-direction: column-reverse; }
      .layout { grid-template-columns: 1fr; }
      .pair-card { position: static; }
      .session-strip { grid-template-columns: 1fr; }
    }
    @media (max-width: 560px) {
      .relay-main { flex-direction: column; }
      .actions { justify-content: flex-start; }
      .pair-actions { grid-template-columns: 1fr; }
      .pair-actions .primary { grid-column: auto; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="brand">
        <div class="eyebrow" data-i18n="eyebrow">LOCAL CODEX BRIDGE</div>
        <h1>Codex Relay Plus</h1>
        <div class="subtitle" data-i18n="tagline">连接本机 Codex 与手机，不绑定单一工作区</div>
      </div>
      <div class="top-actions">
        <div class="connection-pill"><span class="dot" id="top-dot"></span><span id="top-status" data-i18n="connecting">正在连接…</span></div>
        <select class="lang" id="language"><option value="zh-CN">简体中文</option><option value="en-US">English</option></select>
      </div>
    </header>

    <div class="notice" id="error-banner"><span id="error-text"></span><button class="btn small" id="retry" data-i18n="retry">重试</button></div>

    <div class="layout">
      <div class="stack">
        <section class="card relay-hero">
          <div class="relay-main">
            <div class="relay-copy">
              <div class="relay-title-row"><span class="dot" id="relay-dot"></span><div class="relay-title" id="relay-title" data-i18n="connectingRelay">正在连接本机 Relay</div></div>
              <div class="relay-meta" id="relay-meta">—</div>
            </div>
            <div class="actions">
              <button class="btn" id="copy-mobile" disabled data-i18n="copyMobile">复制手机地址</button>
              <button class="btn" id="refresh" data-i18n="refresh">刷新</button>
            </div>
          </div>
          <div class="session-strip">
            <div class="info-box">
              <div class="info-label" data-i18n="sessionMode">Codex 会话模式</div>
              <div class="info-value" id="session-mode" data-i18n="loading">加载中…</div>
              <div class="info-sub" id="session-command"></div>
            </div>
            <div class="info-box">
              <div class="info-label" data-i18n="fallbackDir">新会话兜底目录</div>
              <div class="info-value code" id="fallback-dir">—</div>
              <div class="meta" data-i18n="fallbackHint">已有会话继续使用各自原有 cwd</div>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-body">
            <div class="card-head">
              <div><h2 class="card-title" data-i18n="pending">待确认设备</h2><div class="card-desc" data-i18n="pendingDesc">手机扫码后，请在这里确认连接。</div></div>
              <span class="connection-pill"><span id="pending-count">0</span></span>
            </div>
            <div class="list" id="pending-list"><div class="empty" data-i18n="loading">加载中…</div></div>
          </div>
        </section>

        <section class="card">
          <div class="card-body">
            <div class="card-head">
              <div><h2 class="card-title" data-i18n="devices">已配对设备</h2><div class="card-desc" data-i18n="devicesDesc">已授权手机会保留安全会话，可随时单独断开。</div></div>
              <button class="btn danger small" id="clear-all" disabled data-i18n="disconnectAll">断开全部</button>
            </div>
            <div class="list" id="session-list"><div class="empty" data-i18n="loading">加载中…</div></div>
          </div>
        </section>

        <section class="card">
          <div class="card-body">
            <div class="card-head"><div><h2 class="card-title" data-i18n="diagnostics">环境诊断</h2><div class="card-desc" data-i18n="diagnosticsDesc">用于判断 Relay、Node、网络和共享 Codex 服务是否可用。</div></div></div>
            <div id="diagnostics"><div class="empty" data-i18n="loading">加载中…</div></div>
          </div>
        </section>
      </div>

      <aside class="card pair-card">
        <div class="card-body">
          <div class="card-head"><div><h2 class="card-title" data-i18n="pairPhone">添加手机</h2><div class="card-desc" data-i18n="scanHint">用 Codex Relay Plus 手机端扫描二维码，然后在左侧允许设备。</div></div></div>
          <div class="qr-shell">
            <div class="qr-stage">
              <canvas id="pairing-qr" aria-label="Pairing QR code"></canvas>
              <pre class="qr-fallback" id="pairing-qr-fallback"></pre>
              <div class="qr-loading" id="qr-loading" data-i18n="loadingQr">正在生成安全配对二维码…</div>
            </div>
          </div>
          <div class="pair-actions">
            <button class="btn primary" id="copy-pair" disabled data-i18n="copyPair">复制配对链接</button>
            <button class="btn" id="copy-address" disabled data-i18n="copyAddress">复制连接地址</button>
            <button class="btn" id="pair-refresh" data-i18n="refresh">刷新</button>
          </div>
          <div class="payload" id="pairing-payload">—</div>
          <div class="foot"><span data-i18n="localOnly">控制中心仅监听 127.0.0.1</span><span id="last-sync">—</span></div>
        </div>
      </aside>
    </div>
  </main>
  <div class="toast" id="toast"></div>

  <script>
    (function () {
      var tokenNode = document.querySelector('meta[name="codex-relay-control-token"]');
      var token = tokenNode ? tokenNode.content : "";
      var state = null;
      var refreshing = false;
      var lastPendingCodes = {};
      var translations = {
        "zh-CN": {
          eyebrow: "LOCAL CODEX BRIDGE", tagline: "连接本机 Codex 与手机，不绑定单一工作区", connecting: "正在连接…", connected: "Relay 在线", failed: "连接失败",
          connectingRelay: "正在连接本机 Relay", relayRunning: "本机 Relay 正在运行", retry: "重试", refresh: "刷新", loading: "加载中…", loadingQr: "正在生成安全配对二维码…",
          copyMobile: "复制手机地址", copyAddress: "复制连接地址", copyPair: "复制配对链接", copied: "已复制", copyFailed: "复制失败，请手动复制",
          sessionMode: "Codex 会话模式", sharedOn: "全局共享 app-server", sharedOff: "私有 app-server 回退", sharedDesc: "历史与共享会话可统一恢复和继续", privateDesc: "可恢复历史会话；独立终端实时会话需通过 remote 接入",
          fallbackDir: "新会话兜底目录", fallbackHint: "已有会话继续使用各自原有 cwd",
          pending: "待确认设备", pendingDesc: "手机扫码后，请在这里确认连接。", pairPhone: "添加手机", scanHint: "用 Codex Relay Plus 手机端扫描二维码，然后在左侧允许设备。",
          devices: "已配对设备", devicesDesc: "已授权手机会保留安全会话，可随时单独断开。", disconnectAll: "断开全部", diagnostics: "环境诊断", diagnosticsDesc: "用于判断 Relay、Node、网络和共享 Codex 服务是否可用。",
          approve: "允许", reject: "拒绝", disconnect: "断开", noPending: "暂无待确认设备", noDevices: "暂无已配对设备", expires: "有效至", unknownDevice: "未命名设备", justNow: "刚刚",
          actionDone: "操作完成", confirmClear: "确定断开所有已配对设备？", localOnly: "控制中心仅监听 127.0.0.1", qrUnavailable: "二维码暂不可用，请刷新后重试"
        },
        "en-US": {
          eyebrow: "LOCAL CODEX BRIDGE", tagline: "Connect local Codex to your phone without binding one workspace", connecting: "Connecting…", connected: "Relay online", failed: "Connection failed",
          connectingRelay: "Connecting to local Relay", relayRunning: "Local Relay is running", retry: "Retry", refresh: "Refresh", loading: "Loading…", loadingQr: "Generating secure pairing QR…",
          copyMobile: "Copy mobile URL", copyAddress: "Copy address", copyPair: "Copy pairing link", copied: "Copied", copyFailed: "Copy failed; copy it manually",
          sessionMode: "Codex session mode", sharedOn: "Global shared app-server", sharedOff: "Private app-server fallback", sharedDesc: "Historical and shared sessions can be resumed together", privateDesc: "History is resumable; an independent live terminal needs remote mode",
          fallbackDir: "New-thread fallback directory", fallbackHint: "Existing sessions keep their own original cwd",
          pending: "Pending devices", pendingDesc: "After scanning on the phone, approve the connection here.", pairPhone: "Add phone", scanHint: "Scan with Codex Relay Plus mobile, then approve the device on the left.",
          devices: "Paired devices", devicesDesc: "Authorized phones keep secure sessions and can be disconnected individually.", disconnectAll: "Disconnect all", diagnostics: "Diagnostics", diagnosticsDesc: "Checks Relay, Node, networking, and the shared Codex service.",
          approve: "Allow", reject: "Reject", disconnect: "Disconnect", noPending: "No pending devices", noDevices: "No paired devices", expires: "Expires", unknownDevice: "Unnamed device", justNow: "Just now",
          actionDone: "Done", confirmClear: "Disconnect every paired device?", localOnly: "Control center listens on 127.0.0.1 only", qrUnavailable: "QR is unavailable; refresh and try again"
        }
      };
      var language = localStorage.getItem("codex-relay-language") || (navigator.language && navigator.language.toLowerCase().indexOf("zh") === 0 ? "zh-CN" : "en-US");
      if (!translations[language]) language = "zh-CN";

      function byId(id) { return document.getElementById(id); }
      function t(key) { return translations[language][key] || key; }
      function escape(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) { if (char === "&") return "&amp;"; if (char === "<") return "&lt;"; if (char === ">") return "&gt;"; if (char === '"') return "&quot;"; return "&#39;"; }); }
      function each(selector, callback) { Array.prototype.forEach.call(document.querySelectorAll(selector), callback); }
      function applyLanguage() {
        document.documentElement.lang = language;
        byId("language").value = language;
        each("[data-i18n]", function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
        render();
      }
      function api(path, options) {
        options = options || {};
        options.headers = Object.assign({}, options.headers || {}, {"x-codex-relay-control-token": token});
        return fetch(path, options).then(function (response) {
          return response.text().then(function (text) {
            var body = {};
            try { body = text ? JSON.parse(text) : {}; } catch (_) { body = {}; }
            if (!response.ok) throw new Error(body.error || ("HTTP " + response.status));
            return body;
          });
        });
      }
      function toast(message) {
        var el = byId("toast");
        el.textContent = message;
        el.classList.add("show");
        clearTimeout(toast.timer);
        toast.timer = setTimeout(function () { el.classList.remove("show"); }, 1700);
      }
      function legacyCopy(value) {
        var input = document.createElement("textarea");
        input.value = value;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        var ok = false;
        try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
        document.body.removeChild(input);
        return ok;
      }
      function copy(value) {
        if (!value) return;
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard.writeText(value).then(function () { toast(t("copied")); }).catch(function () {
            toast(legacyCopy(value) ? t("copied") : t("copyFailed"));
          });
          return;
        }
        toast(legacyCopy(value) ? t("copied") : t("copyFailed"));
      }
      function relativeTime(timestamp) {
        if (!timestamp) return "";
        var delta = Math.max(0, Date.now() - timestamp);
        if (delta < 60000) return t("justNow");
        var minutes = Math.floor(delta / 60000);
        if (minutes < 60) return minutes + "m";
        var hours = Math.floor(minutes / 60);
        if (hours < 48) return hours + "h";
        return new Date(timestamp).toLocaleDateString(language);
      }
      function setConnection(kind, message) {
        var topDot = byId("top-dot");
        var relayDot = byId("relay-dot");
        topDot.className = "dot" + (kind === "ok" ? " ok" : kind === "bad" ? " bad" : "");
        relayDot.className = topDot.className;
        byId("top-status").textContent = message;
      }
      function setError(error) {
        var message = error && error.message ? error.message : String(error || "Unknown error");
        setConnection("bad", t("failed"));
        byId("relay-title").textContent = t("failed");
        byId("error-text").textContent = message;
        byId("error-banner").classList.add("show");
        byId("qr-loading").textContent = t("qrUnavailable");
      }
      function clearError() { byId("error-banner").classList.remove("show"); }
      function act(promise) {
        promise.then(function () { toast(t("actionDone")); return refresh(); }).catch(setError);
      }
      function trimQrLines(text) {
        var lines = String(text || "").replace(/\\r/g, "").split("\\n");
        while (lines.length && !lines[0].trim()) lines.shift();
        while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
        return lines;
      }
      function drawQr(text) {
        var canvas = byId("pairing-qr");
        var fallback = byId("pairing-qr-fallback");
        var loading = byId("qr-loading");
        canvas.classList.remove("ready");
        fallback.classList.remove("show");
        loading.style.display = "block";
        if (!text) { loading.textContent = t("qrUnavailable"); return; }
        var lines = trimQrLines(text);
        if (!lines.length) { loading.textContent = t("qrUnavailable"); return; }
        var width = 0;
        lines.forEach(function (line) { width = Math.max(width, line.length); });
        var ctx = canvas.getContext && canvas.getContext("2d");
        if (!ctx || width === 0) {
          fallback.textContent = text;
          fallback.classList.add("show");
          loading.style.display = "none";
          return;
        }
        var moduleSize = 5;
        var quiet = 4;
        var pixelWidth = width + quiet * 2;
        var pixelHeight = lines.length * 2 + quiet * 2;
        canvas.width = pixelWidth * moduleSize;
        canvas.height = pixelHeight * moduleSize;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#050505";
        var dark = 0;
        lines.forEach(function (line, row) {
          for (var col = 0; col < width; col += 1) {
            var ch = line.charAt(col) || " ";
            var top = ch === "▀" || ch === "█";
            var bottom = ch === "▄" || ch === "█";
            if (top) { ctx.fillRect((col + quiet) * moduleSize, (row * 2 + quiet) * moduleSize, moduleSize, moduleSize); dark += 1; }
            if (bottom) { ctx.fillRect((col + quiet) * moduleSize, (row * 2 + quiet + 1) * moduleSize, moduleSize, moduleSize); dark += 1; }
          }
        });
        if (!dark) {
          fallback.textContent = text;
          fallback.classList.add("show");
        } else {
          canvas.classList.add("ready");
        }
        loading.style.display = "none";
      }
      function render() {
        if (!state) return;
        clearError();
        setConnection("ok", t("connected"));
        byId("relay-title").textContent = t("relayRunning");
        byId("relay-meta").textContent = state.relay.connectUrl + "  ·  PID " + state.relay.pid + "  ·  port " + state.relay.port;
        byId("copy-mobile").disabled = !state.relay.connectUrl;
        byId("copy-address").disabled = !state.relay.connectUrl;
        byId("copy-pair").disabled = !state.pairingPayload;
        byId("clear-all").disabled = !state.sessions.length;
        byId("fallback-dir").textContent = state.relay.workspacePath || "—";
        if (state.relay.sharedAppServerRemoteAddress) {
          byId("session-mode").textContent = t("sharedOn") + " · " + t("sharedDesc");
          byId("session-command").textContent = "codex resume --remote " + state.relay.sharedAppServerRemoteAddress;
        } else {
          byId("session-mode").textContent = t("sharedOff") + " · " + t("privateDesc");
          byId("session-command").textContent = "";
        }
        drawQr(state.pairingQr || "");
        byId("pairing-payload").textContent = state.pairingPayload || "—";
        byId("pending-count").textContent = String(state.pendingPairings.length);
        var pending = byId("pending-list");
        pending.innerHTML = state.pendingPairings.length ? state.pendingPairings.map(function (item) {
          return '<div class="row"><div class="row-main"><div class="pair-code">' + escape(item.approvalCode) + '</div><div class="meta">' + escape(item.clientName || t("unknownDevice")) + ' · ' + t("expires") + ' ' + escape(new Date(item.expiresAt).toLocaleTimeString(language, {hour:"2-digit", minute:"2-digit"})) + '</div></div><div class="actions"><button class="btn small" data-reject="' + escape(item.approvalCode) + '">' + t("reject") + '</button><button class="btn primary small" data-approve="' + escape(item.approvalCode) + '">' + t("approve") + '</button></div></div>';
        }).join("") : '<div class="empty">' + t("noPending") + '</div>';
        var sessions = byId("session-list");
        sessions.innerHTML = state.sessions.length ? state.sessions.map(function (item) {
          return '<div class="row"><div class="row-main"><div class="row-title">' + escape(item.clientName || t("unknownDevice")) + '</div><div class="meta code">' + escape(item.clientSessionId || item.displayId) + ' · ' + escape(relativeTime(item.updatedAt)) + '</div></div><button class="btn danger small" data-disconnect="' + escape(item.tokenHash) + '">' + t("disconnect") + '</button></div>';
        }).join("") : '<div class="empty">' + t("noDevices") + '</div>';
        var diagnostics = byId("diagnostics");
        diagnostics.innerHTML = state.diagnostics.length ? state.diagnostics.map(function (item) {
          return '<div class="diag"><span class="diag-icon ' + escape(item.status) + '"></span><strong>' + escape(item.label) + '</strong><span class="diag-value code">' + escape(item.value) + '</span></div>';
        }).join("") : '<div class="empty">' + t("loading") + '</div>';
        byId("last-sync").textContent = new Date().toLocaleTimeString(language, {hour:"2-digit", minute:"2-digit", second:"2-digit"});
        bindActions();
      }
      function bindActions() {
        each("[data-approve]", function (button) { button.onclick = function () { act(api("/api/pairings/" + encodeURIComponent(button.getAttribute("data-approve")) + "/approve", {method:"POST"})); }; });
        each("[data-reject]", function (button) { button.onclick = function () { act(api("/api/pairings/" + encodeURIComponent(button.getAttribute("data-reject")), {method:"DELETE"})); }; });
        each("[data-disconnect]", function (button) { button.onclick = function () { act(api("/api/sessions/" + encodeURIComponent(button.getAttribute("data-disconnect")), {method:"DELETE"})); }; });
      }
      function rememberPending(nextState) {
        var next = {};
        nextState.pendingPairings.forEach(function (item) { next[item.approvalCode] = true; });
        lastPendingCodes = next;
      }
      function refresh() {
        if (refreshing) return Promise.resolve();
        refreshing = true;
        return api("/api/state").then(function (next) {
          rememberPending(next);
          state = next;
          render();
        }).catch(function (error) {
          setError(error);
        }).then(function () {
          refreshing = false;
        });
      }

      byId("language").onchange = function (event) {
        language = event.target.value;
        localStorage.setItem("codex-relay-language", language);
        applyLanguage();
      };
      byId("copy-mobile").onclick = function () { copy(state && state.relay.connectUrl); };
      byId("copy-address").onclick = function () { copy(state && state.relay.connectUrl); };
      byId("copy-pair").onclick = function () { copy(state && state.pairingPayload); };
      byId("refresh").onclick = refresh;
      byId("pair-refresh").onclick = refresh;
      byId("retry").onclick = refresh;
      byId("clear-all").onclick = function () {
        if (!state || !state.sessions.length || !confirm(t("confirmClear"))) return;
        act(api("/api/sessions/clear", {method:"POST"}));
      };
      document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });

      applyLanguage();
      refresh();
      setInterval(refresh, 3000);
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
