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
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", sans-serif;
      --bg: #0c0d0f;
      --panel: #141518;
      --panel-2: #18191d;
      --panel-3: #101113;
      --line: rgba(255,255,255,.08);
      --line-strong: rgba(255,255,255,.14);
      --text: #f3f3f0;
      --muted: #989a96;
      --quiet: #676966;
      --good: #79c99a;
      --good-soft: rgba(121,201,154,.1);
      --warn: #d6ad67;
      --warn-soft: rgba(214,173,103,.1);
      --bad: #e27c82;
      --bad-soft: rgba(226,124,130,.1);
      --primary: #ecece8;
      --primary-text: #151619;
    }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    button, select { font: inherit; }
    button { cursor: pointer; }
    button:disabled { cursor: default; opacity: .38; }
    :where(button, select):focus-visible {
      outline: 2px solid rgba(170, 221, 190, .92);
      outline-offset: 2px;
    }
    .app {
      width: min(1100px, calc(100% - 28px));
      height: 100vh;
      margin: 0 auto;
      padding: 14px 0;
      display: grid;
      grid-template-rows: 42px auto minmax(0, 1fr);
      gap: 10px;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-width: 0;
      padding: 0 2px;
    }
    .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .brand-mark {
      width: 28px;
      height: 28px;
      display: grid;
      place-items: center;
      border: 1px solid var(--line-strong);
      border-radius: 8px;
      background: var(--panel-2);
      color: #d8d9d5;
      font-size: 12px;
      font-weight: 760;
      letter-spacing: -.04em;
    }
    .brand-copy { min-width: 0; }
    .brand-title { margin: 0; font-size: 14px; line-height: 1.15; font-weight: 720; letter-spacing: -.02em; }
    .brand-subtitle { margin-top: 2px; color: var(--quiet); font-size: 10.5px; line-height: 1.2; }
    .top-actions { display: flex; align-items: center; gap: 8px; }
    .host-pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 28px;
      padding: 0 10px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255,255,255,.025);
      color: var(--muted);
      font-size: 10.5px;
      font-weight: 640;
      white-space: nowrap;
    }
    .dot {
      width: 7px;
      height: 7px;
      flex: 0 0 auto;
      border-radius: 50%;
      background: var(--warn);
      box-shadow: 0 0 0 3px rgba(214,173,103,.08);
    }
    .dot.good { background: var(--good); box-shadow: 0 0 0 3px rgba(121,201,154,.08); }
    .dot.bad { background: var(--bad); box-shadow: 0 0 0 3px rgba(226,124,130,.08); }
    .toolbar-button,
    .language {
      height: 28px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: transparent;
      color: var(--muted);
      font-size: 10.5px;
    }
    .toolbar-button { padding: 0 10px; font-weight: 620; }
    .toolbar-button:hover { border-color: var(--line-strong); background: rgba(255,255,255,.035); color: #d7d8d4; }
    .language { padding: 0 24px 0 8px; }
    .error {
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 9px 11px;
      border: 1px solid rgba(226,124,130,.24);
      border-radius: 10px;
      background: var(--bad-soft);
      color: #efb3b7;
      font-size: 10.5px;
    }
    .error.show { display: flex; }
    .dashboard {
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 332px;
      gap: 12px;
      position: relative;
      overflow: hidden;
    }
    .left-column {
      min-width: 0;
      min-height: 0;
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      gap: 12px;
    }
    .card {
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--panel);
      overflow: hidden;
    }
    .overview-card { padding: 18px 20px 15px; }
    .overview-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 15px;
    }
    .overview-state { min-width: 0; }
    .eyebrow {
      color: var(--quiet);
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .overview-title-row { display: flex; align-items: center; gap: 9px; margin-top: 6px; }
    .overview-title {
      margin: 0;
      font-size: 22px;
      line-height: 1.15;
      font-weight: 700;
      letter-spacing: -.035em;
    }
    .overview-copy { margin-top: 5px; color: var(--muted); font-size: 11px; line-height: 1.35; }
    .sync-block { text-align: right; flex: 0 0 auto; }
    .sync-label { color: var(--quiet); font-size: 9px; }
    .sync-value { margin-top: 3px; color: var(--muted); font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; }
    .status-strip {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      border: 1px solid var(--line);
      border-radius: 11px;
      overflow: hidden;
      background: var(--panel-3);
    }
    .status-item { min-width: 0; padding: 11px 12px; }
    .status-item + .status-item { border-left: 1px solid var(--line); }
    .status-label { color: var(--quiet); font-size: 9.5px; font-weight: 650; }
    .status-value { margin-top: 4px; font-size: 12px; line-height: 1.25; font-weight: 660; }
    .status-detail {
      margin-top: 3px;
      color: var(--muted);
      font-size: 9.5px;
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .workspace-row {
      display: flex;
      align-items: center;
      gap: 9px;
      margin-top: 11px;
      min-width: 0;
      color: var(--quiet);
      font-size: 10px;
    }
    .workspace-path {
      min-width: 0;
      color: var(--muted);
      font: 10px ui-monospace, SFMono-Regular, Menlo, monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pending-card { display: none; padding: 12px 14px; border-color: rgba(214,173,103,.24); background: var(--warn-soft); }
    .pending-card.visible { display: block; }
    .pending-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
    .pending-title { margin: 0; font-size: 11px; font-weight: 690; }
    .pending-count { color: var(--warn); font-size: 10px; font-variant-numeric: tabular-nums; }
    .pending-desc { color: var(--muted); font-size: 9.5px; line-height: 1.3; }
    .request-list { margin-top: 6px; max-height: 92px; overflow: auto; }
    .request {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 7px 0;
      border-top: 1px solid rgba(255,255,255,.07);
    }
    .request-main { min-width: 0; }
    .approval-code { font: 720 12.5px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .07em; }
    .row-meta { margin-top: 2px; color: var(--muted); font-size: 9.5px; line-height: 1.3; overflow-wrap: anywhere; }
    .devices-card { min-height: 0; display: flex; flex-direction: column; }
    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 14px 16px 11px;
      border-bottom: 1px solid var(--line);
    }
    .card-title { margin: 0; font-size: 12px; font-weight: 690; letter-spacing: -.01em; }
    .card-subtitle { margin-top: 2px; color: var(--quiet); font-size: 9.5px; }
    .device-count { color: var(--quiet); font-size: 10px; font-variant-numeric: tabular-nums; }
    .device-list { min-height: 0; flex: 1 1 auto; overflow: auto; padding: 0 16px; }
    .device {
      min-height: 48px;
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid var(--line);
    }
    .device:last-child { border-bottom: 0; }
    .device-icon {
      width: 26px;
      height: 26px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: var(--panel-2);
      border: 1px solid var(--line);
      color: var(--muted);
      font-size: 10px;
      font-weight: 700;
    }
    .device-main { min-width: 0; padding: 8px 0; }
    .row-title { font-size: 11px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .empty { padding: 17px 0; color: var(--muted); font-size: 10.5px; line-height: 1.45; }
    .pair-card {
      min-height: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 18px;
      background: var(--panel-3);
    }
    .pair-head { flex: 0 0 auto; }
    .pair-head-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .pair-title { margin: 6px 0 0; font-size: 17px; line-height: 1.2; font-weight: 690; letter-spacing: -.025em; }
    .pair-desc { margin-top: 5px; color: var(--muted); font-size: 10.5px; line-height: 1.4; }
    .qr-stage {
      flex: 1 1 auto;
      min-height: 0;
      display: grid;
      place-items: center;
      padding: 14px 0 10px;
    }
    .qr-wrap {
      width: min(100%, 248px);
      aspect-ratio: 1;
      display: grid;
      place-items: center;
      padding: 12px;
      border-radius: 14px;
      background: #f4f4ef;
      box-shadow: inset 0 0 0 1px rgba(0,0,0,.08), 0 10px 28px rgba(0,0,0,.16);
    }
    #pairing-qr { display: none; width: 100%; height: auto; image-rendering: pixelated; }
    #pairing-qr.ready { display: block; }
    .qr-fallback { display: none; margin: 0; max-width: 100%; overflow: hidden; color: #111; font: 6px/.86 ui-monospace, monospace; white-space: pre; }
    .qr-fallback.show { display: block; }
    .qr-loading { max-width: 180px; color: #60615d; text-align: center; font-size: 10px; line-height: 1.4; }
    .pair-actions { flex: 0 0 auto; }
    .pair-note { margin-top: 7px; color: var(--quiet); font-size: 9.5px; line-height: 1.35; }
    .btn {
      min-height: 28px;
      padding: 0 9px;
      border: 1px solid var(--line-strong);
      border-radius: 8px;
      background: transparent;
      color: #d6d7d3;
      font-size: 10px;
      font-weight: 650;
      transition: background .12s ease, border-color .12s ease, transform .12s ease;
    }
    .btn:hover:not(:disabled) { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.19); }
    .btn:active:not(:disabled) { transform: translateY(1px); }
    .btn.primary { width: 100%; min-height: 34px; background: var(--primary); border-color: var(--primary); color: var(--primary-text); }
    .btn.primary:hover:not(:disabled) { background: #f7f7f3; border-color: #f7f7f3; }
    .btn.quiet { border-color: transparent; color: var(--muted); padding-left: 6px; padding-right: 6px; }
    .btn.danger { color: #dca5a8; border-color: rgba(226,124,130,.2); }
    .actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .drawer-backdrop {
      display: none;
      position: absolute;
      inset: 0;
      z-index: 30;
      background: rgba(3,4,5,.5);
      backdrop-filter: blur(2px);
    }
    .drawer-backdrop.open { display: block; }
    .drawer {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 31;
      width: min(470px, 74%);
      display: flex;
      flex-direction: column;
      border-left: 1px solid var(--line-strong);
      background: #18191c;
      box-shadow: -22px 0 54px rgba(0,0,0,.34);
      transform: translateX(102%);
      transition: transform .16s ease;
    }
    .drawer.open { transform: translateX(0); }
    .drawer-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 17px 18px 13px;
      border-bottom: 1px solid var(--line);
    }
    .drawer-title { margin: 0; font-size: 13px; font-weight: 700; }
    .drawer-subtitle { margin-top: 3px; color: var(--muted); font-size: 9.5px; line-height: 1.35; }
    .drawer-body { min-height: 0; flex: 1 1 auto; overflow: auto; padding: 7px 18px 16px; }
    .technical {
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr);
      gap: 8px 12px;
      padding: 9px 0;
      border-bottom: 1px solid var(--line);
      font-size: 10px;
      line-height: 1.35;
    }
    .technical-label { color: var(--quiet); }
    .technical-value { color: var(--muted); overflow-wrap: anywhere; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .drawer-actions { padding: 12px 0 4px; }
    .diag-list { margin-top: 8px; border-top: 1px solid var(--line); }
    .diag {
      display: grid;
      grid-template-columns: 7px 80px minmax(0, 1fr);
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid var(--line);
      font-size: 9.5px;
    }
    .diag-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--good); }
    .diag-dot.warn { background: var(--warn); }
    .diag-dot.bad { background: var(--bad); }
    .diag-value { color: var(--muted); overflow-wrap: anywhere; }
    .danger-zone { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 0 2px; }
    .danger-copy { color: var(--quiet); font-size: 9.5px; line-height: 1.35; }
    .toast {
      position: fixed;
      right: 18px;
      bottom: 16px;
      z-index: 60;
      max-width: 320px;
      padding: 9px 11px;
      border-radius: 9px;
      background: #ecece8;
      color: #17181a;
      font-size: 10px;
      font-weight: 680;
      opacity: 0;
      transform: translateY(6px);
      pointer-events: none;
      transition: opacity .15s ease, transform .15s ease;
      box-shadow: 0 14px 38px rgba(0,0,0,.3);
    }
    .toast.show { opacity: 1; transform: translateY(0); }
    @media (max-width: 820px) {
      html, body { height: auto; min-height: 100%; overflow: auto; }
      .app { width: min(700px, calc(100% - 24px)); height: auto; min-height: 100vh; display: block; padding: 12px 0 20px; }
      .topbar { margin-bottom: 10px; }
      .dashboard { grid-template-columns: 1fr; overflow: visible; }
      .left-column { display: grid; }
      .pair-card { min-height: 500px; }
      .drawer { position: fixed; width: min(470px, 92vw); }
      .drawer-backdrop { position: fixed; }
      .device-list, .request-list { overflow: visible; max-height: none; }
    }
    @media (max-width: 560px) {
      .brand-subtitle, .host-pill { display: none; }
      .status-strip { grid-template-columns: 1fr; }
      .status-item + .status-item { border-left: 0; border-top: 1px solid var(--line); }
      .overview-head { display: block; }
      .sync-block { display: none; }
      .drawer { width: 100vw; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { transition: none !important; }
    }
  </style>
</head>
<body>
  <main class="app">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">CR</div>
        <div class="brand-copy">
          <h1 class="brand-title">Codex Relay Plus</h1>
          <div class="brand-subtitle" data-i18n="productNote">Mac Host · 保持运行即可</div>
        </div>
      </div>
      <div class="top-actions">
        <div class="host-pill"><span class="dot" id="top-dot"></span><span id="top-state" data-i18n="connecting">正在连接</span></div>
        <button class="toolbar-button" id="diagnostics-trigger" data-i18n="diagnostics">诊断</button>
        <select class="language" id="language" aria-label="Language"><option value="zh-CN">简体中文</option><option value="en-US">English</option></select>
      </div>
    </header>

    <div class="error" id="error-banner"><span id="error-text"></span><button class="btn quiet" id="retry" data-i18n="retry">重试</button></div>

    <div class="dashboard">
      <section class="left-column">
        <section class="card overview-card">
          <div class="overview-head">
            <div class="overview-state">
              <div class="eyebrow" data-i18n="hostStatus">Host 状态</div>
              <div class="overview-title-row"><span class="dot" id="host-dot"></span><h2 class="overview-title" id="host-title" data-i18n="connectingHost">正在启动</h2></div>
              <div class="overview-copy" id="host-copy" data-i18n="hostCopy">保持此 Mac 在线，手机会自动选择可用连接路径。</div>
            </div>
            <div class="sync-block"><div class="sync-label" data-i18n="lastSync">最近更新</div><div class="sync-value" id="last-sync">—</div></div>
          </div>

          <div class="status-strip" aria-label="Host summary">
            <div class="status-item">
              <div class="status-label" data-i18n="relay">Relay</div>
              <div class="status-value" id="relay-value" data-i18n="loading">加载中…</div>
              <div class="status-detail" id="relay-detail">—</div>
            </div>
            <div class="status-item">
              <div class="status-label" data-i18n="remoteAccess">Tailcat</div>
              <div class="status-value" id="remote-value" data-i18n="loading">加载中…</div>
              <div class="status-detail" id="remote-detail">—</div>
            </div>
            <div class="status-item">
              <div class="status-label" data-i18n="phones">已授权设备</div>
              <div class="status-value" id="phone-count">—</div>
              <div class="status-detail" id="phone-detail" data-i18n="phoneHint">手机</div>
            </div>
          </div>

          <div class="workspace-row"><span data-i18n="workspace">默认工作目录</span><span class="workspace-path" id="workspace-value">—</span></div>
        </section>

        <section class="card pending-card" id="pending-section">
          <div class="pending-head"><h3 class="pending-title" data-i18n="pending">等待你的确认</h3><span class="pending-count" id="pending-count">0</span></div>
          <div class="pending-desc" data-i18n="pendingDesc">只允许你刚刚发起配对的手机。</div>
          <div class="request-list" id="pending-list"></div>
        </section>

        <section class="card devices-card">
          <div class="card-head">
            <div><h3 class="card-title" data-i18n="pairedPhones">已配对设备</h3><div class="card-subtitle" data-i18n="pairedDesc">这些手机可以在 Mac 在线时使用 Relay。</div></div>
            <span class="device-count" id="device-count">0</span>
          </div>
          <div class="device-list" id="session-list"><div class="empty" data-i18n="loading">加载中…</div></div>
        </section>
      </section>

      <aside class="card pair-card">
        <div class="pair-head">
          <div class="pair-head-row"><span class="eyebrow" data-i18n="pairing">配对</span><button class="btn quiet" id="pair-refresh" data-i18n="refreshShort">刷新</button></div>
          <h3 class="pair-title" data-i18n="pairPhone">添加手机</h3>
          <div class="pair-desc" data-i18n="scanHint">在 Codex Relay mobile 中扫描二维码。首次连接会要求确认。</div>
        </div>
        <div class="qr-stage">
          <div class="qr-wrap">
            <canvas id="pairing-qr" aria-label="Pairing QR code"></canvas>
            <pre class="qr-fallback" id="pairing-qr-fallback"></pre>
            <div class="qr-loading" id="qr-loading" data-i18n="loadingQr">正在准备安全配对码…</div>
          </div>
        </div>
        <div class="pair-actions">
          <button class="btn primary" id="copy-pair" disabled data-i18n="copyPair">复制配对链接</button>
          <div class="pair-note" data-i18n="pairNote">扫不了二维码时，把配对链接发到手机并用 Codex Relay mobile 打开。</div>
        </div>
      </aside>

      <div class="drawer-backdrop" id="drawer-backdrop"></div>
      <aside class="drawer" id="diagnostics-drawer" aria-hidden="true">
        <div class="drawer-head">
          <div><h3 class="drawer-title" data-i18n="advanced">高级与诊断</h3><div class="drawer-subtitle" data-i18n="advancedHint">连接地址和运行状态仅用于排查问题。</div></div>
          <button class="btn quiet" id="diagnostics-close" data-i18n="close">关闭</button>
        </div>
        <div class="drawer-body">
          <div class="technical"><span class="technical-label" data-i18n="connectionAddress">Relay 连接地址</span><span class="technical-value mono" id="connect-url">—</span></div>
          <div class="technical"><span class="technical-label" data-i18n="relayPort">Relay 端口</span><span class="technical-value mono" id="relay-port">—</span></div>
          <div class="technical"><span class="technical-label" data-i18n="tailcatNode">Tailcat 节点</span><span class="technical-value mono" id="tailcat-node">—</span></div>
          <div class="technical"><span class="technical-label" data-i18n="tailcatPort">Tailcat 端口</span><span class="technical-value mono" id="tailcat-port">—</span></div>
          <div class="technical"><span class="technical-label" data-i18n="codexService">Codex 服务</span><span class="technical-value" id="codex-service">—</span></div>
          <div class="drawer-actions actions">
            <button class="btn" id="copy-address" disabled data-i18n="copyAddress">复制 Relay 地址</button>
            <button class="btn" id="refresh" data-i18n="refresh">刷新状态</button>
          </div>
          <div class="diag-list" id="diagnostics"></div>
          <div class="danger-zone">
            <span class="danger-copy" data-i18n="disconnectAllHint">移除全部手机授权，不影响 Mac 上的 Codex 数据。</span>
            <button class="btn danger" id="clear-all" disabled data-i18n="disconnectAll">断开全部</button>
          </div>
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
      var translations = {
        "zh-CN": {
          productNote: "Mac Host · 保持运行即可",
          connecting: "正在连接",
          online: "Host 在线",
          failed: "连接失败",
          retry: "重试",
          hostStatus: "HOST 状态",
          connectingHost: "正在启动",
          hostReady: "Mac 已就绪",
          hostCopy: "保持此 Mac 在线，手机会自动选择可用连接路径。",
          hostReadyCopy: "Relay 和配对服务已准备好，可以从手机继续。",
          lastSync: "最近更新",
          relay: "Relay",
          relayReady: "运行中",
          remoteAccess: "Tailcat",
          remoteReady: "已就绪",
          remoteStarting: "正在启动",
          remoteDisabled: "已关闭",
          remoteDisabledDetail: "仅局域网 · 菜单栏可重新开启",
          remoteUnavailable: "未集成",
          lanStillAvailable: "局域网仍可用",
          workspace: "默认工作目录",
          phones: "已授权设备",
          phoneHint: "手机",
          phoneUnit: " 台",
          pending: "等待你的确认",
          pendingDesc: "只允许你刚刚发起配对的手机。",
          pairedPhones: "已配对设备",
          pairedDesc: "这些手机可以在 Mac 在线时使用 Relay。",
          diagnostics: "诊断",
          advanced: "高级与诊断",
          advancedHint: "连接地址和运行状态仅用于排查问题。",
          close: "关闭",
          connectionAddress: "Relay 连接地址",
          relayPort: "Relay 端口",
          tailcatNode: "Tailcat 节点",
          tailcatPort: "Tailcat 端口",
          codexService: "Codex 服务",
          sharedCodex: "共享服务已就绪",
          privateCodex: "私有服务回退",
          copyAddress: "复制 Relay 地址",
          refresh: "刷新状态",
          refreshShort: "刷新",
          disconnectAllHint: "移除全部手机授权，不影响 Mac 上的 Codex 数据。",
          disconnectAll: "断开全部",
          pairing: "配对",
          pairPhone: "添加手机",
          scanHint: "在 Codex Relay mobile 中扫描二维码。首次连接会要求确认。",
          loadingQr: "正在准备安全配对码…",
          qrUnavailable: "配对码暂不可用，请刷新后重试。",
          copyPair: "复制配对链接",
          pairNote: "扫不了二维码时，把配对链接发到手机并用 Codex Relay mobile 打开。",
          loading: "加载中…",
          noDevices: "还没有已配对设备。扫描右侧二维码即可添加手机。",
          unknownDevice: "未命名设备",
          approve: "允许",
          reject: "拒绝",
          disconnect: "断开",
          expires: "有效至",
          justNow: "刚刚",
          copied: "已复制",
          copyFailed: "复制失败，请手动复制",
          actionDone: "已完成",
          confirmClear: "确定断开全部已配对手机？"
        },
        "en-US": {
          productNote: "Mac Host · keep it running",
          connecting: "Connecting",
          online: "Host online",
          failed: "Connection failed",
          retry: "Retry",
          hostStatus: "HOST STATUS",
          connectingHost: "Starting",
          hostReady: "Mac is ready",
          hostCopy: "Keep this Mac online. The mobile app chooses an available connection path automatically.",
          hostReadyCopy: "Relay and pairing are ready. Continue from your phone.",
          lastSync: "Last update",
          relay: "Relay",
          relayReady: "Running",
          remoteAccess: "Tailcat",
          remoteReady: "Ready",
          remoteStarting: "Starting",
          remoteDisabled: "Off",
          remoteDisabledDetail: "LAN only · re-enable from the menu bar",
          remoteUnavailable: "Not included",
          lanStillAvailable: "LAN remains available",
          workspace: "Default workspace",
          phones: "Authorized devices",
          phoneHint: "Phones",
          phoneUnit: "",
          pending: "Waiting for approval",
          pendingDesc: "Only approve the phone you just paired.",
          pairedPhones: "Paired devices",
          pairedDesc: "These phones can use Relay while this Mac is online.",
          diagnostics: "Diagnostics",
          advanced: "Advanced & diagnostics",
          advancedHint: "Connection addresses and runtime details are for troubleshooting only.",
          close: "Close",
          connectionAddress: "Relay connection address",
          relayPort: "Relay port",
          tailcatNode: "Tailcat node",
          tailcatPort: "Tailcat port",
          codexService: "Codex service",
          sharedCodex: "Shared service ready",
          privateCodex: "Private service fallback",
          copyAddress: "Copy Relay address",
          refresh: "Refresh status",
          refreshShort: "Refresh",
          disconnectAllHint: "Remove all phone authorizations without touching Codex data on this Mac.",
          disconnectAll: "Disconnect all",
          pairing: "PAIRING",
          pairPhone: "Add phone",
          scanHint: "Scan this QR code in Codex Relay mobile. The first connection will ask for approval.",
          loadingQr: "Preparing secure pairing code…",
          qrUnavailable: "Pairing code is unavailable. Refresh and try again.",
          copyPair: "Copy pairing link",
          pairNote: "If you cannot scan the QR code, send the pairing link to your phone and open it with Codex Relay mobile.",
          loading: "Loading…",
          noDevices: "No paired devices yet. Scan the QR code to add a phone.",
          unknownDevice: "Unnamed device",
          approve: "Allow",
          reject: "Reject",
          disconnect: "Disconnect",
          expires: "Expires",
          justNow: "Just now",
          copied: "Copied",
          copyFailed: "Copy failed; copy it manually",
          actionDone: "Done",
          confirmClear: "Disconnect every paired phone?"
        }
      };
      var language = localStorage.getItem("codex-relay-language") || (navigator.language && navigator.language.toLowerCase().indexOf("zh") === 0 ? "zh-CN" : "en-US");
      if (!translations[language]) language = "zh-CN";

      function byId(id) { return document.getElementById(id); }
      function t(key) { return translations[language][key] || key; }
      function each(selector, callback) { Array.prototype.forEach.call(document.querySelectorAll(selector), callback); }
      function escape(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
          if (char === "&") return "&amp;";
          if (char === "<") return "&lt;";
          if (char === ">") return "&gt;";
          if (char === '"') return "&quot;";
          return "&#39;";
        });
      }
      function applyLanguage() {
        document.documentElement.lang = language;
        byId("language").value = language;
        each("[data-i18n]", function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
        render();
      }
      function api(path, options) {
        options = options || {};
        options.headers = Object.assign({}, options.headers || {}, { "x-codex-relay-control-token": token });
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
        toast.timer = setTimeout(function () { el.classList.remove("show"); }, 1600);
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
      function setDots(kind) {
        var className = "dot" + (kind === "good" ? " good" : kind === "bad" ? " bad" : "");
        byId("top-dot").className = className;
        byId("host-dot").className = className;
      }
      function setError(error) {
        var message = error && error.message ? error.message : String(error || "Unknown error");
        setDots("bad");
        byId("top-state").textContent = t("failed");
        byId("host-title").textContent = t("failed");
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
        ctx.fillStyle = "#f4f4ef";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#0d0e0f";
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
      function bindActions() {
        each("[data-approve]", function (button) {
          button.onclick = function () { act(api("/api/pairings/" + encodeURIComponent(button.getAttribute("data-approve")) + "/approve", { method: "POST" })); };
        });
        each("[data-reject]", function (button) {
          button.onclick = function () { act(api("/api/pairings/" + encodeURIComponent(button.getAttribute("data-reject")), { method: "DELETE" })); };
        });
        each("[data-disconnect]", function (button) {
          button.onclick = function () { act(api("/api/sessions/" + encodeURIComponent(button.getAttribute("data-disconnect")), { method: "DELETE" })); };
        });
      }
      function render() {
        if (!state) return;
        clearError();
        setDots("good");
        byId("top-state").textContent = t("online");
        byId("host-title").textContent = t("hostReady");
        byId("host-copy").textContent = t("hostReadyCopy");
        byId("relay-value").textContent = t("relayReady");
        byId("relay-detail").textContent = "PID " + state.relay.pid + " · :" + state.relay.port;
        byId("workspace-value").textContent = state.relay.workspacePath || "—";
        byId("phone-count").textContent = String(state.sessions.length) + t("phoneUnit");
        byId("phone-detail").textContent = t("phoneHint");
        byId("device-count").textContent = String(state.sessions.length);

        var tailcat = state.tailcat || {};
        if (tailcat.ready) {
          byId("remote-value").textContent = t("remoteReady");
          byId("remote-detail").textContent = (tailcat.address || "—") + (tailcat.port ? " · :" + tailcat.port : "");
        } else if (tailcat.configured && tailcat.enabled === false) {
          byId("remote-value").textContent = t("remoteDisabled");
          byId("remote-detail").textContent = t("remoteDisabledDetail");
        } else if (tailcat.configured) {
          byId("remote-value").textContent = t("remoteStarting");
          byId("remote-detail").textContent = t("lanStillAvailable");
        } else {
          byId("remote-value").textContent = t("remoteUnavailable");
          byId("remote-detail").textContent = t("lanStillAvailable");
        }

        byId("connect-url").textContent = state.relay.connectUrl || "—";
        byId("relay-port").textContent = String(state.relay.port || "—");
        byId("tailcat-node").textContent = tailcat.address || "—";
        byId("tailcat-port").textContent = tailcat.port ? String(tailcat.port) : "—";
        byId("codex-service").textContent = state.relay.sharedAppServerRemoteAddress ? t("sharedCodex") : t("privateCodex");
        byId("copy-address").disabled = !state.relay.connectUrl;
        byId("copy-pair").disabled = !state.pairingPayload;
        byId("clear-all").disabled = !state.sessions.length;

        drawQr(state.pairingQr || "");

        var pendingSection = byId("pending-section");
        var pendingList = byId("pending-list");
        pendingSection.classList.toggle("visible", state.pendingPairings.length > 0);
        byId("pending-count").textContent = String(state.pendingPairings.length);
        pendingList.innerHTML = state.pendingPairings.map(function (item) {
          return '<div class="request"><div class="request-main"><div class="approval-code">' + escape(item.approvalCode) + '</div><div class="row-meta">' + escape(item.clientName || t("unknownDevice")) + ' · ' + t("expires") + ' ' + escape(new Date(item.expiresAt).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })) + '</div></div><div class="actions"><button class="btn" data-reject="' + escape(item.approvalCode) + '">' + t("reject") + '</button><button class="btn" data-approve="' + escape(item.approvalCode) + '">' + t("approve") + '</button></div></div>';
        }).join("");

        var sessions = byId("session-list");
        sessions.innerHTML = state.sessions.length ? state.sessions.map(function (item) {
          return '<div class="device"><div class="device-icon">M</div><div class="device-main"><div class="row-title">' + escape(item.clientName || t("unknownDevice")) + '</div><div class="row-meta mono">' + escape(item.clientSessionId || item.displayId) + ' · ' + escape(relativeTime(item.updatedAt)) + '</div></div><button class="btn quiet" data-disconnect="' + escape(item.tokenHash) + '">' + t("disconnect") + '</button></div>';
        }).join("") : '<div class="empty">' + t("noDevices") + '</div>';

        var diagnostics = byId("diagnostics");
        diagnostics.innerHTML = state.diagnostics && state.diagnostics.length ? state.diagnostics.map(function (item) {
          return '<div class="diag"><span class="diag-dot ' + escape(item.status) + '"></span><strong>' + escape(item.label) + '</strong><span class="diag-value mono">' + escape(item.value) + '</span></div>';
        }).join("") : "";

        byId("last-sync").textContent = new Date().toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
        bindActions();
      }
      function refresh() {
        if (refreshing) return Promise.resolve();
        refreshing = true;
        return api("/api/state").then(function (next) {
          state = next;
          render();
        }).catch(setError).then(function () { refreshing = false; });
      }
      function setDrawer(open) {
        byId("diagnostics-drawer").classList.toggle("open", open);
        byId("drawer-backdrop").classList.toggle("open", open);
        byId("diagnostics-drawer").setAttribute("aria-hidden", open ? "false" : "true");
      }

      byId("language").onchange = function (event) {
        language = event.target.value;
        localStorage.setItem("codex-relay-language", language);
        applyLanguage();
      };
      byId("diagnostics-trigger").onclick = function () { setDrawer(true); };
      byId("diagnostics-close").onclick = function () { setDrawer(false); };
      byId("drawer-backdrop").onclick = function () { setDrawer(false); };
      byId("copy-address").onclick = function () { copy(state && state.relay.connectUrl); };
      byId("copy-pair").onclick = function () { copy(state && state.pairingPayload); };
      byId("refresh").onclick = refresh;
      byId("pair-refresh").onclick = refresh;
      byId("retry").onclick = refresh;
      byId("clear-all").onclick = function () {
        if (!state || !state.sessions.length || !confirm(t("confirmClear"))) return;
        act(api("/api/sessions/clear", { method: "POST" }));
      };
      document.addEventListener("keydown", function (event) { if (event.key === "Escape") setDrawer(false); });
      document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });

      applyLanguage();
      refresh();
      setInterval(function () { if (!document.hidden) refresh(); }, 3000);
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
