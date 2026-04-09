#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TMP_DIR="${REPO_ROOT}/tests/tmp/test-install-codex"
CODEX_HOME="${TMP_DIR}/codex-home"
PLUGIN_DIR="${CODEX_HOME}/plugins/cache/local-codex-plugins/acc-collab-runtime/local"
SKILL_DIR="${CODEX_HOME}/skills/acc-collab-runtime"
CONFIG_PATH="${CODEX_HOME}/config.toml"

rm -rf "${TMP_DIR}"
mkdir -p "${CODEX_HOME}"

CODEX_HOME="${CODEX_HOME}" "${REPO_ROOT}/scripts/install-codex-skill.sh" >/dev/null
CODEX_HOME="${CODEX_HOME}" "${REPO_ROOT}/scripts/install-codex-skill.sh" >/dev/null

[[ -L "${SKILL_DIR}" ]]
[[ "$(readlink "${SKILL_DIR}")" == "${REPO_ROOT}/skills/acc-collab-runtime" ]]
[[ -L "${PLUGIN_DIR}" ]]
[[ "$(readlink "${PLUGIN_DIR}")" == "${REPO_ROOT}" ]]
[[ -f "${PLUGIN_DIR}/.codex-plugin/plugin.json" ]]
[[ -f "${PLUGIN_DIR}/commands/acc-bootstrap.md" ]]
[[ -f "${PLUGIN_DIR}/commands/acc-sync.md" ]]
[[ -f "${PLUGIN_DIR}/commands/acc-handoff.md" ]]
[[ -f "${PLUGIN_DIR}/skills/acc-collab-runtime/SKILL.md" ]]
grep -F '[plugins."acc-collab-runtime@local-codex-plugins"]' "${CONFIG_PATH}" >/dev/null
grep -F 'enabled = true' "${CONFIG_PATH}" >/dev/null

echo "test-install-codex.sh: ok"
