#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -P "${SCRIPT_DIR}/.." && pwd)"
TARGET_ROOT="${CODEX_HOME:-${HOME}/.codex}"
HOME_ROOT="$(cd "${TARGET_ROOT}/.." && pwd)"
SKILLS_DIR="${TARGET_ROOT}/skills"
TARGET_SKILL="${SKILLS_DIR}/acc-collab-runtime"
PLUGIN_NAME="acc-collab-runtime"
PLUGIN_KEY="${PLUGIN_NAME}@local-codex-plugins"
PLUGIN_ROOT="${TARGET_ROOT}/plugins/cache/local-codex-plugins/${PLUGIN_NAME}"
PLUGIN_INSTALL="${PLUGIN_ROOT}/local"
CONFIG_PATH="${TARGET_ROOT}/config.toml"
MARKETPLACE_PATH="${HOME_ROOT}/.agents/plugins/marketplace.json"
HOME_PLUGIN_DIR="${HOME_ROOT}/plugins"
HOME_PLUGIN_LINK="${HOME_PLUGIN_DIR}/${PLUGIN_NAME}"

"${REPO_ROOT}/scripts/validate-plugin-bundles.sh" >/dev/null

ensure_plugin_enabled() {
  local config_path="$1"
  local plugin_key="$2"
  local tmp

  mkdir -p "$(dirname "$config_path")"
  touch "$config_path"

  if ! grep -Fq "[plugins.\"${plugin_key}\"]" "$config_path"; then
    printf '\n[plugins."%s"]\nenabled = true\n' "$plugin_key" >>"$config_path"
    return
  fi

  tmp="$(mktemp)"
  awk -v key="$plugin_key" '
    BEGIN {
      in_section = 0
      saw_enabled = 0
    }
    $0 == "[plugins.\"" key "\"]" {
      if (in_section && !saw_enabled) {
        print "enabled = true"
      }
      print
      in_section = 1
      saw_enabled = 0
      next
    }
    /^\[/ {
      if (in_section && !saw_enabled) {
        print "enabled = true"
      }
      in_section = 0
    }
    in_section && /^enabled = / {
      print "enabled = true"
      saw_enabled = 1
      next
    }
    {
      print
    }
    END {
      if (in_section && !saw_enabled) {
        print "enabled = true"
      }
    }
  ' "$config_path" >"$tmp"
  mv "$tmp" "$config_path"
}

ensure_home_plugin_link() {
  local link_path="$1"
  local target="$2"

  mkdir -p "$(dirname "$link_path")"

  if [ -e "$link_path" ] && [ ! -L "$link_path" ]; then
    echo "Refusing to overwrite unmanaged home plugin path at ${link_path}" >&2
    exit 1
  fi

  if [ -L "$link_path" ] && [ "$(readlink "$link_path")" != "$target" ]; then
    rm -f "$link_path"
  fi

  if [ ! -e "$link_path" ]; then
    ln -s "$target" "$link_path"
  fi
}

mkdir -p "${SKILLS_DIR}" "${PLUGIN_ROOT}"
rm -rf "${TARGET_SKILL}"
ln -s "${REPO_ROOT}/skills/acc-collab-runtime" "${TARGET_SKILL}"
rm -rf "${PLUGIN_INSTALL}"
ln -s "${REPO_ROOT}" "${PLUGIN_INSTALL}"
ensure_home_plugin_link "${HOME_PLUGIN_LINK}" "${REPO_ROOT}"
ensure_plugin_enabled "${CONFIG_PATH}" "${PLUGIN_KEY}"

REPO_ROOT="${REPO_ROOT}" \
MARKETPLACE_PATH="${MARKETPLACE_PATH}" \
PLUGIN_NAME="${PLUGIN_NAME}" \
node <<'EOF'
const fs = require("fs");
const path = require("path");

const marketplacePath = process.env.MARKETPLACE_PATH;
const pluginName = process.env.PLUGIN_NAME;

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Marketplace JSON is malformed: ${filePath}`);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

const existing = readJson(marketplacePath);
const marketplace = existing || {
  name: "Local Plugins",
  interface: {
    displayName: "Local Plugins",
  },
  plugins: [],
};

if (!marketplace || typeof marketplace !== "object" || Array.isArray(marketplace)) {
  throw new Error(`Marketplace root must be an object: ${marketplacePath}`);
}

if (!marketplace.name || typeof marketplace.name !== "string") {
  marketplace.name = "Local Plugins";
}

if (!marketplace.interface || typeof marketplace.interface !== "object" || Array.isArray(marketplace.interface)) {
  marketplace.interface = { displayName: "Local Plugins" };
}

if (!marketplace.interface.displayName || typeof marketplace.interface.displayName !== "string") {
  marketplace.interface.displayName = "Local Plugins";
}

if (!Array.isArray(marketplace.plugins)) {
  throw new Error(`Marketplace plugins must be an array: ${marketplacePath}`);
}

const entry = {
  name: pluginName,
  source: {
    source: "local",
    path: `./plugins/${pluginName}`,
  },
  policy: {
    installation: "AVAILABLE",
    authentication: "ON_INSTALL",
  },
  category: "Coding",
};

const nextPlugins = marketplace.plugins.filter((item) => item && item.name !== pluginName);
nextPlugins.push(entry);
marketplace.plugins = nextPlugins;

writeJson(marketplacePath, marketplace);
EOF

echo "Installed Codex skill at ${TARGET_SKILL}"
echo "Installed Codex local plugin at ${PLUGIN_INSTALL}"
echo "Registered home-local plugin at ${HOME_PLUGIN_LINK}"
echo "Enabled ${PLUGIN_KEY} in ${CONFIG_PATH}"
echo "Registered ${PLUGIN_NAME} in ${MARKETPLACE_PATH}"
