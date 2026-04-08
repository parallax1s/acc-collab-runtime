"use strict";

const leases = require("../core/leases");
const store = require("../core/store");

function run(args) {
  const id = args["--id"];
  const rawFiles = args["--files"] ? args["--files"].split(",") : [];
  const ttl = args["--ttl"] ? parseInt(args["--ttl"], 10) : 300;

  if (!id || rawFiles.length === 0) {
    console.error("Usage: acc claim --id <agent-id> --files <paths> [--ttl N]");
    process.exit(1);
  }

  // Canonicalize file paths (allow globs through without resolving)
  const files = rawFiles.map((f) => {
    const trimmed = f.trim();
    // Pass through glob patterns as-is
    if (trimmed.includes("*") || trimmed.includes("?")) return trimmed;
    return store.canonicalize(trimmed);
  });

  try {
    const lease = leases.claim({ owner: id, files, ttl, projectDir: process.cwd() });
    console.log(JSON.stringify({ claimed: lease.id, files: lease.files, expiresAt: lease.expiresAt }));
  } catch (err) {
    if (err && err.code === "CLAIM_BUSY") {
      console.error(JSON.stringify({
        error: "busy",
        message: "Lease claim lock is busy, retry shortly",
      }));
      process.exit(1);
    }
    if (err.conflict) {
      console.error(JSON.stringify({
        error: "conflict",
        file: err.message,
        owner: err.conflict.owner,
        lease: err.conflict.id,
        expiresAt: err.conflict.expiresAt,
      }));
      process.exit(1);
    }
    throw err;
  }
}

module.exports = { run };
