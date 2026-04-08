"use strict";

const agents = require("../core/agents");
const leases = require("../core/leases");
const messages = require("../core/messages");
const tasks = require("../core/tasks");

function run(args) {
  const json = !!args["--json"];
  const projectDir = process.cwd();

  const agentList = agents.list(projectDir).map((a) => ({
    ...a,
    pendingMessages: messages.pendingCount(a.id, projectDir),
  }));

  const activeLeases = leases.listActive(projectDir);
  const activeTasks = tasks.filterBy(projectDir, {
    status: ["queued", "in_progress", "blocked"],
  });
  const allTasks = tasks.list(projectDir);
  const taskCounts = allTasks.reduce((memo, task) => {
    memo[task.status] = (memo[task.status] || 0) + 1;
    return memo;
  }, {});

  const status = {
    agents: agentList,
    leases: activeLeases,
    tasks: {
      total: allTasks.length,
      active: activeTasks.slice(0, 10),
      counts: taskCounts,
    },
  };

  if (json) {
    const formatter = require("../format/json");
    console.log(formatter.formatStatus(status));
  } else {
    const formatter = require("../format/human");
    console.log(formatter.formatStatus(status));
  }
}

module.exports = { run };
