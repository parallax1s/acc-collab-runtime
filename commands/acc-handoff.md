---
description: Send an ACC handoff or progress update to another agent with touched file references.
argument-hint: <to-agent> <message>
allowed-tools: [Read, Bash]
---

# ACC Handoff

Send a concise handoff to another ACC agent.

## Arguments

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the target agent ID and message from `$ARGUMENTS`.
2. Infer the current agent ID from prior ACC usage or environment.
3. Identify any files touched in the current task that should be attached to the handoff.
4. Resolve the installed skill directory:

```bash
ACC_SKILL_DIR="${CODEX_HOME:-$HOME/.codex}/skills/acc-collab-runtime"
if [[ ! -d "$ACC_SKILL_DIR" ]]; then
  ACC_SKILL_DIR="${CLAUDE_HOME:-$HOME/.claude}/skills/acc-collab-runtime"
fi
```

5. Run:

```bash
"${ACC_SKILL_DIR}/scripts/acc-run.sh" send --from <from-agent> --to <to-agent> "<message>" --files file/a.ts,file/b.ts
```

6. Confirm what was sent.

## Rules

- Keep the message factual and short.
- If the current or target agent ID is missing, stop instead of guessing.
