"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const COMMS_DIR = ".agent-comms";

function commsRoot(projectDir) {
  return path.join(projectDir || process.cwd(), COMMS_DIR);
}

function bootstrap(projectDir) {
  const root = commsRoot(projectDir);
  fs.mkdirSync(path.join(root, "inbox"), { recursive: true });
  fs.mkdirSync(path.join(root, "leases"), { recursive: true });
  fs.mkdirSync(path.join(root, "receipts"), { recursive: true });
  fs.mkdirSync(path.join(root, "tasks"), { recursive: true });
  return root;
}

function inboxDir(projectDir, agentId) {
  return path.join(commsRoot(projectDir), "inbox", agentId);
}

function leasesDir(projectDir) {
  return path.join(commsRoot(projectDir), "leases");
}

function receiptsDir(projectDir) {
  return path.join(commsRoot(projectDir), "receipts");
}

function agentsFile(projectDir) {
  return path.join(commsRoot(projectDir), "agents.json");
}

function tasksDir(projectDir) {
  return path.join(commsRoot(projectDir), "tasks");
}

/**
 * Atomic write: write to .tmp then rename to final path.
 * Ensures readers never see partial files.
 */
function atomicWriteJSON(filePath, data) {
  const tmp = filePath + `.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmp, filePath);
}

/**
 * Safe JSON read — returns null on missing/corrupt files.
 */
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Normalize a file path to be repo-relative with forward slashes.
 * Rejects paths that escape the repo root.
 */
function canonicalize(filePath, projectDir) {
  const root = path.resolve(projectDir || process.cwd());
  // Resolve against repo root
  const abs = path.resolve(root, filePath);
  // Reject escapes
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error(`Path escapes repo root: ${filePath}`);
  }
  // Make relative, normalize to forward slashes
  return path.relative(root, abs).replace(/\\/g, "/");
}

module.exports = {
  COMMS_DIR, commsRoot, bootstrap,
  inboxDir, leasesDir, receiptsDir, agentsFile, tasksDir,
  atomicWriteJSON, readJSON, canonicalize,
};
