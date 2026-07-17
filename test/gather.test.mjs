import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	gather,
	gatherFeature,
	gatherImplement,
	gatherKnowledge,
	gatherPlan,
	gatherPlanReview,
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

/** Build a throwaway repo with a memory bundle: one done feature (committed
 * with a `Feature:` trailer), one pending feature with a working-tree diff. */
function makeFixture() {
	const root = mkdtempSync(join(tmpdir(), "iterator-gather-"));
	git(root, "init", "-q");
	mkdirSync(join(root, "memory", "features"), { recursive: true });
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
		join(root, "memory", "features", "config-module.md"),
		`---
type: Feature
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
		join(root, "memory", "features", "auth-middleware.md"),
		`---
type: Feature
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
		join(root, "memory", "features", "index.md"),
		`# Features

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
		"feature(config-module): config\n\nFeature: config-module",
	);
	// Working-tree change matching only auth-middleware's glob.
	mkdirSync(join(root, "src", "auth"), { recursive: true });
	writeFileSync(join(root, "src", "auth", "index.ts"), "export {};\n");
	git(root, "add", "src/auth/index.ts"); // staged counts via `git diff HEAD`
	return root;
}

test("gather exposes the indexed backlog separately from plan features", () => {
	const root = makeFixture();
	try {
		mkdirSync(join(root, "memory", "backlog"), { recursive: true });
		writeFileSync(
			join(root, "memory", "backlog", "index.md"),
			`---\ntype: Backlog\ntitle: Iterator backlog\nitems: '[{"id":"fix-shell","title":"Fix shell","details":"Session error","kind":"bug","selected":true}]'\n---\n\n# Backlog\n`,
		);
		const p = gather(root);
		assert.deepEqual(p.backlog, [
			{
				id: "fix-shell",
				title: "Fix shell",
				details: "Session error",
				kind: "bug",
				selected: true,
			},
		]);
		assert.ok(!p.features.some((feature) => feature.name === "fix-shell"));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("gather builds the hub payload from bundle + git state", () => {
	const root = makeFixture();
	try {
		const p = gather(root);
		assert.equal(p.step, "hub");
		assert.deepEqual(p.plan, {
			title: "Add JWT auth",
			status: "approved",
			planReviewed: null,
			worktree: null,
		});
		assert.deepEqual(p.progress, { done: 1, total: 2 });
		assert.deepEqual(
			p.features.map((c) => c.name),
			["config-module", "auth-middleware"],
		);

		// Derived state is computed server-side and shipped in the payload.
		assert.equal(p.stage, "implementing");
		const [config, auth] = p.features;
		assert.equal(config.status, "done");
		assert.equal(config.testsStatus, "green");
		assert.equal(config.hasCommits, true, "trailer commit must be found");
		assert.equal(config.hasDiff, false);
		assert.equal(config.ready, true);

		assert.equal(auth.status, "pending");
		assert.deepEqual(auth.dependsOn, ["config-module"]);
		assert.equal(auth.ready, true, "done dependency satisfies");
		assert.deepEqual(
			p.readyWave,
			["auth-middleware"],
			"hub carries the server-derived ready-wave snapshot candidates",
		);
		assert.deepEqual(auth.waitingOn, []);
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
		writeFileSync(join(root, "a.ts"), "export {};\n");
		writeFileSync(join(root, "b.ts"), "export {};\n");
		git(root, "add", ".");
		const p = gather(root);
		assert.equal(p.plan, null);
		assert.equal(p.stage, "no-plan");
		assert.deepEqual(p.progress, { done: 0, total: 0 });
		assert.deepEqual(p.features, []);
		// Tracked files ride along for the goal box's @-mention suggestions.
		assert.deepEqual(p.files, ["a.ts", "b.ts"]);
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
			join(root, "memory", "features", "a-draft.md"),
			`---
type: Feature
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

test("focused review favors its feature over an earlier overlapping file owner", () => {
	const root = makeFixture();
	try {
		writeFileSync(
			join(root, "memory", "features", "config-module.md"),
			`---\ntype: Feature\ntitle: Config module\nstatus: done\nfiles: ["src/auth/*.ts"]\n---\n`,
		);
		const p = gatherReview(root, { feature: "auth-middleware" });
		assert.deepEqual(
			p.features[0].files.map((file) => file.path),
			["src/auth/index.ts"],
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("consolidated review rebuilds each implemented feature from its own commits", () => {
	const root = makeFixture();
	try {
		const config = join(root, "memory", "features", "config-module.md");
		writeFileSync(
			config,
			readFileSync(config, "utf8").replace(
				"status: done",
				"status: implemented",
			),
		);
		const auth = join(root, "memory", "features", "auth-middleware.md");
		writeFileSync(
			auth,
			readFileSync(auth, "utf8").replace(
				"status: pending",
				"status: implemented",
			),
		);
		git(root, "add", ".");
		git(
			root,
			"commit",
			"-q",
			"-m",
			"feature(auth-middleware): auth\n\nFeature: auth-middleware",
		);

		const p = gatherReview(root, { feature: "all" });
		assert.equal(p.multiReview, true);
		assert.equal(p.source, "commits");
		assert.deepEqual(p.reviewScope, ["config-module", "auth-middleware"]);
		assert.deepEqual(
			p.features.map((feature) => feature.name),
			["config-module", "auth-middleware"],
		);
		assert.deepEqual(
			p.features[0].files.map((file) => file.path),
			["src/config.ts"],
		);
		assert.deepEqual(
			p.features[1].files.map((file) => file.path),
			["src/auth/index.ts"],
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("review payload carries actual diff stats per feature", () => {
	const root = makeFixture();
	try {
		const p = gatherReview(root, { feature: "auth-middleware" });
		assert.equal(p.features.length, 1);
		assert.equal(p.features[0].linesEstimate, undefined, "estimates are gone");
		assert.ok(p.features[0].stats, "actual stats present");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("review groups a feature's tests with it and excludes comment/doc lines from code stats", () => {
	const root = makeFixture();
	try {
		// Give the feature recorded tests (as /iterator-test would) and stage a
		// change mixing code, a comment, and a blank line, plus the test file.
		writeFileSync(
			join(root, "memory", "features", "auth-middleware.md"),
			`---
type: Feature
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

		const p = gatherReview(root, { feature: "auth-middleware" });
		const paths = p.features[0].files.map((f) => f.path);
		assert.ok(
			paths.includes("test/auth.test.mjs"),
			"test file must be grouped with its feature",
		);
		assert.equal(p.uncategorized.length, 0, "nothing falls to uncategorized");

		const s = p.features[0].stats;
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

test("implement rounds carry exactly ONE feature (next) with its full contract", () => {
	const root = makeFixture();
	try {
		// A second dependency-free pending feature: ready alongside auth-middleware.
		writeFileSync(
			join(root, "memory", "features", "logging.md"),
			`---
type: Feature
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
		assert.ok(p.ready.length >= 2, "both features are ready");
		assert.deepEqual(
			p.wave.map((c) => c.name),
			[p.next.name],
			"one feature per round: the wave carries only next",
		);
		assert.ok(
			"implementationNotes" in p.next &&
				"blastRadius" in p.next &&
				"tests" in p.next,
			"next carries the full contract",
		);
		assert.match(p.advice, /exactly ONE feature/);
		// finishedFeatures: what this plan already changed, for a fresh context.
		assert.deepEqual(
			p.finishedFeatures.map((f) => f.name),
			["config-module"],
		);
		const fin = p.finishedFeatures[0];
		assert.equal(fin.status, "done");
		assert.ok(fin.commits.length >= 1, "commits resolved via trailer/recorded");
		assert.ok(fin.commits[0].sha && fin.commits[0].subject);
		// tmpdir may be a symlink (/var → /private/var on macOS) — compare tails.
		assert.ok(
			String(p.root).endsWith(root.split("/").pop()),
			"payload names the working root",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("implement readiness honors review_required for implemented dependencies", () => {
	const root = makeFixture();
	try {
		// Make auth-middleware's dependency merely implemented, not done.
		const cfg = join(root, "memory", "features", "config-module.md");
		writeFileSync(
			cfg,
			readFileSync(cfg, "utf8").replace("status: done", "status: implemented"),
		);
		let p = gatherImplement(root);
		assert.deepEqual(p.ready, [], "review_required on: implemented dep blocks");
		assert.deepEqual(p.implemented, ["config-module"]);
		assert.equal(p.stuck, false, "awaiting review is not a stuck graph");
		assert.match(p.advice, /Awaiting review/);

		writeFileSync(
			join(root, "memory", "settings.md"),
			`---\ntype: Settings\ntitle: Project settings\nreview_required: off\n---\n`,
		);
		p = gatherImplement(root);
		assert.deepEqual(
			p.ready,
			["auth-middleware"],
			"review_required off: implemented dep satisfies",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("plan-review gathers the plan sections, features, and the whole-plan diff", () => {
	const root = makeFixture();
	try {
		const p = gatherPlanReview(root);
		assert.equal(p.step, "plan-review");
		assert.equal(p.plan.title, "Add JWT auth");
		assert.equal(p.plan.planReviewed, null);
		assert.ok(p.plan.goal, "goal section rides along");
		assert.deepEqual(p.features.map((f) => f.name).sort(), [
			"auth-middleware",
			"config-module",
		]);
		const done = p.features.find((f) => f.name === "config-module");
		assert.ok(done.commits.length >= 1, "feature commits resolved");
		assert.ok(p.commits.length >= 1, "ordered commit list");
		assert.equal(p.commits[0].feature, "config-module");
		assert.ok(p.commits[0].sha && p.commits[0].subject);
		assert.match(
			p.diff,
			/src\/config\.ts/,
			"the whole-plan diff covers the feature commit",
		);
		assert.ok(!p.diff.includes("memory/"), "bundle bookkeeping excluded");
		assert.equal(p.diffTruncated, false);
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

test("memorize inventories OKF areas and the uncovered commit range", () => {
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

/** A repo with knowledge areas, a plan/features (work side), and design.md. */
function makeKnowledgeFixture() {
	const root = makeFixture(); // plan + 2 features, one commit, staged auth diff
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
		"---\ntype: Design\ntitle: Design parameters\ndescription: Dark, dense, mono.\n---\n# Direction\nd\n\n# Color\nAccent #7aa2f7.\n\n# Spacing\nspace-sm: 8px, space-md: 16px, space-lg: 32px\n\n# Elements\nButton: radius 4px.\n",
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
		// work-owned files (plan.md, features/, design.md) are not knowledge concepts
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
			!p.memories.some((m) => m.id.startsWith("features/")),
			"features are work-side",
		);

		assert.deepEqual(p.design, {
			title: "Design parameters",
			description: "Dark, dense, mono.",
			path: "design.md",
			register: "product",
			sections: {
				direction: "d",
				typography: "",
				color: "Accent #7aa2f7.",
				spacing: "space-sm: 8px, space-md: 16px, space-lg: 32px",
				elements: "Button: radius 4px.",
				responsive: "",
				signature: "",
			},
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

test("matchConcepts matches bidirectionally between anchors and feature globs", () => {
	const concepts = [
		{ id: "pitfalls/a", area: "pitfalls", files: ["lib/server.mjs"] },
		{ id: "architecture/b", area: "architecture", files: ["lib/views/*"] },
		{ id: "setup/c", area: "setup", files: ["package.json"] },
	];
	// feature glob matches an exact anchor
	assert.deepEqual(
		matchConcepts(concepts, ["lib/*.mjs"]).map((c) => c.id),
		["pitfalls/a"],
	);
	// anchor glob matches an exact feature path
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

test("implement contracts carry relevantMemories anchored to each feature, pitfalls first", () => {
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
		// auth-middleware owns src/auth/*.ts and depends on the done config feature.
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
		// The concept body is inlined with the frontmatter stripped — the
		// implementer reads knowledge from the contract, not from raw files.
		assert.equal(mem.body, "body");

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

test("feature payload lists architecture concepts with their anchors", () => {
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
		const p = gatherFeature(root);
		assert.deepEqual(p.architecture, [
			{
				id: "architecture/auth-shape",
				title: "Auth shape",
				description: "How auth is layered.",
				files: ["src/auth/*.ts"],
			},
		]);
		assert.equal(gatherFeature(mkFreshRepo()).architecture.length, 0);
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
		const p = gatherReview(root, { feature: "auth-middleware" });
		assert.equal(p.features.length, 1);
		const pits = p.features[0].pitfalls;
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
		assert.match(gatherRange(root).advice, /iterator-init/);
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

test("plan/hub/review payloads carry designFile and knowledgeInitialized", () => {
	const root = makeFixture();
	try {
		// No knowledge areas, no design.md yet.
		let plan = gatherPlan(root);
		assert.equal(plan.designFile, null);
		assert.equal(plan.knowledgeInitialized, false);
		assert.equal(gather(root).knowledgeInitialized, false);
		assert.equal(gatherReview(root).designFile, null);

		writeFileSync(
			join(root, "memory", "design.md"),
			"---\ntype: Design\ntitle: Design\n---\n\n# Direction\nd\n",
		);
		writeFileSync(
			join(root, "memory", "index.md"),
			'---\nokf_version: "0.1"\n---\n# Memory\n',
		);
		mkdirSync(join(root, "memory", "architecture"), { recursive: true });

		plan = gatherPlan(root);
		assert.ok(plan.designFile.endsWith(join("memory", "design.md")));
		assert.equal(plan.knowledgeInitialized, true);
		assert.equal(gather(root).knowledgeInitialized, true);
		assert.ok(
			gatherReview(root).designFile.endsWith(join("memory", "design.md")),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("hub without a bundle reports knowledge-init state for the hero", () => {
	const root = mkdtempSync(join(tmpdir(), "iterator-gather-"));
	try {
		git(root, "init", "-q");
		assert.equal(gather(root).knowledgeInitialized, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("review payload carries the deterministic hasChanges flag", () => {
	const root = makeFixture();
	try {
		assert.equal(gatherReview(root).hasChanges, true, "staged diff → changes");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("hasChanges is false on a clean tree with no recorded commits", () => {
	const root = mkdtempSync(join(tmpdir(), "iterator-gather-"));
	try {
		git(root, "init", "-q");
		mkdirSync(join(root, "memory", "features"), { recursive: true });
		writeFileSync(
			join(root, "memory", "features", "empty-feature.md"),
			'---\ntype: Feature\ntitle: E\ndescription: d\nstatus: pending\nfiles: ["src/*.ts"]\n---\n',
		);
		writeFileSync(join(root, ".keep"), "");
		git(root, "add", ".keep");
		git(root, "commit", "-qm", "init");
		const p = gatherReview(root);
		assert.equal(p.hasChanges, false);
		assert.equal(p.features.length, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("hub payload reports working-tree dirt outside the bundle", () => {
	const root = makeFixture();
	try {
		const p = gather(root);
		assert.equal(p.dirty.count, 1, "staged src/auth/index.ts counts");
		assert.deepEqual(p.dirty.files, ["src/auth/index.ts"]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("feature payload surfaces decisions concepts and stored memories/conflicts", () => {
	const root = makeFixture();
	try {
		mkdirSync(join(root, "memory", "decisions"), { recursive: true });
		writeFileSync(
			join(root, "memory", "decisions", "no-orm.md"),
			"---\ntype: Decision\ntitle: No ORM\ndescription: Raw SQL only.\n---\n\nbody\n",
		);
		writeFileSync(
			join(root, "memory", "features", "auth-middleware.md"),
			`---
type: Feature
title: Auth middleware
description: JWT middleware
status: pending
depends_on: [config-module]
files: ["src/auth/*.ts"]
memories: [decisions/no-orm]
conflicts: '[{"decision":"decisions/no-orm","note":"introduces an ORM"}]'
---
`,
		);
		const p = gatherFeature(root);
		assert.equal(p.decisions.length, 1);
		assert.equal(p.decisions[0].id, "decisions/no-orm");
		const auth = p.features.find((c) => c.name === "auth-middleware");
		assert.deepEqual(auth.memories, ["decisions/no-orm"]);
		assert.deepEqual(auth.conflicts, [
			{ decision: "decisions/no-orm", note: "introduces an ORM" },
		]);

		// Implement contract unions the stored list with the dynamic match.
		const imp = gatherImplement(root);
		assert.ok(
			imp.next.relevantMemories.some((m) => m.id === "decisions/no-orm"),
			"stored memory id resolved into the contract",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("gatherUsage and gatherArchive read the ledger and retired plans", async () => {
	const { applyOp } = await import("../lib/write.mjs");
	const { gatherUsage, gatherArchive } = await import("../lib/gather.mjs");
	const root = mkdtempSync(join(tmpdir(), "iterator-gather-"));
	try {
		git(root, "init", "-q");
		// Empty state first.
		assert.equal(gatherUsage(root).exists, false);
		assert.deepEqual(gatherArchive(root).archives, []);

		applyOp(
			{
				op: "plan",
				title: "Tiny plan",
				sections: { goal: "g" },
			},
			root,
		);
		applyOp(
			{
				op: "features",
				features: [
					{ name: "only-feature", description: "d", files: ["src/x.ts"] },
				],
			},
			root,
		);
		applyOp(
			{
				op: "update-feature",
				feature: "only-feature",
				set: { status: "done" },
			},
			root,
		);
		applyOp(
			{
				op: "usage",
				rows: [
					{
						step: "implement",
						feature: "only-feature",
						provider: "p",
						model: "m",
						input: 42,
						output: 7,
					},
				],
			},
			root,
		);

		const u = gatherUsage(root);
		assert.equal(u.exists, true);
		assert.equal(u.grand.input, 42);
		assert.equal(u.totals.features["only-feature"].output, 7);

		applyOp(
			{
				op: "retire-plan",
				concept: { slug: "tiny", title: "Tiny", description: "d", body: "b" },
			},
			root,
		);

		// Hub lists the retired plan; archive gather parses it fully.
		const { gather } = await import("../lib/gather.mjs");
		const hub = gather(root);
		assert.equal(hub.retired.length, 1);
		assert.equal(hub.retired[0].title, "Tiny plan");

		const list = gatherArchive(root);
		assert.equal(list.archives.length, 1);
		assert.equal(list.archives[0].features, 1);
		assert.equal(list.archives[0].usage.input, 42);

		const one = gatherArchive(root, list.archives[0].name);
		assert.equal(one.title, "Tiny plan");
		assert.equal(one.features[0].name, "only-feature");
		assert.equal(one.features[0].status, "done");
		assert.equal(one.usage.grand.input, 42);
		assert.match(one.sections["Goal"] || "", /g/);

		assert.ok(gatherArchive(root, "nope").error, "bad target reports an error");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
