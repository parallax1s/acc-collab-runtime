---
name: ralph-loop
description: Run and supervise a bounded detached Codex Ralph loop in the current repository.
metadata:
  short-description: Bounded Codex Ralph loop workflow
---

# Ralph Loop

Use this skill when you want Codex to work through a task over repeated `codex exec` iterations instead of a single interactive turn.

## Preconditions

1. `acc-collab-runtime` is installed in Codex.
2. The current repository can safely host a `.ralph/` directory.
3. The user accepts a bounded autonomous loop instead of a normal one-shot command.

## Core workflow

1. Start a loop:
```bash
node scripts/ralph-start.js --prompt "<task>" --max-iterations 5 --completion-promise COMPLETE
```

2. Inspect status:
```bash
node scripts/ralph-status.js
```

3. Add operator steering:
```bash
node scripts/ralph-add-context.js --message "Prefer the simpler patch and rerun tests."
```

4. Stop the loop:
```bash
node scripts/ralph-stop.js
```

## State files

Ralph writes repo-local state under `.ralph/`:

- `ralph-loop.state.json`
- `ralph-history.json`
- `ralph-context.md`
- `logs/`

## Safety rules

1. Always use an explicit iteration limit.
2. Do not start a second loop in the same repo unless you intentionally force replacement.
3. Read `/ralph-status` before assuming the loop is still running.
4. Use `/ralph-add-context` for steering instead of editing `.ralph` files manually.
5. Use `/ralph-stop` rather than killing random processes when the loop is under plugin control.
