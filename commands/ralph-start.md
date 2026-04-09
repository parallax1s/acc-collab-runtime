---
description: Start a bounded detached Codex Ralph loop in the current repository.
argument-hint: <task prompt>
allowed-tools: [Read, Bash]
---

# Ralph Start

Start a Ralph loop for the current repository.

## Arguments

The user invoked this command with: $ARGUMENTS

## Instructions

1. Treat `$ARGUMENTS` as the task prompt. If it is empty, stop and ask the user for the prompt text.
2. Resolve the installed ACC skill directory:

```bash
RALPH_SKILL_DIR="${CODEX_HOME:-$HOME/.codex}/skills/acc-collab-runtime"
```

3. Confirm that `${RALPH_SKILL_DIR}` exists, then resolve the plugin root:

```bash
RALPH_PLUGIN_ROOT="$(cd "${RALPH_SKILL_DIR}/../.." && pwd)"
```

4. Run the start command with a bounded default:

```bash
node "${RALPH_PLUGIN_ROOT}/scripts/ralph-start.js" \
  --prompt "$ARGUMENTS" \
  --max-iterations 5 \
  --completion-promise COMPLETE
```

5. Report the command result and remind the user they can use `/ralph-status`, `/ralph-add-context`, or `/ralph-stop`.

## Rules

- Do not guess success; show the command result.
- If the skill is missing, stop and explain that `acc-collab-runtime` must be installed first.
