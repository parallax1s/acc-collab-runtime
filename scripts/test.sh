#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

(cd "${REPO_ROOT}/acc" && node test/leases.test.js && node test/core.test.js && node test/task.test.js && node test/install-claude.test.js)
"${REPO_ROOT}/tests/test-acc-run.sh"
"${REPO_ROOT}/tests/test-bundled-acc.sh"
"${REPO_ROOT}/tests/test-acc-guard.sh"
"${REPO_ROOT}/tests/test-plugin-bundles.sh"
"${REPO_ROOT}/tests/test-install-codex.sh"
"${REPO_ROOT}/tests/test-install-claude.sh"

echo "All ACC Collaboration Runtime tests passed."
