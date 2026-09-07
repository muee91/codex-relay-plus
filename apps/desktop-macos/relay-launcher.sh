#!/usr/bin/env bash
set -euo pipefail

RUNTIME_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$RUNTIME_DIR/node-bin"
TAILCAT_BIN="$RUNTIME_DIR/tailcat-relay-server"
RELAY_PORT="${PORT:-8787}"
SUPPORT_DIR="${CODEX_RELAY_HOME:-$HOME/Library/Application Support/Codex Relay Plus}"
DESKTOP_RELAY_PID_FILE="$SUPPORT_DIR/desktop-relay-launcher.pid"
TAILCAT_KEY="$SUPPORT_DIR/tailcat-server.json"
TAILCAT_STATUS_FILE="$SUPPORT_DIR/tailcat-status.$$"
TAILCAT_INITIAL_READY_WAIT_MS=3000
TAILCAT_ENABLED="${CODEX_RELAY_TAILCAT_ENABLED:-1}"

node_pid=""
tailcat_pid=""
bonjour_pid=""

stop_stale_launcher() {
  local stale_pid stale_command
  if [[ ! -s "$DESKTOP_RELAY_PID_FILE" ]]; then
    return
  fi

  stale_pid="$(tr -d '[:space:]' < "$DESKTOP_RELAY_PID_FILE")"
  if [[ ! "$stale_pid" =~ ^[0-9]+$ ]] || [[ "$stale_pid" == "$$" ]]; then
    rm -f "$DESKTOP_RELAY_PID_FILE"
    return
  fi

  if ! kill -0 "$stale_pid" >/dev/null 2>&1; then
    rm -f "$DESKTOP_RELAY_PID_FILE"
    return
  fi

  stale_command="$(ps -p "$stale_pid" -o command= 2>/dev/null || true)"
  if [[ "$stale_command" != *"/relay-launcher.sh"* && "$stale_command" != *"/runtime/node"* ]]; then
    return
  fi

  echo "Stopping stale Codex Relay launcher pid $stale_pid." >&2
  kill -TERM "-$stale_pid" >/dev/null 2>&1 || kill -TERM "$stale_pid" >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if ! kill -0 "$stale_pid" >/dev/null 2>&1; then
      break
    fi
    sleep 0.2
  done
  if kill -0 "$stale_pid" >/dev/null 2>&1; then
    kill -KILL "-$stale_pid" >/dev/null 2>&1 || kill -KILL "$stale_pid" >/dev/null 2>&1 || true
  fi
  rm -f "$DESKTOP_RELAY_PID_FILE"
}

write_launcher_pid() {
  printf '%s\n' "$$" > "$DESKTOP_RELAY_PID_FILE"
}

cleanup() {
  trap - EXIT INT TERM
  [[ -n "$node_pid" ]] && kill "$node_pid" >/dev/null 2>&1 || true
  [[ -n "$tailcat_pid" ]] && kill "$tailcat_pid" >/dev/null 2>&1 || true
  [[ -n "$bonjour_pid" ]] && kill "$bonjour_pid" >/dev/null 2>&1 || true
  [[ -n "$node_pid" ]] && wait "$node_pid" >/dev/null 2>&1 || true
  [[ -n "$tailcat_pid" ]] && wait "$tailcat_pid" >/dev/null 2>&1 || true
  [[ -n "$bonjour_pid" ]] && wait "$bonjour_pid" >/dev/null 2>&1 || true
  rm -f "$TAILCAT_STATUS_FILE"
  if [[ -s "$DESKTOP_RELAY_PID_FILE" ]] && [[ "$(tr -d '[:space:]' < "$DESKTOP_RELAY_PID_FILE")" == "$$" ]]; then
    rm -f "$DESKTOP_RELAY_PID_FILE"
  fi
}
trap cleanup EXIT INT TERM

mkdir -p "$SUPPORT_DIR"
stop_stale_launcher
write_launcher_pid
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
