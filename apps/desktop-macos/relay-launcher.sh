#!/usr/bin/env bash
set -euo pipefail

RUNTIME_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$RUNTIME_DIR/node-bin"
TAILCAT_BIN="$RUNTIME_DIR/tailcat-relay-server"
RELAY_PORT="${PORT:-8787}"
SUPPORT_DIR="${CODEX_RELAY_HOME:-$HOME/Library/Application Support/Codex Relay Plus}"
TAILCAT_KEY="$SUPPORT_DIR/tailcat-server.json"

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
}
trap cleanup EXIT INT TERM

mkdir -p "$SUPPORT_DIR"

# Bonjour is advisory discovery only. LAN IP candidates in the regular pairing
# payload remain available even if the service publisher is unavailable.
if command -v dns-sd >/dev/null 2>&1; then
  dns-sd -R "Codex Relay Plus" _codex-relay._tcp local "$RELAY_PORT" >/dev/null 2>&1 &
  bonjour_pid=$!
fi

# Tailcat is a remote fallback, not a prerequisite for the local Relay. If DERP
# bootstrap is temporarily unavailable we still launch the existing LAN server.
if [[ -x "$TAILCAT_BIN" ]]; then
  if tailcat_addr="$($TAILCAT_BIN --key "$TAILCAT_KEY" --port "$RELAY_PORT" --address-only 2>&1)"; then
    tailcat_addr="$(printf '%s\n' "$tailcat_addr" | tail -n 1 | tr -d '\r\n')"
    if [[ "$tailcat_addr" == tc* ]]; then
      export CODEX_RELAY_TAILCAT_ADDR="$tailcat_addr"
      export CODEX_RELAY_TAILCAT_PORT="$RELAY_PORT"
      "$TAILCAT_BIN" --key "$TAILCAT_KEY" --port "$RELAY_PORT" 1>&2 &
      tailcat_pid=$!
      echo "Tailcat remote transport: $tailcat_addr" >&2
    fi
  else
    echo "Tailcat remote transport unavailable; continuing with LAN connectivity." >&2
  fi
fi

"$NODE_BIN" "$@" &
node_pid=$!
set +e
wait "$node_pid"
status=$?
set -e
node_pid=""
exit "$status"
