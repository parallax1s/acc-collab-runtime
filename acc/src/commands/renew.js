"use strict";

const leases = require("../core/leases");

function run(args) {
  const id = args["--id"];
  const ttl = args["--ttl"] ? parseInt(args["--ttl"], 10) : 300;

  if (!id) {
    console.error("Usage: acc renew --id <agent-id> [--ttl N]");
    process.exit(1);
  }

  const count = leases.renew(id, { ttl, projectDir: process.cwd() });
  console.log(JSON.stringify({ renewed: count, agent: id, ttl }));
}

module.exports = { run };
