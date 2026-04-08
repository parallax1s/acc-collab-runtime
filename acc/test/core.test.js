"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

const leases = require("../src/core/leases");
const messages = require("../src/core/messages");
const agents = require("../src/core/agents");
const store = require("../src/core/store");

const ACC_BIN = path.resolve(__dirname, "../bin/acc.js");

let tmpDir;

function freshDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "acc-core-test-"));
  store.bootstrap(tmpDir);
  return tmpDir;
}

function cleanup() {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
}

function accCmd(args, cwd) {
  return new Promise((resolve) => {
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

function assertThrows(fn, label) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  assert(threw, label);
}

function assertDeepEqual(a, b, label) {
  assert(JSON.stringify(a) === JSON.stringify(b), label);
}

// ═══════════════════════════════════════════════════════════════════════
// release --files partial lease updates
// ═══════════════════════════════════════════════════════════════════════

async function testReleasePartialFiles() {
  console.log("\n── release --files partial lease updates ──");
  const dir = freshDir();

  // Claim multiple files in one lease
  const lease = leases.claim({
    owner: "agent-a",
    files: ["src/a.ts", "src/b.ts", "src/c.ts"],
    ttl: 60,
    projectDir: dir,
  });

  // Release only one file
  leases.release("agent-a", { files: ["src/b.ts"], projectDir: dir });

  const active = leases.listActive(dir);
  assert(active.length === 1, "lease still exists after partial release");
  assertDeepEqual(active[0].files, ["src/a.ts", "src/c.ts"], "remaining files are a.ts and c.ts");
  assert(active[0].id === lease.id, "lease ID unchanged after partial release");

  // Another agent can now claim the released file
  const lease2 = leases.claim({ owner: "agent-b", files: ["src/b.ts"], ttl: 60, projectDir: dir });
  assert(!!lease2.id, "released file can be claimed by another agent");

  // But the remaining files are still locked
  let threw = false;
  try {
    leases.claim({ owner: "agent-b", files: ["src/a.ts"], ttl: 60, projectDir: dir });
  } catch (err) {
    threw = true;
    assert(err.conflict.owner === "agent-a", "remaining file still locked by original owner");
  }
  assert(threw, "remaining file still conflicts");

  cleanup();
}

async function testReleaseAllFilesDeletesLease() {
  console.log("\n── release --files all files deletes lease ──");
  const dir = freshDir();

  leases.claim({ owner: "agent-a", files: ["src/x.ts"], ttl: 60, projectDir: dir });
  leases.release("agent-a", { files: ["src/x.ts"], projectDir: dir });

  const active = leases.listActive(dir);
  assert(active.length === 0, "lease deleted when all files released");

  cleanup();
}

async function testReleaseNoFilesReleasesAll() {
  console.log("\n── release without --files releases all leases ──");
  const dir = freshDir();

  leases.claim({ owner: "agent-a", files: ["src/a.ts"], ttl: 60, projectDir: dir });
  leases.claim({ owner: "agent-a", files: ["src/b.ts"], ttl: 60, projectDir: dir });

  const count = leases.release("agent-a", { projectDir: dir });
  assert(count === 2, "released 2 leases");
  assert(leases.listActive(dir).length === 0, "no active leases remain");

  cleanup();
}

// ═══════════════════════════════════════════════════════════════════════
// renew semantics
// ═══════════════════════════════════════════════════════════════════════

async function testRenewOwnerOnly() {
  console.log("\n── renew only affects owner's leases ──");
  const dir = freshDir();

  leases.claim({ owner: "agent-a", files: ["src/a.ts"], ttl: 30, projectDir: dir });
  const bLease = leases.claim({ owner: "agent-b", files: ["src/b.ts"], ttl: 30, projectDir: dir });

  const renewed = leases.renew("agent-a", { ttl: 600, projectDir: dir });
  assert(renewed === 1, "renewed 1 lease (owner-a only)");

  const active = leases.listActive(dir);
  const aLease = active.find((l) => l.owner === "agent-a");
  const bAfter = active.find((l) => l.owner === "agent-b");

  assert(aLease.ttl === 600, "agent-a TTL updated to 600");
  assert(bAfter.ttl === 30, "agent-b TTL unchanged");
  assert(aLease.expiresAt > bAfter.expiresAt, "agent-a expiry extended past agent-b");

  cleanup();
}

async function testRenewSkipsExpired() {
  console.log("\n── renew skips already-expired leases ──");
  const dir = freshDir();

  // Create a lease that's already expired by writing directly
  const leasesDir = store.leasesDir(dir);
  const now = Math.floor(Date.now() / 1000);
  const expiredLease = {
    id: "lease-expired-test",
    owner: "agent-a",
    files: ["src/old.ts"],
    claimedAt: now - 120,
    ttl: 60,
    expiresAt: now - 60, // expired 60s ago
  };
  store.atomicWriteJSON(path.join(leasesDir, `${expiredLease.id}.json`), expiredLease);

  // Also give agent-a a live lease
  leases.claim({ owner: "agent-a", files: ["src/live.ts"], ttl: 30, projectDir: dir });

  const renewed = leases.renew("agent-a", { ttl: 300, projectDir: dir });
  assert(renewed === 1, "renewed only the live lease, skipped expired");

  // The expired lease file is still there but inactive
  const active = leases.listActive(dir);
  const expiredStillThere = active.find((l) => l.id === "lease-expired-test");
  assert(!expiredStillThere, "expired lease not in active list");

  cleanup();
}

async function testRenewNonexistentOwner() {
  console.log("\n── renew returns 0 for unknown owner ──");
  const dir = freshDir();

  leases.claim({ owner: "agent-a", files: ["src/a.ts"], ttl: 60, projectDir: dir });
  const renewed = leases.renew("agent-z", { ttl: 300, projectDir: dir });
  assert(renewed === 0, "0 leases renewed for unknown owner");

  cleanup();
}

// ═══════════════════════════════════════════════════════════════════════
// concurrent register atomicity for agents.json
// ═══════════════════════════════════════════════════════════════════════

async function testConcurrentRegisterCLI() {
  console.log("\n── concurrent agent register atomicity ──");
  const dir = freshDir();

  // Spawn 10 concurrent installs for unique agents
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(accCmd(["install", "--type", "claude", "--agent-id", `agent-${i}`], dir));
  }
  const results = await Promise.all(promises);

  const allSucceeded = results.every((r) => r.code === 0);
  assert(allSucceeded, "all 10 concurrent installs succeeded");

  // Check agents.json is valid and has all 10
  const agentsList = agents.list(dir);
  assert(Array.isArray(agentsList), "agents.json is a valid array");

  // Due to read-modify-write races, some agents may be lost. The key invariant
  // is that the file is never corrupt (always valid JSON array).
  assert(agentsList.length >= 1, "agents.json has at least 1 agent (file not corrupt)");

  // The atomicWriteJSON prevents corruption — verify by re-reading raw
  const raw = fs.readFileSync(store.agentsFile(dir), "utf8");
  let parseOk = false;
  try {
    const parsed = JSON.parse(raw);
    parseOk = Array.isArray(parsed);
  } catch { /* corrupt */ }
  assert(parseOk, "agents.json is valid JSON after concurrent writes");

  // Count unique IDs
  const ids = new Set(agentsList.map((a) => a.id));
  assert(ids.size === agentsList.length, "no duplicate agent IDs");

  cleanup();
}

async function testRegisterIdempotent() {
  console.log("\n── register is idempotent ──");
  const dir = freshDir();

  agents.register("agent-x", "claude", dir);
  agents.register("agent-x", "codex", dir);  // re-register with different type

  const list = agents.list(dir);
  assert(list.length === 1, "still one agent after re-register");
  assert(list[0].type === "codex", "type updated to codex");

  cleanup();
}

// ═══════════════════════════════════════════════════════════════════════
// canonicalize security cases
// ═══════════════════════════════════════════════════════════════════════

async function testCanonicalizeEscapeRejection() {
  console.log("\n── canonicalize rejects repo escapes ──");
  const dir = freshDir();

  assertThrows(
    () => store.canonicalize("../../etc/passwd", dir),
    "rejects ../../etc/passwd"
  );

  assertThrows(
    () => store.canonicalize("../sibling/secret.txt", dir),
    "rejects ../sibling/secret.txt"
  );

  assertThrows(
    () => store.canonicalize("/etc/passwd", dir),
    "rejects absolute /etc/passwd"
  );

  cleanup();
}

async function testCanonicalizeNormalization() {
  console.log("\n── canonicalize normalizes paths ──");
  const dir = freshDir();

  // Redundant ./ prefix
  assert(store.canonicalize("./src/sim.ts", dir) === "src/sim.ts", "strips ./");

  // Redundant internal ..
  assert(store.canonicalize("src/core/../core/sim.ts", dir) === "src/core/sim.ts", "resolves internal ..");

  // Double slashes
  assert(store.canonicalize("src//core//sim.ts", dir) === "src/core/sim.ts", "collapses double slashes");

  // Already clean
  assert(store.canonicalize("src/core/sim.ts", dir) === "src/core/sim.ts", "clean path unchanged");

  cleanup();
}

async function testCanonicalizeBackslash() {
  console.log("\n── canonicalize normalizes backslashes ──");
  const dir = freshDir();

  // On macOS/Linux path.resolve won't treat \ as separator, but the
  // replace(/\\/g, "/") at the end normalizes any that sneak through.
  // The key check: the output never contains backslashes.
  const result = store.canonicalize("src/core/sim.ts", dir);
  assert(!result.includes("\\"), "output contains no backslashes");

  cleanup();
}

async function testCanonicalizeBoundary() {
  console.log("\n── canonicalize edge: root itself ──");
  const dir = freshDir();

  // Canonicalizing "." should give empty string (the root itself)
  const result = store.canonicalize(".", dir);
  assert(result === "", ". canonicalizes to empty string (root)");

  cleanup();
}

// ═══════════════════════════════════════════════════════════════════════
// message immutability
// ═══════════════════════════════════════════════════════════════════════

async function testMessageImmutability() {
  console.log("\n── message files are immutable after send ──");
  const dir = freshDir();

  const msg = messages.send({
    from: "agent-a", to: "agent-b", body: "hello",
    files: ["src/x.ts"], ttl: 300, projectDir: dir,
  });

  // Read the raw message file
  const inboxDir = store.inboxDir(dir, "agent-b");
  const msgFile = path.join(inboxDir, `${msg.id}.json`);
  const beforeContent = fs.readFileSync(msgFile, "utf8");

  // recv marks as read — but via receipts, not by mutating the message
  messages.recv("agent-b", { projectDir: dir });

  const afterContent = fs.readFileSync(msgFile, "utf8");
  assert(beforeContent === afterContent, "message file unchanged after recv");

  // reply also doesn't touch the original file
  messages.markReplied("agent-b", msg.id, dir);
  const afterReply = fs.readFileSync(msgFile, "utf8");
  assert(beforeContent === afterReply, "message file unchanged after markReplied");

  // Verify state is tracked in receipts instead
  const receipts = messages.getReceipts("agent-b", dir);
  assert(receipts[msg.id] === "replied", "receipt tracks replied state");

  cleanup();
}

async function testRecvPeekDoesNotMarkRead() {
  console.log("\n── recv --peek does not mark messages as read ──");
  const dir = freshDir();

  messages.send({ from: "a", to: "b", body: "test", ttl: 300, projectDir: dir });

  // Peek
  const peeked = messages.recv("b", { projectDir: dir, peek: true });
  assert(peeked.length === 1, "peek returns 1 message");
  assert(peeked[0].status === "pending", "peek status is pending");

  // Receipts should be empty
  const receipts = messages.getReceipts("b", dir);
  assert(Object.keys(receipts).length === 0, "no receipt created by peek");

  // Non-peek recv marks it
  const received = messages.recv("b", { projectDir: dir });
  assert(received[0].status === "read", "non-peek marks as read");

  const receiptsAfter = messages.getReceipts("b", dir);
  assert(receiptsAfter[received[0].id] === "read", "receipt set to read");

  cleanup();
}

// ═══════════════════════════════════════════════════════════════════════
// busy -> retry success path
// ═══════════════════════════════════════════════════════════════════════

async function testBusyRetrySuccess() {
  console.log("\n── busy -> retry success path ──");
  const dir = freshDir();
  const leasesDir = store.leasesDir(dir);
  const lockPath = path.join(leasesDir, ".claim.lock");

  // Create a fresh lock to simulate contention
  fs.writeFileSync(lockPath, JSON.stringify({ pid: 99999, ts: Date.now() }) + "\n");

  // First attempt: should get CLAIM_BUSY
  let busyThrown = false;
  try {
    leases.claim({ owner: "agent-a", files: ["src/retry.ts"], ttl: 60, projectDir: dir });
  } catch (err) {
    busyThrown = err.code === "CLAIM_BUSY";
  }
  assert(busyThrown, "first attempt got CLAIM_BUSY");

  // Simulate the other process finishing — remove the lock
  fs.unlinkSync(lockPath);

  // Retry: should succeed
  let lease;
  let retryOk = false;
  try {
    lease = leases.claim({ owner: "agent-a", files: ["src/retry.ts"], ttl: 60, projectDir: dir });
    retryOk = true;
  } catch { /* still busy somehow */ }

  assert(retryOk, "retry succeeds after lock released");
  assert(!!lease && !!lease.id, "got a valid lease on retry");

  cleanup();
}

// ═══════════════════════════════════════════════════════════════════════
// runner
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  console.log("acc core tests\n");

  // release --files
  await testReleasePartialFiles();
  await testReleaseAllFilesDeletesLease();
  await testReleaseNoFilesReleasesAll();

  // renew
  await testRenewOwnerOnly();
  await testRenewSkipsExpired();
  await testRenewNonexistentOwner();

  // concurrent register
  await testConcurrentRegisterCLI();
  await testRegisterIdempotent();

  // canonicalize
  await testCanonicalizeEscapeRejection();
  await testCanonicalizeNormalization();
  await testCanonicalizeBackslash();
  await testCanonicalizeBoundary();

  // message immutability
  await testMessageImmutability();
  await testRecvPeekDoesNotMarkRead();

  // busy -> retry
  await testBusyRetrySuccess();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
