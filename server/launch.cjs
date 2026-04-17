/**
 * Run with: node launch.cjs
 * Works when invoked with an absolute path on UNC shares (Node resolves __dirname from the script path).
 * npm scripts use npm_package_json instead (see package.json).
 */
const path = require("path");
const { spawn } = require("child_process");

const entry = path.join(__dirname, "src", "index.js");
const child = spawn(process.execPath, [entry], { stdio: "inherit", shell: false });
child.on("exit", (code) => process.exit(code ?? 0));
