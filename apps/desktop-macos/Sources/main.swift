import AppKit
import Darwin
import Foundation
import WebKit

private enum C {
  static let name = "Codex Relay Plus"
  static let relayPort = 8787
  static let controlOffset = 2
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
  private var window: NSWindow!
  private var webView: WKWebView!
  private var statusItem: NSStatusItem!
  private var relayStatusMenuItem: NSMenuItem!
  private var relay: Process?
  private var relayGroup: pid_t?
  private var logHandle: FileHandle?
  private var relayPort = C.relayPort
  private var controlPort = C.relayPort + C.controlOffset
  private var generation = 0

  func applicationDidFinishLaunching(_ notification: Notification) {
    setupMenu()
    setupWindow()
    setupStatusItem()
    NSApp.activate(ignoringOtherApps: true)
    startRelay()
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

  func applicationShouldHandleReopen(
    _ sender: NSApplication,
    hasVisibleWindows flag: Bool
  ) -> Bool {
    showMainWindow(nil)
    return true
  }

  func applicationWillTerminate(_ notification: Notification) { stopRelay() }

  private func setupWindow() {
    let config = WKWebViewConfiguration()
    config.websiteDataStore = .default()
    config.userContentController.addUserScript(WKUserScript(
      source: "try { if (!localStorage.getItem('codex-relay-language')) localStorage.setItem('codex-relay-language', 'zh-CN'); } catch (_) {}",
      injectionTime: .atDocumentStart,
      forMainFrameOnly: true
    ))
    webView = WKWebView(frame: .zero, configuration: config)
    webView.navigationDelegate = self
    webView.uiDelegate = self
    webView.underPageBackgroundColor = .clear
    window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 1120, height: 760),
      styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
      backing: .buffered,
      defer: false
    )
    window.title = C.name
    window.titlebarAppearsTransparent = true
    window.titleVisibility = .hidden
    window.minSize = NSSize(width: 860, height: 620)
    window.center()
    window.contentView = webView
    window.makeKeyAndOrderFront(nil)
  }

  private func setupMenu() {
    let main = NSMenu()
    let appItem = NSMenuItem(); main.addItem(appItem)
    let appMenu = NSMenu()
    appMenu.addItem(withTitle: "关于 \(C.name)", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
    appMenu.addItem(.separator())
    appMenu.addItem(withTitle: "退出 \(C.name)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    appItem.submenu = appMenu

    let fileItem = NSMenuItem(); main.addItem(fileItem)
    let file = NSMenu(title: "文件")
    let restart = NSMenuItem(title: "重启 Relay", action: #selector(restartRelay(_:)), keyEquivalent: "r")
    restart.keyEquivalentModifierMask = [.command, .shift]; restart.target = self; file.addItem(restart)
    let reload = NSMenuItem(title: "重新载入控制中心", action: #selector(reloadControlCenter(_:)), keyEquivalent: "r")
    reload.target = self; file.addItem(reload)
    let logs = NSMenuItem(title: "打开 Relay 日志", action: #selector(openRelayLog(_:)), keyEquivalent: "l")
    logs.keyEquivalentModifierMask = [.command, .shift]; logs.target = self; file.addItem(logs)
    fileItem.submenu = file
    NSApp.mainMenu = main
  }

  private func setupStatusItem() {
    statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
    if let button = statusItem.button {
      let icon = NSApp.applicationIconImage.copy() as? NSImage ?? NSApp.applicationIconImage
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
    menu.addItem(.separator())

    let open = NSMenuItem(title: "打开主窗口", action: #selector(showMainWindow(_:)), keyEquivalent: "")
    open.target = self
    menu.addItem(open)

    let pairing = NSMenuItem(title: "显示配对二维码", action: #selector(showPairing(_:)), keyEquivalent: "")
    pairing.target = self
    menu.addItem(pairing)
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
  }

  private func setRelayStatus(_ status: String) {
    relayStatusMenuItem?.title = "Relay：\(status)"
    statusItem?.button?.toolTip = "\(C.name) · Relay \(status)"
  }

  @objc private func showMainWindow(_ sender: Any?) {
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }

  @objc private func showPairing(_ sender: Any?) {
    showMainWindow(sender)
    reloadControlCenter(sender)
  }

  @objc private func restartRelay(_ sender: Any?) { startRelay() }

  @objc private func reloadControlCenter(_ sender: Any?) {
    guard let url = URL(string: "http://127.0.0.1:\(controlPort)") else { return }
    webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 5))
  }

  @objc private func openRelayLog(_ sender: Any?) {
    guard let url = try? logURL() else { return }
    if !FileManager.default.fileExists(atPath: url.path) { FileManager.default.createFile(atPath: url.path, contents: nil) }
    NSWorkspace.shared.activateFileViewerSelecting([url])
  }

  private func startRelay() {
    stopRelay(); generation += 1
    let currentGeneration = generation
    setRelayStatus("正在启动")
    showLoading()

    guard
      let node = Bundle.main.url(forResource: "node", withExtension: nil, subdirectory: "runtime"),
      let cli = Bundle.main.url(forResource: "cli", withExtension: "js", subdirectory: "relay/dist")
    else { showError("内置 Relay 运行时不完整，请重新安装 Codex Relay Plus。"); return }
    guard let ports = reservePorts() else { showError("未能找到可用的本机 Relay 端口。"); return }
    relayPort = ports.0; controlPort = ports.1

    do {
      let support = try supportURL()
      let runtime = support.appendingPathComponent("Runtime", isDirectory: true)
      try FileManager.default.createDirectory(at: runtime, withIntermediateDirectories: true)
      let log = try logURL(); rotateLog(log)
      FileManager.default.createFile(atPath: log.path, contents: nil)
      let handle = try FileHandle(forWritingTo: log); try handle.seekToEnd(); logHandle = handle

      let process = Process()
      process.executableURL = node
      process.arguments = [cli.path]
      process.currentDirectoryURL = runtime
      process.standardOutput = handle; process.standardError = handle
      var env = ProcessInfo.processInfo.environment
      env["PORT"] = String(relayPort); env["HOST"] = "0.0.0.0"
      env["CODEX_RELAY_CONTROL_PORT"] = String(controlPort)
      env["CODEX_RELAY_CONTROL_CENTER"] = "1"
      env["CODEX_RELAY_DESKTOP"] = "1"
      env["CODEX_RELAY_HOME"] = support.path
      env["CODEX_RELAY_WORKSPACE_PATH"] = FileManager.default.homeDirectoryForCurrentUser.path
      env["NO_COLOR"] = "1"
      env["PATH"] = [node.deletingLastPathComponent().path, "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"].joined(separator: ":")
      process.environment = env
      process.terminationHandler = { [weak self] p in
        DispatchQueue.main.async {
          guard let self, currentGeneration == self.generation, p.terminationStatus != 0 else { return }
          self.showError("Relay 意外退出（状态码 \(p.terminationStatus)）。请查看 ~/Library/Logs/Codex Relay Plus/relay.log。")
        }
      }
      try process.run(); relay = process
      if setpgid(process.processIdentifier, process.processIdentifier) == 0 { relayGroup = process.processIdentifier }
      waitForControlCenter(currentGeneration, 0)
    } catch { showError("无法启动内置 Relay：\(error.localizedDescription)") }
  }

  private func waitForControlCenter(_ expectedGeneration: Int, _ attempt: Int) {
    guard expectedGeneration == generation else { return }
    guard attempt < 80 else { showError("Relay 未能完成启动。请查看 ~/Library/Logs/Codex Relay Plus/relay.log。"); return }
    guard let url = URL(string: "http://127.0.0.1:\(controlPort)/") else { return }
    var request = URLRequest(url: url); request.cachePolicy = .reloadIgnoringLocalCacheData; request.timeoutInterval = 0.7
    URLSession.shared.dataTask(with: request) { [weak self] _, response, _ in
      DispatchQueue.main.async {
        guard let self, expectedGeneration == self.generation else { return }
        if let http = response as? HTTPURLResponse, (200..<500).contains(http.statusCode) {
          self.setRelayStatus("运行中")
          self.window.title = C.name
          self.webView.load(URLRequest(url: url))
        } else {
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { self.waitForControlCenter(expectedGeneration, attempt + 1) }
        }
      }
    }.resume()
  }

  private func stopRelay() {
    generation += 1
    guard let process = relay else { closeLog(); return }
    if process.isRunning {
      if let group = relayGroup { _ = Darwin.kill(-group, SIGTERM) } else { process.terminate() }
      let deadline = Date().addingTimeInterval(2)
      while process.isRunning && Date() < deadline { _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.05)) }
      if process.isRunning {
        if let group = relayGroup { _ = Darwin.kill(-group, SIGKILL) } else { _ = Darwin.kill(process.processIdentifier, SIGKILL) }
      }
    }
    relayGroup = nil; relay = nil; closeLog()
  }

  private func closeLog() { try? logHandle?.synchronize(); try? logHandle?.close(); logHandle = nil }

  private func reservePorts() -> (Int, Int)? {
    for relay in C.relayPort...(C.relayPort + 40) {
      let control = relay + C.controlOffset
      if canBind(relay) && canBind(control) { return (relay, control) }
    }
    return nil
  }

  private func canBind(_ port: Int) -> Bool {
    let fd = socket(AF_INET, SOCK_STREAM, 0); guard fd >= 0 else { return false }; defer { close(fd) }
    var address = sockaddr_in(); address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size); address.sin_family = sa_family_t(AF_INET)
    address.sin_port = in_port_t(port).bigEndian; address.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))
    return withUnsafePointer(to: &address) { $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.bind(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) == 0 } }
  }

  private func supportURL() throws -> URL {
    let root = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    let url = root.appendingPathComponent(C.name, isDirectory: true)
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true); return url
  }

  private func logURL() throws -> URL {
    let root = try FileManager.default.url(for: .libraryDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    let dir = root.appendingPathComponent("Logs/\(C.name)", isDirectory: true)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true); return dir.appendingPathComponent("relay.log")
  }

  private func rotateLog(_ url: URL) {
    let size = ((try? FileManager.default.attributesOfItem(atPath: url.path)[.size]) as? NSNumber)?.int64Value ?? 0
    guard size >= 5 * 1024 * 1024 else { return }
    let old = url.deletingLastPathComponent().appendingPathComponent("relay.log.1")
    try? FileManager.default.removeItem(at: old); try? FileManager.default.moveItem(at: url, to: old)
  }

  private func showLoading() {
    webView.loadHTMLString("""
      <!doctype html><html><head><meta charset="utf-8"><style>html,body{height:100%;margin:0;background:#191919;color:#f2f2f2;font:14px -apple-system,sans-serif}main{height:100%;display:grid;place-items:center;text-align:center}.m{color:#999}</style></head><body><main><div><h2>正在启动 Codex Relay Plus</h2><div>正在连接本机 Codex 服务并加载会话…</div><p class="m">无需选择工作区</p></div></main></body></html>
      """, baseURL: nil)
  }

  private func showError(_ message: String) {
    setRelayStatus("启动失败")
    let text = escape(message)
    webView.loadHTMLString("""
      <!doctype html><html><head><meta charset="utf-8"><style>html,body{height:100%;margin:0;background:#191919;color:#f2f2f2;font:14px -apple-system,sans-serif}main{height:100%;display:grid;place-items:center}.c{max-width:660px;padding:36px}h2{color:#fda4af}p{color:#bbb}</style></head><body><main><div class="c"><h2>Codex Relay Plus 启动失败</h2><p>\(text)</p><p>可使用“文件 → 重启 Relay”（⇧⌘R）重试，或打开 Relay 日志查看详细原因。</p></div></main></body></html>
      """, baseURL: nil)
  }

  private func escape(_ value: String) -> String {
    value.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;").replacingOccurrences(of: "\"", with: "&quot;").replacingOccurrences(of: "'", with: "&#39;")
  }

  func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    guard let url = action.request.url else { decisionHandler(.cancel); return }
    if url.scheme == "about" || ((url.host == "127.0.0.1" || url.host == "localhost") && url.port == controlPort) { decisionHandler(.allow); return }
    if action.navigationType == .linkActivated { NSWorkspace.shared.open(url) }
    decisionHandler(.cancel)
  }

  func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
    if let url = action.request.url { NSWorkspace.shared.open(url) }; return nil
  }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
