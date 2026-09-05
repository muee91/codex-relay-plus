Pod::Spec.new do |spec|
  spec.name = "CodexRelayTailcat"
  spec.version = "1.0.0"
  spec.summary = "Native Tailcat transport for Codex Relay Plus"
  spec.homepage = "https://github.com/muee91/codex-relay-plus"
  spec.license = { :type => "Apache-2.0" }
  spec.author = { "Codex Relay Plus" => "maintainers@invalid.local" }
  spec.source = { :git => "https://github.com/muee91/codex-relay-plus.git", :tag => spec.version.to_s }
  spec.platform = :ios, "16.4"
  spec.source_files = "ios/**/*.{h,m}"
  spec.vendored_frameworks = "Bridge.xcframework"
  spec.dependency "React-Core"
  spec.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }
end
