#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${ACC_TEST_LOG:?ACC_TEST_LOG is required}"

printf '%s\n' "$*" >> "${LOG_FILE}"

case "${1:-}" in
  claim)
    echo '{"status":"ok","command":"claim"}'
    ;;
  renew)
    echo '{"status":"ok","command":"renew"}'
    ;;
  release)
    echo '{"status":"ok","command":"release"}'
    ;;
  recv)
    echo '{"status":"ok","command":"recv"}'
    ;;
  *)
    echo '{"status":"ok"}'
    ;;
esac
