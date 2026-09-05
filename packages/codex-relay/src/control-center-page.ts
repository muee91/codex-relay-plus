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
      --bg: #101113;
      --surface: #17181b;
      --surface-raised: #1c1d20;
      --surface-soft: #141517;
      --line: rgba(255,255,255,.075);
      --line-strong: rgba(255,255,255,.13);
      --text: #f0f0ed;
      --muted: #969793;
      --quiet: #666864;
      --good: #7bc99b;
      --warn: #d7b16c;
      --bad: #e77d82;
      --button: #e8e8e3;
      --button-text: #18191b;
    }
    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    button, select { font: inherit; }
    button { cursor: pointer; }
    button:disabled { cursor: default; opacity: .4; }
    :where(button, select, summary):focus-visible {
      outline: 2px solid rgba(188, 225, 201, .9);
      outline-offset: 3px;
    }
    .shell {
      width: min(1060px, calc(100% - 48px));
      margin: 0 auto;
      padding: 34px 0 48px;
    }
    .masthead {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 24px;
      padding: 0 2px 18px;
    }
    .identity { min-width: 0; }
    .product {
      margin: 0;
      font-size: 18px;
      line-height: 1.15;
      font-weight: 710;
      letter-spacing: -.025em;
    }
    .product-note {
      margin-top: 6px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
    }
    .mast-actions { display: flex; align-items: center; gap: 11px; }
    .live-state {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 620;
      white-space: nowrap;
    }
    .state-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--warn);
      box-shadow: 0 0 0 3px rgba(215,177,108,.09);
      flex: 0 0 auto;
    }
    .state-dot.good { background: var(--good); box-shadow: 0 0 0 3px rgba(123,201,155,.09); }
    .state-dot.bad { background: var(--bad); box-shadow: 0 0 0 3px rgba(231,125,130,.09); }
    .language {
      height: 30px;
      padding: 0 25px 0 9px;
      border: 1px solid var(--line);
      border-radius: 7px;
      background: transparent;
      color: var(--muted);
      font-size: 11px;
    }
    .error {
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 12px;
      padding: 11px 13px;
      border: 1px solid rgba(231,125,130,.25);
      border-radius: 10px;
      background: rgba(231,125,130,.065);
      color: #efb5b8;
      font-size: 11px;
      line-height: 1.45;
    }
    .error.show { display: flex; }
    .workspace {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 350px;
      min-height: 610px;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 20px;
      background: var(--surface);
      box-shadow: 0 24px 70px rgba(0,0,0,.19);
    }
    .main-pane { min-width: 0; padding: 30px 32px 28px; }
    .pair-pane {
      min-width: 0;
      padding: 28px;
      border-left: 1px solid var(--line);
      background: var(--surface-soft);
    }
    .hero { padding-bottom: 27px; }
    .hero-kicker {
      color: var(--quiet);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .105em;
      text-transform: uppercase;
    }
    .hero-title-row {
      display: flex;
      align-items: center;
      gap: 11px;
      margin-top: 12px;
    }
    .hero-dot { width: 10px; height: 10px; }
    .hero-title {
      margin: 0;
      font-size: clamp(26px, 3vw, 38px);
      line-height: 1.06;
      font-weight: 690;
      letter-spacing: -.045em;
    }
    .hero-copy {
      max-width: 590px;
      margin: 12px 0 0 21px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.58;
    }
    .facts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }
    .fact {
      min-width: 0;
      min-height: 99px;
      padding: 18px 18px 17px 0;
    }
    .fact:nth-child(even) { padding-left: 20px; border-left: 1px solid var(--line); }
    .fact:nth-child(n+3) { border-top: 1px solid var(--line); }
    .fact-label {
      color: var(--quiet);
      font-size: 10px;
      font-weight: 680;
      letter-spacing: .04em;
    }
    .fact-value {
      margin-top: 8px;
      color: var(--text);
      font-size: 14px;
      font-weight: 650;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .fact-detail {
      margin-top: 4px;
      color: var(--muted);
      font-size: 10.5px;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }
    .section { padding: 25px 0 0; }
    .section + .section { margin-top: 24px; border-top: 1px solid var(--line); }
    .section-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 13px;
    }
    .section-title { margin: 0; font-size: 12px; font-weight: 690; letter-spacing: -.01em; }
    .section-desc { margin-top: 4px; color: var(--muted); font-size: 10.5px; line-height: 1.45; }
    .count { color: var(--quiet); font-size: 10px; font-variant-numeric: tabular-nums; }
    .pending-section { display: none; }
    .pending-section.visible { display: block; }
    .request {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 13px 0;
      border-top: 1px solid var(--line);
    }
    .request:first-child { border-top: 0; }
    .request-main { min-width: 0; }
    .approval-code {
      font: 720 15px/1.1 ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: .08em;
    }
    .row-title { font-size: 12px; font-weight: 640; overflow-wrap: anywhere; }
    .row-meta { margin-top: 4px; color: var(--muted); font-size: 10px; line-height: 1.4; overflow-wrap: anywhere; }
    .device-list { display: grid; }
    .device {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      min-height: 53px;
      border-top: 1px solid var(--line);
    }
    .device:first-child { border-top: 0; }
    .device-main { min-width: 0; padding: 11px 0; }
    .empty {
      padding: 17px 0 2px;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.5;
    }
    .actions { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
    .btn {
      min-height: 31px;
      padding: 0 10px;
      border: 1px solid var(--line-strong);
      border-radius: 8px;
      background: transparent;
      color: #d8d8d5;
      font-size: 10.5px;
      font-weight: 650;
      transition: background .12s ease, border-color .12s ease, transform .12s ease;
    }
    .btn:hover:not(:disabled) { background: rgba(255,255,255,.055); border-color: rgba(255,255,255,.18); }
    .btn:active:not(:disabled) { transform: translateY(1px); }
    .btn.primary { background: var(--button); border-color: var(--button); color: var(--button-text); }
    .btn.primary:hover:not(:disabled) { background: #f4f4ef; border-color: #f4f4ef; }
    .btn.danger { color: #dca5a8; border-color: rgba(231,125,130,.18); }
    .btn.quiet { border-color: transparent; color: var(--muted); padding-left: 6px; padding-right: 6px; }
    .pair-head { margin-bottom: 20px; }
    .pair-index {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .pair-label {
      color: var(--quiet);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: .09em;
      text-transform: uppercase;
    }
    .pair-title { margin: 8px 0 0; font-size: 19px; line-height: 1.2; font-weight: 680; letter-spacing: -.025em; }
    .pair-desc { margin-top: 7px; color: var(--muted); font-size: 11px; line-height: 1.5; }
    .qr-wrap {
      display: grid;
      place-items: center;
      width: 100%;
      aspect-ratio: 1;
      padding: 18px;
      border-radius: 15px;
      background: #f5f5f0;
      box-shadow: inset 0 0 0 1px rgba(0,0,0,.06);
    }
    #pairing-qr { display: none; width: 100%; height: auto; image-rendering: pixelated; }
    #pairing-qr.ready { display: block; }
    .qr-fallback { display: none; margin: 0; max-width: 100%; overflow: hidden; color: #111; font: 6px/.86 ui-monospace, monospace; white-space: pre; }
    .qr-fallback.show { display: block; }
    .qr-loading { max-width: 180px; color: #63645f; text-align: center; font-size: 10.5px; line-height: 1.45; }
    .pair-primary { display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 13px; }
    .pair-primary .btn { min-height: 35px; }
    .pair-note { margin-top: 12px; color: var(--quiet); font-size: 9.5px; line-height: 1.5; }
    details.advanced { margin-top: 25px; border-top: 1px solid var(--line); }
    details.advanced summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-height: 46px;
      list-style: none;
      cursor: pointer;
      color: var(--muted);
      font-size: 10.5px;
      font-weight: 640;
      user-select: none;
    }
    details.advanced summary::-webkit-details-marker { display: none; }
    .chevron { color: var(--quiet); transition: transform .14s ease; }
    details[open] .chevron { transform: rotate(90deg); }
    .advanced-body { padding: 2px 0 4px; }
    .technical {
      display: grid;
      grid-template-columns: 100px minmax(0, 1fr);
      gap: 7px 12px;
      padding: 9px 0;
      border-top: 1px solid var(--line);
      font-size: 9.5px;
      line-height: 1.45;
    }
    .technical-label { color: var(--quiet); }
    .technical-value { color: var(--muted); overflow-wrap: anywhere; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .diag-list { margin-top: 9px; border-top: 1px solid var(--line); }
    .diag {
      display: grid;
      grid-template-columns: 7px 74px minmax(0,1fr);
      align-items: center;
      gap: 9px;
      padding: 9px 0;
      border-bottom: 1px solid var(--line);
      font-size: 9.5px;
    }
    .diag-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--good); }
    .diag-dot.warn { background: var(--warn); }
    .diag-dot.bad { background: var(--bad); }
    .diag-value { color: var(--muted); overflow-wrap: anywhere; }
    .danger-zone { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0 4px; }
    .danger-copy { color: var(--quiet); font-size: 9.5px; line-height: 1.4; }
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 13px 3px 0;
      color: #555753;
      font-size: 9px;
    }
    .toast {
      position: fixed;
      right: 20px;
      bottom: 20px;
      max-width: 320px;
      padding: 10px 12px;
      border-radius: 9px;
      background: #e7e7e2;
      color: #17181a;
      font-size: 10.5px;
      font-weight: 680;
      opacity: 0;
      transform: translateY(6px);
      pointer-events: none;
      transition: opacity .15s ease, transform .15s ease;
      box-shadow: 0 14px 38px rgba(0,0,0,.3);
    }
    .toast.show { opacity: 1; transform: translateY(0); }
    @media (max-width: 820px) {
      .shell { width: min(700px, calc(100% - 28px)); padding-top: 22px; }
      .workspace { grid-template-columns: 1fr; }
      .pair-pane { border-left: 0; border-top: 1px solid var(--line); }
      .qr-wrap { max-width: 330px; margin: 0 auto; }
    }
    @media (max-width: 540px) {
      .shell { width: calc(100% - 20px); }
      .masthead { align-items: flex-start; }
      .mast-actions { flex-direction: column-reverse; align-items: flex-end; }
      .main-pane, .pair-pane { padding: 22px 20px; }
      .facts { grid-template-columns: 1fr; }
      .fact:nth-child(even) { padding-left: 0; border-left: 0; }
      .fact:nth-child(n+2) { border-top: 1px solid var(--line); }
      .request, .device { align-items: flex-start; }
      .pair-primary { grid-template-columns: 1fr; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="masthead">
      <div class="identity">
        <h1 class="product">Codex Relay Plus</h1>
        <div class="product-note" data-i18n="productNote">Mac Host · 平时保持运行即可</div>
      </div>
      <div class="mast-actions">
        <div class="live-state"><span class="state-dot" id="top-dot"></span><span id="top-state" data-i18n="connecting">正在连接</span></div>
        <select class="language" id="language" aria-label="Language"><option value="zh-CN">简体中文</option><option value="en-US">English</option></select>
      </div>
    </header>

    <div class="error" id="error-banner"><span id="error-text"></span><button class="btn quiet" id="retry" data-i18n="retry">重试</button></div>

    <div class="workspace">
      <section class="main-pane">
        <div class="hero">
          <div class="hero-kicker" data-i18n="hostStatus">Host status</div>
          <div class="hero-title-row">
            <span class="state-dot hero-dot" id="hero-dot"></span>
            <h2 class="hero-title" id="hero-title" data-i18n="connectingHost">正在启动本机服务</h2>
          </div>
          <p class="hero-copy" id="hero-copy" data-i18n="hostCopy">保持此 Mac 在线，手机端会自动选择可用连接路径。</p>
        </div>

        <div class="facts" aria-label="Host summary">
          <div class="fact">
            <div class="fact-label" data-i18n="relay">Relay</div>
            <div class="fact-value" id="relay-value" data-i18n="loading">加载中…</div>
            <div class="fact-detail" id="relay-detail">—</div>
          </div>
          <div class="fact">
            <div class="fact-label" data-i18n="remoteAccess">Tailcat 远程访问</div>
            <div class="fact-value" id="remote-value" data-i18n="loading">加载中…</div>
            <div class="fact-detail" id="remote-detail" data-i18n="automaticNetwork">手机端自动选择连接路径</div>
          </div>
          <div class="fact">
            <div class="fact-label" data-i18n="workspace">默认工作目录</div>
            <div class="fact-value mono" id="workspace-value">—</div>
            <div class="fact-detail" data-i18n="workspaceHint">仅用于新会话的默认起点</div>
          </div>
          <div class="fact">
            <div class="fact-label" data-i18n="phones">手机</div>
            <div class="fact-value" id="phone-count">—</div>
            <div class="fact-detail" id="phone-detail" data-i18n="phoneHint">已授权设备</div>
          </div>
        </div>

        <section class="section pending-section" id="pending-section">
          <div class="section-head">
            <div><h3 class="section-title" data-i18n="pending">等待你的确认</h3><div class="section-desc" data-i18n="pendingDesc">只允许你刚刚发起配对的手机。</div></div>
            <span class="count" id="pending-count">0</span>
          </div>
          <div id="pending-list"></div>
        </section>

        <section class="section">
          <div class="section-head">
            <div><h3 class="section-title" data-i18n="pairedPhones">已配对手机</h3><div class="section-desc" data-i18n="pairedDesc">这些设备可以在 Mac 在线时使用 Relay。</div></div>
          </div>
          <div class="device-list" id="session-list"><div class="empty" data-i18n="loading">加载中…</div></div>
        </section>

        <details class="advanced" id="advanced">
          <summary><span data-i18n="advanced">高级与诊断</span><span class="chevron">›</span></summary>
          <div class="advanced-body">
            <div class="technical"><span class="technical-label" data-i18n="connectionAddress">Relay 连接地址</span><span class="technical-value mono" id="connect-url">—</span></div>
            <div class="technical"><span class="technical-label" data-i18n="relayPort">Relay 端口</span><span class="technical-value mono" id="relay-port">—</span></div>
            <div class="technical"><span class="technical-label" data-i18n="tailcatNode">Tailcat 节点</span><span class="technical-value mono" id="tailcat-node">—</span></div>
            <div class="technical"><span class="technical-label" data-i18n="tailcatPort">Tailcat 端口</span><span class="technical-value mono" id="tailcat-port">—</span></div>
            <div class="technical"><span class="technical-label" data-i18n="codexService">Codex 服务</span><span class="technical-value" id="codex-service">—</span></div>
            <div class="actions" style="padding: 7px 0 4px">
              <button class="btn" id="copy-address" disabled data-i18n="copyAddress">复制 Relay 地址</button>
              <button class="btn" id="refresh" data-i18n="refresh">刷新状态</button>
            </div>
            <div class="diag-list" id="diagnostics"></div>
            <div class="danger-zone">
              <span class="danger-copy" data-i18n="disconnectAllHint">移除全部手机授权，不影响 Mac 上的 Codex 数据。</span>
              <button class="btn danger" id="clear-all" disabled data-i18n="disconnectAll">断开全部</button>
            </div>
          </div>
        </details>
      </section>

      <aside class="pair-pane">
        <div class="pair-head">
          <div class="pair-index"><span class="pair-label" data-i18n="pairing">Pairing</span><button class="btn quiet" id="pair-refresh" data-i18n="refreshShort">刷新</button></div>
          <h3 class="pair-title" data-i18n="pairPhone">添加一台手机</h3>
          <div class="pair-desc" data-i18n="scanHint">用移动端扫描二维码。首次连接会在左侧出现确认请求。</div>
        </div>
        <div class="qr-wrap">
          <canvas id="pairing-qr" aria-label="Pairing QR code"></canvas>
          <pre class="qr-fallback" id="pairing-qr-fallback"></pre>
          <div class="qr-loading" id="qr-loading" data-i18n="loadingQr">正在准备安全配对码…</div>
        </div>
        <div class="pair-primary">
          <button class="btn primary" id="copy-pair" disabled data-i18n="copyPair">复制配对链接</button>
        </div>
        <div class="pair-note" data-i18n="pairNote">无法扫码时，复制配对链接发送到手机，并在 Codex Relay mobile 中打开。</div>
      </aside>
    </div>

    <footer class="footer"><span data-i18n="footerNote">正常使用时无需保持此窗口打开。</span><span id="last-sync">—</span></footer>
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
          productNote: "Mac Host · 平时保持运行即可",
          connecting: "正在连接",
          online: "Host 在线",
          failed: "连接失败",
          retry: "重试",
          hostStatus: "HOST STATUS",
          connectingHost: "正在启动本机服务",
          hostReady: "服务已就绪",
          hostCopy: "保持此 Mac 在线，手机端会自动选择可用连接路径。",
          hostReadyCopy: "Mac 端已准备好。接下来通常只需要使用手机。",
          relay: "Relay",
          relayReady: "正在运行",
          remoteAccess: "Tailcat 远程访问",
          remoteReady: "已就绪",
          remoteStarting: "正在启动",
          remoteDisabled: "已关闭",
          remoteUnavailable: "当前 Host 未集成",
          automaticNetwork: "手机端自动选择连接路径",
          lanStillAvailable: "局域网连接仍可用",
          workspace: "默认工作目录",
          workspaceHint: "仅用于新会话的默认起点",
          phones: "手机",
          phoneHint: "已授权设备",
          phoneUnit: " 台已授权",
          pending: "等待你的确认",
          pendingDesc: "只允许你刚刚发起配对的手机。",
          pairedPhones: "已配对手机",
          pairedDesc: "这些设备可以在 Mac 在线时使用 Relay。",
          advanced: "高级与诊断",
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
          pairing: "PAIRING",
          pairPhone: "添加一台手机",
          scanHint: "用移动端扫描二维码。首次连接会在左侧出现确认请求。",
          loadingQr: "正在准备安全配对码…",
          qrUnavailable: "配对码暂不可用，请刷新后重试。",
          copyPair: "复制配对链接",
          pairNote: "无法扫码时，复制配对链接发送到手机，并在 Codex Relay mobile 中打开。",
          footerNote: "正常使用时无需保持此窗口打开。",
          loading: "加载中…",
          noDevices: "还没有已配对手机。扫描右侧二维码即可添加。",
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
          productNote: "Mac Host · designed to stay out of the way",
          connecting: "Connecting",
          online: "Host online",
          failed: "Connection failed",
          retry: "Retry",
          hostStatus: "HOST STATUS",
          connectingHost: "Starting local services",
          hostReady: "Host is ready",
          hostCopy: "Keep this Mac online. The mobile app chooses the best available connection automatically.",
          hostReadyCopy: "The Mac side is ready. You can normally continue from your phone.",
          relay: "Relay",
          relayReady: "Running",
          remoteAccess: "Tailcat remote access",
          remoteReady: "Ready",
          remoteStarting: "Starting",
          remoteDisabled: "Off",
          remoteUnavailable: "Not included in this Host",
          automaticNetwork: "The mobile app chooses the connection path automatically",
          lanStillAvailable: "LAN access remains available",
          workspace: "Default workspace",
          workspaceHint: "Used only as the starting point for new sessions",
          phones: "Phones",
          phoneHint: "Authorized devices",
          phoneUnit: " authorized",
          pending: "Waiting for your approval",
          pendingDesc: "Only approve the phone you just paired.",
          pairedPhones: "Paired phones",
          pairedDesc: "These devices can use Relay while this Mac is online.",
          advanced: "Advanced & diagnostics",
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
          pairPhone: "Add a phone",
          scanHint: "Scan this QR code in the mobile app. The first connection will appear for approval on the left.",
          loadingQr: "Preparing secure pairing code…",
          qrUnavailable: "Pairing code is unavailable. Refresh and try again.",
          copyPair: "Copy pairing link",
          pairNote: "If you cannot scan the QR code, copy the pairing link, send it to your phone, and open it with Codex Relay mobile.",
          footerNote: "You do not need to keep this window open during normal use.",
          loading: "Loading…",
          noDevices: "No paired phones yet. Scan the QR code to add one.",
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
        var className = "state-dot" + (kind === "good" ? " good" : kind === "bad" ? " bad" : "");
        byId("top-dot").className = className;
        byId("hero-dot").className = className + " hero-dot";
      }
      function setError(error) {
        var message = error && error.message ? error.message : String(error || "Unknown error");
        setDots("bad");
        byId("top-state").textContent = t("failed");
        byId("hero-title").textContent = t("failed");
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
        ctx.fillStyle = "#f5f5f0";
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
        byId("hero-title").textContent = t("hostReady");
        byId("hero-copy").textContent = t("hostReadyCopy");
        byId("relay-value").textContent = t("relayReady");
        byId("relay-detail").textContent = "PID " + state.relay.pid + " · :" + state.relay.port;
        byId("workspace-value").textContent = state.relay.workspacePath || "—";
        byId("phone-count").textContent = String(state.sessions.length) + t("phoneUnit");
        byId("phone-detail").textContent = t("phoneHint");

        var tailcat = state.tailcat || {};
        if (tailcat.ready) {
          byId("remote-value").textContent = t("remoteReady");
          byId("remote-detail").textContent = (tailcat.address || "—") + (tailcat.port ? " · :" + tailcat.port : "");
        } else if (tailcat.configured && tailcat.enabled === false) {
          byId("remote-value").textContent = t("remoteDisabled");
          byId("remote-detail").textContent = t("lanStillAvailable");
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
          return '<div class="request"><div class="request-main"><div class="approval-code">' + escape(item.approvalCode) + '</div><div class="row-meta">' + escape(item.clientName || t("unknownDevice")) + ' · ' + t("expires") + ' ' + escape(new Date(item.expiresAt).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })) + '</div></div><div class="actions"><button class="btn" data-reject="' + escape(item.approvalCode) + '">' + t("reject") + '</button><button class="btn primary" data-approve="' + escape(item.approvalCode) + '">' + t("approve") + '</button></div></div>';
        }).join("");

        var sessions = byId("session-list");
        sessions.innerHTML = state.sessions.length ? state.sessions.map(function (item) {
          return '<div class="device"><div class="device-main"><div class="row-title">' + escape(item.clientName || t("unknownDevice")) + '</div><div class="row-meta mono">' + escape(item.clientSessionId || item.displayId) + ' · ' + escape(relativeTime(item.updatedAt)) + '</div></div><button class="btn quiet" data-disconnect="' + escape(item.tokenHash) + '">' + t("disconnect") + '</button></div>';
        }).join("") : '<div class="empty">' + t("noDevices") + '</div>';

        var diagnostics = byId("diagnostics");
        diagnostics.innerHTML = state.diagnostics && state.diagnostics.length ? state.diagnostics.map(function (item) {
          return '<div class="diag"><span class="diag-dot ' + escape(item.status) + '"></span><strong>' + escape(item.label) + '</strong><span class="diag-value mono">' + escape(item.value) + '</span></div>';
        }).join("") : "";

        byId("last-sync").textContent = new Date().toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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

      byId("language").onchange = function (event) {
        language = event.target.value;
        localStorage.setItem("codex-relay-language", language);
        applyLanguage();
      };
      byId("copy-address").onclick = function () { copy(state && state.relay.connectUrl); };
      byId("copy-pair").onclick = function () { copy(state && state.pairingPayload); };
      byId("refresh").onclick = refresh;
      byId("pair-refresh").onclick = refresh;
      byId("retry").onclick = refresh;
      byId("clear-all").onclick = function () {
        if (!state || !state.sessions.length || !confirm(t("confirmClear"))) return;
        act(api("/api/sessions/clear", { method: "POST" }));
      };
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
