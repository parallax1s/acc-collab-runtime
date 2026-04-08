"use strict";

const leases = require("../core/leases");

function run(args) {
  const id = args["--id"];
  const files = args["--files"] ? args["--files"].split(",") : undefined;

  if (!id) {
    console.error("Usage: acc release --id <agent-id> [--files <paths>]");
    process.exit(1);
  }

  const count = leases.release(id, { files, projectDir: process.cwd() });
  console.log(JSON.stringify({ released: count, agent: id }));
}

module.exports = { run };
