package expo.modules.codexrelaytailcat

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import tailcatbridge.Tailcatbridge

class CodexRelayTailcatModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CodexRelayTailcat")

    AsyncFunction("startProxy") { address: String, remotePort: Long ->
      Tailcatbridge.startProxy(address, remotePort)
    }

    Function("stopProxy") {
      Tailcatbridge.stopProxy()
    }

    Function("currentProxyUrl") {
      Tailcatbridge.currentProxyURL()
    }

    Function("version") {
      Tailcatbridge.version()
    }
  }
}
