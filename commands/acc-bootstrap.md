---
description: Bootstrap ACC coordination in the current repository and register this agent.
argument-hint: [agent-id]
allowed-tools: [Read, Bash]
---

# ACC Bootstrap

Bootstrap the current repository for ACC collaboration.

## Arguments

The user invoked this command with: $ARGUMENTS

## Instructions

1. Determine the agent ID from `$ARGUMENTS`. If it is empty, derive a short agent ID from the current tool and role.
2. Detect the current runtime:

```bash
ACC_RUNTIME="codex"
if [[ -n "${CLAUDE_PROJECT_DIR:-}" ]]; then
  ACC_RUNTIME="claude"
elif [[ -n "${CODEX_HOME:-}" ]]; then
  ACC_RUNTIME="codex"
elif [[ -n "${CLAUDE_HOME:-}" ]]; then
  ACC_RUNTIME="claude"
fi
```

3. Resolve the installed skill directory:

```bash
if [[ "$ACC_RUNTIME" == "claude" ]]; then
  ACC_SKILL_DIR="${CLAUDE_HOME:-$HOME/.claude}/skills/acc-collab-runtime"
else
  ACC_SKILL_DIR="${CODEX_HOME:-$HOME/.codex}/skills/acc-collab-runtime"
fi
```

4. Confirm that `${ACC_SKILL_DIR}/scripts/acc-run.sh` exists.
5. Run the bootstrap command:

```bash
"${ACC_SKILL_DIR}/scripts/acc-run.sh" install --type "${ACC_RUNTIME}" --agent-id <agent-id>
```

6. Report the chosen agent ID, detected runtime, and any follow-up steps.

## Rules

- Do not guess success; show the command result.
- If the skill is missing, stop and explain exactly how it can be installed.
