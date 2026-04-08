"use strict";

const fs = require("fs");
const path = require("path");
const store = require("../core/store");

function run() {
  const projectDir = process.cwd();
  const now = Math.floor(Date.now() / 1000);
  let pruned = { messages: 0, leases: 0, receipts: 0 };

  // Prune expired leases
  const lDir = store.leasesDir(projectDir);
  if (fs.existsSync(lDir)) {
    for (const file of fs.readdirSync(lDir).filter((f) => f.endsWith(".json"))) {
      const fp = path.join(lDir, file);
      const lease = store.readJSON(fp);
      if (lease && lease.expiresAt <= now) {
        fs.unlinkSync(fp);
        pruned.leases++;
      }
    }
  }

  // Prune expired messages from all inboxes
  const inboxRoot = path.join(store.commsRoot(projectDir), "inbox");
  if (fs.existsSync(inboxRoot)) {
    for (const agentDir of fs.readdirSync(inboxRoot)) {
      const inbox = path.join(inboxRoot, agentDir);
      if (!fs.statSync(inbox).isDirectory()) continue;

      const receipts = store.readJSON(path.join(store.receiptsDir(projectDir), `${agentDir}.json`)) || {};

      for (const file of fs.readdirSync(inbox).filter((f) => f.endsWith(".json"))) {
        const fp = path.join(inbox, file);
        const msg = store.readJSON(fp);
        if (!msg) continue;

        if (msg.timestamp + msg.ttl < now) {
          fs.unlinkSync(fp);
          // Clean up receipt entry
          if (receipts[msg.id]) delete receipts[msg.id];
          pruned.messages++;
        }
      }

      // Write cleaned receipts
      const receiptsFile = path.join(store.receiptsDir(projectDir), `${agentDir}.json`);
      if (Object.keys(receipts).length > 0) {
        store.atomicWriteJSON(receiptsFile, receipts);
      } else if (fs.existsSync(receiptsFile)) {
        fs.unlinkSync(receiptsFile);
        pruned.receipts++;
      }
    }
  }

  console.log(JSON.stringify(pruned));
}

module.exports = { run };
