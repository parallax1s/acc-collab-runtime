"use strict";

const fs = require("fs");
const path = require("path");
const store = require("./store");
const ids = require("./ids");

/**
 * Send a message. Message files are immutable after creation.
 * Delivery state is tracked separately in receipts.
 */
function send({ from, to, body, files, type, replyTo, requiresAck, blocking, ttl, projectDir }) {
  store.bootstrap(projectDir);
  const inbox = store.inboxDir(projectDir, to);
  fs.mkdirSync(inbox, { recursive: true });

  const now = Math.floor(Date.now() / 1000);
  const msg = {
    id: ids.generate("msg"),
    from,
    to,
    timestamp: now,
    type: type || "info",
    replyTo: replyTo || null,
    body,
    files: files || [],
    requiresAck: !!requiresAck,
    blocking: !!blocking,
    ttl: ttl || 300,
  };

  const file = path.join(inbox, `${msg.id}.json`);
  store.atomicWriteJSON(file, msg);
  return msg;
}

/**
 * Read receipts for an agent. Returns { [msgId]: "read"|"replied"|... }
 */
function getReceipts(agentId, projectDir) {
  const file = path.join(store.receiptsDir(projectDir), `${agentId}.json`);
  return store.readJSON(file) || {};
}

function setReceipt(agentId, msgId, status, projectDir) {
  store.bootstrap(projectDir);
  const file = path.join(store.receiptsDir(projectDir), `${agentId}.json`);
  const receipts = store.readJSON(file) || {};
  receipts[msgId] = status;
  store.atomicWriteJSON(file, receipts);
}

/**
 * Read all messages in an agent's inbox. Filters expired. Marks read via receipts.
 */
function recv(agentId, { projectDir, peek } = {}) {
  const inbox = store.inboxDir(projectDir, agentId);
  if (!fs.existsSync(inbox)) return [];

  const now = Math.floor(Date.now() / 1000);
  const files = fs.readdirSync(inbox).filter((f) => f.endsWith(".json")).sort();
  const receipts = getReceipts(agentId, projectDir);
  const messages = [];

  for (const file of files) {
    const msg = store.readJSON(path.join(inbox, file));
    if (!msg) continue;

    // Lazy expiry check
    if (msg.timestamp + msg.ttl < now) continue;

    const status = receipts[msg.id] || "pending";
    if (!peek && status === "pending") {
      setReceipt(agentId, msg.id, "read", projectDir);
    }

    messages.push({ ...msg, status: peek ? status : (status === "pending" ? "read" : status) });
  }

  return messages;
}

/**
 * Get pending (unread) message count.
 */
function pendingCount(agentId, projectDir) {
  const inbox = store.inboxDir(projectDir, agentId);
  if (!fs.existsSync(inbox)) return 0;

  const now = Math.floor(Date.now() / 1000);
  const receipts = getReceipts(agentId, projectDir);
  let count = 0;

  for (const file of fs.readdirSync(inbox).filter((f) => f.endsWith(".json"))) {
    const msg = store.readJSON(path.join(inbox, file));
    if (!msg) continue;
    if (msg.timestamp + msg.ttl < now) continue;
    if (!receipts[msg.id] || receipts[msg.id] === "pending") count++;
  }
  return count;
}

/**
 * Get pending messages (for hook fast-path check without full recv).
 */
function pending(agentId, projectDir) {
  const inbox = store.inboxDir(projectDir, agentId);
  if (!fs.existsSync(inbox)) return [];

  const now = Math.floor(Date.now() / 1000);
  const receipts = getReceipts(agentId, projectDir);
  const msgs = [];

  for (const file of fs.readdirSync(inbox).filter((f) => f.endsWith(".json"))) {
    const msg = store.readJSON(path.join(inbox, file));
    if (!msg) continue;
    if (msg.timestamp + msg.ttl < now) continue;
    if (!receipts[msg.id] || receipts[msg.id] === "pending") {
      msgs.push({ ...msg, status: "pending" });
    }
  }
  return msgs;
}

function markReplied(agentId, msgId, projectDir) {
  setReceipt(agentId, msgId, "replied", projectDir);
}

module.exports = { send, recv, pending, pendingCount, markReplied, getReceipts, setReceipt };
