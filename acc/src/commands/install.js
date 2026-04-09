"use strict";

const path = require("path");
const store = require("../core/store");
const agents = require("../core/agents");
const claude = require("../core/claude");

function run(args) {
  try {
    const type = args["--type"];
    const agentId = args["--agent-id"] || `${type}-${Date.now().toString(36)}`;

    if (!type || !["claude", "codex"].includes(type)) {
      console.error("Usage: acc install --type claude|codex [--agent-id <id>]");
      process.exit(1);
    }

    const projectDir = process.cwd();

    if (type === "claude") {
      claude.installRepoBootstrap(agentId, projectDir);
    } else {
      store.bootstrap(projectDir);
      installCodex(agentId, projectDir);
    }

    agents.register(agentId, type, projectDir);
    console.log(JSON.stringify({ installed: type, agentId, project: projectDir }));
  } catch (error) {
    console.error(error.message || String(error));
    process.exit(1);
  }
}

function installCodex(agentId, projectDir) {
  console.error(`Codex agent "${agentId}" registered.`);
  console.error(`Use the wrapper: node ${path.resolve(__dirname, "../hooks/codex-wrapper.sh")} ${agentId} <codex-cmd>`);
}

module.exports = { run };
