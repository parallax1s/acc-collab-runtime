# ACC Collaboration Runtime

ACC Collaboration Runtime is a multi-agent coding workflow built around ACC, the Agent Communication CLI, for teams mixing Codex, Claude, and shared file coordination.

It packages three things in one repo:

- a bundled `acc` CLI for mailbox, lease, and task coordination
- installable Codex and Claude plugin bundles rooted at `.codex-plugin/` and `.claude-plugin/`
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

Bootstrap a Codex agent in a repo:

```bash
./bin/acc install --type codex --agent-id codex-main
```

Bootstrap a Claude agent in a repo:

```bash
./bin/acc install --type claude --agent-id claude-main
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

## Install Model

ACC uses a two-step install model:

- global install: makes the skill and plugin available to Codex or Claude under `~/.codex` or `~/.claude`
- repo bootstrap: wires the current repository for a specific agent with `./bin/acc install --type codex|claude --agent-id <id>`

The global installers do more than create a symlink.

For Codex they:

- symlink the skill into `~/.codex/skills/acc-collab-runtime`
- symlink the repo into `~/.codex/plugins/cache/local-codex-plugins/acc-collab-runtime/local`
- symlink the repo into `~/plugins/acc-collab-runtime` for local marketplace discovery
- enable `acc-collab-runtime@local-codex-plugins` in `~/.codex/config.toml`
- register the plugin in `~/.agents/plugins/marketplace.json` so it appears in the Codex plugins browser

For Claude they:

- symlink the skill into `~/.claude/skills/acc-collab-runtime`
- symlink the repo into `~/.claude/plugins/cache/local-claude-plugins/acc-collab-runtime/local`
- register the plugin in `~/.claude/plugins/installed_plugins.json`
- enable `acc-collab-runtime@local-claude-plugins` in `~/.claude/settings.json`

They do not run `npm install`.
They validate that the plugin bundle manifests plus command and skill payloads are present before installing.

## Claude Repo Bootstrap

`./bin/acc install --type claude --agent-id <id>` is the step that makes Claude operational inside a repository.

It writes:

- `.agent-comms/` with inbox, leases, receipts, and tasks state
- `.claude/hooks/acc-pre-tool-use.js` as an ACC-managed repo-local hook
- `.claude/settings.json` updates that register the ACC `PreToolUse` hook without removing unrelated settings

Behavior is conservative:

- if `.claude/settings.json` is malformed JSON, bootstrap stops without writing anything
- if `.claude/hooks/acc-pre-tool-use.js` already exists and is not ACC-managed, bootstrap stops instead of overwriting it
- rerunning bootstrap is idempotent and keeps a single ACC hook entry

## Plugin Commands

The plugin exposes three slash commands:

- `/acc-bootstrap`: register the current agent in the current repo
- `/acc-sync`: read and summarize pending coordination messages
- `/acc-handoff`: send a concise update or handoff to another agent

For Claude, `/acc-bootstrap` should be the first command you run in each repo after the global plugin install.

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
- Claude repo bootstrap tests
- plugin bundle validation tests
- skill wrapper tests
- bundled CLI resolution tests
- Codex installer tests against a disposable `CODEX_HOME`
- Claude installer tests against a disposable `CLAUDE_HOME`
