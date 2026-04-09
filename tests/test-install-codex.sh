#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TMP_DIR="${REPO_ROOT}/tests/tmp/test-install-codex"
CODEX_HOME="${TMP_DIR}/codex-home"
HOME_ROOT="${TMP_DIR}"
PLUGIN_DIR="${CODEX_HOME}/plugins/cache/local-codex-plugins/acc-collab-runtime/local"
SKILL_DIR="${CODEX_HOME}/skills/acc-collab-runtime"
CONFIG_PATH="${CODEX_HOME}/config.toml"
HOME_PLUGIN_LINK="${HOME_ROOT}/plugins/acc-collab-runtime"
MARKETPLACE_PATH="${HOME_ROOT}/.agents/plugins/marketplace.json"

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
[[ -L "${HOME_PLUGIN_LINK}" ]]
[[ "$(readlink "${HOME_PLUGIN_LINK}")" == "${REPO_ROOT}" ]]
[[ -f "${MARKETPLACE_PATH}" ]]
grep -F '[plugins."acc-collab-runtime@local-codex-plugins"]' "${CONFIG_PATH}" >/dev/null
grep -F 'enabled = true' "${CONFIG_PATH}" >/dev/null

MARKETPLACE_PATH="${MARKETPLACE_PATH}" \
node <<'EOF'
const fs = require("fs");

const marketplace = JSON.parse(fs.readFileSync(process.env.MARKETPLACE_PATH, "utf8"));
const entry = (marketplace.plugins || []).find((plugin) => plugin && plugin.name === "acc-collab-runtime");

if (!entry) {
  process.exit(1);
}
if (!entry.source || entry.source.source !== "local" || entry.source.path !== "./plugins/acc-collab-runtime") {
  process.exit(1);
}
if (!entry.policy || entry.policy.installation !== "AVAILABLE" || entry.policy.authentication !== "ON_INSTALL") {
  process.exit(1);
}
EOF

echo "test-install-codex.sh: ok"
