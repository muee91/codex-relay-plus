#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACTS_DIR="${ARTIFACTS_DIR:-$ROOT_DIR/artifacts}"

mkdir -p "$ARTIFACTS_DIR"

ARTIFACTS_DIR="$ARTIFACTS_DIR" \
  APP_VERSION="${APP_VERSION:-1.4.0}" \
  BUILD_NUMBER="${BUILD_NUMBER:-1}" \
  "$ROOT_DIR/apps/desktop-macos/build.sh"

ARTIFACTS_DIR="$ARTIFACTS_DIR" \
  "$ROOT_DIR/scripts/build-android-release.sh"

echo "Artifacts: $ARTIFACTS_DIR"
find "$ARTIFACTS_DIR" -maxdepth 2 -mindepth 1 -print | sort
