#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
BRIDGE_DIR="$ROOT_DIR/native/tailcat-bridge"
OUT_DIR="$ROOT_DIR/apps/mobile/native-libs"
GOMOBILE_COMMIT="4776eadac327bcb80cebc7413c91f8b4abf8ffa1"

: "${ANDROID_HOME:=${ANDROID_SDK_ROOT:-}}"
if [[ -z "${ANDROID_HOME:-}" ]]; then
  echo "ANDROID_HOME or ANDROID_SDK_ROOT is required" >&2
  exit 1
fi

export PATH="$(go env GOPATH)/bin:$PATH"
go install "golang.org/x/mobile/cmd/gomobile@${GOMOBILE_COMMIT}"
go install "golang.org/x/mobile/cmd/gobind@${GOMOBILE_COMMIT}"
gomobile init

mkdir -p "$OUT_DIR"
(
  cd "$BRIDGE_DIR"
  gomobile bind \
    -target=android \
    -androidapi=24 \
    -javapkg=com.muee91.codexrelay.tailcat \
    -o "$OUT_DIR/CodexRelayTailcat.aar" \
    ./bridge
)

echo "Built: $OUT_DIR/CodexRelayTailcat.aar"
