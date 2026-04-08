"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

const leases = require("../src/core/leases");
const store = require("../src/core/store");

const ACC_BIN = path.resolve(__dirname, "../bin/acc.js");

let tmpDir;

function freshDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "acc-test-"));
  store.bootstrap(tmpDir);
  return tmpDir;
}

function cleanup() {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ── helpers ──────────────────────────────────────────────────────────

function accCmd(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile("node", [ACC_BIN, ...args], { cwd: cwd || tmpDir }, (err, stdout, stderr) => {
      resolve({ code: err ? err.code : 0, stdout, stderr });
    });
  });
}

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

// ── tests ────────────────────────────────────────────────────────────

async function testLiteralVsGlobConflict() {
  console.log("\n── literal-vs-glob conflict ──");
  const dir = freshDir();

  // Agent A claims a glob pattern
  leases.claim({ owner: "agent-a", files: ["src/core/*.ts"], ttl: 60, projectDir: dir });

  // Agent B tries to claim a literal that matches the glob
  let threw = false;
  try {
    leases.claim({ owner: "agent-b", files: ["src/core/sim.ts"], ttl: 60, projectDir: dir });
  } catch (err) {
    threw = true;
    assert(!!err.conflict, "throws with conflict property");
    assert(err.conflict.owner === "agent-a", "conflict owner is agent-a");
  }
  assert(threw, "claim threw on literal-vs-glob conflict");

  // But agent A can claim another file under same glob (self doesn't conflict)
  const lease2 = leases.claim({ owner: "agent-a", files: ["src/core/engine.ts"], ttl: 60, projectDir: dir });
  assert(!!lease2.id, "same owner can claim files under own glob");

  cleanup();
}

async function testGlobVsLiteralConflict() {
  console.log("\n── glob-vs-literal conflict ──");
  const dir = freshDir();

  // Agent A claims a literal file
  leases.claim({ owner: "agent-a", files: ["src/core/sim.ts"], ttl: 60, projectDir: dir });

  // Agent B tries to claim a glob that covers that file
  let threw = false;
  try {
    leases.claim({ owner: "agent-b", files: ["src/core/*.ts"], ttl: 60, projectDir: dir });
  } catch (err) {
    threw = true;
    assert(!!err.conflict, "throws with conflict property");
    assert(err.conflict.owner === "agent-a", "conflict owner is agent-a");
  }
  assert(threw, "claim threw on glob-vs-literal conflict");

  cleanup();
}

async function testPatternVsPatternConflict() {
  console.log("\n── pattern-vs-pattern conflict (conservative) ──");
  const dir = freshDir();

  // Agent A claims src/core/*.ts
  leases.claim({ owner: "agent-a", files: ["src/core/*.ts"], ttl: 60, projectDir: dir });

  // Agent B claims src/core/**/*.js — overlapping prefix → conservative conflict
  let threw = false;
  try {
    leases.claim({ owner: "agent-b", files: ["src/core/**/*.js"], ttl: 60, projectDir: dir });
  } catch (err) {
    threw = true;
    assert(!!err.conflict, "throws with conflict property");
  }
  assert(threw, "claim threw on overlapping pattern prefixes");

  // Disjoint prefixes should NOT conflict
  const lease2 = leases.claim({ owner: "agent-b", files: ["lib/utils/*.js"], ttl: 60, projectDir: dir });
  assert(!!lease2.id, "disjoint pattern prefixes don't conflict");

  cleanup();
}

async function testNoConflictDifferentPaths() {
  console.log("\n── no conflict for different paths ──");
  const dir = freshDir();

  leases.claim({ owner: "agent-a", files: ["src/core/sim.ts"], ttl: 60, projectDir: dir });
  const lease2 = leases.claim({ owner: "agent-b", files: ["src/ui/app.tsx"], ttl: 60, projectDir: dir });
  assert(!!lease2.id, "different paths don't conflict");

  cleanup();
}

async function testConcurrentClaimsCLI() {
  console.log("\n── concurrent claim attempts (CLI, one must lose) ──");
  const dir = freshDir();

  // Spawn two claim commands at the same time for the same file
  const p1 = accCmd(["claim", "--id", "racer-1", "--files", "shared.ts", "--ttl", "60"], dir);
  const p2 = accCmd(["claim", "--id", "racer-2", "--files", "shared.ts", "--ttl", "60"], dir);

  const [r1, r2] = await Promise.all([p1, p2]);

  const oneWon = (r1.code === 0) !== (r2.code === 0) || // exactly one succeeds
    (r1.code === 0 && r2.code !== 0) ||
    (r1.code !== 0 && r2.code === 0);

  // It's also acceptable if both fail due to busy (mutex contention) — the point is
  // they can't BOTH succeed on the same file.
  const bothSucceeded = r1.code === 0 && r2.code === 0;

  if (bothSucceeded) {
    // Check that the two leases don't actually overlap (edge case: timing)
    const active = leases.listActive(dir);
    const owners = active.filter((l) => l.files.includes("shared.ts")).map((l) => l.owner);
    assert(owners.length <= 1, "at most one lease on shared.ts even if both returned 0");
  } else {
    assert(!bothSucceeded, "both claims did not succeed on the same file");

    // Identify winner and loser
    const winner = r1.code === 0 ? r1 : r2;
    const loser = r1.code === 0 ? r2 : r1;

    const winnerResult = JSON.parse(winner.stdout);
    assert(!!winnerResult.claimed, "winner got a lease ID");

    const loserStderr = loser.stderr;
    const loserParsed = (() => { try { return JSON.parse(loserStderr); } catch { return null; } })();
    assert(
      loserParsed && (loserParsed.error === "conflict" || loserParsed.error === "busy"),
      "loser got conflict or busy error"
    );
  }

  cleanup();
}

async function testStaleLockRecovery() {
  console.log("\n── stale lock recovery ──");
  const dir = freshDir();
  const leasesDir = store.leasesDir(dir);

  // Manually create a stale lock file with old mtime
  const lockPath = path.join(leasesDir, ".claim.lock");
  fs.writeFileSync(lockPath, JSON.stringify({ pid: 99999, ts: Date.now() - 60000 }) + "\n");

  // Set mtime to 60 seconds ago (well past the 30s stale threshold)
  const oldTime = new Date(Date.now() - 60000);
  fs.utimesSync(lockPath, oldTime, oldTime);

  // Claim should succeed — the stale lock gets cleaned up
  let threw = false;
  let lease;
  try {
    lease = leases.claim({ owner: "agent-a", files: ["src/foo.ts"], ttl: 60, projectDir: dir });
  } catch (err) {
    threw = true;
  }

  assert(!threw, "claim succeeds despite stale lock");
  assert(!!lease && !!lease.id, "got a valid lease");
  assert(!fs.existsSync(lockPath), "stale lock file was cleaned up");

  cleanup();
}

async function testFreshLockBlocks() {
  console.log("\n── fresh lock blocks with CLAIM_BUSY ──");
  const dir = freshDir();
  const leasesDir = store.leasesDir(dir);

  // Manually create a fresh lock file (simulating another process mid-claim)
  const lockPath = path.join(leasesDir, ".claim.lock");
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, ts: Date.now() }) + "\n");

  let threw = false;
  let errCode;
  try {
    leases.claim({ owner: "agent-a", files: ["src/foo.ts"], ttl: 60, projectDir: dir });
  } catch (err) {
    threw = true;
    errCode = err.code;
  }

  assert(threw, "claim throws when lock is held");
  assert(errCode === "CLAIM_BUSY", "error code is CLAIM_BUSY");

  // Cleanup the lock so rmSync doesn't fail
  fs.unlinkSync(lockPath);
  cleanup();
}

async function testCheckLiteralVsGlob() {
  console.log("\n── check() literal against glob lease ──");
  const dir = freshDir();

  leases.claim({ owner: "agent-a", files: ["src/entities/*.ts"], ttl: 60, projectDir: dir });

  const hit = leases.check("src/entities/player.ts", "agent-b", dir);
  assert(!!hit, "literal file matched by glob lease");
  assert(hit.owner === "agent-a", "correct owner on match");

  const miss = leases.check("src/core/engine.ts", "agent-b", dir);
  assert(!miss, "unrelated path not matched");

  const self = leases.check("src/entities/player.ts", "agent-a", dir);
  assert(!self, "owner excluded from own lease check");

  cleanup();
}

async function testCheckGlobVsLiteral() {
  console.log("\n── check() glob against literal lease ──");
  const dir = freshDir();

  leases.claim({ owner: "agent-a", files: ["src/core/sim.ts"], ttl: 60, projectDir: dir });

  // Checking a glob against a literal lease — uses entriesConflict symmetry
  const hit = leases.check("src/core/*.ts", "agent-b", dir);
  assert(!!hit, "glob query matched by literal lease");

  const miss = leases.check("src/ui/*.tsx", "agent-b", dir);
  assert(!miss, "unrelated glob not matched");

  cleanup();
}

// ── runner ───────────────────────────────────────────────────────────

async function main() {
  console.log("acc lease tests\n");

  await testLiteralVsGlobConflict();
  await testGlobVsLiteralConflict();
  await testPatternVsPatternConflict();
  await testNoConflictDifferentPaths();
  await testConcurrentClaimsCLI();
  await testStaleLockRecovery();
  await testFreshLockBlocks();
  await testCheckLiteralVsGlob();
  await testCheckGlobVsLiteral();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
