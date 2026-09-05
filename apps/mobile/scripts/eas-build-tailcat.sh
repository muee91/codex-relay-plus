#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "${EAS_BUILD_PLATFORM:-}" in
  ios)
    exec bash "$SCRIPT_DIR/build-tailcat-ios.sh"
    ;;
  android)
    exec bash "$SCRIPT_DIR/build-tailcat-android.sh"
    ;;
  *)
    echo "EAS_BUILD_PLATFORM is not ios or android; skipping Tailcat native build."
    ;;
esac
