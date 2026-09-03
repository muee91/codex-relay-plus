import AppKit
import Darwin
import Foundation
import WebKit

private enum DesktopConstants {
  static let appName = "Codex Relay Plus"
  static let defaultRelayPort = 8787
  static let controlPortOffset = 2
  static let workspaceDefaultsKey = "workspacePath"
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
  private var window: NSWindow!
  private var webView: WKWebView!
  private var relayProcess: Process?
  private var relayProcessGroup: pid_t?
  private var relayLogHandle: FileHandle?
  private var relayPort = DesktopConstants.defaultRelayPort
  private var controlPort = DesktopConstants.defaultRelayPort + DesktopConstants.controlPortOffset
  private var currentWorkspace: URL?
  private var startupGeneration = 0

  func applicationDidFinishLaunching(_ notification: Notification) {
    configureMenus()
    configureWindow()
    NSApp.activate(ignoringOtherApps: true)

    if let remembered = rememberedWorkspace(), FileManager.default.fileExists(atPath: remembered.path) {
      startRelay(in: remembered)
    } else {
      chooseWorkspace(nil)
    }
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
  }

  func applicationWillTerminate(_ notification: Notification) {
    stopRelay()
  }

  private func configureWindow() {
    let configuration = WKWebViewConfiguration()
    configuration.websiteDataStore = .default()
    configuration.userContentController.addUserScript(
      WKUserScript(
        source: "try { if (!localStorage.getItem('codex-relay-language')) localStorage.setItem('codex-relay-language', 'zh-CN'); } catch (_) {}",
        injectionTime: .atDocumentStart,
        forMainFrameOnly: true
      )
    )

    webView = WKWebView(frame: .zero, configuration: configuration)
    webView.navigationDelegate = self
    webView.uiDelegate = self
    webView.underPageBackgroundColor = .clear

    window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 1120, height: 760),
      styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
      backing: .buffered,
      defer: false
    )
    window.title = DesktopConstants.appName
    window.titlebarAppearsTransparent = true
    window.titleVisibility = .hidden
    window.minSize = NSSize(width: 860, height: 620)
    window.center()
    window.contentView = webView
    window.makeKeyAndOrderFront(nil)
  }

  private func configureMenus() {
    let mainMenu = NSMenu()

    let appMenuItem = NSMenuItem()
    mainMenu.addItem(appMenuItem)
    let appMenu = NSMenu()
    appMenu.addItem(withTitle: "关于 \(DesktopConstants.appName)", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
    appMenu.addItem(.separator())
    appMenu.addItem(withTitle: "退出 \(DesktopConstants.appName)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    appMenuItem.submenu = appMenu

    let fileMenuItem = NSMenuItem()
    mainMenu.addItem(fileMenuItem)
    let fileMenu = NSMenu(title: "文件")
    let workspaceItem = NSMenuItem(title: "切换工作区…", action: #selector(chooseWorkspace(_:)), keyEquivalent: "o")
    workspaceItem.target = self
    fileMenu.addItem(workspaceItem)
    let restartItem = NSMenuItem(title: "重启 Relay", action: #selector(restartRelay(_:)), keyEquivalent: "r")
    restartItem.keyEquivalentModifierMask = [.command, .shift]
    restartItem.target = self
    fileMenu.addItem(restartItem)
    let reloadItem = NSMenuItem(title: "重新载入控制中心", action: #selector(reloadControlCenter(_:)), keyEquivalent: "r")
    reloadItem.target = self
    fileMenu.addItem(reloadItem)
    let logsItem = NSMenuItem(title: "打开 Relay 日志", action: #selector(openRelayLog(_:)), keyEquivalent: "l")
    logsItem.keyEquivalentModifierMask = [.command, .shift]
    logsItem.target = self
    fileMenu.addItem(logsItem)
    fileMenuItem.submenu = fileMenu

    let windowMenuItem = NSMenuItem()
    mainMenu.addItem(windowMenuItem)
    let windowMenu = NSMenu(title: "窗口")
    windowMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
    windowMenu.addItem(withTitle: "缩放", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
    windowMenuItem.submenu = windowMenu
    NSApp.windowsMenu = windowMenu

    NSApp.mainMenu = mainMenu
  }

  @objc private func chooseWorkspace(_ sender: Any?) {
    let panel = NSOpenPanel()
    panel.title = "选择 Codex 工作区"
    panel.message = "Codex Relay 将在此 Mac 上针对所选文件夹运行。"
    panel.prompt = "使用此工作区"
    panel.canChooseDirectories = true
    panel.canChooseFiles = false
    panel.allowsMultipleSelection = false
    panel.canCreateDirectories = true
    panel.directoryURL = currentWorkspace ?? rememberedWorkspace() ?? FileManager.default.homeDirectoryForCurrentUser

    guard panel.runModal() == .OK, let url = panel.url else {
      if currentWorkspace == nil {
        showWelcome(message: "请选择一个工作区以启动 Codex Relay Plus。")
      }
      return
    }

    UserDefaults.standard.set(url.path, forKey: DesktopConstants.workspaceDefaultsKey)
    startRelay(in: url)
  }

  @objc private func restartRelay(_ sender: Any?) {
    guard let workspace = currentWorkspace ?? rememberedWorkspace() else {
      chooseWorkspace(sender)
      return
    }
    startRelay(in: workspace)
  }

  @objc private func reloadControlCenter(_ sender: Any?) {
    guard let url = URL(string: "http://127.0.0.1:\(controlPort)") else { return }
    webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 5))
  }

  @objc private func openRelayLog(_ sender: Any?) {
    guard let logURL = try? logFileURL() else { return }
    if !FileManager.default.fileExists(atPath: logURL.path) {
      FileManager.default.createFile(atPath: logURL.path, contents: nil)
    }
    NSWorkspace.shared.activateFileViewerSelecting([logURL])
  }

  private func rememberedWorkspace() -> URL? {
    guard let path = UserDefaults.standard.string(forKey: DesktopConstants.workspaceDefaultsKey), !path.isEmpty else {
      return nil
    }
    return URL(fileURLWithPath: path, isDirectory: true)
  }

  private func startRelay(in workspace: URL) {
    stopRelay()
    startupGeneration += 1
    let generation = startupGeneration
    currentWorkspace = workspace
    showLoading(workspace: workspace)

    guard let nodeURL = Bundle.main.url(forResource: "node", withExtension: nil, subdirectory: "runtime"),
          let cliURL = Bundle.main.url(forResource: "cli", withExtension: "js", subdirectory: "relay/dist") else {
      showFatalError("内置 Relay 运行时不完整，请重新安装 Codex Relay Plus。")
      return
    }

    guard let ports = reserveRelayPorts() else {
      showFatalError("未能在桌面端口范围内找到可用的本机 Relay 端口。")
      return
    }
    relayPort = ports.relay
    controlPort = ports.control

    do {
      let supportURL = try applicationSupportDirectory()
      let logURL = try logFileURL()
      rotateLogIfNeeded(logURL)
      FileManager.default.createFile(atPath: logURL.path, contents: nil)
      let logHandle = try FileHandle(forWritingTo: logURL)
      try logHandle.seekToEnd()
      relayLogHandle = logHandle

      let process = Process()
      process.executableURL = nodeURL
      process.arguments = [cliURL.path]
      process.currentDirectoryURL = workspace
      process.standardOutput = logHandle
      process.standardError = logHandle

      var environment = ProcessInfo.processInfo.environment
      environment["PORT"] = String(relayPort)
      environment["HOST"] = "0.0.0.0"
      environment["CODEX_RELAY_CONTROL_PORT"] = String(controlPort)
      environment["CODEX_RELAY_CONTROL_CENTER"] = "1"
      environment["CODEX_RELAY_HOME"] = supportURL.path
      environment["CODEX_RELAY_WORKSPACE_PATH"] = workspace.path
      environment["NO_COLOR"] = "1"
      let bundledPath = nodeURL.deletingLastPathComponent().path
      environment["PATH"] = [
        bundledPath,
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
      ].joined(separator: ":")
      process.environment = environment

      process.terminationHandler = { [weak self] terminated in
        DispatchQueue.main.async {
          guard let self, generation == self.startupGeneration else { return }
          if terminated.terminationStatus != 0 {
            self.showFatalError("Relay 意外退出（状态码 \(terminated.terminationStatus)）。请查看 ~/Library/Logs/Codex Relay Plus/relay.log。")
          }
        }
      }

      try process.run()
      relayProcess = process
      if setpgid(process.processIdentifier, process.processIdentifier) == 0 {
        relayProcessGroup = process.processIdentifier
      }
      waitForControlCenter(generation: generation, attempt: 0)
    } catch {
      showFatalError("无法启动内置 Relay：\(error.localizedDescription)")
    }
  }

  private func waitForControlCenter(generation: Int, attempt: Int) {
    guard generation == startupGeneration else { return }
    guard attempt < 80 else {
      showFatalError("Relay 未能完成启动。请查看 ~/Library/Logs/Codex Relay Plus/relay.log。")
      return
    }

    guard let url = URL(string: "http://127.0.0.1:\(controlPort)/") else { return }
    var request = URLRequest(url: url)
    request.cachePolicy = .reloadIgnoringLocalCacheData
    request.timeoutInterval = 0.7
    URLSession.shared.dataTask(with: request) { [weak self] _, response, _ in
      DispatchQueue.main.async {
        guard let self, generation == self.startupGeneration else { return }
        if let http = response as? HTTPURLResponse, (200..<500).contains(http.statusCode) {
          self.window.title = "\(DesktopConstants.appName) — \(self.currentWorkspace?.lastPathComponent ?? "工作区")"
          self.webView.load(URLRequest(url: url))
        } else {
          DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            self.waitForControlCenter(generation: generation, attempt: attempt + 1)
          }
        }
      }
    }.resume()
  }

  private func stopRelay() {
    startupGeneration += 1
    guard let process = relayProcess else {
      closeRelayLog()
      return
    }

    if process.isRunning {
      if let group = relayProcessGroup {
        _ = Darwin.kill(-group, SIGTERM)
      } else {
        process.terminate()
      }

      let deadline = Date().addingTimeInterval(2.0)
      while process.isRunning && Date() < deadline {
        _ = RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.05))
      }

      if process.isRunning {
        if let group = relayProcessGroup {
          _ = Darwin.kill(-group, SIGKILL)
        } else {
          _ = Darwin.kill(process.processIdentifier, SIGKILL)
        }
      }
    }

    relayProcessGroup = nil
    relayProcess = nil
    closeRelayLog()
  }

  private func closeRelayLog() {
    try? relayLogHandle?.synchronize()
    try? relayLogHandle?.close()
    relayLogHandle = nil
  }

  private func reserveRelayPorts() -> (relay: Int, control: Int)? {
    for relay in DesktopConstants.defaultRelayPort...DesktopConstants.defaultRelayPort + 40 {
      let control = relay + DesktopConstants.controlPortOffset
      if canBindLoopback(port: relay) && canBindLoopback(port: control) {
        return (relay, control)
      }
    }
    return nil
  }

  private func canBindLoopback(port: Int) -> Bool {
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

  private func applicationSupportDirectory() throws -> URL {
    let root = try FileManager.default.url(
      for: .applicationSupportDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    let directory = root.appendingPathComponent(DesktopConstants.appName, isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory
  }

  private func logFileURL() throws -> URL {
    let root = try FileManager.default.url(
      for: .libraryDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    let directory = root.appendingPathComponent("Logs/\(DesktopConstants.appName)", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory.appendingPathComponent("relay.log")
  }

  private func rotateLogIfNeeded(_ logURL: URL) {
    let maxLogBytes: Int64 = 5 * 1024 * 1024
    guard let attributes = try? FileManager.default.attributesOfItem(atPath: logURL.path),
          let size = attributes[.size] as? NSNumber,
          size.int64Value >= maxLogBytes else {
      return
    }
    let previousURL = logURL.deletingLastPathComponent().appendingPathComponent("relay.log.1")
    try? FileManager.default.removeItem(at: previousURL)
    try? FileManager.default.moveItem(at: logURL, to: previousURL)
  }

  private func showLoading(workspace: URL) {
    let escaped = htmlEscape(workspace.path)
    webView.loadHTMLString(
      """
      <!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="dark">
      <style>html,body{height:100%;margin:0;background:#191919;color:#f2f2f2;font:14px -apple-system,BlinkMacSystemFont,sans-serif}main{height:100%;display:grid;place-items:center}.card{max-width:640px;padding:36px;text-align:center}.dot{width:10px;height:10px;margin:0 auto 18px;border-radius:50%;background:#5eead4;box-shadow:0 0 28px #5eead4}.path{margin-top:12px;color:#8f8f8f;font:12px ui-monospace,SFMono-Regular,monospace;overflow-wrap:anywhere}</style></head>
      <body><main><div class="card"><div class="dot"></div><h2>正在启动 Codex Relay Plus</h2><div>正在准备本机控制中心…</div><div class="path">\(escaped)</div></div></main></body></html>
      """,
      baseURL: nil
    )
  }

  private func showWelcome(message: String) {
    let escaped = htmlEscape(message)
    webView.loadHTMLString(
      """
      <!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="dark"><style>html,body{height:100%;margin:0;background:#191919;color:#f2f2f2;font:14px -apple-system,BlinkMacSystemFont,sans-serif}main{height:100%;display:grid;place-items:center}.card{max-width:560px;padding:36px;text-align:center}p{color:#aaa}</style></head><body><main><div class="card"><h2>Codex Relay Plus</h2><p>\(escaped)</p><p>使用“文件 → 切换工作区…”（⌘O）更换工作区。</p></div></main></body></html>
      """,
      baseURL: nil
    )
  }

  private func showFatalError(_ message: String) {
    let escaped = htmlEscape(message)
    webView.loadHTMLString(
      """
      <!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="dark"><style>html,body{height:100%;margin:0;background:#191919;color:#f2f2f2;font:14px -apple-system,BlinkMacSystemFont,sans-serif}main{height:100%;display:grid;place-items:center}.card{max-width:660px;padding:36px}h2{color:#fda4af}p{color:#bbb;line-height:1.55}</style></head><body><main><div class="card"><h2>Codex Relay Plus 启动失败</h2><p>\(escaped)</p><p>可使用“文件 → 重启 Relay”（⇧⌘R）重试，或“文件 → 切换工作区…”（⌘O）选择其他工作区。</p></div></main></body></html>
      """,
      baseURL: nil
    )
  }

  private func htmlEscape(_ value: String) -> String {
    value
      .replacingOccurrences(of: "&", with: "&amp;")
      .replacingOccurrences(of: "<", with: "&lt;")
      .replacingOccurrences(of: ">", with: "&gt;")
      .replacingOccurrences(of: "\"", with: "&quot;")
      .replacingOccurrences(of: "'", with: "&#39;")
  }

  func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
    guard let url = navigationAction.request.url else {
      decisionHandler(.cancel)
      return
    }
    if url.scheme == "about" || (url.host == "127.0.0.1" && url.port == controlPort) || (url.host == "localhost" && url.port == controlPort) {
      decisionHandler(.allow)
      return
    }
    if navigationAction.navigationType == .linkActivated {
      NSWorkspace.shared.open(url)
    }
    decisionHandler(.cancel)
  }

  func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
    if let url = navigationAction.request.url {
      NSWorkspace.shared.open(url)
    }
    return nil
  }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
