# ACC Claude Portable Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Claude support in ACC operationally complete by keeping global install thin and moving repo wiring into safe, idempotent `acc install --type claude --agent-id <id>` bootstrap behavior.

**Architecture:** Keep `scripts/install-claude-skill.sh` focused on user-level Claude install. Move Claude repo bootstrap into ACC CLI code that creates `.agent-comms`, writes an ACC-managed repo-local hook, and conservatively merges `.claude/settings.json` without clobbering unrelated config.

**Tech Stack:** Node.js, filesystem-based config merge, shell integration tests, existing ACC CLI test harness.

---

## Chunk 1: Claude Bootstrap Core

### Task 1: Add failing bootstrap tests for fresh repo and rerun behavior

**Files:**
- Create: `acc/test/install-claude.test.js`
- Reference: `acc/src/commands/install.js`
- Reference: `acc/src/core/store.js`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run `node acc/test/install-claude.test.js` and confirm failure**
- [ ] **Step 3: Cover fresh repo bootstrap outputs**
- [ ] **Step 4: Cover rerun idempotence for hook/settings registration**
- [ ] **Step 5: Commit**

### Task 2: Extract Claude bootstrap helpers and portable hook generation

**Files:**
- Create: `acc/src/core/claude.js`
- Modify: `acc/src/commands/install.js`
- Create or modify: `acc/src/hooks/claude-pre-tool-use.js`

- [ ] **Step 1: Add minimal helper module skeleton after tests fail**
- [ ] **Step 2: Implement `.agent-comms` bootstrap reuse and repo-local `.claude/hooks` creation**
- [ ] **Step 3: Generate ACC-managed hook content from portable source, not Werkstatt paths**
- [ ] **Step 4: Rerun `node acc/test/install-claude.test.js` until green**
- [ ] **Step 5: Commit**

## Chunk 2: Settings Merge Safety

### Task 3: Add failing tests for settings merge and refusal cases

**Files:**
- Modify: `acc/test/install-claude.test.js`
- Create: `acc/test/fixtures/claude-settings/valid-existing.json`
- Create: `acc/test/fixtures/claude-settings/malformed.json`
- Create: `acc/test/fixtures/claude-settings/unmanaged-hook.json`

- [ ] **Step 1: Add failing tests for preserving unrelated settings**
- [ ] **Step 2: Add failing tests for malformed JSON refusal**
- [ ] **Step 3: Add failing tests for unmanaged hook refusal**
- [ ] **Step 4: Run `node acc/test/install-claude.test.js` and confirm expected failures**
- [ ] **Step 5: Commit**

### Task 4: Implement conservative settings merge and managed-file detection

**Files:**
- Modify: `acc/src/core/claude.js`
- Modify: `acc/src/commands/install.js`

- [ ] **Step 1: Implement ACC-managed hook marker detection**
- [ ] **Step 2: Implement conservative `.claude/settings.json` merge logic**
- [ ] **Step 3: Refuse ambiguous or malformed configurations without partial writes**
- [ ] **Step 4: Rerun `node acc/test/install-claude.test.js` until green**
- [ ] **Step 5: Commit**

## Chunk 3: Public Packaging and Validation

### Task 5: Update docs and installer messaging to match the new model

**Files:**
- Modify: `README.md`
- Modify: `scripts/install-claude-skill.sh` (only if output messaging needs to change)
- Reference: `docs/superpowers/specs/2026-04-09-acc-claude-plugin-design.md`

- [ ] **Step 1: Document global install vs repo bootstrap split**
- [ ] **Step 2: Document repo-local files bootstrap writes**
- [ ] **Step 3: Document safety behavior for existing `.claude/settings.json`**
- [ ] **Step 4: Run targeted doc/install tests**
- [ ] **Step 5: Commit**

### Task 6: Run verification and finish cleanly

**Files:**
- Verify: `acc/test/install-claude.test.js`
- Verify: `acc/test/*.test.js`
- Verify: `tests/test-install-claude.sh`
- Verify: `scripts/test.sh`

- [ ] **Step 1: Run `node acc/test/install-claude.test.js`**
- [ ] **Step 2: Run `node acc/test/core.test.js && node acc/test/leases.test.js && node acc/test/task.test.js`**
- [ ] **Step 3: Run `./tests/test-install-claude.sh`**
- [ ] **Step 4: Run `./scripts/test.sh`**
- [ ] **Step 5: Commit final verification/doc slice if needed**
