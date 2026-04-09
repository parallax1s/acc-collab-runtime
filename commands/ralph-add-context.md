---
description: Add operator guidance for future Ralph iterations in this repository.
argument-hint: <message>
allowed-tools: [Read, Bash]
---

# Ralph Add Context

Append operator guidance for future Ralph iterations.

## Arguments

The user invoked this command with: $ARGUMENTS

## Instructions

1. Treat `$ARGUMENTS` as the context message. If it is empty, stop and ask for the message.
2. Resolve the installed ACC skill directory:

```bash
RALPH_SKILL_DIR="${CODEX_HOME:-$HOME/.codex}/skills/acc-collab-runtime"
RALPH_PLUGIN_ROOT="$(cd "${RALPH_SKILL_DIR}/../.." && pwd)"
```

3. Run:

```bash
node "${RALPH_PLUGIN_ROOT}/scripts/ralph-add-context.js" --message "$ARGUMENTS"
```

4. Report the result.

## Rules

- Keep the user-supplied text intact.
