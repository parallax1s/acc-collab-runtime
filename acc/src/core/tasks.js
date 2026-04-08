"use strict";

const fs = require("fs");
const path = require("path");

const store = require("./store");
const ids = require("./ids");

const TASK_STATUSES = ["queued", "in_progress", "blocked", "completed", "failed"];
const TASK_PRIORITIES = ["low", "normal", "high", "critical"];

function validateStatus(status) {
  if (!TASK_STATUSES.includes(status)) {
    const err = new Error(`Invalid task status: ${status}`);
    err.code = "INVALID_TASK_STATUS";
    throw err;
  }
}

function splitCsv(value, fallback = []) {
  if (!value) return fallback;
  return value
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function now() {
  return Math.floor(Date.now() / 1000);
}

function parseTask(pathValue) {
  return store.canonicalize(pathValue);
}

function taskFile(projectDir, taskId) {
  return path.join(store.tasksDir(projectDir), `${taskId}.json`);
}

function list(projectDir) {
  const dir = store.tasksDir(projectDir);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => store.readJSON(path.join(dir, name)))
    .filter(Boolean)
    .map(sanitize)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function get(taskId, projectDir) {
  const file = taskFile(projectDir, taskId);
  const payload = store.readJSON(file);
  if (!payload) return null;
  return sanitize(payload);
}

function sanitize(task) {
  return {
    id: task.id,
    title: task.title || "",
    objective: task.objective || "",
    scope: Array.isArray(task.scope) ? task.scope : [],
    owner: task.owner || null,
    priority: task.priority || "normal",
    status: task.status,
    assignedBy: task.assignedBy || null,
    source: task.source || "agent",
    createdBy: task.createdBy || null,
    unfailable: !!task.unfailable,
    expectedArtifacts: Array.isArray(task.expectedArtifacts) ? task.expectedArtifacts : [],
    acceptanceCriteria: Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria : [],
    runbook: task.runbook || null,
    completionProof: task.completionProof || null,
    createdAt: task.createdAt || now(),
    updatedAt: task.updatedAt || now(),
    completedAt: task.completedAt || null,
    notes: typeof task.notes === "string" ? task.notes : null,
  };
}

function create(payload, projectDir) {
  if (!payload || typeof payload.title !== "string" || !payload.title.trim()) {
    const err = new Error("Task title is required");
    err.code = "INVALID_TASK_PAYLOAD";
    throw err;
  }
  if (!payload.objective || !payload.objective.trim()) {
    const err = new Error("Task objective is required");
    err.code = "INVALID_TASK_PAYLOAD";
    throw err;
  }

  const canonicalScope = (payload.scope || [])
    .map((value) => parseTask(value))
    .filter(Boolean);

  const status = payload.status || "queued";
  validateStatus(status);

  const priority = payload.priority || "normal";
  if (!TASK_PRIORITIES.includes(priority)) {
    const err = new Error(`Invalid task priority: ${priority}`);
    err.code = "INVALID_TASK_PAYLOAD";
    throw err;
  }

  const artifacts = payload.expectedArtifacts || [];
  const criteria = payload.acceptanceCriteria || [];

  const entry = {
    id: payload.id || ids.generate("task"),
    title: payload.title.trim(),
    objective: payload.objective.trim(),
    scope: canonicalScope,
    owner: payload.owner || null,
    priority,
    status,
    assignedBy: payload.assignedBy || null,
    source: payload.source || "agent",
    createdBy: payload.createdBy || null,
    unfailable: !!payload.unfailable,
    expectedArtifacts: canonicalArtifacts(artifacts),
    acceptanceCriteria: criteria.map((c) => String(c).trim()).filter(Boolean),
    runbook: payload.runbook || null,
    completionProof: null,
    createdAt: now(),
    updatedAt: now(),
    completedAt: null,
    notes: payload.notes ? String(payload.notes).trim() : null,
  };

  const fp = taskFile(projectDir, entry.id);
  store.atomicWriteJSON(fp, entry);
  return sanitize(entry);
}

function canonicalArtifacts(artifacts) {
  const values = Array.isArray(artifacts) ? artifacts : [];
  return values
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function update(taskId, updates, projectDir) {
  const file = taskFile(projectDir, taskId);
  const existing = store.readJSON(file);
  if (!existing) {
    const err = new Error(`Task not found: ${taskId}`);
    err.code = "TASK_NOT_FOUND";
    throw err;
  }

  const next = { ...existing, ...updates, id: existing.id };
  if (next.status) validateStatus(next.status);
  if (updates.priority && !TASK_PRIORITIES.includes(updates.priority)) {
    const err = new Error(`Invalid task priority: ${updates.priority}`);
    err.code = "INVALID_TASK_PAYLOAD";
    throw err;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "scope") && Array.isArray(updates.scope)) {
    next.scope = updates.scope.map((value) => parseTask(value)).filter(Boolean);
  }
  if (Object.prototype.hasOwnProperty.call(updates, "expectedArtifacts")) {
    next.expectedArtifacts = canonicalArtifacts(updates.expectedArtifacts);
  }
  if (Object.prototype.hasOwnProperty.call(updates, "acceptanceCriteria")) {
    next.acceptanceCriteria = (updates.acceptanceCriteria || [])
      .map((value) => String(value).trim())
      .filter(Boolean);
  }

  next.updatedAt = now();
  if (next.status === "completed" && !next.completedAt) {
    next.completedAt = now();
  }
  store.atomicWriteJSON(file, next);
  return sanitize(next);
}

function claim(taskId, ownerId, byAgent, projectDir) {
  const task = get(taskId, projectDir);
  if (!task) {
    const err = new Error(`Task not found: ${taskId}`);
    err.code = "TASK_NOT_FOUND";
    throw err;
  }
  if (task.owner && task.owner !== ownerId && task.owner !== byAgent) {
    const err = new Error(`Task already owned by ${task.owner}`);
    err.code = "TASK_ALREADY_OWNED";
    throw err;
  }
  return update(taskId, { owner: byAgent, status: "in_progress", assignedBy: ownerId || task.assignedBy }, projectDir);
}

function complete(taskId, payload, projectDir) {
  const task = get(taskId, projectDir);
  if (!task) {
    const err = new Error(`Task not found: ${taskId}`);
    err.code = "TASK_NOT_FOUND";
    throw err;
  }

  if (task.unfailable) {
    const missing = task.expectedArtifacts.filter((value) => !fs.existsSync(path.resolve(projectDir || process.cwd(), value)));
    if (missing.length > 0) {
      const err = new Error(`Unfailable task is not fully complete; missing artifacts: ${missing.join(", ")}`);
      err.code = "TASK_UNFULFILLED";
      err.missing = missing;
      throw err;
    }
  }

  const proof = payload && payload.completionProof ? String(payload.completionProof).trim() : "completed";
  return update(taskId, {
    status: "completed",
    completionProof: proof,
    notes: payload && payload.notes ? String(payload.notes).trim() : task.notes,
  }, projectDir);
}

function fail(taskId, reason, projectDir) {
  return update(taskId, {
    status: "failed",
    notes: reason ? String(reason).trim() : "failed",
  }, projectDir);
}

function filterBy(projectDir, opts = {}) {
  const all = list(projectDir);
  return all.filter((task) => {
    if (opts.owner && task.owner !== opts.owner) return false;
    if (opts.status) {
      if (Array.isArray(opts.status)) {
        if (!opts.status.includes(task.status)) return false;
      } else if (task.status !== opts.status) {
        return false;
      }
    }
    if (opts.scope && !task.scope.includes(opts.scope)) return false;
    if (opts.onlyUnfailable && !task.unfailable) return false;
    if (opts.onlyMine && task.owner !== opts.onlyMine) return false;
    return true;
  });
}

module.exports = {
  create,
  list,
  filterBy,
  get,
  update,
  claim,
  complete,
  fail,
  sanitize,
  splitCsv,
  TASK_STATUSES,
  TASK_PRIORITIES,
};
