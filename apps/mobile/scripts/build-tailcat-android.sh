#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
BRIDGE_DIR="$ROOT_DIR/native/tailcat-bridge"
OUT_DIR="$ROOT_DIR/apps/mobile/native-libs"
GOMOBILE_VERSION="v0.0.0-20260821190718-4776eadac327"

: "${ANDROID_HOME:=${ANDROID_SDK_ROOT:-}}"
if [[ -z "${ANDROID_HOME:-}" ]]; then
  echo "ANDROID_HOME or ANDROID_SDK_ROOT is required" >&2
  exit 1
fi
if ! command -v go >/dev/null 2>&1; then
  echo "Go is required to build the Tailcat Android transport." >&2
  exit 1
fi

export GOTOOLCHAIN="${GOTOOLCHAIN:-auto}"
export PATH="$(go env GOPATH)/bin:$PATH"
go install "golang.org/x/mobile/cmd/gomobile@${GOMOBILE_VERSION}"
go install "golang.org/x/mobile/cmd/gobind@${GOMOBILE_VERSION}"
gomobile init

mkdir -p "$OUT_DIR"
(
  cd "$BRIDGE_DIR"
  gomobile bind \
    -mod=readonly \
    -trimpath \
    -target=android \
    -androidapi=24 \
    -o "$OUT_DIR/CodexRelayTailcat.aar" \
    ./bridge
)

echo "Built: $OUT_DIR/CodexRelayTailcat.aar"
