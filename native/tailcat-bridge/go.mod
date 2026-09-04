module github.com/muee91/codex-relay-plus/native/tailcat-bridge

go 1.27.0

require (
	github.com/tailscale/tailcat v0.5.0
	golang.org/x/mobile v0.0.0-20260821190718-4776eadac327
	tailscale.com v1.103.0-pre.0.20260830144538-72780705eda8
)

tool (
	golang.org/x/mobile/cmd/gobind
	golang.org/x/mobile/cmd/gomobile
)
