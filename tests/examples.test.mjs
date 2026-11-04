// The README example: examples/before must keep its slop, examples/after must stay clean.
// The browser check starts one headless Chrome per page: run it with ANTI_SLOP_BROWSER_TESTS=1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scripts = join(root, "skills/slop-check/scripts");
const page = (name) => join(root, "examples", name);

const lint = (name) => {
  const run = spawnSync(process.execPath, [join(scripts, "lint.mjs"), page(name), "--json"], { encoding: "utf8" });
  return new Set(JSON.parse(run.stdout).findings.map((f) => f.id));
};

test("lint: the before example keeps its slop, the after example has none", () => {
  const before = lint("before");
  for (const id of ["UI-01", "UI-02", "UI-21", "COPY-04", "COPY-16", "A11Y-05"]) assert.ok(before.has(id), `${id} missing on examples/before`);
  assert.deepEqual([...lint("after")], [], "examples/after must stay clean");
});

test("inspect: new probes fire on the before example, nothing on the after example", { skip: !process.env.ANTI_SLOP_BROWSER_TESTS }, () => {
  const probe = (name) => {
    const out = mkdtempSync(join(tmpdir(), "ai-anti-slop-test-"));
    try {
      const run = spawnSync(process.execPath, [join(scripts, "inspect.mjs"), pathToFileURL(join(page(name), "index.html")).href, "--widths", "1440", "--no-axe", "--out", out], { encoding: "utf8", timeout: 120_000 });
      assert.equal(run.status, 0, run.stderr);
      return JSON.parse(readFileSync(join(out, "report.json"), "utf8")).runs.flatMap((r) => r.findings.map((f) => f.id));
    } finally { rmSync(out, { recursive: true, force: true }); }
  };
  const before = new Set(probe("before"));
  for (const id of ["UI-29", "UI-30", "COPY-17", "UI-02", "COPY-04"]) assert.ok(before.has(id), `${id} missing on examples/before`);
  assert.deepEqual(probe("after"), [], "examples/after must stay clean in the browser");
});
