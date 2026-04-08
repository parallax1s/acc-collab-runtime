#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: acc-inbox.sh <agent-id>" >&2
  exit 1
fi

AGENT_ID="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/acc-run.sh" recv --id "$AGENT_ID" --format inject

