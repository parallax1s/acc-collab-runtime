---
description: Show the current Ralph loop status for this repository.
allowed-tools: [Read, Bash]
---

# Ralph Status

Show the current Ralph loop status for the current repository.

## Instructions

1. Resolve the installed ACC skill directory:

```bash
RALPH_SKILL_DIR="${CODEX_HOME:-$HOME/.codex}/skills/acc-collab-runtime"
RALPH_PLUGIN_ROOT="$(cd "${RALPH_SKILL_DIR}/../.." && pwd)"
```

2. Run:

```bash
node "${RALPH_PLUGIN_ROOT}/scripts/ralph-status.js"
```

3. Report the output directly.

## Rules

- Do not guess status from `.ralph` files manually unless the command fails.
