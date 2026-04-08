"use strict";

const fs = require("fs");
const path = require("path");
const store = require("./store");
const ids = require("./ids");
const glob = require("./glob");

const CLAIM_MUTEX_FILE = ".claim.lock";
const CLAIM_MUTEX_STALE_MS = 30_000;
const GLOB_CHAR_RE = /[*?]/;

function isPattern(value) {
  return typeof value === "string" && GLOB_CHAR_RE.test(value);
}

function staticPrefix(pattern) {
  if (!isPattern(pattern)) return pattern;
  const idxStar = pattern.indexOf("*");
  const idxQuestion = pattern.indexOf("?");
  let cut = pattern.length;
  if (idxStar >= 0) cut = Math.min(cut, idxStar);
  if (idxQuestion >= 0) cut = Math.min(cut, idxQuestion);
  return pattern.slice(0, cut).replace(/\/+$/, "");
}

function entriesConflict(left, right) {
  const leftIsPattern = isPattern(left);
  const rightIsPattern = isPattern(right);

  if (!leftIsPattern && !rightIsPattern) {
    return left === right;
  }

  if (leftIsPattern && !rightIsPattern) {
    return glob.matchesGlob(right, left);
  }

  if (!leftIsPattern && rightIsPattern) {
    return glob.matchesGlob(left, right);
  }

  if (left === right) {
    return true;
  }

  // Conservative intersection heuristic for pattern-vs-pattern.
  // If static prefixes overlap, assume conflict rather than allow overlap.
  const leftPrefix = staticPrefix(left);
  const rightPrefix = staticPrefix(right);
  if (!leftPrefix || !rightPrefix) {
    return true;
  }
  return leftPrefix.startsWith(rightPrefix) || rightPrefix.startsWith(leftPrefix);
}

function conflictWithLease(fileEntry, lease) {
  const entries = Array.isArray(lease.files) ? lease.files : [];
  return entries.some((entry) => entriesConflict(fileEntry, entry));
}

function acquireClaimMutex(leaseDir) {
  const lockPath = path.join(leaseDir, CLAIM_MUTEX_FILE);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, ts: Date.now() }) + "\n", "utf8");
      fs.closeSync(fd);

      return () => {
        try {
          fs.unlinkSync(lockPath);
        } catch (err) {
          if (!(err && err.code === "ENOENT")) {
            throw err;
          }
        }
      };
    } catch (err) {
      if (!(err && err.code === "EEXIST")) {
        throw err;
      }

      try {
        const stat = fs.statSync(lockPath);
        const ageMs = Date.now() - stat.mtimeMs;
        if (ageMs > CLAIM_MUTEX_STALE_MS) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch (statErr) {
        if (!(statErr && statErr.code === "ENOENT")) {
          throw statErr;
        }
      }

      const busy = new Error("Lease claim is busy; retry");
      busy.code = "CLAIM_BUSY";
      throw busy;
    }
  }
  const busy = new Error("Lease claim is busy; retry");
  busy.code = "CLAIM_BUSY";
  throw busy;
}

/**
 * Claim a lease on files.
 * Uses a claim mutex to serialize conflict checks + writes.
 */
function claim({ owner, files, ttl, projectDir }) {
  store.bootstrap(projectDir);
  const dir = store.leasesDir(projectDir);
  const releaseMutex = acquireClaimMutex(dir);
  const now = Math.floor(Date.now() / 1000);
  const leaseTtl = ttl || 300;

  const lease = {
    id: ids.generate("lease"),
    owner,
    files: files || [],
    claimedAt: now,
    ttl: leaseTtl,
    expiresAt: now + leaseTtl,
  };

  try {
    // Check for conflicts while holding the claim mutex.
    for (const file of lease.files) {
      const conflict = check(file, owner, projectDir);
      if (conflict) {
        const err = new Error(`File "${file}" is leased by ${conflict.owner}`);
        err.conflict = conflict;
        throw err;
      }
    }
    const leasePath = path.join(dir, `${lease.id}.json`);
    store.atomicWriteJSON(leasePath, lease);
    return lease;
  } finally {
    releaseMutex();
  }
}

/**
 * Read all active (non-expired) leases.
 */
function listActive(projectDir) {
  const dir = store.leasesDir(projectDir);
  if (!fs.existsSync(dir)) return [];

  const now = Math.floor(Date.now() / 1000);
  const leases = [];

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const lease = store.readJSON(path.join(dir, file));
    if (!lease) continue;
    if (lease.expiresAt > now) leases.push(lease);
  }
  return leases;
}

/**
 * Check if a file is leased by anyone other than `excludeOwner`.
 */
function check(filePath, excludeOwner, projectDir) {
  const active = listActive(projectDir);
  for (const lease of active) {
    if (lease.owner === excludeOwner) continue;
    if (conflictWithLease(filePath, lease)) return lease;
  }
  return null;
}

/**
 * Release all leases owned by an agent. Optionally only for specific files.
 */
function release(owner, { files, projectDir } = {}) {
  const dir = store.leasesDir(projectDir);
  if (!fs.existsSync(dir)) return 0;

  let released = 0;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const fp = path.join(dir, file);
    const lease = store.readJSON(fp);
    if (!lease || lease.owner !== owner) continue;

    if (files && files.length > 0) {
      lease.files = lease.files.filter((f) => !files.includes(f));
      if (lease.files.length === 0) {
        fs.unlinkSync(fp);
      } else {
        store.atomicWriteJSON(fp, lease);
      }
      released++;
    } else {
      fs.unlinkSync(fp);
      released++;
    }
  }
  return released;
}

/**
 * Renew (extend) all leases owned by an agent.
 */
function renew(owner, { ttl, projectDir } = {}) {
  const dir = store.leasesDir(projectDir);
  if (!fs.existsSync(dir)) return 0;

  const now = Math.floor(Date.now() / 1000);
  const newTtl = ttl || 300;
  let renewed = 0;

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const fp = path.join(dir, file);
    const lease = store.readJSON(fp);
    if (!lease || lease.owner !== owner) continue;
    if (lease.expiresAt <= now) continue; // already expired

    lease.ttl = newTtl;
    lease.expiresAt = now + newTtl;
    store.atomicWriteJSON(fp, lease);
    renewed++;
  }
  return renewed;
}

module.exports = { claim, listActive, check, release, renew };
