"use strict";

/**
 * Format for injection into agent context.
 * Message bodies are rendered as JSON-escaped strings to prevent prompt injection.
 */

function formatMessages(messages) {
  if (messages.length === 0) return "";

  const lines = ["[ACC] Incoming messages:"];
  for (const m of messages) {
    const flags = [];
    if (m.blocking) flags.push("BLOCKING");
    if (m.requiresAck) flags.push("ACK-REQUIRED");
    const flagStr = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
    const fileStr = m.files.length > 0 ? ` (files: ${m.files.join(", ")})` : "";
    // JSON.stringify escapes the body to prevent injection
    const safeBody = JSON.stringify(m.body);

    lines.push(`  From ${m.from}${flagStr}: ${safeBody}${fileStr}`);
    if (m.replyTo) lines.push(`    (reply to: ${m.replyTo})`);
    lines.push(`    [msg-id: ${m.id}]`);
  }
  return lines.join("\n");
}

function formatLeases(leases) {
  if (leases.length === 0) return "";

  const lines = ["[ACC] Active file leases:"];
  for (const l of leases) {
    const remaining = l.expiresAt - Math.floor(Date.now() / 1000);
    lines.push(`  ${l.owner} holds: ${l.files.join(", ")} (${remaining}s remaining)`);
  }
  lines.push("  Do NOT edit leased files unless you own the lease.");
  return lines.join("\n");
}

function formatTasks(tasks) {
  if (!tasks || tasks.length === 0) return "";

  const lines = ["[ACC] Active tasks:"];
  for (const t of tasks) {
    const owner = t.owner ? ` owner=${t.owner}` : " owner=unowned";
    const status = `status=${t.status}`;
    const priority = `priority=${t.priority}`;
    const unfailable = t.unfailable ? " unfailable" : "";
    const art = t.expectedArtifacts.length > 0 ? ` artifacts=[${t.expectedArtifacts.join(", ")}]` : "";
    lines.push(`  ${t.id}: ${t.title} (${status}, ${priority}${owner}${unfailable})`);
    if (t.objective) lines.push(`    objective: ${JSON.stringify(t.objective)}`);
    if (t.scope && t.scope.length > 0) lines.push(`    scope: ${t.scope.join(", ")}`);
    if (art) lines.push(`    expected: ${art}`);
  }
  return lines.join("\n");
}

function formatContext(messages, leases, tasks) {
  const parts = [
    formatMessages(messages),
    formatLeases(leases),
    formatTasks(tasks),
  ].filter(Boolean);
  return parts.join("\n\n");
}

module.exports = { formatMessages, formatLeases, formatTasks, formatContext };
