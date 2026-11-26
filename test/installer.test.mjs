// Tests for both installers. Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INSTALLERS = [
  ["node", [join(ROOT, "bin", "create-career-agent.js")]],
  ["sh", [join(ROOT, "bin", "career-agent")]],
];

function git(cwd, ...args) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

function fakeTemplate() {
  const dir = mkdtempSync(join(tmpdir(), "tpl-"));
  git(dir, "init", "-q", "-b", "main");
  mkdirSync(join(dir, "inbox"));
  writeFileSync(join(dir, "README.md"), "# Career agent template\n");
  writeFileSync(join(dir, "inbox", "README.md"), "Put your CV here.\n");
  git(dir, "add", "-A");
  git(dir, "-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-qm", "template");
  return dir;
}

function run([cmd, pre], args, cwd, url) {
  return spawnSync(cmd, [...pre, ...args], {
    cwd, encoding: "utf8",
    env: { ...process.env, CAREER_AGENT_TEMPLATE_URL: url },
  });
}

for (const installer of INSTALLERS) {
  const name = installer[0] === "node" ? "npx installer" : "brew installer";

  test(`${name}: copies the template into a new folder with a fresh git repo`, () => {
    const tpl = fakeTemplate();
    const work = mkdtempSync(join(tmpdir(), "work-"));
    const r = run(installer, ["my-agent"], work, tpl);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const target = join(work, "my-agent");
    assert.ok(existsSync(join(target, "README.md")));
    assert.ok(existsSync(join(target, "inbox", "README.md")));
    assert.ok(existsSync(join(target, ".git")));
    assert.equal(git(target, "remote").stdout.trim(), "", "must not point back at the public template");
    assert.notEqual(git(target, "rev-parse", "--verify", "HEAD").status, 0, "history must start fresh");
    assert.match(r.stdout, /\/career-setup/);
  });

  test(`${name}: defaults the folder name to my-career-agent`, () => {
    const tpl = fakeTemplate();
    const work = mkdtempSync(join(tmpdir(), "work-"));
    const r = run(installer, [], work, tpl);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.ok(existsSync(join(work, "my-career-agent", "README.md")));
  });

  test(`${name}: refuses a folder that already has files and leaves it alone`, () => {
    const tpl = fakeTemplate();
    const work = mkdtempSync(join(tmpdir(), "work-"));
    mkdirSync(join(work, "taken"));
    writeFileSync(join(work, "taken", "mine.txt"), "keep me");
    const r = run(installer, ["taken"], work, tpl);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /already exists/);
    assert.equal(readFileSync(join(work, "taken", "mine.txt"), "utf8"), "keep me");
    assert.ok(!existsSync(join(work, "taken", "README.md")));
  });

  test(`${name}: an absolute folder path gets a fresh repo too`, () => {
    const tpl = fakeTemplate();
    const work = mkdtempSync(join(tmpdir(), "work-"));
    const elsewhere = mkdtempSync(join(tmpdir(), "cwd-"));
    const target = join(work, "abs-agent");
    const r = run(installer, [target], elsewhere, tpl);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(git(target, "remote").stdout.trim(), "", "must not point back at the public template");
    assert.notEqual(git(target, "rev-parse", "--verify", "HEAD").status, 0, "history must start fresh");
  });

  test(`${name}: prints usage for --help`, () => {
    const r = run(installer, ["--help"], tmpdir(), "unused");
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Usage/);
  });

  test(`${name}: reports a clone failure clearly`, () => {
    const work = mkdtempSync(join(tmpdir(), "work-"));
    const r = run(installer, ["x"], work, join(work, "no-such-repo"));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /could not download/i);
    assert.ok(!existsSync(join(work, "x", "README.md")));
  });
}
