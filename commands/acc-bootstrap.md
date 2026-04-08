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
2. Resolve the installed skill directory:

```bash
ACC_SKILL_DIR="${CODEX_HOME:-$HOME/.codex}/skills/acc-collab-runtime"
if [[ ! -d "$ACC_SKILL_DIR" ]]; then
  ACC_SKILL_DIR="${CLAUDE_HOME:-$HOME/.claude}/skills/acc-collab-runtime"
fi
```

3. Confirm that `${ACC_SKILL_DIR}/scripts/acc-run.sh` exists.
4. Run the bootstrap command:

```bash
"${ACC_SKILL_DIR}/scripts/acc-run.sh" install --type codex --agent-id <agent-id>
```

5. Report the chosen agent ID and any follow-up steps.

## Rules

- Do not guess success; show the command result.
- If the skill is missing, stop and explain exactly how it can be installed.
