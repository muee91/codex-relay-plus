#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DESKTOP_DIR="$ROOT_DIR/apps/desktop-macos"
TAILCAT_BRIDGE_DIR="$ROOT_DIR/native/tailcat-bridge"
SOURCE_ICON="$ROOT_DIR/apps/mobile/assets/images/icon.png"
APP_VERSION="${APP_VERSION:-1.0.0}"
BUILD_NUMBER="${BUILD_NUMBER:-1}"
ARCH="${ARCH:-$(uname -m)}"
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT_DIR/.desktop-macos-build/$ARCH}"
APP_NAME="Codex Relay Plus"
APP_DIR="$OUTPUT_DIR/$APP_NAME.app"
CONTENTS="$APP_DIR/Contents"
RESOURCES="$CONTENTS/Resources"
MACOS="$CONTENTS/MacOS"
STAGE_ROOT=""
STAGE=""
ICONSET="$OUTPUT_DIR/AppIcon.iconset"
MASTER_ICON="$OUTPUT_DIR/AppIcon-master.png"

cleanup_stage() {
  if [[ -n "${STAGE_ROOT:-}" && -d "$STAGE_ROOT" ]]; then
    rm -rf "$STAGE_ROOT"
  fi
}

case "$ARCH" in
  arm64|x86_64) ;;
  *) echo "Unsupported macOS architecture: $ARCH" >&2; exit 1 ;;
esac

rm -rf "$OUTPUT_DIR"
STAGE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/codex-relay-plus-deploy.XXXXXX")"
STAGE="$STAGE_ROOT/stage"
trap cleanup_stage EXIT
mkdir -p "$MACOS" "$RESOURCES/runtime" "$STAGE" "$ICONSET"

if [[ ! -f "$SOURCE_ICON" ]]; then
  echo "Canonical icon missing: $SOURCE_ICON" >&2
  exit 1
fi

swift "$DESKTOP_DIR/Tools/IconPrep.swift" "$SOURCE_ICON" "$MASTER_ICON"

make_icon() {
  local pixels="$1"
  local name="$2"
  sips -s format png -z "$pixels" "$pixels" "$MASTER_ICON" --out "$ICONSET/$name" >/dev/null
}
make_icon 16 icon_16x16.png
make_icon 32 icon_16x16@2x.png
make_icon 32 icon_32x32.png
make_icon 64 icon_32x32@2x.png
make_icon 128 icon_128x128.png
make_icon 256 icon_128x128@2x.png
make_icon 256 icon_256x256.png
make_icon 512 icon_256x256@2x.png
make_icon 512 icon_512x512.png
cp "$MASTER_ICON" "$ICONSET/icon_512x512@2x.png"
iconutil -c icns "$ICONSET" -o "$RESOURCES/AppIcon.icns"

(
  cd "$ROOT_DIR/packages/codex-relay"
  "$ROOT_DIR/node_modules/.bin/tsdown"
)
if ! pnpm --filter codex-relay deploy --prod "$STAGE/relay"; then
  rm -rf "$STAGE/relay"
  pnpm --filter codex-relay deploy --prod --legacy "$STAGE/relay"
fi
cp -R "$STAGE/relay" "$RESOURCES/relay"

NODE_BIN="$(command -v node)"
if [[ -z "$NODE_BIN" ]]; then
  echo "Node.js is required to build the desktop bundle" >&2
  exit 1
fi
if ! command -v go >/dev/null 2>&1; then
  echo "Go 1.27+ is required to build the Tailcat transport" >&2
  exit 1
fi

cp "$NODE_BIN" "$RESOURCES/runtime/node-bin"
cp "$DESKTOP_DIR/relay-launcher.sh" "$RESOURCES/runtime/node"
chmod 755 "$RESOURCES/runtime/node" "$RESOURCES/runtime/node-bin"
bash -n "$RESOURCES/runtime/node"
(
  cd "$TAILCAT_BRIDGE_DIR"
  go mod tidy
  go build -mod=mod -trimpath -o "$RESOURCES/runtime/tailcat-relay-server" ./cmd/tailcat-relay-server
)
chmod 755 "$RESOURCES/runtime/tailcat-relay-server"

NODE_ARCHS="$(lipo -archs "$RESOURCES/runtime/node-bin" 2>/dev/null || true)"
if [[ " $NODE_ARCHS " != *" $ARCH "* ]]; then
  echo "Embedded Node architecture mismatch: expected $ARCH, got ${NODE_ARCHS:-unknown}" >&2
  exit 1
fi
TAILCAT_ARCHS="$(lipo -archs "$RESOURCES/runtime/tailcat-relay-server" 2>/dev/null || true)"
if [[ " $TAILCAT_ARCHS " != *" $ARCH "* ]]; then
  echo "Embedded Tailcat architecture mismatch: expected $ARCH, got ${TAILCAT_ARCHS:-unknown}" >&2
  exit 1
fi

plutil -lint "$DESKTOP_DIR/Info.plist" >/dev/null
plutil -lint "$DESKTOP_DIR/Node.entitlements" >/dev/null

sed \
  -e "s/__APP_VERSION__/$APP_VERSION/g" \
  -e "s/__BUILD_NUMBER__/$BUILD_NUMBER/g" \
  "$DESKTOP_DIR/Info.plist" > "$CONTENTS/Info.plist"

swiftc \
  -O \
  -target "$ARCH-apple-macos13.0" \
  -framework AppKit \
  -framework WebKit \
  "$DESKTOP_DIR/Sources/main.swift" \
  -o "$MACOS/CodexRelayPlus"
chmod 755 "$MACOS/CodexRelayPlus"

"$RESOURCES/runtime/node-bin" "$RESOURCES/relay/dist/cli.js" --help >/dev/null

cleanup_signing() {
  if [[ -n "${KEYCHAIN:-}" ]]; then
    security delete-keychain "$KEYCHAIN" >/dev/null 2>&1 || true
  fi
  rm -f "${P12:-}"
  cleanup_stage
}
trap cleanup_signing EXIT

if [[ -n "${MACOS_CERTIFICATE_P12_BASE64:-}" && -n "${MACOS_CERTIFICATE_PASSWORD:-}" && -n "${MACOS_SIGNING_IDENTITY:-}" ]]; then
  KEYCHAIN="$OUTPUT_DIR/signing.keychain-db"
  P12="$OUTPUT_DIR/signing.p12"
  KEYCHAIN_PASSWORD="$(openssl rand -hex 24)"
  printf '%s' "$MACOS_CERTIFICATE_P12_BASE64" | base64 --decode > "$P12"
  security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
  security set-keychain-settings -lut 21600 "$KEYCHAIN"
  security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
  security import "$P12" -k "$KEYCHAIN" -P "$MACOS_CERTIFICATE_PASSWORD" -T /usr/bin/codesign
  security set-key-partition-list -S apple-tool:,apple: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
  security list-keychains -d user -s "$KEYCHAIN" login.keychain-db
  SIGN_IDENTITY="$MACOS_SIGNING_IDENTITY"
else
  SIGN_IDENTITY="-"
  echo "No Developer ID certificate configured; creating an ad-hoc signed build."
fi

sign_timestamp_args=()
if [[ "$SIGN_IDENTITY" != "-" ]]; then
  sign_timestamp_args+=(--timestamp)
else
  sign_timestamp_args+=(--timestamp=none)
fi

while IFS= read -r -d '' candidate; do
  if file "$candidate" | grep -q "Mach-O"; then
    codesign --force --options runtime --sign "$SIGN_IDENTITY" "${sign_timestamp_args[@]}" "$candidate"
  fi
done < <(find "$RESOURCES/relay" -type f -print0)

codesign --force --options runtime --entitlements "$DESKTOP_DIR/Node.entitlements" \
  --sign "$SIGN_IDENTITY" "${sign_timestamp_args[@]}" "$RESOURCES/runtime/node-bin"
codesign --force --options runtime --sign "$SIGN_IDENTITY" "${sign_timestamp_args[@]}" \
  "$RESOURCES/runtime/tailcat-relay-server"
codesign --force --options runtime --sign "$SIGN_IDENTITY" "${sign_timestamp_args[@]}" "$MACOS/CodexRelayPlus"
codesign --force --options runtime --sign "$SIGN_IDENTITY" "${sign_timestamp_args[@]}" "$APP_DIR"
codesign --verify --deep --strict --verbose=2 "$APP_DIR"

has_notary_credentials=0
if [[ -n "${APPLE_ID:-}" && -n "${APPLE_TEAM_ID:-}" && -n "${APPLE_APP_PASSWORD:-}" && "$SIGN_IDENTITY" != "-" ]]; then
  has_notary_credentials=1
  APP_NOTARY_ZIP="$OUTPUT_DIR/Codex-Relay-Plus_${APP_VERSION}_${ARCH}.app.zip"
  ditto -c -k --keepParent "$APP_DIR" "$APP_NOTARY_ZIP"
  xcrun notarytool submit "$APP_NOTARY_ZIP" \
    --apple-id "$APPLE_ID" \
    --team-id "$APPLE_TEAM_ID" \
    --password "$APPLE_APP_PASSWORD" \
    --wait
  xcrun stapler staple "$APP_DIR"
  xcrun stapler validate "$APP_DIR"
  rm -f "$APP_NOTARY_ZIP"
fi

if [[ "${MACOS_APP_ONLY:-0}" == "1" ]]; then
  echo "Built: $APP_DIR"
  exit 0
fi

DMG_NAME="Codex-Relay-Plus_${APP_VERSION}_${ARCH}.dmg"
DMG_PATH="$OUTPUT_DIR/$DMG_NAME"
DMG_STAGE="$OUTPUT_DIR/dmg"
mkdir -p "$DMG_STAGE"
cp -R "$APP_DIR" "$DMG_STAGE/"
ln -s /Applications "$DMG_STAGE/Applications"
hdiutil create -volname "$APP_NAME" -srcfolder "$DMG_STAGE" -ov -format UDZO "$DMG_PATH" >/dev/null

if [[ "$SIGN_IDENTITY" != "-" ]]; then
  codesign --force --sign "$SIGN_IDENTITY" --timestamp "$DMG_PATH"
fi

if [[ "$has_notary_credentials" == "1" ]]; then
  xcrun notarytool submit "$DMG_PATH" \
    --apple-id "$APPLE_ID" \
    --team-id "$APPLE_TEAM_ID" \
    --password "$APPLE_APP_PASSWORD" \
    --wait
  xcrun stapler staple "$DMG_PATH"
  xcrun stapler validate "$DMG_PATH"
else
  echo "Notarization credentials are not configured; skipping notarization."
fi

shasum -a 256 "$DMG_PATH" > "$DMG_PATH.sha256"
echo "Built: $DMG_PATH"
