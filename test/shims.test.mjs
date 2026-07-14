import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The skills/iterator/*.mjs shims are the spawnable surface of a dropped
// skill folder: they must stay CLI-executable and keep the one-JSON-line
// contract even though all logic lives in the synced lib/ copies.

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const GATHER = join(root, "skills", "iterator", "gather.mjs");
const WRITE = join(root, "skills", "iterator", "write.mjs");

function tmpGitRepo() {
	const dir = mkdtempSync(join(tmpdir(), "iterator-shim-"));
	const git = (...args) =>
		execFileSync("git", args, { cwd: dir, stdio: "ignore" });
	git("init", "-q");
	git("config", "user.email", "t@example.com");
	git("config", "user.name", "t");
	return dir;
}

test("gather shim prints one JSON line for --step hub", () => {
	const dir = tmpGitRepo();
	try {
		const out = execFileSync(process.execPath, [GATHER, dir, "--step", "hub"], {
			encoding: "utf8",
		});
		const lines = out.trim().split("\n");
		assert.equal(lines.length, 1);
		const payload = JSON.parse(lines[0]);
		assert.equal(payload.step, "hub");
		assert.equal(payload.plan, null);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("gather shim rejects an unknown step with exit 1", () => {
	assert.throws(
		() =>
			execFileSync(process.execPath, [GATHER, "--step", "nope"], {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			}),
		(e) => e.status === 1,
	);
});

test("write shim prints an ok:false JSON line and exits 1 on a bad op", () => {
	const dir = tmpGitRepo();
	try {
		execFileSync(process.execPath, [WRITE, dir], {
			encoding: "utf8",
			input: '{"op":"nope"}',
		});
		assert.fail("expected exit 1");
	} catch (e) {
		assert.equal(e.status, 1);
		const result = JSON.parse(String(e.stdout).trim());
		assert.equal(result.ok, false);
		assert.match(result.error, /unknown op/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("write shim re-exports the core helpers (import surface preserved)", async () => {
	const mod = await import("../skills/iterator/write.mjs");
	assert.equal(typeof mod.applyOp, "function");
	assert.equal(typeof mod.setFmKeys, "function");
	const gmod = await import("../skills/iterator/gather.mjs");
	assert.equal(typeof gmod.gather, "function");
	assert.equal(typeof gmod.loadBundle, "function");
});

test("gather shim prints a JSON error envelope when gathering throws", () => {
	const dir = tmpGitRepo();
	try {
		// A directory named *.md makes loadBundle's readFileSync throw EISDIR —
		// the CLI must answer with {"ok":false,...}, never a stack trace.
		execFileSync("mkdir", ["-p", join(dir, "memory", "features", "broken.md")]);
		execFileSync(process.execPath, [GATHER, dir, "--step", "hub"], {
			encoding: "utf8",
		});
		assert.fail("expected exit 1");
	} catch (e) {
		assert.equal(e.status, 1);
		const result = JSON.parse(String(e.stdout).trim());
		assert.equal(result.ok, false);
		assert.match(result.error, /EISDIR|directory/i);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("gather shim answers an unknown step with a JSON error envelope", () => {
	try {
		execFileSync(process.execPath, [GATHER, "--step", "nope"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		assert.fail("expected exit 1");
	} catch (e) {
		assert.equal(e.status, 1);
		const result = JSON.parse(String(e.stdout).trim());
		assert.equal(result.ok, false);
		assert.match(result.error, /unknown step 'nope'/);
	}
});

test("write shim --schema prints a parseable payload shape per op", () => {
	const all = JSON.parse(
		execFileSync(process.execPath, [WRITE, "--schema"], { encoding: "utf8" }),
	);
	assert.ok(all.ops.includes("commit-tests"));
	assert.ok(all.ops.includes("extensions"));
	for (const op of all.ops) {
		const schema = JSON.parse(
			execFileSync(process.execPath, [WRITE, "--schema", op], {
				encoding: "utf8",
			}),
		);
		assert.equal(typeof schema, "object");
	}
});
