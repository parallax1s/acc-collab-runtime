#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage:
  acc-guard.sh --id <agent-id> --files "<csv>" [--ttl 300] [--renew-every 90] -- <command...>
USAGE
}

AGENT_ID=""
FILES=""
TTL=300
RENEW_EVERY=90

while [[ $# -gt 0 ]]; do
  case "$1" in
    --id)
      AGENT_ID="${2:-}"
      shift 2
      ;;
    --files)
      FILES="${2:-}"
      shift 2
      ;;
    --ttl)
      TTL="${2:-300}"
      shift 2
      ;;
    --renew-every)
      RENEW_EVERY="${2:-90}"
      shift 2
      ;;
    --)
      shift
      break
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$AGENT_ID" || -z "$FILES" || $# -eq 0 ]]; then
  usage
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACC_RUN="$SCRIPT_DIR/acc-run.sh"
RENEW_PID=""

cleanup() {
  if [[ -n "$RENEW_PID" ]]; then
    kill "$RENEW_PID" >/dev/null 2>&1 || true
    wait "$RENEW_PID" 2>/dev/null || true
  fi
  "$ACC_RUN" release --id "$AGENT_ID" --files "$FILES" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

"$ACC_RUN" claim --id "$AGENT_ID" --files "$FILES" --ttl "$TTL"

if [[ "$RENEW_EVERY" -gt 0 ]]; then
  (
    while sleep "$RENEW_EVERY"; do
      "$ACC_RUN" renew --id "$AGENT_ID" --ttl "$TTL" >/dev/null 2>&1 || true
    done
  ) &
  RENEW_PID="$!"
fi

set +e
"$@"
RC=$?
set -e

exit "$RC"

