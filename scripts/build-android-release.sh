#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACTS_DIR="${ARTIFACTS_DIR:-$ROOT_DIR/artifacts}"
ARTIFACT_DIR="${ARTIFACT_DIR:-$ARTIFACTS_DIR/android}"
VERSION_NAME="${CODEX_RELAY_ANDROID_VERSION_NAME:-1.4.0}"
SAFE_VERSION_NAME="${VERSION_NAME//[^A-Za-z0-9._-]/-}"
APK_NAME="${APK_NAME:-CodexRelayPlus-${SAFE_VERSION_NAME}-release.apk}"
APK_PATH="$ARTIFACT_DIR/$APK_NAME"
ANDROID_DIR="$ROOT_DIR/apps/mobile/android"
APK_SOURCE="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"

if [[ -z "${JAVA_HOME:-}" ]]; then
  HOMEBREW_JAVA17="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
  if [[ -x "$HOMEBREW_JAVA17/bin/java" ]]; then
    export JAVA_HOME="$HOMEBREW_JAVA17"
  fi
fi

if [[ -n "${JAVA_HOME:-}" && ! -x "$JAVA_HOME/bin/java" ]]; then
  echo "JAVA_HOME does not contain a usable Java runtime: $JAVA_HOME" >&2
  exit 1
fi

"$ROOT_DIR/apps/mobile/scripts/build-tailcat-android.sh"
CI=true pnpm --filter @codex-relay/mobile exec expo prebuild --platform android --no-install
# Expo may prune workspace dev-dependency links while regenerating the native
# project. Restore the workspace toolchain before another platform build.
CI=true pnpm install --frozen-lockfile

(
  cd "$ANDROID_DIR"
  ./gradlew :app:assembleRelease
)

if [[ ! -f "$APK_SOURCE" ]]; then
  echo "Gradle completed without producing the expected APK: $APK_SOURCE" >&2
  exit 1
fi

mkdir -p "$ARTIFACT_DIR"
cp "$APK_SOURCE" "$APK_PATH"
shasum -a 256 "$APK_PATH" > "$APK_PATH.sha256"
echo "Built: $APK_PATH"
