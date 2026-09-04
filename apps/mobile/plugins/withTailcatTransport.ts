import {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
  type ConfigPlugin,
} from "expo/config-plugins";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const gradleMarker = "// @generated codex-relay-plus: Tailcat AAR";
const packageMarker = "// @generated codex-relay-plus: Tailcat transport package";
const kotlinPackage = "com.muee91.codexrelayplus";
const kotlinRelativePath = join(
  "app",
  "src",
  "main",
  "java",
  ...kotlinPackage.split("."),
  "CodexRelayTransportModule.kt",
);

const withTailcatTransport: ConfigPlugin = (config) => {
  config = withTailcatAar(config);
  config = withTailcatPackageRegistration(config);
  config = withTailcatNativeModule(config);
  config = withTailcatPermissions(config);
  return config;
};

const withTailcatAar: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error("Tailcat integration requires the generated Android app/build.gradle to use Groovy.");
    }
    if (config.modResults.contents.includes(gradleMarker)) {
      return config;
    }
    const dependencyBlock = "dependencies {";
    const index = config.modResults.contents.indexOf(dependencyBlock);
    if (index === -1) {
      throw new Error("Could not find dependencies block in generated Android app/build.gradle.");
    }
    const insertion = `${dependencyBlock}\n    ${gradleMarker}\n    implementation files("../../native-libs/CodexRelayTailcat.aar")`;
    config.modResults.contents =
      config.modResults.contents.slice(0, index) +
      config.modResults.contents.slice(index).replace(dependencyBlock, insertion);
    return config;
  });

const withTailcatPackageRegistration: ConfigPlugin = (config) =>
  withMainApplication(config, (config) => {
    if (config.modResults.language !== "kt") {
      throw new Error("Tailcat integration requires a Kotlin MainApplication.");
    }
    if (config.modResults.contents.includes(packageMarker)) {
      return config;
    }
    const marker = "PackageList(this).packages.apply {";
    if (!config.modResults.contents.includes(marker)) {
      throw new Error("Could not find PackageList(this).packages.apply in MainApplication.kt.");
    }
    const replacement = `${marker}\n              ${packageMarker}\n              add(CodexRelayTransportPackage())`;
    config.modResults.contents = config.modResults.contents.replace(marker, replacement);
    return config;
  });

const withTailcatNativeModule: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "android",
    async (config) => {
      const path = join(config.modRequest.platformProjectRoot, kotlinRelativePath);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, kotlinSource, "utf8");
      return config;
    },
  ]);

const withTailcatPermissions: ConfigPlugin = (config) =>
  withAndroidManifest(config, (config) => {
    for (const permission of [
      "android.permission.ACCESS_NETWORK_STATE",
      "android.permission.CHANGE_WIFI_MULTICAST_STATE",
    ]) {
      AndroidConfig.Permissions.addPermission(config.modResults, permission);
    }
    return config;
  });

const kotlinSource = `package ${kotlinPackage}

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Handler
import android.os.Looper
import bridge.Bridge
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReactPackage
import com.facebook.react.uimanager.ViewManager
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class CodexRelayTransportModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val executor = Executors.newSingleThreadExecutor()
  private val preferences = context.getSharedPreferences("codex-relay-tailcat", Context.MODE_PRIVATE)

  init {
    executor.execute { restoreProxyIfConfigured() }
  }

  override fun getName() = "CodexRelayTransport"

  @ReactMethod
  fun configureRelayProxy(serverAddr: String, remotePort: Double, lanTargetsJson: String, mode: String, promise: Promise) {
    executor.execute {
      try {
        val localUrl = configureProxy(serverAddr, remotePort.toLong(), lanTargetsJson, mode)
        preferences.edit()
          .putString("serverAddr", serverAddr)
          .putLong("remotePort", remotePort.toLong())
          .putString("lanTargetsJson", lanTargetsJson)
          .putString("mode", mode)
          .apply()
        promise.resolve(localUrl)
      } catch (error: Throwable) {
        promise.reject("TAILCAT_CONFIGURE_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun startTailcatProxy(serverAddr: String, remotePort: Double, promise: Promise) {
    configureRelayProxy(serverAddr, remotePort, "[]", "remote", promise)
  }

  @ReactMethod
  fun stopTailcatProxy(promise: Promise) {
    executor.execute {
      try {
        preferences.edit().clear().apply()
        Bridge.stopProxy()
        promise.resolve(null)
      } catch (error: Throwable) {
        promise.reject("TAILCAT_STOP_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun tailcatStatus(promise: Promise) {
    executor.execute {
      try {
        promise.resolve(Bridge.statusJSON())
      } catch (error: Throwable) {
        promise.reject("TAILCAT_STATUS_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun refreshTailcatPath(promise: Promise) {
    executor.execute {
      try {
        promise.resolve(Bridge.refreshPath())
      } catch (error: Throwable) {
        promise.reject("TAILCAT_STATUS_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun discoverLocalRelay(timeoutMs: Double, promise: Promise) {
    val manager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    val settled = AtomicBoolean(false)
    lateinit var listener: NsdManager.DiscoveryListener

    fun stopDiscovery() {
      try {
        manager.stopServiceDiscovery(listener)
      } catch (_: Throwable) {
      }
    }

    listener = object : NsdManager.DiscoveryListener {
      override fun onDiscoveryStarted(serviceType: String) = Unit
      override fun onDiscoveryStopped(serviceType: String) = Unit
      override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
        if (settled.compareAndSet(false, true)) {
          stopDiscovery()
          promise.reject("NSD_START_FAILED", "NSD discovery failed with code $errorCode")
        }
      }
      override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) = Unit
      override fun onServiceLost(serviceInfo: NsdServiceInfo) = Unit
      override fun onServiceFound(serviceInfo: NsdServiceInfo) {
        if (settled.get() || !serviceInfo.serviceType.startsWith("_codex-relay._tcp")) return
        @Suppress("DEPRECATION")
        manager.resolveService(serviceInfo, object : NsdManager.ResolveListener {
          override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) = Unit
          override fun onServiceResolved(resolved: NsdServiceInfo) {
            if (!settled.compareAndSet(false, true)) return
            val rawHost = resolved.host?.hostAddress
            if (rawHost == null) {
              stopDiscovery()
              promise.reject("NSD_RESOLVE_FAILED", "Resolved Relay service did not include an IP address")
              return
            }
            val host = if (rawHost.contains(":")) "[$rawHost]" else rawHost
            stopDiscovery()
            promise.resolve("http://$host:${resolved.port}")
          }
        })
      }
    }

    manager.discoverServices("_codex-relay._tcp.", NsdManager.PROTOCOL_DNS_SD, listener)
    Handler(Looper.getMainLooper()).postDelayed({
      if (settled.compareAndSet(false, true)) {
        stopDiscovery()
        promise.resolve(null)
      }
    }, timeoutMs.toLong().coerceAtLeast(250L))
  }

  private fun configureProxy(serverAddr: String, remotePort: Long, lanTargetsJson: String, mode: String): String {
    val keyFile = File(context.filesDir, "codex-relay-tailcat-client-key")
    return Bridge.configureProxy(serverAddr, remotePort, lanTargetsJson, mode, keyFile.absolutePath)
  }

  private fun restoreProxyIfConfigured() {
    val serverAddr = preferences.getString("serverAddr", null) ?: return
    val remotePort = preferences.getLong("remotePort", 0L)
    if (remotePort !in 1L..65535L) return
    val lanTargetsJson = preferences.getString("lanTargetsJson", "[]") ?: "[]"
    val mode = preferences.getString("mode", "auto") ?: "auto"
    try {
      configureProxy(serverAddr, remotePort, lanTargetsJson, mode)
    } catch (_: Throwable) {
      // A later JS synchronization retries configuration with current discovery data.
    }
  }
}

class CodexRelayTransportPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(CodexRelayTransportModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
`;

export default withTailcatTransport;
