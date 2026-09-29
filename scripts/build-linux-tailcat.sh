#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TAILCAT_DIR="$ROOT_DIR/native/tailcat-bridge"
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT_DIR/artifacts/linux}"
GOARCH_VALUE="${GOARCH:-}"

if [[ -z "$GOARCH_VALUE" ]]; then
  case "$(uname -m)" in
    x86_64|amd64) GOARCH_VALUE="amd64" ;;
    arm64|aarch64) GOARCH_VALUE="arm64" ;;
    *) echo "Unsupported host architecture: $(uname -m)" >&2; exit 1 ;;
  esac
fi

case "$GOARCH_VALUE" in
  amd64|arm64) ;;
  *) echo "Unsupported Linux GOARCH: $GOARCH_VALUE (expected amd64 or arm64)" >&2; exit 1 ;;
esac

if ! command -v go >/dev/null 2>&1; then
  echo "Go 1.27+ is required to build Tailcat" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
OUTPUT_PATH="$OUTPUT_DIR/tailcat-relay-server-linux-$GOARCH_VALUE"
(
  cd "$TAILCAT_DIR"
  GOOS=linux GOARCH="$GOARCH_VALUE" CGO_ENABLED=0 \
    go build -mod=readonly -trimpath -ldflags="-s -w" \
    -o "$OUTPUT_PATH" ./cmd/tailcat-relay-server
)
chmod 755 "$OUTPUT_PATH"
echo "Built: $OUTPUT_PATH"
