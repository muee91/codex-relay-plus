#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
BRIDGE_DIR="$ROOT_DIR/native/tailcat-bridge"
OUT_DIR="$ROOT_DIR/apps/mobile/native-tailcat-ios"
FRAMEWORK="$OUT_DIR/Bridge.xcframework"
GOMOBILE_VERSION="v0.0.0-20260821190718-4776eadac327"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Tailcat iOS bindings require macOS with Xcode installed." >&2
  exit 1
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "Xcode command line tools are required to build the Tailcat iOS transport." >&2
  exit 1
fi

if ! command -v go >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    HOMEBREW_NO_AUTO_UPDATE=1 brew install go
  else
    echo "Go is required to build the Tailcat iOS transport." >&2
    exit 1
  fi
fi

export GOTOOLCHAIN="${GOTOOLCHAIN:-auto}"
export PATH="$(go env GOPATH)/bin:$PATH"

go install "golang.org/x/mobile/cmd/gomobile@${GOMOBILE_VERSION}"
go install "golang.org/x/mobile/cmd/gobind@${GOMOBILE_VERSION}"
gomobile init

mkdir -p "$OUT_DIR"
rm -rf "$FRAMEWORK"
(
  cd "$BRIDGE_DIR"
  go mod verify
  gomobile bind \
    -trimpath \
    -target=ios \
    -iosversion=16.4 \
    -bundleid=com.gronstudio.codexrelay.tailcat \
    -prefix=Go \
    -o "$FRAMEWORK" \
    ./bridge
)

echo "Built: $FRAMEWORK"
