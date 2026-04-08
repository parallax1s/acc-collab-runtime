#!/usr/bin/env bash
# codex-wrapper.sh — Wraps Codex invocation with ACC context injection.
# Usage: codex-wrapper.sh <codex-agent-id> <codex-command> [args...]
#
# Reads inbox + active leases and prepends them to the prompt/instructions.

set -euo pipefail

AGENT_ID="${1:?Usage: codex-wrapper.sh <agent-id> <codex-command> [args...]}"
shift

ACC_BIN="$(dirname "$(readlink -f "$0")")/../../bin/acc.js"

# Gather ACC context
ACC_CONTEXT=$(node "$ACC_BIN" recv --id "$AGENT_ID" --format inject 2>/dev/null || true)
ACC_STATUS=$(node "$ACC_BIN" status --json 2>/dev/null || true)

if [ -n "$ACC_CONTEXT" ]; then
  echo "--- ACC Context for $AGENT_ID ---"
  echo "$ACC_CONTEXT"
  echo "--- End ACC Context ---"
  echo ""
fi

# Execute the original codex command
exec "$@"
