#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TMP_DIR="${REPO_ROOT}/tests/tmp/test-acc-run"
LOG_FILE="${TMP_DIR}/calls.log"
BIN_DIR="${TMP_DIR}/bin"

rm -rf "${TMP_DIR}"
mkdir -p "${TMP_DIR}" "${BIN_DIR}"
: > "${LOG_FILE}"
ln -s "${REPO_ROOT}/tests/fixtures/fake-acc.sh" "${BIN_DIR}/acc"

ACC_TEST_LOG="${LOG_FILE}" \
PATH="${BIN_DIR}:${PATH}" \
ACC_CLI=acc \
"${REPO_ROOT}/skills/acc-collab-runtime/scripts/acc-run.sh" \
claim --id codex-main --files src/index.ts --ttl 300 >/dev/null

grep -F 'claim --id codex-main --files src/index.ts --ttl 300' "${LOG_FILE}" >/dev/null

echo "test-acc-run.sh: ok"
