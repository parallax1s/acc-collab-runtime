"use strict";

function formatMessages(messages) {
  if (messages.length === 0) return "No messages.";

  return messages.map((m) => {
    const age = Math.floor(Date.now() / 1000) - m.timestamp;
    const ageStr = age < 60 ? `${age}s ago` : `${Math.floor(age / 60)}m ago`;
    const files = m.files.length > 0 ? `  files: ${m.files.join(", ")}` : "";
    const flags = [
      m.blocking ? "BLOCKING" : null,
      m.requiresAck ? "ACK-REQ" : null,
    ].filter(Boolean).join(" ");
    const flagStr = flags ? ` [${flags}]` : "";

    return [
      `--- ${m.id} (${m.status}) ---`,
      `  from: ${m.from} | ${ageStr}${flagStr}`,
      `  ${m.body}`,
      files,
    ].filter(Boolean).join("\n");
  }).join("\n\n");
}

function formatLeases(leases) {
  if (leases.length === 0) return "No active leases.";

  return leases.map((l) => {
    const remaining = l.expiresAt - Math.floor(Date.now() / 1000);
    return [
      `${l.id} (owner: ${l.owner})`,
      `  files: ${l.files.join(", ")}`,
      `  expires in: ${remaining}s`,
    ].join("\n");
  }).join("\n\n");
}

function formatTasks(tasks) {
  if (!tasks || tasks.length === 0) return "No active tasks.";

  const lines = [];
  lines.push(`[TASKS] Active: ${tasks.length}`);
  for (const task of tasks) {
    const owner = task.owner || "unowned";
    lines.push(`  ${task.id}: ${task.title} (${task.status}) owner=${owner} priority=${task.priority}`);
    if (task.scope && task.scope.length > 0) {
      lines.push(`    scope: ${task.scope.join(", ")}`);
    }
  }
  return lines.join("\n");
}

function formatStatus(status) {
  const lines = [];
  lines.push(`Agents: ${status.agents.length}`);
  for (const a of status.agents) {
    lines.push(`  ${a.id} (${a.type}) — ${a.pendingMessages} pending`);
  }
  lines.push("");
  lines.push(`Active leases: ${status.leases.length}`);
  for (const l of status.leases) {
    const remaining = l.expiresAt - Math.floor(Date.now() / 1000);
    lines.push(`  ${l.owner}: ${l.files.join(", ")} (${remaining}s remaining)`);
  }
  lines.push("");
  const taskCounts = status.tasks ? status.tasks.counts || {} : {};
  const countItems = Object.entries(taskCounts)
    .map(([status, count]) => `${status}=${count}`)
    .join(", ");
  lines.push(`Tasks: ${status.tasks ? status.tasks.total : 0} total (${countItems || "none"})`);
  lines.push(formatTasks(status.tasks ? status.tasks.active || [] : []));
  return lines.join("\n");
}

module.exports = { formatMessages, formatLeases, formatStatus };
