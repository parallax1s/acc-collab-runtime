"use strict";

/**
 * Timestamp-sortable ID generation.
 * Format: <prefix>-<hex-timestamp>-<random-4char>
 */

const crypto = require("crypto");

function generate(prefix = "msg") {
  const now = Date.now();
  const hex = now.toString(16).padStart(12, "0");
  const rand = crypto.randomBytes(2).toString("hex");
  return `${prefix}-${hex}-${rand}`;
}

module.exports = { generate };
