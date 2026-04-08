#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TMP_DIR="${REPO_ROOT}/tests/tmp/test-bundled-acc"
PROJECT_DIR="${TMP_DIR}/project"

rm -rf "${TMP_DIR}"
mkdir -p "${PROJECT_DIR}"

(
  cd "${PROJECT_DIR}"
  "${REPO_ROOT}/skills/acc-collab-runtime/scripts/acc-run.sh" install --type codex --agent-id codex-main >/dev/null
  "${REPO_ROOT}/skills/acc-collab-runtime/scripts/acc-run.sh" claim --id codex-main --files src/index.ts --ttl 300 >/dev/null
)

find "${PROJECT_DIR}/.agent-comms/leases" -type f -name '*.json' | grep -q .
PROJECT_DIR="${PROJECT_DIR}" node <<'EOF'
const fs = require("fs");
const path = require("path");

const leasesDir = path.join(process.env.PROJECT_DIR, ".agent-comms", "leases");
const files = fs.readdirSync(leasesDir).filter((file) => file.endsWith(".json"));
if (files.length === 0) {
  process.exit(1);
}
const lease = JSON.parse(fs.readFileSync(path.join(leasesDir, files[0]), "utf8"));
if (lease.owner !== "codex-main") {
  process.exit(1);
}
EOF

echo "test-bundled-acc.sh: ok"
