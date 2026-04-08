"use strict";

const path = require("path");

/**
 * Check if a file path matches a glob pattern.
 * Supports: *, **, ? wildcards.
 * Uses path.matchesGlob if available (Node 22.13+), else manual fallback.
 */

function matchesGlob(filePath, pattern) {
  // Normalize both to forward slashes for consistent matching
  const norm = filePath.replace(/\\/g, "/");
  const pat = pattern.replace(/\\/g, "/");

  if (typeof path.matchesGlob === "function") {
    return path.matchesGlob(norm, pat);
  }
  return fallbackMatch(norm, pat);
}

function fallbackMatch(str, pattern) {
  // Escape regex specials except our wildcards
  let regex = "";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*" && pattern[i + 1] === "*") {
      // ** matches any path segments
      regex += ".*";
      i += 2;
      if (pattern[i] === "/") i++; // skip trailing slash after **
    } else if (ch === "*") {
      // * matches anything except /
      regex += "[^/]*";
      i++;
    } else if (ch === "?") {
      regex += "[^/]";
      i++;
    } else {
      // Escape regex special chars
      regex += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      i++;
    }
  }
  return new RegExp(`^${regex}$`).test(str);
}

/**
 * Check if a file path matches any pattern in a list.
 */
function matchesAny(filePath, patterns) {
  if (!patterns || patterns.length === 0) return false;
  return patterns.some((p) => matchesGlob(filePath, p));
}

module.exports = { matchesGlob, matchesAny };
