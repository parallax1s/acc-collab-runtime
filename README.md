# ACC Collaboration Runtime

ACC Collaboration Runtime is a multi-agent coding workflow for teams mixing Codex, Claude, and ACC-style file coordination.

It packages three things in one repo:

- a bundled `acc` CLI for mailbox, lease, and task coordination
- an installable skill for Codex and Claude
- local plugin packaging and slash commands for both apps

This is for shared-repo coding sessions where multiple agents may touch overlapping files. It is not a general-purpose chat plugin.

## What You Get

- [`acc/`](/Users/mo/Desktop/Prj.nosync/programming/acc-collab-runtime/acc): the vendored ACC CLI source
- [`bin/acc`](/Users/mo/Desktop/Prj.nosync/programming/acc-collab-runtime/bin/acc): repo-local launcher for the bundled CLI
- [`skills/acc-collab-runtime/`](/Users/mo/Desktop/Prj.nosync/programming/acc-collab-runtime/skills/acc-collab-runtime): reusable skill with inbox, claim, renew, release, and handoff helpers
- [`commands/`](/Users/mo/Desktop/Prj.nosync/programming/acc-collab-runtime/commands): plugin slash commands for common ACC flows
- [`scripts/`](/Users/mo/Desktop/Prj.nosync/programming/acc-collab-runtime/scripts): installers and validation scripts

## Quick Start

Install into Codex:

```bash
./scripts/install-codex-plugin.sh
```

Install into Claude:

```bash
./scripts/install-claude-plugin.sh
```

Install into both:

```bash
./scripts/install.sh
```

Bootstrap an agent in a repo:

```bash
./bin/acc install --type codex --agent-id codex-main
```

Claim files before editing:

```bash
./bin/acc claim --id codex-main --files src/app.ts --ttl 300
```

Read inbox:

```bash
./bin/acc recv --id codex-main --format human
```

Send a handoff:

```bash
./bin/acc send --from codex-main --to claude-review "Ready for review" --files src/app.ts
```

Release when done:

```bash
./bin/acc release --id codex-main
```

## What Installation Changes

The installers do more than create a symlink.

For Codex they:

- symlink the skill into `~/.codex/skills/acc-collab-runtime`
- symlink the repo into `~/.codex/plugins/cache/local-codex-plugins/acc-collab-runtime/local`
- enable `acc-collab-runtime@local-codex-plugins` in `~/.codex/config.toml`

For Claude they:

- symlink the skill into `~/.claude/skills/acc-collab-runtime`
- symlink the repo into `~/.claude/plugins/cache/local-claude-plugins/acc-collab-runtime/local`
- register the plugin in `~/.claude/plugins/installed_plugins.json`
- enable `acc-collab-runtime@local-claude-plugins` in `~/.claude/settings.json`

They do not run `npm install`.

## Plugin Commands

The plugin exposes three slash commands:

- `/acc-bootstrap`: register the current agent in the current repo
- `/acc-sync`: read and summarize pending coordination messages
- `/acc-handoff`: send a concise update or handoff to another agent

The shared skill can also be invoked directly by asking for `acc-collab-runtime`.

## Direct Skill Helpers

The skill ships with shell helpers for common flows:

- [`acc-run.sh`](/Users/mo/Desktop/Prj.nosync/programming/acc-collab-runtime/skills/acc-collab-runtime/scripts/acc-run.sh): resolves the bundled CLI, `ACC_CLI`, or `acc` on `PATH`
- [`acc-inbox.sh`](/Users/mo/Desktop/Prj.nosync/programming/acc-collab-runtime/skills/acc-collab-runtime/scripts/acc-inbox.sh): reads inbox context in inject format
- [`acc-guard.sh`](/Users/mo/Desktop/Prj.nosync/programming/acc-collab-runtime/skills/acc-collab-runtime/scripts/acc-guard.sh): claims files, auto-renews, runs a command, then releases on exit

Example guarded command:

```bash
./skills/acc-collab-runtime/scripts/acc-guard.sh \
  --id codex-main \
  --files "src/app.ts,src/routes.ts" \
  --ttl 300 \
  --renew-every 90 \
  -- \
  npm test
```

## Repository Layout

```text
.claude-plugin/plugin.json
.codex-plugin/plugin.json
acc/
bin/acc
agents/openai.yaml
commands/
scripts/
skills/acc-collab-runtime/
tests/
```

## Validation

Run the full validation suite:

```bash
./scripts/test.sh
```

That covers:

- vendored ACC CLI tests
- skill wrapper tests
- bundled CLI resolution tests
- Codex installer tests against a disposable `CODEX_HOME`
- Claude installer tests against a disposable `CLAUDE_HOME`
