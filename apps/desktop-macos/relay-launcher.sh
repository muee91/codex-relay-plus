#!/usr/bin/env bash
set -euo pipefail

RUNTIME_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$RUNTIME_DIR/node-bin"
TAILCAT_BIN="$RUNTIME_DIR/tailcat-relay-server"
RELAY_PORT="${PORT:-8787}"
SUPPORT_DIR="${CODEX_RELAY_HOME:-$HOME/Library/Application Support/Codex Relay Plus}"
TAILCAT_KEY="$SUPPORT_DIR/tailcat-server.json"
TAILCAT_STARTUP_FILE="$SUPPORT_DIR/tailcat-startup.$$"

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
  rm -f "$TAILCAT_STARTUP_FILE"
}
trap cleanup EXIT INT TERM

mkdir -p "$SUPPORT_DIR"
rm -f "$TAILCAT_STARTUP_FILE"

# Bonjour is advisory discovery only. LAN IP candidates in the regular pairing
# payload remain available even if the service publisher is unavailable.
if command -v dns-sd >/dev/null 2>&1; then
  dns-sd -R "Codex Relay Plus" _codex-relay._tcp local "$RELAY_PORT" >/dev/null 2>&1 &
  bonjour_pid=$!
fi

# Start Tailcat once and wait only briefly for its post-Start readiness record.
# This keeps remote bootstrap truthful without allowing DERP lookup to block the
# normal LAN Relay for Tailcat's full network timeout.
if [[ -x "$TAILCAT_BIN" ]]; then
  "$TAILCAT_BIN" --key "$TAILCAT_KEY" --port "$RELAY_PORT" >"$TAILCAT_STARTUP_FILE" &
  tailcat_pid=$!

  for _ in {1..30}; do
    [[ -s "$TAILCAT_STARTUP_FILE" ]] && break
    kill -0 "$tailcat_pid" >/dev/null 2>&1 || break
    sleep 0.1
  done

  tailcat_addr=""
  if [[ -s "$TAILCAT_STARTUP_FILE" ]] && kill -0 "$tailcat_pid" >/dev/null 2>&1; then
    tailcat_addr="$(sed -n 's/.*"address":"\([^"]*\)".*/\1/p' "$TAILCAT_STARTUP_FILE" | tail -n 1 | tr -d '\r\n')"
  fi

  if [[ "$tailcat_addr" == tc* ]]; then
    export CODEX_RELAY_TAILCAT_ADDR="$tailcat_addr"
    export CODEX_RELAY_TAILCAT_PORT="$RELAY_PORT"
    echo "Tailcat remote transport: $tailcat_addr" >&2
  else
    kill "$tailcat_pid" >/dev/null 2>&1 || true
    wait "$tailcat_pid" >/dev/null 2>&1 || true
    tailcat_pid=""
    echo "Tailcat remote transport unavailable; continuing with LAN connectivity." >&2
  fi
  rm -f "$TAILCAT_STARTUP_FILE"
fi

"$NODE_BIN" "$@" &
node_pid=$!
set +e
wait "$node_pid"
status=$?
set -e
node_pid=""
exit "$status"
