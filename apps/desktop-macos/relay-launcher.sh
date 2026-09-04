#!/usr/bin/env bash
set -euo pipefail

RUNTIME_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$RUNTIME_DIR/node-bin"
TAILCAT_BIN="$RUNTIME_DIR/tailcat-relay-server"
RELAY_PORT="${PORT:-8787}"
SUPPORT_DIR="${CODEX_RELAY_HOME:-$HOME/Library/Application Support/Codex Relay Plus}"
TAILCAT_KEY="$SUPPORT_DIR/tailcat-server.json"
TAILCAT_STATUS_FILE="$SUPPORT_DIR/tailcat-status.$$"

node_pid=""
tailcat_pid=""
bonjour_pid=""

cleanup() {
  trap - EXIT INT TERM
  [[ -n "$node_pid" ]] && kill "$node_pid" >/dev/null 2>&1 || true
  [[ -n "$tailcat_pid" ]] && kill "$tailcat_pid" >/dev/null 2>&1 || true
  [[ -n "$bonjour_pid" ]] && kill "$bonjour_pid" >/dev/null 2>&1 || true
  [[ -n "$node_pid" ]] && wait "$node_pid" >/dev/null 2>&1 || true
  [[ -n "$tailcat_pid" ]] && wait "$tailcat_pid" >/dev/null 2>&1 || true
  [[ -n "$bonjour_pid" ]] && wait "$bonjour_pid" >/dev/null 2>&1 || true
  rm -f "$TAILCAT_STATUS_FILE"
}
trap cleanup EXIT INT TERM

mkdir -p "$SUPPORT_DIR"
rm -f "$TAILCAT_STATUS_FILE"

# Bonjour is advisory discovery only. LAN IP candidates in the regular pairing
# payload remain available even if the service publisher is unavailable.
if command -v dns-sd >/dev/null 2>&1; then
  dns-sd -R "Codex Relay Plus" _codex-relay._tcp local "$RELAY_PORT" >/dev/null 2>&1 &
  bonjour_pid=$!
fi

# Tailcat is deliberately asynchronous. The local Relay must never wait for
# DERP/DNS/TLS startup, but a slow Tailcat bootstrap may still become available
# later in the same desktop session. The Node process polls this readiness file
# while rebuilding its network snapshot and adds the Tailcat bootstrap to new
# pairing payloads as soon as the helper reaches server.Start().
if [[ -x "$TAILCAT_BIN" ]]; then
  export CODEX_RELAY_TAILCAT_STATUS_FILE="$TAILCAT_STATUS_FILE"
  export CODEX_RELAY_TAILCAT_PORT="$RELAY_PORT"
  "$TAILCAT_BIN" --key "$TAILCAT_KEY" --port "$RELAY_PORT" >"$TAILCAT_STATUS_FILE" 2>>"$SUPPORT_DIR/tailcat.log" &
  tailcat_pid=$!
  echo "Tailcat remote transport starting asynchronously." >&2
fi

"$NODE_BIN" "$@" &
node_pid=$!
set +e
wait "$node_pid"
status=$?
set -e
node_pid=""
exit "$status"
