"use strict";

const tasks = require("../core/tasks");

function usage() {
  console.error(`acc task <subcommand> --help

Subcommands:
  create   Create a task contract for deterministic subagent work.
  list     List tasks (optional filters).
  claim    Claim a task for an agent.
  complete Mark a task as completed.
  fail     Mark a task as failed.

  create:
  acc task create --title "Fix sprite pipeline" --objective "..." [options]
    --owner <agent-id>
    --scope <path1,path2>
    --priority low|normal|high|critical
    --criteria <criterion1,criterion2>
    --artifacts <artifact1,artifact2>
    --runbook "<short plan>"
    --unfailable

list:
  acc task list [--owner <agent-id>] [--status queued,in_progress,blocked,completed,failed] [--scope <path>]
    --only-unfailable

claim:
  acc task claim --id <task-id> --agent <agent-id> [--by <agent-id>]

complete:
  acc task complete --id <task-id> --by <agent-id> [--proof "what was done"] [--notes "..."]

fail:
  acc task fail --id <task-id> --reason "why it failed"
`);
  process.exit(1);
}

function run(args) {
  const sub = args._subcommand;
  if (!sub || sub === "--help" || sub === "-h") usage();

  if (sub === "create") return runCreate(args);
  if (sub === "list") return runList(args);
  if (sub === "claim") return runClaim(args);
  if (sub === "complete") return runComplete(args);
  if (sub === "fail") return runFail(args);

  usage();
}

function runCreate(args) {
  const title = args["--title"];
  const objective = args["--objective"];
  const owner = args["--owner"] || null;
  const priority = args["--priority"] || "normal";
  const id = args["--id"] || null;
  const status = args["--status"];
  const runbook = args["--runbook"] || null;
  const notes = args["--notes"] || null;
  const unfailable = !!args["--unfailable"];

  if (!title || !objective) {
    console.error("Usage: acc task create --title \"...\" --objective \"...\" [--owner id]");
    process.exit(1);
  }

  const scope = tasks.splitCsv(args["--scope"]);
  const acceptanceCriteria = tasks.splitCsv(args["--criteria"]);
  const expectedArtifacts = tasks.splitCsv(args["--artifacts"]);

  const task = tasks.create({
    id,
    title,
    objective,
    scope,
    owner,
    priority,
    status,
    runbook,
    notes,
    unfailable,
    acceptanceCriteria,
    expectedArtifacts,
    createdBy: args["--created-by"] || null,
  }, process.cwd());

  console.log(JSON.stringify({ created: task.id, owner: task.owner, status: task.status, title: task.title }));
}

function runList(args) {
  const owner = args["--owner"] || null;
  const status = tasks.splitCsv(args["--status"] || "");
  const scope = args["--scope"] || null;
  const out = tasks.filterBy(process.cwd(), {
    owner,
    status: status.length > 0 ? status : null,
    scope,
    onlyUnfailable: !!args["--only-unfailable"],
  });
  console.log(JSON.stringify({ count: out.length, tasks: out }));
}

function runClaim(args) {
  const id = args["--id"];
  const agent = args["--agent"] || args["--owner"] || args["--by"];
  const by = args["--by"] || "planner";

  if (!id || !agent) {
    console.error("Usage: acc task claim --id <task-id> --agent <agent-id>");
    process.exit(1);
  }

  const task = tasks.claim(id, agent, by, process.cwd());
  console.log(JSON.stringify({ claimed: task.id, owner: task.owner, status: task.status }));
}

function runComplete(args) {
  const id = args["--id"];
  const proof = args["--proof"] || null;
  const notes = args["--notes"] || null;
  const by = args["--by"] || null;

  if (!id) {
    console.error("Usage: acc task complete --id <task-id> [--proof text] [--notes text]");
    process.exit(1);
  }

  const task = tasks.complete(id, { completionProof: proof, notes, by }, process.cwd());
  console.log(JSON.stringify({ completed: task.id, status: task.status, proof: task.completionProof }));
}

function runFail(args) {
  const id = args["--id"];
  const reason = args["--reason"];
  if (!id || !reason) {
    console.error("Usage: acc task fail --id <task-id> --reason \"why\"");
    process.exit(1);
  }

  const task = tasks.fail(id, reason, process.cwd());
  console.log(JSON.stringify({ failed: task.id, status: task.status, notes: task.notes }));
}

module.exports = { run };
