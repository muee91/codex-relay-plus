#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GO_VERSION="1.27.1"
GO_ROOT="$HOME/.cache/codex-relay-go/go${GO_VERSION}"

ensure_go_toolchain() {
  if [[ -x "$GO_ROOT/go/bin/go" ]]; then
    export PATH="$GO_ROOT/go/bin:$PATH"
    return
  fi

  local os arch archive metadata filename expected actual
  case "$(uname -s)" in
    Darwin) os="darwin" ;;
    Linux) os="linux" ;;
    *) echo "Unsupported EAS host OS for Tailcat: $(uname -s)" >&2; exit 1 ;;
  esac
  case "$(uname -m)" in
    arm64|aarch64) arch="arm64" ;;
    x86_64|amd64) arch="amd64" ;;
    *) echo "Unsupported EAS host architecture for Tailcat: $(uname -m)" >&2; exit 1 ;;
  esac

  mkdir -p "$GO_ROOT"
  metadata="$(mktemp -t codex-relay-go-metadata.XXXXXX)"
  archive="$(mktemp -t codex-relay-go-archive.XXXXXX)"

  curl --fail --silent --show-error --location \
    'https://go.dev/dl/?mode=json&include=all' > "$metadata"
  read -r filename expected < <(
    node - "$metadata" "$GO_VERSION" "$os" "$arch" <<'NODE'
const fs = require("node:fs");
const [path, version, os, arch] = process.argv.slice(2);
const releases = JSON.parse(fs.readFileSync(path, "utf8"));
const release = releases.find((entry) => entry.version === `go${version}`);
const file = release?.files?.find(
  (entry) => entry.os === os && entry.arch === arch && entry.kind === "archive",
);
if (!file?.filename || !file?.sha256) process.exit(2);
process.stdout.write(`${file.filename} ${file.sha256}\n`);
NODE
  )
  if [[ -z "${filename:-}" || -z "${expected:-}" ]]; then
    rm -f "$metadata" "$archive"
    echo "Could not resolve Go ${GO_VERSION} archive metadata for ${os}/${arch}" >&2
    exit 1
  fi

  curl --fail --silent --show-error --location \
    "https://go.dev/dl/${filename}" -o "$archive"
  if command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$archive" | awk '{print $1}')"
  else
    actual="$(sha256sum "$archive" | awk '{print $1}')"
  fi
  if [[ "$actual" != "$expected" ]]; then
    rm -f "$metadata" "$archive"
    echo "Go ${GO_VERSION} archive checksum mismatch" >&2
    exit 1
  fi

  rm -rf "$GO_ROOT/go"
  tar -C "$GO_ROOT" -xzf "$archive"
  rm -f "$metadata" "$archive"
  export PATH="$GO_ROOT/go/bin:$PATH"
  go version
}

case "${EAS_BUILD_PLATFORM:-}" in
  ios)
    ensure_go_toolchain
    exec bash "$SCRIPT_DIR/build-tailcat-ios.sh"
    ;;
  android)
    ensure_go_toolchain
    exec bash "$SCRIPT_DIR/build-tailcat-android.sh"
    ;;
  *)
    echo "EAS_BUILD_PLATFORM is not ios or android; skipping Tailcat native build."
    ;;
esac
