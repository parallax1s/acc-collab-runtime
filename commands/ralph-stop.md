---
description: Stop the current Ralph loop for this repository.
allowed-tools: [Read, Bash]
---

# Ralph Stop

Stop the Ralph loop for the current repository.

## Instructions

1. Resolve the installed ACC skill directory:

```bash
RALPH_SKILL_DIR="${CODEX_HOME:-$HOME/.codex}/skills/acc-collab-runtime"
RALPH_PLUGIN_ROOT="$(cd "${RALPH_SKILL_DIR}/../.." && pwd)"
```

2. Run:

```bash
node "${RALPH_PLUGIN_ROOT}/scripts/ralph-stop.js"
```

3. Report the result and suggest checking `/ralph-status` if needed.

## Rules

- Do not say it stopped unless the command says so.
