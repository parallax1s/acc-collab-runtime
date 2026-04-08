"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

const tasks = require("../src/core/tasks");
const store = require("../src/core/store");

const ACC_BIN = path.resolve(__dirname, "../bin/acc.js");

let tmpDir;

function freshDir() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "acc-task-test-"));
  store.bootstrap(tmpDir);
  return tmpDir;
}

function cleanup() {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
}

function accCmd(args, cwd) {
  return new Promise((resolve) => {
    execFile("node", [ACC_BIN, ...args], { cwd: cwd || tmpDir }, (err, stdout, stderr) => {
      resolve({ code: err ? err.code || 1 : 0, stdout, stderr });
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
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, label);
}

function assertJsonContains(jsonText, label) {
  try {
    const parsed = JSON.parse(jsonText);
    return parsed;
  } catch {
    failed++;
    console.error(`  ✗ ${label}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// task creation + defaults
// ═══════════════════════════════════════════════════════════════════════

async function testCreateDefaultsAndScope() {
  console.log("\n── task create defaults and scope canonicalization ──");
  const dir = freshDir();

  const t1 = tasks.create({
    title: "  Build sprite pipeline  ",
    objective: "  Implement sprite import/export pipeline ",
    scope: ["./src/../src/game", "assets//sprites"],
  }, dir);

  assert(t1.title === "Build sprite pipeline", "title is trimmed");
  assert(t1.objective === "Implement sprite import/export pipeline", "objective is trimmed");
  assert(t1.scope[0] === "src/game", "scope canonicalized");
  assert(t1.scope[1] === "assets/sprites", "scope strips duplicate slashes");
  assert(t1.status === "queued", "default task status is queued");
  assert(t1.priority === "normal", "default priority is normal");
  assert(t1.owner === null, "default owner is null");

  cleanup();
}

async function testCreateInvalidPayload() {
  console.log("\n── task creation rejects invalid payloads ──");
  const dir = freshDir();

  assertThrows(
    () => tasks.create({ title: "", objective: "x" }, dir),
    "rejects empty title"
  );
  assertThrows(
    () => tasks.create({ title: "x", objective: " " }, dir),
    "rejects blank objective"
  );
  assertThrows(
    () => tasks.create({ title: "x", objective: "y", priority: "wrong" }, dir),
    "rejects invalid priority"
  );
  assertThrows(
    () => tasks.create({ title: "x", objective: "y", scope: ["../../outside"] }, dir),
    "rejects scope escaping repo"
  );

  cleanup();
}

// ═══════════════════════════════════════════════════════════════════════
// task claim + lifecycle
// ═══════════════════════════════════════════════════════════════════════

async function testTaskClaimAndComplete() {
  console.log("\n── task claim and completion lifecycle ──");
  const dir = freshDir();

  const t = tasks.create({ title: "Implement HUD", objective: "Add HUD", owner: null }, dir);

  const claimed = tasks.claim(t.id, null, "agent-a", dir);
  assert(claimed.owner === "agent-a", "claim sets owner");
  assert(claimed.status === "in_progress", "claim sets status in_progress");

  let ownedConflict = false;
  try {
    tasks.claim(t.id, null, "agent-b", dir);
  } catch (err) {
    ownedConflict = err.code === "TASK_ALREADY_OWNED";
  }
  assert(ownedConflict, "second owner gets TASK_ALREADY_OWNED");

  const sameOwner = tasks.claim(t.id, "agent-a", "agent-a", dir);
  assert(sameOwner.owner === "agent-a", "owner can refresh own claim");

  cleanup();
}

async function testTaskUnfailableCompletion() {
  console.log("\n── task unfailable completion validation ──");
  const dir = freshDir();

  const missingArtifactPath = "artifacts/output.txt";
  const t = tasks.create({
    title: "Generate output",
    objective: "Produce required artifact",
    unfailable: true,
    expectedArtifacts: [missingArtifactPath],
  }, dir);

  let missingError = false;
  try {
    tasks.complete(t.id, { completionProof: "done" }, dir);
  } catch (err) {
    missingError = err.code === "TASK_UNFULFILLED";
  }
  assert(missingError, "unfailable task fails when required artifacts are missing");

  fs.mkdirSync(path.join(dir, "artifacts"), { recursive: true });
  fs.writeFileSync(path.join(dir, missingArtifactPath), "artifact\n", "utf8");
  const completed = tasks.complete(t.id, { completionProof: "artifact generated", notes: "final notes" }, dir);
  assert(completed.status === "completed", "unfailable task completes when artifacts exist");
  assert(completed.completionProof === "artifact generated", "completion proof stored");
  assert(completed.notes === "final notes", "notes stored");

  cleanup();
}

async function testTaskFail() {
  console.log("\n── task fail sets final status and reason ──");
  const dir = freshDir();

  const t = tasks.create({
    title: "Broken task",
    objective: "Intentionally fail",
  }, dir);

  const failed = tasks.fail(t.id, "blocked by upstream dependency", dir);
  assert(failed.status === "failed", "failed status set");
  assert(failed.notes === "blocked by upstream dependency", "failure reason saved to notes");

  cleanup();
}

// ═══════════════════════════════════════════════════════════════════════
// task list filtering
// ═══════════════════════════════════════════════════════════════════════

async function testFilterByStatusScopeAndFlags() {
  console.log("\n── task filter by status, scope, and unfailable flag ──");
  const dir = freshDir();

  const queuedCore = tasks.create({
    title: "Q1",
    objective: "Core task",
    scope: ["src/core"],
  }, dir);

  const inProgressUi = tasks.create({
    title: "I1",
    objective: "UI task",
    scope: ["src/ui"],
    owner: "agent-a",
    status: "in_progress",
  }, dir);

  const blockedUi = tasks.create({
    title: "B1",
    objective: "Blocked task",
    status: "blocked",
    scope: ["src/ui"],
    owner: "agent-b",
  }, dir);

  tasks.create({
    title: "F1",
    objective: "Failing task",
    status: "failed",
    scope: ["src/tools"],
    unfailable: true,
  }, dir);

  const scoped = tasks.filterBy(dir, { status: ["queued", "in_progress"], scope: "src/ui" });
  assert(scoped.length === 1 && scoped[0].id === inProgressUi.id, "scope + status filter narrows to one task");

  const onlyQueued = tasks.filterBy(dir, { status: ["queued"] });
  assert(onlyQueued.length === 1 && onlyQueued[0].id === queuedCore.id, "status filter includes only queued");

  const onlyUnfailable = tasks.filterBy(dir, { onlyUnfailable: true });
  assert(onlyUnfailable.length === 1 && !!onlyUnfailable[0].unfailable, "unfailable filter includes only unfailable tasks");

  cleanup();
}

async function testCliTaskCommands() {
  console.log("\n── acc task CLI create/list/claim/complete flow ──");
  const dir = freshDir();

  const create = await accCmd([
    "task",
    "create",
    "--title", "CLI Task",
    "--objective", "drive local CLI test",
    "--scope", "src/cli",
  ], dir);
  assert(create.code === 0, "acc task create returns 0");

  const created = assertJsonContains(create.stdout, "acc task create JSON parse");
  if (!created) return;

  const listed = await accCmd(["task", "list", "--scope", "src/cli", "--status", "queued"], dir);
  const listPayload = assertJsonContains(listed.stdout, "acc task list JSON parse");
  assert(listed.code === 0, "acc task list returns 0");
  assert(listPayload.tasks.length === 1, "list returns one scoped queued task");

  const claimed = await accCmd(["task", "claim", "--id", created.created, "--agent", "agent-cli"], dir);
  assert(claimed.code === 0, "acc task claim returns 0");

  const completed = await accCmd(["task", "complete", "--id", created.created, "--proof", "verified by cli"], dir);
  const completePayload = assertJsonContains(completed.stdout, "acc task complete JSON parse");
  assert(completed.code === 0, "acc task complete returns 0");
  assert(completePayload.completed === created.created, "complete response includes task id");

  const failed = await accCmd(["task", "fail", "--id", created.created, "--reason", "should not run after complete"], dir);
  assert(failed.code === 0, "acc task fail can transition completed tasks");
  const failPayload = assertJsonContains(failed.stdout, "acc task fail JSON parse");
  assert(failPayload.failed === created.created, "fail response includes task id");

  cleanup();
}

async function main() {
  console.log("acc task tests\n");

  await testCreateDefaultsAndScope();
  await testCreateInvalidPayload();
  await testTaskClaimAndComplete();
  await testTaskUnfailableCompletion();
  await testTaskFail();
  await testFilterByStatusScopeAndFlags();
  await testCliTaskCommands();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
