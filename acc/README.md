# acc — Agent Communication CLI

File-based mailbox and leases for multi-agent coordination. When multiple AI coding agents (Claude Code, Codex, Gemini) work on the same repo, `acc` gives them a way to talk and avoid stepping on each other's files.

No daemon, no database, no dependencies. Just JSON files in `.agent-comms/`.

## Quick Start

```bash
# From any project directory
acc install --type claude --agent-id claude-01
acc install --type codex  --agent-id codex-01

# Send a message
acc send --from codex-01 --to claude-01 "Hold off on sim.ts" --files src/core/sim.ts

# Read inbox
acc recv --id claude-01 --format human

# Claim files (prevents other agents from editing)
acc claim --id codex-01 --files src/core/sim.ts --ttl 120

# Release when done
acc release --id codex-01
```

## How It Works

```
┌─────────────┐     .agent-comms/inbox/     ┌─────────────┐
│  Claude Code │ ◄──── messages (JSON) ────► │    Codex     │
│              │                              │              │
│  PreToolUse  │     .agent-comms/leases/    │   wrapper    │
│  hook checks │ ◄──── leases (JSON) ──────► │   checks     │
│  on Edit/    │                              │   before     │
│  Write       │     .agent-comms/receipts/  │   prompt     │
└─────────────┘      delivery state          └─────────────┘
```

**Messages** are immutable JSON files dropped into an agent's inbox. Delivery state (read/replied) is tracked separately in receipts, so no two processes mutate the same file.

**Leases** are TTL-based file locks. An agent claims files before editing; the Claude hook denies `Edit`/`Write` on leased files. Leases auto-expire.
Claim operations are serialized with a mutex to avoid check/write race windows.

**Hooks** are the injection layer. Claude Code gets a `PreToolUse` hook that checks leases and surfaces pending messages as `additionalContext`. Codex gets a wrapper script that prepends inbox state to the prompt.

## Commands

### `acc send`
Send a message to another agent's inbox.

```
acc send --from <id> --to <id> "message body" [options]
  --files     Comma-separated file paths (canonicalized)
  --blocking  Mark as blocking (receiver should stop)
  --ttl N     Time-to-live in seconds (default: 300)
  --type      Message type: info|request|ack|nack (default: info)
```

### `acc recv`
Read messages from an agent's inbox.

```
acc recv --id <agent-id> [options]
  --format   Output format: human|json|inject (default: human)
  --peek     Don't mark messages as read
  --task-status
            Comma-separated task statuses injected with --format inject (default: in_progress,queued,blocked)
```

Formats:
- `human` — terminal-friendly with timestamps and flags
- `json` — raw JSON array
- `inject` — structured block for agent context injection (messages + active leases + active tasks)

### `acc task`
Create deterministic task contracts and coordinate explicit work ownership.

```
acc task create   --title "<short title>" --objective "<clear goal>" [options]
acc task list     [--owner <agent-id>] [--status in_progress,queued,blocked,completed,failed] [--scope <path>] [--only-unfailable]
acc task claim    --id <task-id> --agent <agent-id> [--by <agent-id>]
acc task complete --id <task-id> [--by <agent-id>] [--proof "what was done"] [--notes "..."]
acc task fail     --id <task-id> --reason "why it failed"
```

Core fields stored in each task file:
- `id`, `title`, `objective`, `scope`
- `owner`, `status`, `priority`, `runbook`
- `unfailable` — if true, task completion requires expected artifacts to exist
- `expectedArtifacts` / `acceptanceCriteria` / `runbook`

### `acc status`
Show registered agents, active leases, and task summary.

```
acc status [--json]
```

### `acc reply`
Reply to a specific message. Marks the original as "replied" via receipts.

```
acc reply --from <id> --to <id> --re <msg-id> "reply body"
```

### `acc claim`
Claim a file lease. Other agents' hooks will deny edits on these files.

```
acc claim --id <agent-id> --files <paths> [--ttl N]
  --files   Comma-separated paths or globs (e.g. "src/core/*.ts")
  --ttl     Seconds until auto-expire (default: 300)
```

Fails with a conflict error if the file is already leased by another agent.
If a concurrent claim is in progress, returns `{"error":"busy",...}` and should be retried.
For pattern-vs-pattern claims, conflict checks are conservative (overlapping static prefixes are treated as conflicts).

### `acc release`
Release file leases.

```
acc release --id <agent-id> [--files <paths>]
```

Without `--files`, releases all leases for the agent.

### `acc renew`
Extend active leases (heartbeat). Use this for long editing sessions.

```
acc renew --id <agent-id> [--ttl N]
```

### `acc check-lease`
Check if a file is currently leased. Used internally by hooks.

```
acc check-lease --file <path> [--exclude <agent-id>]
```

Returns `{ "leased": true/false, "owner": "...", ... }`.

### `acc status`
Show all registered agents and active leases.

```
acc status [--json]
```

### `acc install`
Register an agent and install hooks.

```
acc install --type claude|codex [--agent-id <id>]
```

For Claude: generates `.claude/hooks/acc-pre-tool-use.js` and merges hook config into `.claude/settings.json`. Idempotent — safe to run multiple times.

For Codex: registers the agent and prints wrapper script usage.

### `acc gc`
Garbage-collect expired messages, leases, and stale receipts.

```
acc gc
```

## File Layout

```
<project>/
  .agent-comms/              # Created by acc install (gitignored)
    agents.json              # Registered agents
    inbox/<agent-id>/        # One dir per agent
      msg-<id>.json          # Immutable message files
    leases/
      lease-<id>.json        # Active file leases
    receipts/
      <agent-id>.json        # Read/replied state per agent
  .claude/
    hooks/
      acc-pre-tool-use.js    # Generated Claude hook
    settings.json            # Hook config (merged)
```

## Design Principles

1. **Zero dependencies** — plain Node.js, CommonJS, no build step
2. **File-based, no daemon** — survives crashes, works with turn-based agents
3. **Atomic writes** — all JSON writes use tmp+rename to prevent partial reads
4. **Immutable messages** — message files never mutated after creation; delivery state in separate receipts
5. **Lazy expiry** — expired items filtered at read time, cleaned up by `gc`
6. **Path canonicalization** — all file paths normalized to repo-relative with forward slashes
7. **Hardened injection** — message bodies JSON-escaped in inject format to prevent prompt injection
8. **Bash = inject only** — the hook never denies Bash commands (too brittle to parse shell paths), only injects context
9. **Serialized claim writes** — lease claim uses a mutex so conflict checks and writes are one atomic critical section

## Claude Hook Behavior

The generated `acc-pre-tool-use.js` runs on `Edit|Write|MultiEdit|Bash`:

| Tool | Leased file? | Pending messages? | Result |
|------|-------------|-------------------|--------|
| Edit/Write | Yes | — | **deny** with reason |
| Edit/Write | No | Yes | **allow** + additionalContext |
| Edit/Write | No | No | (empty = allow) |
| Bash | — | Yes | **allow** + additionalContext |
| Bash | — | No | (empty = allow) |

The hook is self-contained (no external requires), targets < 50ms on the fast path.
