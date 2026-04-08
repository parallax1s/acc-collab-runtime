"use strict";

const leases = require("../core/leases");
const store = require("../core/store");

function run(args) {
  const rawFile = args["--file"];
  const exclude = args["--exclude"];

  if (!rawFile) {
    console.error("Usage: acc check-lease --file <path> [--exclude <agent-id>]");
    process.exit(1);
  }

  const file = store.canonicalize(rawFile);
  const lease = leases.check(file, exclude || "", process.cwd());

  if (lease) {
    console.log(JSON.stringify({ leased: true, owner: lease.owner, lease: lease.id, expiresAt: lease.expiresAt }));
  } else {
    console.log(JSON.stringify({ leased: false }));
  }
}

module.exports = { run };
