import AppKit
import Darwin
import Foundation
import WebKit

private enum C {
  static let name = "Codex Relay Plus"
  static let relayPort = 8787
  static let controlOffset = 2
  static let tailcatEnabledKey = "tailcatRemoteAccessEnabled"
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
  private var window: NSWindow?
  private var webView: WKWebView?
  private var tailcatSwitch: NSSwitch?
  private var tailcatStatusLabel: NSTextField?
  private var tailcatCopyButton: NSButton?
  private var statusItem: NSStatusItem!
  private var relayStatusMenuItem: NSMenuItem!
  private var tailcatStatusMenuItem: NSMenuItem!
  private var tailcatAddressMenuItem: NSMenuItem!
  private var tailcatToggleMenuItem: NSMenuItem!
  private var copyTailcatAddressMenuItem: NSMenuItem!
  private var relay: Process?
  private var relayGroup: pid_t?
  private var logHandle: FileHandle?
  private var tailcatStatusTimer: Timer?
  private var currentTailcatAddress: String?
  private var relayPort = C.relayPort
  private var controlPort = C.relayPort + C.controlOffset
  private var generation = 0
  private var relayReady = false
  private var lastError: String?

  private var tailcatEnabled: Bool {
    get {
      if UserDefaults.standard.object(forKey: C.tailcatEnabledKey) == nil {
        return true
      }
      return UserDefaults.standard.bool(forKey: C.tailcatEnabledKey)
    }
    set {
      UserDefaults.standard.set(newValue, forKey: C.tailcatEnabledKey)
    }
  }

  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.setActivationPolicy(.accessory)
    setupStatusItem()
    startRelay()
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

  func applicationShouldHandleReopen(
    _ sender: NSApplication,
    hasVisibleWindows flag: Bool
  ) -> Bool {
    showHostPanel(nil)
    return true
  }

  func applicationWillTerminate(_ notification: Notification) {
    stopRelay()
  }

  private func setupStatusItem() {
    statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    if let button = statusItem.button {
      let icon = NSApp.applicationIconImage?.copy() as? NSImage ?? NSImage()
      icon.size = NSSize(width: 18, height: 18)
      icon.isTemplate = false
      button.image = icon
      button.imageScaling = .scaleProportionallyDown
      button.toolTip = "\(C.name) · Relay 正在启动"
    }

    let menu = NSMenu()
    relayStatusMenuItem = NSMenuItem(title: "Relay：正在启动", action: nil, keyEquivalent: "")
    relayStatusMenuItem.isEnabled = false
    menu.addItem(relayStatusMenuItem)

    tailcatStatusMenuItem = NSMenuItem(title: "Tailcat：正在启动", action: nil, keyEquivalent: "")
    tailcatStatusMenuItem.isEnabled = false
    menu.addItem(tailcatStatusMenuItem)

    tailcatAddressMenuItem = NSMenuItem(title: "Tailcat 地址：—", action: nil, keyEquivalent: "")
    tailcatAddressMenuItem.isEnabled = false
    menu.addItem(tailcatAddressMenuItem)
    menu.addItem(.separator())

    let pair = NSMenuItem(title: "添加手机…", action: #selector(showPairing(_:)), keyEquivalent: "")
    pair.target = self
    menu.addItem(pair)

    let panel = NSMenuItem(title: "打开 Host 面板", action: #selector(showHostPanel(_:)), keyEquivalent: "")
    panel.target = self
    menu.addItem(panel)
    menu.addItem(.separator())

    tailcatToggleMenuItem = NSMenuItem(
      title: "Tailcat 远程访问",
      action: #selector(toggleTailcat(_:)),
      keyEquivalent: ""
    )
    tailcatToggleMenuItem.target = self
    tailcatToggleMenuItem.state = tailcatEnabled ? .on : .off
    menu.addItem(tailcatToggleMenuItem)

    copyTailcatAddressMenuItem = NSMenuItem(
      title: "复制 Tailcat 地址",
      action: #selector(copyTailcatAddress(_:)),
      keyEquivalent: ""
    )
    copyTailcatAddressMenuItem.target = self
    copyTailcatAddressMenuItem.isEnabled = false
    menu.addItem(copyTailcatAddressMenuItem)
    menu.addItem(.separator())

    let restart = NSMenuItem(title: "重启 Relay", action: #selector(restartRelay(_:)), keyEquivalent: "")
    restart.target = self
    menu.addItem(restart)

    let logs = NSMenuItem(title: "打开 Relay 日志", action: #selector(openRelayLog(_:)), keyEquivalent: "")
    logs.target = self
    menu.addItem(logs)
    menu.addItem(.separator())

    let quit = NSMenuItem(title: "退出 \(C.name)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "")
    menu.addItem(quit)
    statusItem.menu = menu
    refreshTailcatMenu()
  }

  private func ensureWindow() {
    guard window == nil else { return }

    let config = WKWebViewConfiguration()
    config.websiteDataStore = .default()
    config.userContentController.addUserScript(WKUserScript(
      source: "try { if (!localStorage.getItem('codex-relay-language')) localStorage.setItem('codex-relay-language', 'zh-CN'); } catch (_) {}",
      injectionTime: .atDocumentStart,
      forMainFrameOnly: true
    ))

    let nextWebView = WKWebView(frame: .zero, configuration: config)
    nextWebView.navigationDelegate = self
    nextWebView.uiDelegate = self
    nextWebView.underPageBackgroundColor = .clear
    nextWebView.translatesAutoresizingMaskIntoConstraints = false

    let tailcatBar = NSVisualEffectView()
    tailcatBar.material = .headerView
    tailcatBar.blendingMode = .withinWindow
    tailcatBar.state = .active
    tailcatBar.translatesAutoresizingMaskIntoConstraints = false

    let tailcatTitle = NSTextField(labelWithString: "Tailcat 远程访问")
    tailcatTitle.font = NSFont.systemFont(ofSize: 12, weight: .semibold)
    tailcatTitle.textColor = .labelColor

    let nextTailcatStatusLabel = NSTextField(labelWithString: "正在读取状态…")
    nextTailcatStatusLabel.font = NSFont.systemFont(ofSize: 11)
    nextTailcatStatusLabel.textColor = .secondaryLabelColor
    nextTailcatStatusLabel.lineBreakMode = .byTruncatingMiddle

    let labels = NSStackView(views: [tailcatTitle, nextTailcatStatusLabel])
    labels.orientation = .vertical
    labels.alignment = .leading
    labels.spacing = 2
    labels.translatesAutoresizingMaskIntoConstraints = false

    let nextTailcatCopyButton = NSButton(
      title: "复制地址",
      target: self,
      action: #selector(copyTailcatAddress(_:))
    )
    nextTailcatCopyButton.bezelStyle = .rounded
    nextTailcatCopyButton.controlSize = .small
    nextTailcatCopyButton.isEnabled = false

    let nextTailcatSwitch = NSSwitch()
    nextTailcatSwitch.state = tailcatEnabled ? .on : .off
    nextTailcatSwitch.target = self
    nextTailcatSwitch.action = #selector(toggleTailcatSwitch(_:))

    let controls = NSStackView(views: [nextTailcatCopyButton, nextTailcatSwitch])
    controls.orientation = .horizontal
    controls.alignment = .centerY
    controls.spacing = 10
    controls.translatesAutoresizingMaskIntoConstraints = false

    tailcatBar.addSubview(labels)
    tailcatBar.addSubview(controls)

    let content = NSView()
    content.addSubview(tailcatBar)
    content.addSubview(nextWebView)

    NSLayoutConstraint.activate([
      tailcatBar.topAnchor.constraint(equalTo: content.topAnchor),
      tailcatBar.leadingAnchor.constraint(equalTo: content.leadingAnchor),
      tailcatBar.trailingAnchor.constraint(equalTo: content.trailingAnchor),
      tailcatBar.heightAnchor.constraint(equalToConstant: 56),

      labels.leadingAnchor.constraint(equalTo: tailcatBar.leadingAnchor, constant: 16),
      labels.centerYAnchor.constraint(equalTo: tailcatBar.centerYAnchor),
      labels.trailingAnchor.constraint(lessThanOrEqualTo: controls.leadingAnchor, constant: -16),

      controls.trailingAnchor.constraint(equalTo: tailcatBar.trailingAnchor, constant: -16),
      controls.centerYAnchor.constraint(equalTo: tailcatBar.centerYAnchor),

      nextWebView.topAnchor.constraint(equalTo: tailcatBar.bottomAnchor),
      nextWebView.leadingAnchor.constraint(equalTo: content.leadingAnchor),
      nextWebView.trailingAnchor.constraint(equalTo: content.trailingAnchor),
      nextWebView.bottomAnchor.constraint(equalTo: content.bottomAnchor),
    ])

    let nextWindow = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 1040, height: 700),
      styleMask: [.titled, .closable, .miniaturizable, .resizable],
      backing: .buffered,
      defer: false
    )
    nextWindow.title = C.name
    nextWindow.titlebarAppearsTransparent = true
    nextWindow.titleVisibility = .hidden
    nextWindow.isMovableByWindowBackground = true
    nextWindow.minSize = NSSize(width: 820, height: 580)
    nextWindow.center()
    nextWindow.contentView = content
    nextWindow.delegate = self

    tailcatSwitch = nextTailcatSwitch
    tailcatStatusLabel = nextTailcatStatusLabel
    tailcatCopyButton = nextTailcatCopyButton
    webView = nextWebView
    window = nextWindow
    refreshTailcatMenu()
  }

  @objc private func showHostPanel(_ sender: Any?) {
    ensureWindow()
    NSApp.setActivationPolicy(.regular)

    if let lastError {
      showError(lastError)
    } else if relayReady {
      loadControlCenter()
    } else {
      showLoading()
    }

    window?.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }

  @objc private func showPairing(_ sender: Any?) {
    showHostPanel(sender)
  }

  func windowShouldClose(_ sender: NSWindow) -> Bool {
    sender.orderOut(nil)
    NSApp.setActivationPolicy(.accessory)
    return false
  }

  @objc private func restartRelay(_ sender: Any?) {
    startRelay()
  }

  @objc private func toggleTailcat(_ sender: NSMenuItem) {
    setTailcatEnabled(!tailcatEnabled)
  }

  @objc private func toggleTailcatSwitch(_ sender: NSSwitch) {
    setTailcatEnabled(sender.state == .on)
  }

  private func setTailcatEnabled(_ enabled: Bool) {
    guard enabled != tailcatEnabled else {
      refreshTailcatMenu()
      return
    }
    tailcatEnabled = enabled
    currentTailcatAddress = nil
    refreshTailcatMenu()
    startRelay()
  }

  @objc private func copyTailcatAddress(_ sender: Any?) {
    guard let currentTailcatAddress else { return }
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(currentTailcatAddress, forType: .string)
  }

  @objc private func openRelayLog(_ sender: Any?) {
    guard let url = try? logURL() else { return }
    if !FileManager.default.fileExists(atPath: url.path) {
      FileManager.default.createFile(atPath: url.path, contents: nil)
    }
    NSWorkspace.shared.activateFileViewerSelecting([url])
  }

  private func setRelayStatus(_ status: String) {
    relayStatusMenuItem?.title = "Relay：\(status)"
    statusItem?.button?.toolTip = "\(C.name) · Relay \(status)"
  }

  private func startRelay() {
    stopRelay()
    generation += 1
    let currentGeneration = generation
    relayReady = false
    lastError = nil
    currentTailcatAddress = nil
    setRelayStatus("正在启动")
    refreshTailcatMenu()
    if window?.isVisible == true {
      showLoading()
    }

    guard
      let node = Bundle.main.url(forResource: "node", withExtension: nil, subdirectory: "runtime"),
      let cli = Bundle.main.url(forResource: "cli", withExtension: "js", subdirectory: "relay/dist")
    else {
      fail("内置 Relay 运行时不完整，请重新安装 Codex Relay Plus。")
      return
    }

    guard let ports = reservePorts() else {
      fail("未能找到可用的本机 Relay 端口。")
      return
    }
    relayPort = ports.0
    controlPort = ports.1

    do {
      let support = try supportURL()
      let runtime = support.appendingPathComponent("Runtime", isDirectory: true)
      try FileManager.default.createDirectory(at: runtime, withIntermediateDirectories: true)

      let log = try logURL()
      rotateLog(log)
      FileManager.default.createFile(atPath: log.path, contents: nil)
      let handle = try FileHandle(forWritingTo: log)
      try handle.seekToEnd()
      logHandle = handle

      let process = Process()
      process.executableURL = node
      process.arguments = [cli.path]
      process.currentDirectoryURL = runtime
      process.standardOutput = handle
      process.standardError = handle

      var env = ProcessInfo.processInfo.environment
      env["PORT"] = String(relayPort)
      env["HOST"] = "0.0.0.0"
      env["CODEX_RELAY_CONTROL_PORT"] = String(controlPort)
      env["CODEX_RELAY_CONTROL_CENTER"] = "1"
      env["CODEX_RELAY_DESKTOP"] = "1"
      env["CODEX_RELAY_HOME"] = support.path
      env["CODEX_RELAY_WORKSPACE_PATH"] = FileManager.default.homeDirectoryForCurrentUser.path
      env["CODEX_RELAY_TAILCAT_ENABLED"] = tailcatEnabled ? "1" : "0"
      env["NO_COLOR"] = "1"
      env["PATH"] = [
        node.deletingLastPathComponent().path,
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
      ].joined(separator: ":")
      process.environment = env
      process.terminationHandler = { [weak self] process in
        DispatchQueue.main.async {
          guard
            let self,
            currentGeneration == self.generation,
            process.terminationStatus != 0
          else { return }
          self.fail(
            "Relay 意外退出（状态码 \(process.terminationStatus)）。请查看 ~/Library/Logs/Codex Relay Plus/relay.log。"
          )
        }
      }

      try process.run()
      relay = process
      if setpgid(process.processIdentifier, process.processIdentifier) == 0 {
        relayGroup = process.processIdentifier
      }
      startTailcatStatusTimer()
      waitForControlCenter(currentGeneration, 0)
    } catch {
      fail("无法启动内置 Relay：\(error.localizedDescription)")
    }
  }

  private func startTailcatStatusTimer() {
    tailcatStatusTimer?.invalidate()
    refreshTailcatMenu()
    tailcatStatusTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
      self?.refreshTailcatMenu()
    }
  }

  private func renderTailcatStatus(
    status: String,
    detail: String,
    menuAddress: String? = nil,
    copyEnabled: Bool
  ) {
    tailcatStatusMenuItem?.title = "Tailcat：\(status)"
    tailcatAddressMenuItem?.title = "Tailcat 地址：\(menuAddress ?? "—")"
    tailcatStatusLabel?.stringValue = detail.isEmpty ? status : "\(status) · \(detail)"
    tailcatToggleMenuItem?.state = tailcatEnabled ? .on : .off
    tailcatSwitch?.state = tailcatEnabled ? .on : .off
    copyTailcatAddressMenuItem?.isEnabled = copyEnabled
    tailcatCopyButton?.isEnabled = copyEnabled
  }

  private func refreshTailcatMenu() {
    tailcatToggleMenuItem?.state = tailcatEnabled ? .on : .off
    tailcatSwitch?.state = tailcatEnabled ? .on : .off

    guard tailcatEnabled else {
      currentTailcatAddress = nil
      renderTailcatStatus(status: "已关闭", detail: "仅局域网", copyEnabled: false)
      return
    }

    guard let process = relay else {
      currentTailcatAddress = nil
      renderTailcatStatus(status: "等待 Relay", detail: "远程访问尚未启动", copyEnabled: false)
      return
    }

    guard let status = readTailcatStatus(for: process.processIdentifier) else {
      currentTailcatAddress = nil
      renderTailcatStatus(
        status: relayReady ? "启动中或暂不可用" : "正在启动",
        detail: "局域网仍可用",
        copyEnabled: false
      )
      return
    }

    currentTailcatAddress = status.address
    let address = "\(status.address) · :\(status.port)"
    renderTailcatStatus(
      status: "已就绪",
      detail: address,
      menuAddress: address,
      copyEnabled: true
    )
  }

  private func readTailcatStatus(for relayPid: pid_t) -> (address: String, port: Int)? {
    guard let support = try? supportURL() else { return nil }
    let statusURL = support.appendingPathComponent("tailcat-status.\(relayPid)")
    guard let text = try? String(contentsOf: statusURL, encoding: .utf8) else { return nil }

    for line in text.split(whereSeparator: { $0.isNewline }).reversed() {
      guard
        let data = String(line).data(using: .utf8),
        let json = try? JSONSerialization.jsonObject(with: data),
        let object = json as? [String: Any],
        let address = object["address"] as? String,
        address.hasPrefix("tc")
      else { continue }

      let port: Int?
      if let value = object["port"] as? Int {
        port = value
      } else if let value = object["port"] as? NSNumber {
        port = value.intValue
      } else {
        port = nil
      }
      guard let port, (1...65535).contains(port) else { continue }
      return (address, port)
    }
    return nil
  }

  private func waitForControlCenter(_ expectedGeneration: Int, _ attempt: Int) {
    guard expectedGeneration == generation else { return }
    guard attempt < 80 else {
      fail("Relay 未能完成启动。请查看 ~/Library/Logs/Codex Relay Plus/relay.log。")
      return
    }
    guard let url = controlCenterURL() else { return }

    var request = URLRequest(url: url)
    request.cachePolicy = .reloadIgnoringLocalCacheData
    request.timeoutInterval = 0.7
    URLSession.shared.dataTask(with: request) { [weak self] _, response, _ in
      DispatchQueue.main.async {
        guard let self, expectedGeneration == self.generation else { return }
        if let http = response as? HTTPURLResponse, (200..<500).contains(http.statusCode) {
          self.relayReady = true
          self.lastError = nil
          self.setRelayStatus("运行中")
          self.refreshTailcatMenu()
          if self.window?.isVisible == true {
            self.loadControlCenter()
          }
        } else {
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            self.waitForControlCenter(expectedGeneration, attempt + 1)
          }
        }
      }
    }.resume()
  }

  private func loadControlCenter() {
    guard let url = controlCenterURL(), let webView else { return }
    webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 5))
  }

  private func controlCenterURL() -> URL? {
    URL(string: "http://127.0.0.1:\(controlPort)/")
  }

  private func fail(_ message: String) {
    relayReady = false
    lastError = message
    setRelayStatus("启动失败")
    refreshTailcatMenu()
    if window?.isVisible == true {
      showError(message)
    }
  }

  private func stopRelay() {
    generation += 1
    relayReady = false
    tailcatStatusTimer?.invalidate()
    tailcatStatusTimer = nil
    currentTailcatAddress = nil
    guard let process = relay else {
      closeLog()
      refreshTailcatMenu()
      return
    }

    if process.isRunning {
      if let group = relayGroup {
        _ = Darwin.kill(-group, SIGTERM)
      } else {
        process.terminate()
      }
      let deadline = Date().addingTimeInterval(2)
      while process.isRunning && Date() < deadline {
        _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.05))
      }
      if process.isRunning {
        if let group = relayGroup {
          _ = Darwin.kill(-group, SIGKILL)
        } else {
          _ = Darwin.kill(process.processIdentifier, SIGKILL)
        }
      }
    }

    relayGroup = nil
    relay = nil
    closeLog()
    refreshTailcatMenu()
  }

  private func closeLog() {
    try? logHandle?.synchronize()
    try? logHandle?.close()
    logHandle = nil
  }

  private func reservePorts() -> (Int, Int)? {
    for relay in C.relayPort...(C.relayPort + 40) {
      let control = relay + C.controlOffset
      if canBind(relay) && canBind(control) {
        return (relay, control)
      }
    }
    return nil
  }

  private func canBind(_ port: Int) -> Bool {
    let fd = socket(AF_INET, SOCK_STREAM, 0)
    guard fd >= 0 else { return false }
    defer { close(fd) }

    var address = sockaddr_in()
    address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    address.sin_family = sa_family_t(AF_INET)
    address.sin_port = in_port_t(port).bigEndian
    address.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))
    return withUnsafePointer(to: &address) {
      $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        Darwin.bind(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) == 0
      }
    }
  }

  private func supportURL() throws -> URL {
    let root = try FileManager.default.url(
      for: .applicationSupportDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    let url = root.appendingPathComponent(C.name, isDirectory: true)
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }

  private func logURL() throws -> URL {
    let root = try FileManager.default.url(
      for: .libraryDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    let directory = root.appendingPathComponent("Logs/\(C.name)", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory.appendingPathComponent("relay.log")
  }

  private func rotateLog(_ url: URL) {
    let size = ((try? FileManager.default.attributesOfItem(atPath: url.path)[.size]) as? NSNumber)?.int64Value ?? 0
    guard size >= 5 * 1024 * 1024 else { return }
    let old = url.deletingLastPathComponent().appendingPathComponent("relay.log.1")
    try? FileManager.default.removeItem(at: old)
    try? FileManager.default.moveItem(at: url, to: old)
  }

  private func showLoading() {
    webView?.loadHTMLString("""
      <!doctype html><html><head><meta charset="utf-8"><style>html,body{height:100%;margin:0;background:#191919;color:#f2f2f2;font:14px -apple-system,sans-serif}main{height:100%;display:grid;place-items:center;text-align:center}.m{color:#999}</style></head><body><main><div><h2>正在启动 Relay</h2><div>正在准备手机连接服务…</div><p class="m">完成后可关闭此窗口，Relay 会继续在菜单栏运行。</p></div></main></body></html>
      """, baseURL: nil)
  }

  private func showError(_ message: String) {
    let text = escape(message)
    webView?.loadHTMLString("""
      <!doctype html><html><head><meta charset="utf-8"><style>html,body{height:100%;margin:0;background:#191919;color:#f2f2f2;font:14px -apple-system,sans-serif}main{height:100%;display:grid;place-items:center}.c{max-width:660px;padding:36px}h2{color:#fda4af}p{color:#bbb}</style></head><body><main><div class="c"><h2>Relay 启动失败</h2><p>\(text)</p><p>可从菜单栏重启 Relay，或打开 Relay 日志查看详细原因。</p></div></main></body></html>
      """, baseURL: nil)
  }

  private func escape(_ value: String) -> String {
    value
      .replacingOccurrences(of: "&", with: "&amp;")
      .replacingOccurrences(of: "<", with: "&lt;")
      .replacingOccurrences(of: ">", with: "&gt;")
      .replacingOccurrences(of: "\"", with: "&quot;")
      .replacingOccurrences(of: "'", with: "&#39;")
  }

  func webView(
    _ webView: WKWebView,
    decidePolicyFor action: WKNavigationAction,
    decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
  ) {
    guard let url = action.request.url else {
      decisionHandler(.cancel)
      return
    }
    if url.scheme == "about" ||
      ((url.host == "127.0.0.1" || url.host == "localhost") && url.port == controlPort)
    {
      decisionHandler(.allow)
      return
    }
    if action.navigationType == .linkActivated {
      NSWorkspace.shared.open(url)
    }
    decisionHandler(.cancel)
  }

  func webView(
    _ webView: WKWebView,
    createWebViewWith configuration: WKWebViewConfiguration,
    for action: WKNavigationAction,
    windowFeatures: WKWindowFeatures
  ) -> WKWebView? {
    if let url = action.request.url {
      NSWorkspace.shared.open(url)
    }
    return nil
  }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
