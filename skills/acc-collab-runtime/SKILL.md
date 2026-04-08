---
name: acc-collab-runtime
description: Coordinate concurrent agent work with ACC (Agent Communication CLI). Use when multiple agents (Codex/Claude/etc.) may touch overlapping files and require inbox sync, lease claim/renew/release, and explicit handoffs.
metadata:
  short-description: ACC coordination workflow for Codex and Claude
---

# ACC Collaboration Runtime

Use this skill when you are collaborating with at least one other agent in the same repository.

## Preconditions

1. `acc` is available either:
   - through this package's bundled CLI, or
   - on `PATH` (`acc ...`), or
   - via `ACC_CLI=/absolute/path/to/acc/bin/acc.js`.
2. You have an agent ID (example: `codex-main`, `codex-ui`, `codex-runtime`).

## Core workflow

1. Bootstrap/register once per repo session:
```bash
scripts/acc-run.sh install --type <codex|claude> --agent-id <agent-id>
```

2. Sync inbox before any edits or shell actions that modify files:
```bash
scripts/acc-inbox.sh <agent-id>
```

3. Claim files before editing:
```bash
scripts/acc-run.sh claim --id <agent-id> --files "src/path/a.ts,src/path/b.ts" --ttl 300
```

4. Renew during long tasks:
```bash
scripts/acc-run.sh renew --id <agent-id> --ttl 300
```

5. Release on completion:
```bash
scripts/acc-run.sh release --id <agent-id>
```

6. Send handoff/update:
```bash
scripts/acc-run.sh send --from <agent-id> --to <other-agent-id> "Done with X" --files src/path/a.ts
```

## Fast path helper

Run a command under a lease with auto-renew and guaranteed release:
```bash
scripts/acc-guard.sh --id <agent-id> --files "src/core/sim.ts" --ttl 300 --renew-every 90 -- <command...>
```

Example:
```bash
scripts/acc-guard.sh --id codex-runtime --files "src/core/sim.ts,src/entities/all.ts" -- \
  npm test -- tests/sim-compat.test.ts
```

## Coordination rules

1. If `claim` returns `conflict`, do not edit those files. Send/await handoff.
2. If `claim` returns `busy`, retry shortly; another claim operation is in flight.
3. Always quote glob patterns in zsh (`"src/core/*.ts"`).
4. Prefer narrow claims. Claim only files you will actually edit.
5. If blocked by another lease, send a message instead of force-editing.
