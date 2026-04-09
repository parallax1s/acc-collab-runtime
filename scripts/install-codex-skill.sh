#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -P "${SCRIPT_DIR}/.." && pwd)"
TARGET_ROOT="${CODEX_HOME:-${HOME}/.codex}"
SKILLS_DIR="${TARGET_ROOT}/skills"
TARGET_SKILL="${SKILLS_DIR}/acc-collab-runtime"
PLUGIN_NAME="acc-collab-runtime"
PLUGIN_KEY="${PLUGIN_NAME}@local-codex-plugins"
PLUGIN_ROOT="${TARGET_ROOT}/plugins/cache/local-codex-plugins/${PLUGIN_NAME}"
PLUGIN_INSTALL="${PLUGIN_ROOT}/local"
CONFIG_PATH="${TARGET_ROOT}/config.toml"

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

mkdir -p "${SKILLS_DIR}" "${PLUGIN_ROOT}"
rm -rf "${TARGET_SKILL}"
ln -s "${REPO_ROOT}/skills/acc-collab-runtime" "${TARGET_SKILL}"
rm -rf "${PLUGIN_INSTALL}"
ln -s "${REPO_ROOT}" "${PLUGIN_INSTALL}"
ensure_plugin_enabled "${CONFIG_PATH}" "${PLUGIN_KEY}"

echo "Installed Codex skill at ${TARGET_SKILL}"
echo "Installed Codex local plugin at ${PLUGIN_INSTALL}"
echo "Enabled ${PLUGIN_KEY} in ${CONFIG_PATH}"
