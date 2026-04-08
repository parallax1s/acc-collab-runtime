"use strict";

const messages = require("../core/messages");

function run(args) {
  const from = args["--from"];
  const to = args["--to"];
  const re = args["--re"];
  const body = args._positional;

  if (!from || !to || !re || !body) {
    console.error("Usage: acc reply --from <id> --to <id> --re <msg-id> \"message\"");
    process.exit(1);
  }

  const msg = messages.send({
    from,
    to,
    body,
    type: "ack",
    replyTo: re,
    projectDir: process.cwd(),
  });

  // Mark original message as replied via receipts (immutable messages)
  messages.markReplied(from, re, process.cwd());

  console.log(JSON.stringify({ replied: msg.id, re }));
}

module.exports = { run };
