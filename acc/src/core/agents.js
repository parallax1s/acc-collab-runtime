"use strict";

const fs = require("fs");
const store = require("./store");

/**
 * Read the agent registry.
 */
function list(projectDir) {
  const file = store.agentsFile(projectDir);
  if (!fs.existsSync(file)) return [];
  const parsed = store.readJSON(file);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Register an agent. Idempotent — updates type if agent already exists.
 */
function register(agentId, type, projectDir) {
  store.bootstrap(projectDir);
  const file = store.agentsFile(projectDir);
  const agents = list(projectDir);
  const idx = agents.findIndex((a) => a.id === agentId);
  const entry = { id: agentId, type, registeredAt: Date.now() };
  if (idx >= 0) {
    agents[idx] = entry;
  } else {
    agents.push(entry);
  }
  store.atomicWriteJSON(file, agents);
  return entry;
}

/**
 * Remove an agent from the registry.
 */
function unregister(agentId, projectDir) {
  const file = store.agentsFile(projectDir);
  if (!fs.existsSync(file)) return false;
  const agents = list(projectDir);
  const filtered = agents.filter((a) => a.id !== agentId);
  if (filtered.length === agents.length) return false;
  store.atomicWriteJSON(file, filtered);
  return true;
}

/**
 * Find an agent by ID.
 */
function get(agentId, projectDir) {
  return list(projectDir).find((a) => a.id === agentId) || null;
}

module.exports = { list, register, unregister, get };
