---
description: Sync ACC inbox before touching files or running write-capable commands.
allowed-tools: [Read, Bash]
---

# ACC Sync

Synchronize the current agent inbox and summarize unread coordination messages.

## Instructions

1. Infer the active agent ID from recent ACC usage in the repo, environment, or user prompt.
2. Resolve the installed skill directory:

```bash
ACC_SKILL_DIR="${CODEX_HOME:-$HOME/.codex}/skills/acc-collab-runtime"
if [[ ! -d "$ACC_SKILL_DIR" ]]; then
  ACC_SKILL_DIR="${CLAUDE_HOME:-$HOME/.claude}/skills/acc-collab-runtime"
fi
```

3. Run:

```bash
"${ACC_SKILL_DIR}/scripts/acc-inbox.sh" <agent-id>
```

4. Summarize blocking leases, requested handoffs, and any files that should not be edited.

## Rules

- If the agent ID cannot be inferred, say so directly and stop.
- Treat a conflicting lease as blocking.
