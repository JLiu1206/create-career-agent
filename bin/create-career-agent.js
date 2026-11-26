#!/usr/bin/env node
// Set up your own copy of the career agent template for Claude Code.
// Usage: npx create-career-agent [folder]     (default folder: my-career-agent)
"use strict";
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const TEMPLATE_URL =
  process.env.CAREER_AGENT_TEMPLATE_URL || "https://github.com/JLiu1206/career-agent-template.git";

const USAGE = `Usage: npx create-career-agent [folder]

Copies the career agent template into a new folder (default: my-career-agent)
and starts a fresh, private git history there. Needs git.

Template: https://github.com/JLiu1206/career-agent-template`;

function fail(code, message) {
  process.stderr.write(message + "\n");
  process.exit(code);
}

function git(args, cwd) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}
const folder = args[0] || "my-career-agent";
const target = path.resolve(process.cwd(), folder);

if (fs.existsSync(target) && (!fs.statSync(target).isDirectory() || fs.readdirSync(target).length > 0)) {
  fail(2, `"${folder}" already exists and isn't empty. Choose a new folder name.`);
}
if (git(["--version"]).status !== 0) {
  fail(1, "git is needed. Install it from https://git-scm.com and try again.");
}

console.log(`Downloading the career agent template into ${folder} ...`);
const clone = git(["clone", "--quiet", "--depth", "1", TEMPLATE_URL, target]);
if (clone.status !== 0) {
  fail(1, `Could not download the template from ${TEMPLATE_URL}.\n${(clone.stderr || "").trim()}\nCheck your internet connection and try again.`);
}

// Start a fresh history with no link back to the public template, so your
// CV and applications can never be pushed there by accident.
const gitDir = path.join(target, ".git");
if (path.dirname(gitDir) !== target) fail(1, "Unexpected folder layout; stopping.");
fs.rmSync(gitDir, { recursive: true, force: true });
if (git(["init", "--quiet", "-b", "main"], target).status !== 0) {
  git(["init", "--quiet"], target);
}

console.log(`
Done. Next:

  cd ${folder}
  (put your CV and past applications in inbox/)
  claude
  /career-setup

No CV on this computer? Try the made-up demo student:
  python3 scripts/load-demo.py     (Windows: python or py)

Keep this folder private: it will hold your CV.`);
