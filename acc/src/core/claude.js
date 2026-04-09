"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const store = require("./store");
const {
  CLAUDE_HOOK_FILENAME,
  buildClaudePreToolUseHook,
  isManagedClaudeHookContent,
} = require("../hooks/claude-pre-tool-use");

const CLAUDE_HOOK_MATCHER = "Edit|Write|MultiEdit|Bash";
const CLAUDE_HOOK_COMMAND = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/acc-pre-tool-use.js"';
const CLAUDE_HOOK_TIMEOUT_SECONDS = 10;

function hookPath(projectDir) {
  return path.join(projectDir, ".claude", "hooks", CLAUDE_HOOK_FILENAME);
}

function settingsPath(projectDir) {
  return path.join(projectDir, ".claude", "settings.json");
}

function installRepoBootstrap(agentId, projectDir) {
  const repoHookPath = hookPath(projectDir);
  const repoSettingsPath = settingsPath(projectDir);
  const commsRoot = store.commsRoot(projectDir);

  validateHookOwnership(repoHookPath);
  const mergedSettings = mergeSettingsFile(repoSettingsPath);
  const hookScript = buildClaudePreToolUseHook({ agentId, commsRoot });
  store.bootstrap(projectDir);

  fs.mkdirSync(path.dirname(repoHookPath), { recursive: true });
  fs.mkdirSync(path.dirname(repoSettingsPath), { recursive: true });

  atomicWriteText(repoHookPath, hookScript, 0o755);
  writeJson(repoSettingsPath, mergedSettings);

  return { repoHookPath, repoSettingsPath, commsRoot };
}

function validateHookOwnership(repoHookPath) {
  if (!fs.existsSync(repoHookPath)) {
    return;
  }

  const existing = fs.readFileSync(repoHookPath, "utf8");
  if (!isManagedClaudeHookContent(existing)) {
    throw new Error(`Refusing to overwrite unmanaged Claude hook at ${repoHookPath}`);
  }
}

function mergeSettingsFile(repoSettingsPath) {
  const settings = readSettings(repoSettingsPath);
  return mergeSettings(settings, repoSettingsPath);
}

function readSettings(repoSettingsPath) {
  if (!fs.existsSync(repoSettingsPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(repoSettingsPath, "utf8"));
  } catch {
    throw new Error(`Claude settings file is malformed JSON: ${repoSettingsPath}`);
  }
}

function mergeSettings(settings, repoSettingsPath) {
  if (!isPlainObject(settings)) {
    throw new Error(`Claude settings root must be a JSON object: ${repoSettingsPath}`);
  }

  const nextSettings = { ...settings };
  const hooks = nextSettings.hooks;
  if (hooks === undefined) {
    nextSettings.hooks = {};
  } else if (!isPlainObject(hooks)) {
    throw new Error(`Claude settings hooks must be an object: ${repoSettingsPath}`);
  } else {
    nextSettings.hooks = { ...hooks };
  }

  const preToolUse = nextSettings.hooks.PreToolUse;
  if (preToolUse === undefined) {
    nextSettings.hooks.PreToolUse = [buildManagedSettingsEntry()];
    return nextSettings;
  }

  if (!Array.isArray(preToolUse)) {
    throw new Error(`Claude settings hooks.PreToolUse must be an array: ${repoSettingsPath}`);
  }

  const nextPreToolUse = preToolUse.slice();
  const managedIndexes = [];
  for (let index = 0; index < nextPreToolUse.length; index++) {
    if (isManagedSettingsEntry(nextPreToolUse[index])) {
      managedIndexes.push(index);
    }
  }

  if (managedIndexes.length > 1) {
    throw new Error(`Claude settings contain multiple ACC-managed PreToolUse entries: ${repoSettingsPath}`);
  }

  if (managedIndexes.length === 1) {
    nextPreToolUse[managedIndexes[0]] = buildManagedSettingsEntry();
  } else {
    nextPreToolUse.push(buildManagedSettingsEntry());
  }

  nextSettings.hooks.PreToolUse = nextPreToolUse;
  return nextSettings;
}

function buildManagedSettingsEntry() {
  return {
    matcher: CLAUDE_HOOK_MATCHER,
    hooks: [
      {
        type: "command",
        command: CLAUDE_HOOK_COMMAND,
        timeout: CLAUDE_HOOK_TIMEOUT_SECONDS,
      },
    ],
  };
}

function isManagedSettingsEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return false;
  }

  if (!Array.isArray(entry.hooks)) {
    return false;
  }

  return entry.hooks.some((hook) => {
    return hook && typeof hook.command === "string" && hook.command === CLAUDE_HOOK_COMMAND;
  });
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function atomicWriteText(filePath, content, mode) {
  const tmpPath = `${filePath}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(tmpPath, content, { mode });
  fs.renameSync(tmpPath, filePath);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  store.atomicWriteJSON(filePath, value);
}

module.exports = {
  CLAUDE_HOOK_COMMAND,
  CLAUDE_HOOK_MATCHER,
  buildManagedSettingsEntry,
  hookPath,
  installRepoBootstrap,
  isManagedSettingsEntry,
  mergeSettings,
  settingsPath,
};
