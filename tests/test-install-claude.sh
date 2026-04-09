#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TMP_DIR="${REPO_ROOT}/tests/tmp/test-install-claude"
CLAUDE_HOME="${TMP_DIR}/claude-home"
PLUGIN_DIR="${CLAUDE_HOME}/plugins/cache/local-claude-plugins/acc-collab-runtime/local"
SKILL_DIR="${CLAUDE_HOME}/skills/acc-collab-runtime"
INSTALLED_PLUGINS_PATH="${CLAUDE_HOME}/plugins/installed_plugins.json"
KNOWN_MARKETPLACES_PATH="${CLAUDE_HOME}/plugins/known_marketplaces.json"
SETTINGS_PATH="${CLAUDE_HOME}/settings.json"

rm -rf "${TMP_DIR}"
mkdir -p "${CLAUDE_HOME}"

CLAUDE_HOME="${CLAUDE_HOME}" "${REPO_ROOT}/scripts/install-claude-skill.sh" >/dev/null
CLAUDE_HOME="${CLAUDE_HOME}" "${REPO_ROOT}/scripts/install-claude-skill.sh" >/dev/null

[[ -L "${SKILL_DIR}" ]]
[[ "$(readlink "${SKILL_DIR}")" == "${REPO_ROOT}/skills/acc-collab-runtime" ]]
[[ -L "${PLUGIN_DIR}" ]]
[[ "$(readlink "${PLUGIN_DIR}")" == "${REPO_ROOT}" ]]
[[ -f "${PLUGIN_DIR}/.claude-plugin/plugin.json" ]]
[[ -f "${PLUGIN_DIR}/commands/acc-bootstrap.md" ]]
[[ -f "${PLUGIN_DIR}/commands/acc-sync.md" ]]
[[ -f "${PLUGIN_DIR}/commands/acc-handoff.md" ]]
[[ -f "${PLUGIN_DIR}/skills/acc-collab-runtime/SKILL.md" ]]

INSTALLED_PLUGINS_PATH="${INSTALLED_PLUGINS_PATH}" \
KNOWN_MARKETPLACES_PATH="${KNOWN_MARKETPLACES_PATH}" \
SETTINGS_PATH="${SETTINGS_PATH}" \
PLUGIN_DIR="${PLUGIN_DIR}" \
node <<'EOF'
const fs = require("fs");

const installed = JSON.parse(fs.readFileSync(process.env.INSTALLED_PLUGINS_PATH, "utf8"));
const known = JSON.parse(fs.readFileSync(process.env.KNOWN_MARKETPLACES_PATH, "utf8"));
const settings = JSON.parse(fs.readFileSync(process.env.SETTINGS_PATH, "utf8"));
const key = "acc-collab-runtime@local-claude-plugins";

if (!installed.plugins[key] || installed.plugins[key][0].installPath !== process.env.PLUGIN_DIR) {
  process.exit(1);
}
if (!known["local-claude-plugins"]) {
  process.exit(1);
}
if (!settings.enabledPlugins || settings.enabledPlugins[key] !== true) {
  process.exit(1);
}
EOF

echo "test-install-claude.sh: ok"
