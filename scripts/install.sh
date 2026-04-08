#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-all}"

case "${TARGET}" in
  codex)
    exec "${SCRIPT_DIR}/install-codex-skill.sh"
    ;;
  claude)
    exec "${SCRIPT_DIR}/install-claude-skill.sh"
    ;;
  all)
    "${SCRIPT_DIR}/install-codex-skill.sh"
    "${SCRIPT_DIR}/install-claude-skill.sh"
    ;;
  *)
    echo "Usage: ./scripts/install.sh [codex|claude|all]" >&2
    exit 1
    ;;
esac
