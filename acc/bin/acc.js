#!/usr/bin/env node
"use strict";

const path = require("path");

// Ensure requires resolve from src/
const srcDir = path.join(__dirname, "..", "src");
const originalResolve = require.resolve;

const cli = require(path.join(srcDir, "cli"));
cli.run(process.argv.slice(2));
