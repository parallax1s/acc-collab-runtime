# ACC Collaboration Runtime

ACC Collaboration Runtime packages a reusable multi-agent coordination workflow for Codex and Claude around a bundled `acc` CLI. It provides:

- the ACC CLI itself under [`acc/`](/Users/mo/Desktop/Prj.nosync/programming/acc-collab-runtime/acc)
- a portable Codex/Claude skill for inbox sync, file leases, renewals, releases, and handoffs
- local plugin packaging for Codex and Claude
- slash-command wrappers for common ACC flows
- install scripts that wire both the skill and the local plugin into the target app

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

## Install

Install into Codex:

```bash
./scripts/install-codex-plugin.sh
```

Install into Claude:

```bash
./scripts/install-claude-plugin.sh
```

Install both:

```bash
./scripts/install.sh
```

The installers:

- symlink the skill into `~/.codex/skills/acc-collab-runtime` or `~/.claude/skills/acc-collab-runtime`
- symlink the plugin repo into each app's local plugin cache
- enable the local plugin in the app config

They do not need `npm install`.

## Use

After installation, the skill can be triggered by asking the agent to use `acc-collab-runtime`.

The bundled CLI is available directly from this repo:

```bash
./bin/acc status
```

The bundled command files are intended for plugin packaging and local-plugin flows:

- `/acc-bootstrap`
- `/acc-sync`
- `/acc-handoff`

## Test

```bash
./scripts/test.sh
```
