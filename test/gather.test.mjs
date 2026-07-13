import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	gather,
	gatherChunk,
	gatherImplement,
	gatherKnowledge,
	gatherMemorize,
	gatherRange,
	gatherReview,
	gatherSession,
	frontmatter,
	globToRegExp,
	matchConcepts,
} from "../lib/gather.mjs";

const git = (dir, ...args) =>
	execFileSync("git", args, {
		cwd: dir,
		encoding: "utf8",
		env: {
			...process.env,
			GIT_AUTHOR_NAME: "t",
			GIT_AUTHOR_EMAIL: "t@t",
			GIT_COMMITTER_NAME: "t",
			GIT_COMMITTER_EMAIL: "t@t",
		},
	}).trim();

/** Build a throwaway repo with a memory bundle: one done chunk (committed
 * with a `Chunk:` trailer), one pending chunk with a working-tree diff. */
function makeFixture() {
	const root = mkdtempSync(join(tmpdir(), "iterator-gather-"));
	git(root, "init", "-q");
	mkdirSync(join(root, "memory", "chunks"), { recursive: true });
	mkdirSync(join(root, "src"), { recursive: true });
	writeFileSync(
		join(root, "memory", "plan.md"),
		`---
type: Plan
title: Add JWT auth
status: approved
---

# Goal
g
`,
	);
	writeFileSync(
		join(root, "memory", "chunks", "config-module.md"),
		`---
type: Chunk
title: Config module
description: Centralize env access
status: done
size: small
lines_estimate: 30
depends_on: []
files: ["src/config.ts"]
tests_status: green
---
`,
	);
	writeFileSync(
		join(root, "memory", "chunks", "auth-middleware.md"),
		`---
type: Chunk
title: Auth middleware
description: JWT middleware
status: pending
size: medium
lines_estimate: 160
depends_on: [config-module]
files: ["src/auth/*.ts"]
---
`,
	);
	writeFileSync(
		join(root, "memory", "chunks", "index.md"),
		`# Chunks

* [Config module](config-module.md) - done
* [Auth middleware](auth-middleware.md) - pending
`,
	);
	writeFileSync(join(root, "src", "config.ts"), "export const cfg = 1;\n");
	git(root, "add", ".");
	git(
		root,
		"commit",
		"-q",
		"-m",
		"chunk(config-module): config\n\nChunk: config-module",
	);
	// Working-tree change matching only auth-middleware's glob.
	mkdirSync(join(root, "src", "auth"), { recursive: true });
	writeFileSync(join(root, "src", "auth", "index.ts"), "export {};\n");
	git(root, "add", "src/auth/index.ts"); // staged counts via `git diff HEAD`
	return root;
}

test("gather builds the hub payload from bundle + git state", () => {
	const root = makeFixture();
	try {
		const p = gather(root);
		assert.equal(p.step, "hub");
		assert.deepEqual(p.plan, { title: "Add JWT auth", status: "approved" });
		assert.deepEqual(p.progress, { done: 1, total: 2 });
		assert.deepEqual(
			p.chunks.map((c) => c.name),
			["config-module", "auth-middleware"],
		);

		const [config, auth] = p.chunks;
		assert.equal(config.status, "done");
		assert.equal(config.testsStatus, "green");
		assert.equal(config.hasCommits, true, "trailer commit must be found");
		assert.equal(config.hasDiff, false);

		assert.equal(auth.status, "pending");
		assert.deepEqual(auth.dependsOn, ["config-module"]);
		assert.equal(
			auth.hasDiff,
			true,
			"staged src/auth/index.ts matches src/auth/*.ts",
		);
		assert.equal(auth.hasCommits, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("gather without a bundle returns the create-plan shape", () => {
	const root = mkdtempSync(join(tmpdir(), "iterator-gather-"));
	try {
		git(root, "init", "-q");
		const p = gather(root);
		assert.equal(p.plan, null);
		assert.deepEqual(p.progress, { done: 0, total: 0 });
		assert.deepEqual(p.chunks, []);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("frontmatter parses scalars, inline lists, and block lists", () => {
	const fm = frontmatter(`---
title: "Quoted title"
status: pending
depends_on: [a, b]
commits:
  - { sha: abc, kind: implement }
files:
---

body`);
	assert.equal(fm.title, "Quoted title");
	assert.deepEqual(fm.depends_on, ["a", "b"]);
	assert.equal(fm.commits.length, 1);
	assert.equal(fm.files, null);
});

test("implement excludes drafts from ready/next and lists them separately", () => {
	const root = makeFixture();
	try {
		// A dependency-free draft: would be "next" if drafts were implementable.
		writeFileSync(
			join(root, "memory", "chunks", "a-draft.md"),
			`---
type: Chunk
title: A draft
description: Unaccepted proposal
status: draft
size: small
lines_estimate: 50
depends_on: []
files: ["src/draft.ts"]
---
`,
		);
		const p = gatherImplement(root);
		assert.equal(p.next.name, "auth-middleware", "draft must not become next");
		assert.deepEqual(p.ready, ["auth-middleware"]);
		assert.deepEqual(p.drafts, ["a-draft"]);
		assert.equal(p.stuck, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("implement payload surfaces designFile when memory/design.md exists", () => {
	const root = makeFixture();
	try {
		assert.equal(gatherImplement(root).designFile, null, "no design.md yet");

		writeFileSync(
			join(root, "memory", "design.md"),
			`---
type: Design
title: Design parameters
description: Quiet editorial tool.
register: product
---

# Direction
d
`,
		);
		const p = gatherImplement(root);
		assert.ok(p.designFile.endsWith(join("memory", "design.md")));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("review payload carries actual diff stats per chunk", () => {
	const root = makeFixture();
	try {
		const p = gatherReview(root, { chunk: "auth-middleware" });
		assert.equal(p.chunks.length, 1);
		assert.equal(p.chunks[0].linesEstimate, undefined, "estimates are gone");
		assert.ok(p.chunks[0].stats, "actual stats present");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("review groups a chunk's tests with it and excludes comment/doc lines from code stats", () => {
	const root = makeFixture();
	try {
		// Give the chunk recorded tests (as /iterator-test would) and stage a
		// change mixing code, a comment, and a blank line, plus the test file.
		writeFileSync(
			join(root, "memory", "chunks", "auth-middleware.md"),
			`---
type: Chunk
title: Auth middleware
description: JWT middleware
status: pending
size: medium
lines_estimate: 160
depends_on: [config-module]
files: ["src/auth/*.ts"]
tests: ["test/auth.test.mjs"]
---
`,
		);
		writeFileSync(
			join(root, "src", "auth", "index.ts"),
			"// verify the token against the config secret\nexport const auth = 1;\n\n",
		);
		mkdirSync(join(root, "test"), { recursive: true });
		writeFileSync(
			join(root, "test", "auth.test.mjs"),
			'import assert from "node:assert";\nassert.ok(true);\n',
		);
		git(root, "add", ".");

		const p = gatherReview(root, { chunk: "auth-middleware" });
		const paths = p.chunks[0].files.map((f) => f.path);
		assert.ok(
			paths.includes("test/auth.test.mjs"),
			"test file must be grouped with its chunk",
		);
		assert.equal(p.uncategorized.length, 0, "nothing falls to uncategorized");

		const s = p.chunks[0].stats;
		assert.ok(
			s.codeAdded < s.added,
			"comment/blank lines excluded from the code count",
		);
		assert.equal(s.codeAdded, 3, "one code line in src + two in the test file");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("globToRegExp handles exact paths, * and **", () => {
	assert.ok(globToRegExp("src/config.ts").test("src/config.ts"));
	assert.ok(!globToRegExp("src/config.ts").test("src/config_ts"));
	assert.ok(globToRegExp("src/*.ts").test("src/a.ts"));
	assert.ok(!globToRegExp("src/*.ts").test("src/deep/a.ts"));
	assert.ok(globToRegExp("src/**").test("src/deep/a.ts"));
});

test("implement wave lists every dependency-ready chunk with its full contract", () => {
	const root = makeFixture();
	try {
		// A second dependency-free pending chunk: ready alongside auth-middleware.
		writeFileSync(
			join(root, "memory", "chunks", "logging.md"),
			`---
type: Chunk
title: Logging
description: Structured logs
status: pending
size: small
depends_on: []
files: ["src/log.ts"]
---

# Implementation notes

Pino, one logger.
`,
		);
		const p = gatherImplement(root);
		assert.deepEqual(
			p.wave.map((c) => c.name),
			p.ready,
			"wave covers exactly the ready set",
		);
		assert.equal(
			p.next.name,
			p.wave[0].name,
			"next stays the first wave chunk",
		);
		assert.ok(p.wave.length >= 2, "both ready chunks are in the wave");
		for (const c of p.wave) {
			assert.ok(
				"implementationNotes" in c && "blastRadius" in c && "tests" in c,
				`wave chunk ${c.name} carries the full contract`,
			);
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("memorize reports okf:false for an iterator-only bundle", () => {
	const root = makeFixture();
	try {
		const p = gatherMemorize(root);
		assert.equal(p.step, "memorize");
		assert.equal(p.okf, false);
		assert.deepEqual(p.areas, []);
		assert.equal(p.lastMemorizedCommit, null);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("memorize inventories okf areas and the uncovered commit range", () => {
	const root = makeFixture();
	try {
		const base = git(root, "rev-parse", "HEAD");
		mkdirSync(join(root, "memory", "patterns"), { recursive: true });
		writeFileSync(
			join(root, "memory", "patterns", "index.md"),
			"# Patterns & Conventions\n",
		);
		writeFileSync(
			join(root, "memory", "patterns", "one-json-line.md"),
			`---
type: Pattern
title: One JSON line
description: Servers print exactly one JSON result line.
---

# Pattern
`,
		);
		writeFileSync(
			join(root, "memory", "index.md"),
			`---
okf_version: "0.1"
last_memorized_commit: ${base}
---

# Project Memory
`,
		);
		git(root, "add", ".");
		git(root, "commit", "-q", "-m", "feat: something new");

		const p = gatherMemorize(root);
		assert.equal(p.okf, true);
		assert.equal(p.lastMemorizedCommit, base);
		assert.equal(p.baseValid, true);
		assert.equal(p.pendingCount, 1);
		assert.match(p.pendingCommits[0].subject, /something new/);
		assert.deepEqual(
			p.areas.map((a) => a.name),
			["patterns"],
		);
		assert.deepEqual(p.areas[0].concepts, [
			{
				id: "patterns/one-json-line",
				type: "Pattern",
				title: "One JSON line",
				description: "Servers print exactly one JSON result line.",
				files: [],
			},
		]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("memorize flags an invalid (rebased-away) pointer", () => {
	const root = makeFixture();
	try {
		mkdirSync(join(root, "memory", "setup"), { recursive: true });
		writeFileSync(join(root, "memory", "setup", "index.md"), "# Setup\n");
		writeFileSync(
			join(root, "memory", "index.md"),
			`---
okf_version: "0.1"
last_memorized_commit: ${"f".repeat(40)}
---
`,
		);
		const p = gatherMemorize(root);
		assert.equal(p.okf, true);
		assert.equal(p.baseValid, false, "unknown sha must not validate");
		assert.equal(p.pendingCount, 0, "no range without a valid base");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

// ---------------------------------------------------------------------------
// range + knowledge (absorbed from okf-memory)

test("gather range reports the commits since a valid pointer", () => {
	const root = mkdtempSync(join(tmpdir(), "iterator-gather-"));
	try {
		git(root, "init", "-q");
		writeFileSync(join(root, "a"), "a\n");
		git(root, "add", ".");
		git(root, "commit", "-qm", "base");
		const base = git(root, "rev-parse", "HEAD");
		mkdirSync(join(root, "memory"), { recursive: true });
		writeFileSync(
			join(root, "memory", "index.md"),
			`---\nokf_version: "0.1"\nlast_memorized_commit: ${base}\n---\n# Memory\n`,
		);
		writeFileSync(join(root, "b"), "b\n");
		git(root, "add", ".");
		git(root, "commit", "-qm", "feat: new thing");

		const r = gatherRange(root);
		assert.equal(r.baseValid, true);
		assert.equal(r.effectiveBase, base);
		assert.equal(r.commitCount, 1);
		assert.match(r.commits[0].subject, /new thing/);
		assert.equal(r.nothingToMemorize, false);

		git(root, "commit", "-qm", "empty-range-check", "--allow-empty");
		writeFileSync(
			join(root, "memory", "index.md"),
			`---\nokf_version: "0.1"\nlast_memorized_commit: ${git(root, "rev-parse", "HEAD")}\n---\n# Memory\n`,
		);
		assert.equal(gatherRange(root).nothingToMemorize, true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("gather range ignores memory-only bookkeeping commits", () => {
	const root = mkdtempSync(join(tmpdir(), "iterator-gather-"));
	try {
		git(root, "init", "-q");
		writeFileSync(join(root, "a"), "a\n");
		git(root, "add", ".");
		git(root, "commit", "-qm", "base");
		const base = git(root, "rev-parse", "HEAD");
		mkdirSync(join(root, "memory"), { recursive: true });
		writeFileSync(
			join(root, "memory", "index.md"),
			`---\nokf_version: "0.1"\nlast_memorized_commit: ${base}\n---\n# Memory\n`,
		);
		git(root, "add", ".");
		git(root, "commit", "-qm", "chore(memory): record pointer");

		const r = gatherRange(root);
		assert.equal(r.baseValid, true);
		assert.equal(r.effectiveBase, base);
		assert.equal(r.commitCount, 0);
		assert.equal(r.nothingToMemorize, true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("gather range flags an invalid pointer without a usable fallback", () => {
	const root = mkdtempSync(join(tmpdir(), "iterator-gather-"));
	try {
		git(root, "init", "-q");
		writeFileSync(join(root, "a"), "a\n");
		git(root, "add", ".");
		git(root, "commit", "-qm", "base");
		mkdirSync(join(root, "memory"), { recursive: true });
		writeFileSync(
			join(root, "memory", "index.md"),
			`---\nokf_version: "0.1"\nlast_memorized_commit: ${"f".repeat(40)}\n---\n# Memory\n`,
		);
		const r = gatherRange(root);
		assert.equal(r.baseValid, false);
		assert.equal(r.mergeBaseFallback, null);
		assert.equal(r.effectiveBase, null);
		assert.equal(r.commitCount, 0);
		assert.equal(
			r.nothingToMemorize,
			false,
			"an unusable base is not 'nothing to do'",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

/** A repo with knowledge areas, a plan/chunks (work side), and design.md. */
function makeKnowledgeFixture() {
	const root = makeFixture(); // plan + 2 chunks, one commit, staged auth diff
	mkdirSync(join(root, "memory", "pitfalls"), { recursive: true });
	writeFileSync(
		join(root, "memory", "index.md"),
		'---\nokf_version: "0.1"\nlast_memorized_commit: HEADSHA\n---\n# Project memory\n'.replace(
			"HEADSHA",
			git(root, "rev-parse", "HEAD"),
		),
	);
	writeFileSync(join(root, "memory", "pitfalls", "index.md"), "# Pitfalls\n");
	writeFileSync(
		join(root, "memory", "pitfalls", "gone-anchor.md"),
		"---\ntype: Pitfall\ntitle: Gone anchor\ndescription: Anchored to a deleted file.\nfiles:\n  - src/deleted.ts\n---\nbody\n",
	);
	writeFileSync(
		join(root, "memory", "pitfalls", "live-anchor.md"),
		"---\ntype: Pitfall\ntitle: Live anchor\ndescription: Anchored to a tracked file.\nfiles:\n  - src/config.ts\n---\nbody\n",
	);
	writeFileSync(
		join(root, "memory", "pitfalls", "glob-anchor.md"),
		"---\ntype: Pitfall\ntitle: Glob anchor\ndescription: Anchored to tracked TypeScript files.\nfiles:\n  - src/*.ts\n---\nbody\n",
	);
	writeFileSync(
		join(root, "memory", "design.md"),
		"---\ntype: Design\ntitle: Design parameters\ndescription: Dark, dense, mono.\n---\n# Direction\nd\n",
	);
	return root;
}

test("gather knowledge reports areas, concepts, staleness, and the design card", () => {
	const root = makeKnowledgeFixture();
	try {
		const p = gatherKnowledge(root);
		assert.equal(p.step, "knowledge");
		assert.equal(p.bundlePath, "memory/");
		assert.equal(p.memory.initialized, true);
		assert.equal(p.memory.okfVersion, "0.1");
		assert.ok(p.memory.lastMemorizedCommit);
		// work-owned files (plan.md, chunks/, design.md) are not knowledge concepts
		assert.equal(p.memory.conceptCount, 3);
		assert.equal(p.memory.staleCount, 1);
		assert.equal(p.memory.unmemorizedCommitCount, 0);
		assert.equal(p.areas.length, 5);
		assert.equal(p.areas.find((a) => a.id === "pitfalls").count, 3);
		assert.equal(p.areas.find((a) => a.id === "pitfalls").title, "Pitfalls");

		const gone = p.memories.find((m) => m.id === "pitfalls/gone-anchor");
		assert.equal(gone.stale, true);
		assert.equal(gone.area, "pitfalls");
		assert.deepEqual(gone.files, ["src/deleted.ts"]);
		assert.equal(
			p.memories.find((m) => m.id === "pitfalls/live-anchor").stale,
			false,
		);
		assert.equal(
			p.memories.find((m) => m.id === "pitfalls/glob-anchor").stale,
			false,
		);
		assert.ok(
			!p.memories.some((m) => m.id.startsWith("chunks/")),
			"chunks are work-side",
		);

		assert.deepEqual(p.design, {
			title: "Design parameters",
			description: "Dark, dense, mono.",
			path: "design.md",
		});
		assert.equal(
			p.formatStale,
			false,
			"no format.md in the bundle → not stale",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("gather knowledge flags a stale format.md and an uninitialized bundle", () => {
	const root = makeKnowledgeFixture();
	try {
		writeFileSync(join(root, "memory", "format.md"), "# Old schema copy\n");
		assert.equal(gatherKnowledge(root).formatStale, true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
	const bare = mkdtempSync(join(tmpdir(), "iterator-gather-"));
	try {
		git(bare, "init", "-q");
		const p = gatherKnowledge(bare);
		assert.equal(p.memory.initialized, false);
		assert.equal(p.memory.conceptCount, 0);
		assert.equal(p.areas.length, 5);
		assert.equal(p.design, null);
	} finally {
		rmSync(bare, { recursive: true, force: true });
	}
});

// ---------------------------------------------------------------------------
// anchor matching — knowledge flowing back into the work (B1)

test("matchConcepts matches bidirectionally between anchors and chunk globs", () => {
	const concepts = [
		{ id: "pitfalls/a", area: "pitfalls", files: ["lib/server.mjs"] },
		{ id: "architecture/b", area: "architecture", files: ["lib/views/*"] },
		{ id: "setup/c", area: "setup", files: ["package.json"] },
	];
	// chunk glob matches an exact anchor
	assert.deepEqual(
		matchConcepts(concepts, ["lib/*.mjs"]).map((c) => c.id),
		["pitfalls/a"],
	);
	// anchor glob matches an exact chunk path
	assert.deepEqual(
		matchConcepts(concepts, ["lib/views/hub.mjs"]).map((c) => c.id),
		["architecture/b"],
	);
	// exact-to-exact
	assert.deepEqual(
		matchConcepts(concepts, ["package.json"]).map((c) => c.id),
		["setup/c"],
	);
	assert.deepEqual(matchConcepts(concepts, ["src/other.ts"]), []);
});

test("implement contracts carry relevantMemories anchored to each chunk, pitfalls first", () => {
	const root = makeKnowledgeFixture(); // pitfalls/live-anchor is anchored to src/config.ts
	try {
		mkdirSync(join(root, "memory", "architecture"), { recursive: true });
		writeFileSync(
			join(root, "memory", "architecture", "index.md"),
			"# Architecture\n",
		);
		writeFileSync(
			join(root, "memory", "architecture", "auth-shape.md"),
			"---\ntype: Architecture\ntitle: Auth shape\ndescription: How auth is layered.\nfiles:\n  - src/auth/*.ts\n---\nbody\n",
		);
		// auth-middleware owns src/auth/*.ts and depends on the done config chunk.
		const p = gatherImplement(root);
		assert.equal(p.next.name, "auth-middleware");
		assert.deepEqual(
			p.next.relevantMemories.map((m) => m.id),
			["architecture/auth-shape"],
		);
		const mem = p.next.relevantMemories[0];
		assert.equal(mem.title, "Auth shape");
		assert.ok(
			mem.path.endsWith(join("memory", "architecture", "auth-shape.md")),
			"path is readable directly",
		);

		// A pitfall anchored to the same files sorts before architecture.
		writeFileSync(
			join(root, "memory", "pitfalls", "auth-sharp-edge.md"),
			"---\ntype: Pitfall\ntitle: Auth sharp edge\ndescription: Token check races.\nfiles:\n  - src/auth/index.ts\n---\nbody\n",
		);
		const again = gatherImplement(root);
		assert.deepEqual(
			again.next.relevantMemories.map((m) => m.id),
			["pitfalls/auth-sharp-edge", "architecture/auth-shape"],
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("chunk payload lists architecture concepts with their anchors", () => {
	const root = makeKnowledgeFixture();
	try {
		mkdirSync(join(root, "memory", "architecture"), { recursive: true });
		writeFileSync(
			join(root, "memory", "architecture", "index.md"),
			"# Architecture\n",
		);
		writeFileSync(
			join(root, "memory", "architecture", "auth-shape.md"),
			"---\ntype: Architecture\ntitle: Auth shape\ndescription: How auth is layered.\nfiles:\n  - src/auth/*.ts\n---\nbody\n",
		);
		const p = gatherChunk(root);
		assert.deepEqual(p.architecture, [
			{
				id: "architecture/auth-shape",
				title: "Auth shape",
				description: "How auth is layered.",
				files: ["src/auth/*.ts"],
			},
		]);
		assert.equal(gatherChunk(mkFreshRepo()).architecture.length, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

function mkFreshRepo() {
	const dir = mkdtempSync(join(tmpdir(), "iterator-gather-"));
	git(dir, "init", "-q");
	return dir;
}

test("gatherMemorize concepts include files anchors", () => {
	const root = makeKnowledgeFixture();
	try {
		const p = gatherMemorize(root);
		const pitfalls = p.areas.find((a) => a.name === "pitfalls");
		const live = pitfalls.concepts.find((c) => c.id === "pitfalls/live-anchor");
		assert.deepEqual(live.files, ["src/config.ts"]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("review payload carries pitfall cards for anchored changed files", () => {
	const root = makeKnowledgeFixture(); // staged diff in src/auth/, live pitfall on src/config.ts
	try {
		writeFileSync(
			join(root, "memory", "pitfalls", "auth-sharp-edge.md"),
			"---\ntype: Pitfall\ntitle: Auth sharp edge\ndescription: Token check races.\nfiles:\n  - src/auth/*.ts\n---\nbody\n",
		);
		const p = gatherReview(root, { chunk: "auth-middleware" });
		assert.equal(p.chunks.length, 1);
		const pits = p.chunks[0].pitfalls;
		assert.equal(pits.length, 1);
		assert.equal(pits[0].id, "pitfalls/auth-sharp-edge");
		assert.deepEqual(pits[0].matched, ["src/auth/index.ts"]);
		assert.ok(pits[0].path.endsWith(".md"));
		assert.deepEqual(p.pitfalls, [], "no uncategorized pitfalls");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("gatherSession bundles hub/implement/memorize in one payload", () => {
	const root = mkFreshRepo();
	try {
		const s = gatherSession(root);
		assert.equal(s.step, "session");
		assert.equal(s.hub.step, "hub");
		assert.equal(s.memorize.step, "memorize");
		// No plan in a bare repo → implement is skipped.
		assert.equal(s.hub.plan, null);
		assert.equal(s.implement, null);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("gatherRange advice covers the pointer states in one sentence", () => {
	const root = mkFreshRepo();
	try {
		assert.match(gatherRange(root).advice, /okf-init/);
		mkdirSync(join(root, "memory"), { recursive: true });
		writeFileSync(
			join(root, "memory", "index.md"),
			'---\nokf_version: "0.1"\n---\n# Memory\n',
		);
		assert.match(gatherRange(root).advice, /No last_memorized_commit/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
