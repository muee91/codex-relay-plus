#!/usr/bin/env bash
set -euo pipefail

RUNTIME_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$RUNTIME_DIR/node-bin"
TAILCAT_BIN="$RUNTIME_DIR/tailcat-relay-server"
RELAY_PORT="${PORT:-8787}"
SUPPORT_DIR="${CODEX_RELAY_HOME:-$HOME/Library/Application Support/Codex Relay Plus}"
TAILCAT_KEY="$SUPPORT_DIR/tailcat-server.json"
TAILCAT_STATUS_FILE="$SUPPORT_DIR/tailcat-status.$$"
TAILCAT_INITIAL_READY_WAIT_MS=3000
TAILCAT_ENABLED="${CODEX_RELAY_TAILCAT_ENABLED:-1}"

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

# Tailcat is the normal remote transport when enabled. Give the helper a short
# bounded window to publish its startup record before Relay creates the first
# pairing QR. Never make LAN Relay availability depend on remote readiness.
if [[ "$TAILCAT_ENABLED" != "0" && -x "$TAILCAT_BIN" ]]; then
  export CODEX_RELAY_TAILCAT_STATUS_FILE="$TAILCAT_STATUS_FILE"
  export CODEX_RELAY_TAILCAT_PORT="$RELAY_PORT"
  "$TAILCAT_BIN" --key "$TAILCAT_KEY" --port "$RELAY_PORT" >"$TAILCAT_STATUS_FILE" 2>>"$SUPPORT_DIR/tailcat.log" &
  tailcat_pid=$!

  wait_steps=$((TAILCAT_INITIAL_READY_WAIT_MS / 100))
  for ((step = 0; step < wait_steps; step += 1)); do
    if [[ -s "$TAILCAT_STATUS_FILE" ]]; then
      echo "Tailcat remote transport ready for initial pairing." >&2
      break
    fi
    if ! kill -0 "$tailcat_pid" >/dev/null 2>&1; then
      echo "Tailcat remote transport exited before readiness; continuing with LAN Relay." >&2
      break
    fi
    sleep 0.1
  done

  if [[ ! -s "$TAILCAT_STATUS_FILE" ]] && kill -0 "$tailcat_pid" >/dev/null 2>&1; then
    echo "Tailcat remote transport is still starting; continuing with LAN Relay." >&2
  fi
else
  unset CODEX_RELAY_TAILCAT_STATUS_FILE CODEX_RELAY_TAILCAT_PORT
  if [[ "$TAILCAT_ENABLED" == "0" ]]; then
    echo "Tailcat remote transport disabled by desktop setting; LAN Relay remains available." >&2
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
