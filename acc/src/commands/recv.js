"use strict";

const messages = require("../core/messages");
const leases = require("../core/leases");
const tasks = require("../core/tasks");

function run(args) {
  const id = args["--id"];
  const format = args["--format"] || "human";
  const peek = !!args["--peek"];

  if (!id) {
    console.error("Usage: acc recv --id <agent-id> [--format json|inject|human] [--peek] [--task-status s1,s2,...]");
    process.exit(1);
  }

  const msgs = messages.recv(id, { projectDir: process.cwd(), peek });

  let formatter;
  if (format === "json") {
    formatter = require("../format/json");
  } else if (format === "inject") {
    formatter = require("../format/inject");
    const active = leases.listActive(process.cwd());
    const taskFilter = {
      status: args["--task-status"] || "in_progress,queued,blocked",
    };
    const activeTasks = tasks.filterBy(process.cwd(), {
      status: taskFilter.status.split(",").map((v) => v.trim()).filter(Boolean),
    });

    const output = formatter.formatContext(msgs, active, activeTasks);
    if (output) console.log(output);
    return;
  } else {
    formatter = require("../format/human");
  }

  console.log(formatter.formatMessages(msgs));
}

module.exports = { run };
