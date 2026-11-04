// Smoke tests for the static scan and the inspector's CLI (no browser needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lint = join(root, "skills/slop-check/scripts/lint.mjs");
const inspect = join(root, "skills/slop-check/scripts/inspect.mjs");

const scan = (dir) => {
  const run = spawnSync(process.execPath, [lint, join(root, "tests/fixtures", dir), "--json"], { encoding: "utf8" });
  return { status: run.status, report: JSON.parse(run.stdout) };
};

test("lint flags the classic slop patterns", () => {
  const { status, report } = scan("slop");
  const ids = new Set(report.findings.map((f) => f.id));
  for (const id of ["COPY-02", "COPY-03", "COPY-04", "COPY-05", "COPY-15", "COPY-16", "UI-21", "UI-31"]) assert.ok(ids.has(id), `${id} missing`);
  assert.equal(status, 2, "a blocker (COPY-04, placeholder text) must set exit code 2");
});

test("lint stays quiet on a component that made its decisions", () => {
  const { status, report } = scan("clean");
  assert.equal(status, 0, "no blocker on a clean component");
  const ids = new Set(report.findings.map((f) => f.id));
  // On-grid values, 1-2 px hairlines, the Tailwind v4 important modifier ("flex!") and "!==" are not slop.
  for (const id of ["UI-31", "COPY-16"]) assert.ok(!ids.has(id), `${id} raised on a clean component`);
});

test("inspect prints its usage without starting a browser", () => {
  const out = execFileSync(process.execPath, [inspect, "--help"], { encoding: "utf8" });
  assert.match(out, /inspect\.mjs <url>/);
  assert.match(out, /--click/);
});
