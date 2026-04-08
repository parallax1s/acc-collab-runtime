"use strict";

const COMMANDS = {
  send: "./commands/send",
  recv: "./commands/recv",
  reply: "./commands/reply",
  claim: "./commands/claim",
  release: "./commands/release",
  renew: "./commands/renew",
  "check-lease": "./commands/check-lease",
  status: "./commands/status",
  install: "./commands/install",
  gc: "./commands/gc",
  task: "./commands/task",
};

/**
 * Minimal arg parser. Handles --key value, --flag, and positional args.
 */
function parseArgs(argv) {
  const args = { _positional: null, _subcommand: null };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg;
      // Check if next arg is a value or another flag
      if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        args[key] = argv[i + 1];
        i += 2;
      } else {
        args[key] = true;
        i++;
      }
    } else {
      // First positional arg becomes the body/message
      if (!args._subcommand) {
        args._subcommand = arg;
      } else if (!args._positional) {
        args._positional = arg;
      }
      i++;
    }
  }
  return args;
}

function run(argv) {
  const command = argv[0];

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  if (!COMMANDS[command]) {
    console.error(`Unknown command: ${command}`);
    console.error(`Available: ${Object.keys(COMMANDS).join(", ")}`);
    process.exit(1);
  }

  const args = parseArgs(argv.slice(1));

  const mod = require(COMMANDS[command]);
  mod.run(args);
}

function printUsage() {
  console.log(`acc — Agent Communication CLI

Commands:
  send         Send a message to another agent
  recv         Receive messages from inbox
  reply        Reply to a specific message
  claim        Claim a file lease
  release      Release file leases
  renew        Renew (extend) active leases
  check-lease  Check if a file is leased (internal)
  status       Show agents and active leases
  task         Manage shared work contracts and delegation
  install      Install hooks for claude|codex
  gc           Garbage-collect expired messages and leases

Use: acc <command> --help for details.`);
}

module.exports = { run, parseArgs };
