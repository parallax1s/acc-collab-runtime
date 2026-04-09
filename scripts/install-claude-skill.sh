#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -P "${SCRIPT_DIR}/.." && pwd)"
TARGET_ROOT="${CLAUDE_HOME:-${HOME}/.claude}"
SKILLS_DIR="${TARGET_ROOT}/skills"
TARGET_SKILL="${SKILLS_DIR}/acc-collab-runtime"
PLUGIN_NAME="acc-collab-runtime"
PLUGIN_MARKETPLACE="local-claude-plugins"
PLUGIN_KEY="${PLUGIN_NAME}@${PLUGIN_MARKETPLACE}"
PLUGIN_VERSION="local"
PLUGIN_ROOT="${TARGET_ROOT}/plugins/cache/${PLUGIN_MARKETPLACE}/${PLUGIN_NAME}"
PLUGIN_INSTALL="${PLUGIN_ROOT}/${PLUGIN_VERSION}"
INSTALLED_PLUGINS_PATH="${TARGET_ROOT}/plugins/installed_plugins.json"
KNOWN_MARKETPLACES_PATH="${TARGET_ROOT}/plugins/known_marketplaces.json"
SETTINGS_PATH="${TARGET_ROOT}/settings.json"

"${REPO_ROOT}/scripts/validate-plugin-bundles.sh" >/dev/null

mkdir -p "${SKILLS_DIR}" "${PLUGIN_ROOT}" "${TARGET_ROOT}/plugins"
rm -rf "${TARGET_SKILL}"
ln -s "${REPO_ROOT}/skills/acc-collab-runtime" "${TARGET_SKILL}"
rm -rf "${PLUGIN_INSTALL}"
ln -s "${REPO_ROOT}" "${PLUGIN_INSTALL}"

REPO_ROOT="${REPO_ROOT}" \
PLUGIN_INSTALL="${PLUGIN_INSTALL}" \
PLUGIN_KEY="${PLUGIN_KEY}" \
PLUGIN_MARKETPLACE="${PLUGIN_MARKETPLACE}" \
PLUGIN_VERSION="${PLUGIN_VERSION}" \
INSTALLED_PLUGINS_PATH="${INSTALLED_PLUGINS_PATH}" \
KNOWN_MARKETPLACES_PATH="${KNOWN_MARKETPLACES_PATH}" \
SETTINGS_PATH="${SETTINGS_PATH}" \
node <<'EOF'
const fs = require("fs");
const path = require("path");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

const now = new Date().toISOString();
const repoRoot = process.env.REPO_ROOT;
const pluginInstall = process.env.PLUGIN_INSTALL;
const pluginKey = process.env.PLUGIN_KEY;
const pluginMarketplace = process.env.PLUGIN_MARKETPLACE;
const pluginVersion = process.env.PLUGIN_VERSION;
const installedPluginsPath = process.env.INSTALLED_PLUGINS_PATH;
const knownMarketplacesPath = process.env.KNOWN_MARKETPLACES_PATH;
const settingsPath = process.env.SETTINGS_PATH;

const installed = readJson(installedPluginsPath, { version: 2, plugins: {} });
installed.version = 2;
installed.plugins = installed.plugins || {};
installed.plugins[pluginKey] = [
  {
    scope: "user",
    installPath: pluginInstall,
    version: pluginVersion,
    installedAt: now,
    lastUpdated: now,
  },
];
writeJson(installedPluginsPath, installed);

const marketplaces = readJson(knownMarketplacesPath, {});
marketplaces[pluginMarketplace] = {
  source: {
    source: "local",
    repo: repoRoot,
  },
  installLocation: pluginInstall,
  lastUpdated: now,
};
writeJson(knownMarketplacesPath, marketplaces);

const settings = readJson(settingsPath, {});
settings.enabledPlugins = settings.enabledPlugins || {};
settings.enabledPlugins[pluginKey] = true;
writeJson(settingsPath, settings);
EOF

echo "Installed Claude skill at ${TARGET_SKILL}"
echo "Installed Claude local plugin at ${PLUGIN_INSTALL}"
echo "Enabled ${PLUGIN_KEY} in ${SETTINGS_PATH}"
echo "Next step in each repo: run /acc-bootstrap <agent-id> in Claude"
