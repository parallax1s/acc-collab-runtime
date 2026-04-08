"use strict";

const messages = require("../core/messages");
const store = require("../core/store");

function run(args) {
  const from = args["--from"];
  const to = args["--to"];
  const body = args._positional;
  const rawFiles = args["--files"] ? args["--files"].split(",") : [];
  const blocking = !!args["--blocking"];
  const ttl = args["--ttl"] ? parseInt(args["--ttl"], 10) : 300;
  const type = args["--type"] || "info";

  if (!from || !to || !body) {
    console.error("Usage: acc send --from <id> --to <id> \"message\" [--files f1,f2] [--blocking] [--ttl N]");
    process.exit(1);
  }

  // Canonicalize file paths
  const files = rawFiles.map((f) => store.canonicalize(f.trim()));

  const msg = messages.send({
    from,
    to,
    body,
    files,
    type,
    blocking,
    ttl,
    projectDir: process.cwd(),
  });

  console.log(JSON.stringify({ sent: msg.id, to: msg.to }));
}

module.exports = { run };
