#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

REPO_ROOT="${REPO_ROOT}" node <<'EOF'
const fs = require("fs");
const path = require("path");

const repoRoot = process.env.REPO_ROOT || process.cwd();

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readJson(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    fail(`Missing required file: ${relativePath}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Invalid JSON in ${relativePath}: ${error.message}`);
  }
}

function requireFile(relativePath) {
  if (!fs.existsSync(path.join(repoRoot, relativePath))) {
    fail(`Missing required file: ${relativePath}`);
  }
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`Missing required string: ${label}`);
  }
}

function requireArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`Missing required non-empty array: ${label}`);
  }
}

const codexManifest = readJson(".codex-plugin/plugin.json");
requireString(codexManifest.name, ".codex-plugin/plugin.json:name");
requireString(codexManifest.version, ".codex-plugin/plugin.json:version");
requireString(codexManifest.description, ".codex-plugin/plugin.json:description");
requireString(codexManifest.skills, ".codex-plugin/plugin.json:skills");
if (!codexManifest.interface || typeof codexManifest.interface !== "object") {
  fail("Missing required object: .codex-plugin/plugin.json:interface");
}
requireString(codexManifest.interface.displayName, ".codex-plugin/plugin.json:interface.displayName");
requireString(codexManifest.interface.shortDescription, ".codex-plugin/plugin.json:interface.shortDescription");
requireString(codexManifest.interface.category, ".codex-plugin/plugin.json:interface.category");
requireArray(codexManifest.interface.capabilities, ".codex-plugin/plugin.json:interface.capabilities");

const claudeManifest = readJson(".claude-plugin/plugin.json");
requireString(claudeManifest.name, ".claude-plugin/plugin.json:name");
requireString(claudeManifest.version, ".claude-plugin/plugin.json:version");
requireString(claudeManifest.description, ".claude-plugin/plugin.json:description");
if (!claudeManifest.author || typeof claudeManifest.author !== "object") {
  fail("Missing required object: .claude-plugin/plugin.json:author");
}
requireString(claudeManifest.author.name, ".claude-plugin/plugin.json:author.name");

requireFile("commands/acc-bootstrap.md");
requireFile("commands/acc-sync.md");
requireFile("commands/acc-handoff.md");
requireFile("commands/ralph-start.md");
requireFile("commands/ralph-status.md");
requireFile("commands/ralph-stop.md");
requireFile("commands/ralph-add-context.md");
requireFile("skills/acc-collab-runtime/SKILL.md");
requireFile("skills/ralph-loop/SKILL.md");
requireFile("skills/acc-collab-runtime/scripts/acc-run.sh");
requireFile("skills/acc-collab-runtime/scripts/acc-inbox.sh");
requireFile("skills/acc-collab-runtime/scripts/acc-guard.sh");

console.log("Plugin bundles validated.");
EOF
