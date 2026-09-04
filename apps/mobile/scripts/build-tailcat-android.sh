#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
BRIDGE_DIR="$ROOT_DIR/apps/mobile/tailcatbridge"
MODULE_DIR="$ROOT_DIR/apps/mobile/modules/codex-relay-tailcat"
OUT_DIR="$MODULE_DIR/android/libs"
GOMOBILE_VERSION="v0.0.0-20260821190718-4776eadac327"

: "${ANDROID_HOME:?ANDROID_HOME is required}"
command -v go >/dev/null || { echo "Go is required to build Tailcat Android bridge" >&2; exit 1; }

go version | grep -Eq 'go1\.(27|2[89]|[3-9][0-9])' || {
  echo "Tailcat v0.5.0 requires Go >= 1.27" >&2
  exit 1
}

export GOBIN="${RUNNER_TEMP:-$ROOT_DIR/.tmp-go-bin}"
mkdir -p "$GOBIN" "$OUT_DIR"
go install "golang.org/x/mobile/cmd/gomobile@$GOMOBILE_VERSION"
go install "golang.org/x/mobile/cmd/gobind@$GOMOBILE_VERSION"
"$GOBIN/gomobile" init

(
  cd "$BRIDGE_DIR"
  go mod tidy
  go test ./...
  "$GOBIN/gomobile" bind \
    -target=android \
    -androidapi=24 \
    -javapkg=tailcatbridge \
    -o "$OUT_DIR/tailcatbridge.aar" \
    .
)

test -s "$OUT_DIR/tailcatbridge.aar"
echo "Built $OUT_DIR/tailcatbridge.aar"
