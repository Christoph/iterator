import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	existsSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyOp, topoSort, setFmKeys } from "../lib/write.mjs";
import { frontmatter, gather, loadBundle } from "../lib/gather.mjs";

process.env.ITERATOR_NOW = "2026-07-06T12:00:00Z";

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

const makeRepo = () => {
	const root = mkdtempSync(join(tmpdir(), "iterator-write-"));
	git(root, "init", "-q");
	return root;
};

const read = (root, ...p) => readFileSync(join(root, "memory", ...p), "utf8");

const PLAN_OP = {
	op: "plan",
	title: "Add JWT auth",
	sections: {
		goal: "Protect the API with JWT.",
		architecture: "Middleware in src/auth.",
		keyDecisions: "HS256.",
		productFit: "Matches middleware pattern.",
	},
	dependencies: ["jsonwebtoken — token signing/verification"],
};

const CHUNKS_OP = {
	op: "chunks",
	chunks: [
		{
			name: "auth-middleware",
			title: "Auth middleware",
			description: "JWT middleware",
			implementationNotes: "Verify token from config secret.",
			files: ["src/auth/*.ts"],
			dependsOn: ["config-module"],
			size: "small",
			snippets: [{ lang: "ts", code: "export function requireAuth(){}" }],
			blastRadius: "All protected routes.",
		},
		{
			name: "config-module",
			title: "Config module",
			description: "Centralize env access",
			implementationNotes: "Read env once.",
			files: ["src/config.ts"],
			dependsOn: [],
			size: "small",
		},
	],
};

test("plan op writes a conformant bundle and log entry", () => {
	const root = makeRepo();
	try {
		const res = applyOp(PLAN_OP, root);
		assert.equal(res.op, "plan");

		const fm = frontmatter(read(root, "plan.md"));
		assert.equal(fm.type, "Plan");
		assert.equal(fm.status, "approved");
		assert.equal(fm.title, "Add JWT auth");
		assert.equal(fm.timestamp, "2026-07-06T12:00:00Z");
		assert.match(
			read(root, "plan.md"),
			/\* `jsonwebtoken` — token signing\/verification/,
		);

		assert.match(read(root, "index.md"), /okf_version: "0\.1"/);
		assert.ok(
			existsSync(join(root, "memory", "format.md")),
			"format.md copied",
		);
		assert.match(
			read(root, "log.md"),
			/## 2026-07-06\n\* \*\*Creation\*\*: Plan "Add JWT auth" approved/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("chunks op writes files, topo-orders the index, regenerates plan # Chunks", () => {
	const root = makeRepo();
	try {
		applyOp(PLAN_OP, root);
		const res = applyOp(CHUNKS_OP, root);
		assert.deepEqual(res.written.sort(), ["auth-middleware", "config-module"]);

		const auth = read(root, "chunks", "auth-middleware.md");
		const fm = frontmatter(auth);
		assert.equal(fm.type, "Chunk");
		assert.deepEqual(fm.depends_on, ["config-module"]);
		assert.match(auth, /# Implementation notes\n\nVerify token/);
		assert.match(auth, /```ts\nexport function requireAuth/);
		assert.match(auth, /\* \[Config module\]\(\/chunks\/config-module\.md\)/);

		const index = read(root, "chunks", "index.md");
		assert.ok(
			index.indexOf("config-module.md") < index.indexOf("auth-middleware.md"),
			"dependency-first order",
		);
		assert.match(index, /⬜ pending · small · depends: config-module/);
		assert.match(
			read(root, "plan.md"),
			/# Chunks\n\n\* \[Config module\]\(\/chunks\/config-module\.md\) - Centralize env access/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("chunks op rejects cycles and missing references before writing", () => {
	const root = makeRepo();
	try {
		applyOp(PLAN_OP, root);
		assert.throws(
			() =>
				applyOp(
					{
						op: "chunks",
						chunks: [
							{ name: "a", description: "a", files: [], dependsOn: ["b"] },
							{ name: "b", description: "b", files: [], dependsOn: ["a"] },
						],
					},
					root,
				),
			/cycle/,
		);
		assert.throws(
			() =>
				applyOp(
					{
						op: "chunks",
						chunks: [
							{ name: "a", description: "a", files: [], dependsOn: ["ghost"] },
						],
					},
					root,
				),
			/missing/,
		);
		assert.ok(
			!existsSync(join(root, "memory", "chunks", "a.md")),
			"nothing written on failure",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("update-chunk flips status, appends commits and review notes", () => {
	const root = makeRepo();
	try {
		applyOp(PLAN_OP, root);
		applyOp(CHUNKS_OP, root);
		applyOp(
			{
				op: "update-chunk",
				chunk: "config-module",
				set: {
					status: "done",
					tests: ["test/config.test.ts"],
					tests_status: "green",
				},
				appendCommit: { sha: "abc1234", kind: "implement" },
				log: "**Implementation**: Committed chunk(config-module).",
			},
			root,
		);

		const raw = read(root, "chunks", "config-module.md");
		const fm = frontmatter(raw);
		assert.equal(fm.status, "done");
		assert.equal(fm.done, "2026-07-06", "done date derived from ITERATOR_NOW");
		assert.equal(fm.tests_status, "green");
		assert.match(
			raw,
			/commits:\n {2}- sha: abc1234\n {4}kind: implement\n {4}date: 2026-07-06/,
		);
		assert.match(read(root, "chunks", "index.md"), /✅ done · 🟢 tests green/);
		assert.match(read(root, "log.md"), /Committed chunk\(config-module\)/);

		applyOp(
			{
				op: "update-chunk",
				chunk: "config-module",
				appendReview: "* **Approved** — no changes requested.",
			},
			root,
		);
		const reviewed = read(root, "chunks", "config-module.md");
		assert.match(reviewed, /# Review\n\n## 2026-07-06\n\* \*\*Approved\*\*/);
		assert.equal(frontmatter(reviewed).reviewed, "2026-07-06");

		assert.throws(
			() =>
				applyOp(
					{ op: "update-chunk", chunk: "config-module", set: { files: [] } },
					root,
				),
			/cannot set/,
		);
		assert.throws(
			() =>
				applyOp(
					{ op: "update-chunk", chunk: "nope", set: { status: "done" } },
					root,
				),
			/no chunk/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("chunks op never rewrites or deletes a done chunk", () => {
	const root = makeRepo();
	try {
		applyOp(PLAN_OP, root);
		applyOp(CHUNKS_OP, root);
		applyOp(
			{ op: "update-chunk", chunk: "config-module", set: { status: "done" } },
			root,
		);

		const before = read(root, "chunks", "config-module.md");
		const res = applyOp(
			{
				op: "chunks",
				chunks: [
					{ ...CHUNKS_OP.chunks[1], description: "REWRITTEN" },
					CHUNKS_OP.chunks[0],
				],
			},
			root,
		);
		assert.deepEqual(res.skipped, ["config-module"]);
		assert.equal(
			read(root, "chunks", "config-module.md"),
			before,
			"done chunk untouched",
		);

		assert.throws(
			() =>
				applyOp(
					{
						op: "chunks",
						chunks: [CHUNKS_OP.chunks[0]],
						deletes: ["config-module"],
					},
					root,
				),
			/done chunk/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("adjustments op applies moves, renames (with rewiring), and descUpdates", () => {
	const root = makeRepo();
	try {
		applyOp(PLAN_OP, root);
		applyOp(CHUNKS_OP, root);
		const res = applyOp(
			{
				type: "plan-adjustments", // server output pipes in verbatim
				moves: [
					{
						file: "src/config.ts",
						from: "config-module",
						to: "auth-middleware",
					},
				],
				renames: [{ from: "config-module", to: "app-config" }],
				descUpdates: [
					{
						chunk: "auth-middleware",
						description: "JWT middleware for every protected route",
					},
				],
			},
			root,
		);
		assert.equal(res.applied.length, 3);

		assert.ok(existsSync(join(root, "memory", "chunks", "app-config.md")));
		assert.ok(!existsSync(join(root, "memory", "chunks", "config-module.md")));
		const auth = frontmatter(read(root, "chunks", "auth-middleware.md"));
		assert.deepEqual(auth.depends_on, ["app-config"], "depends_on rewired");
		assert.deepEqual(
			auth.files,
			["src/auth/*.ts", "src/config.ts"],
			"file moved in",
		);
		assert.equal(auth.description, "JWT middleware for every protected route");
		assert.deepEqual(
			frontmatter(read(root, "chunks", "app-config.md")).files,
			[],
			"file moved out",
		);
		assert.match(
			read(root, "chunks", "auth-middleware.md"),
			/\(\/chunks\/app-config\.md\)/,
			"body links rewired",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("topoSort orders dependency-first and reports cycles", () => {
	const { order, cycle } = topoSort([
		{ slug: "b", dependsOn: ["a"] },
		{ slug: "a", dependsOn: [] },
		{ slug: "c", dependsOn: ["b"] },
	]);
	assert.deepEqual(order, ["a", "b", "c"]);
	assert.deepEqual(cycle, []);
	assert.deepEqual(topoSort([{ slug: "x", dependsOn: ["x"] }]).cycle, ["x"]);
});

test("setFmKeys replaces existing keys and appends new ones", () => {
	const fm = setFmKeys("type: Chunk\nstatus: pending", {
		status: "done",
		done: "2026-07-06",
	});
	assert.match(fm, /status: done/);
	assert.match(fm, /\ndone: 2026-07-06$/);
	assert.doesNotMatch(fm, /pending/);
});

test("chunks op writes drafts, badges them, and validates size", () => {
	const root = makeRepo();
	try {
		applyOp(PLAN_OP, root);
		applyOp(
			{
				op: "chunks",
				chunks: [
					{ ...CHUNKS_OP.chunks[1], status: "draft", size: "medium" },
					{ ...CHUNKS_OP.chunks[0], status: "draft", size: "large" },
				],
			},
			root,
		);
		assert.equal(
			frontmatter(read(root, "chunks", "auth-middleware.md")).status,
			"draft",
		);
		assert.equal(
			frontmatter(read(root, "chunks", "auth-middleware.md")).size,
			"large",
		);
		assert.match(read(root, "chunks", "index.md"), /📝 draft/);
		assert.throws(
			() =>
				applyOp({ op: "chunks", chunks: [{ name: "x", size: "huge" }] }, root),
			/invalid chunk size 'huge'/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("chunks op rejects a status other than draft|pending", () => {
	const root = makeRepo();
	try {
		applyOp(PLAN_OP, root);
		assert.throws(
			() =>
				applyOp(
					{ op: "chunks", chunks: [{ name: "x", status: "done" }] },
					root,
				),
			/invalid chunk status 'done'/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("accepting the chunk set promotes drafts to pending (accept flag and plan-approved verbatim)", () => {
	const root = makeRepo();
	try {
		applyOp(PLAN_OP, root);
		applyOp(
			{
				op: "chunks",
				chunks: CHUNKS_OP.chunks.map((c) => ({ ...c, status: "draft" })),
			},
			root,
		);

		// The chunk UI's Accept line pipes in verbatim.
		const res = applyOp({ type: "plan-approved", branch: "test" }, root);
		assert.equal(res.op, "adjustments");
		assert.equal(res.applied.filter((a) => a.startsWith("accept ")).length, 2);
		assert.equal(
			frontmatter(read(root, "chunks", "auth-middleware.md")).status,
			"pending",
		);
		assert.equal(
			frontmatter(read(root, "chunks", "config-module.md")).status,
			"pending",
		);
		assert.doesNotMatch(read(root, "chunks", "index.md"), /📝 draft/);

		// accept:true on a normal adjustments payload does the same.
		applyOp(
			{
				op: "chunks",
				chunks: [
					{
						name: "late-extra",
						title: "Late",
						description: "x",
						status: "draft",
						dependsOn: [],
					},
				],
			},
			root,
		);
		applyOp({ op: "adjustments", accept: true }, root);
		assert.equal(
			frontmatter(read(root, "chunks", "late-extra.md")).status,
			"pending",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("update-chunk accepts draft and pending status values", () => {
	const root = makeRepo();
	try {
		applyOp(PLAN_OP, root);
		applyOp(CHUNKS_OP, root);
		applyOp(
			{ op: "update-chunk", chunk: "config-module", set: { status: "draft" } },
			root,
		);
		assert.equal(
			frontmatter(read(root, "chunks", "config-module.md")).status,
			"draft",
		);
		applyOp(
			{
				op: "update-chunk",
				chunk: "config-module",
				set: { status: "pending" },
			},
			root,
		);
		assert.equal(
			frontmatter(read(root, "chunks", "config-module.md")).status,
			"pending",
		);
		assert.throws(
			() =>
				applyOp(
					{
						op: "update-chunk",
						chunk: "config-module",
						set: { status: "wip" },
					},
					root,
				),
			/invalid status 'wip'/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

const DESIGN_OP = {
	op: "design",
	title: "Design parameters",
	description: "Quiet editorial tool.",
	register: "product",
	sections: {
		direction: "Editorial, calm; signature: hairline-ruled tables.",
		typography: "Display: Fraunces; body: Source Sans 3; scale 1.25.",
		color: "Accent oklch(0.55 0.15 250); neutrals tinted toward it.",
		spacing: "4pt scale: 4/8/12/16/24/32/48.",
		responsive: "Breakpoints 640/1024; clamp() display type.",
	},
};

test("design op writes design.md, links it in the index, and logs", () => {
	const root = makeRepo();
	try {
		applyOp(PLAN_OP, root);
		const res = applyOp(DESIGN_OP, root);
		assert.deepEqual(res.written, ["design.md", "index.md", "log.md"]);

		const raw = read(root, "design.md");
		const fm = frontmatter(raw);
		assert.equal(fm.type, "Design");
		assert.equal(fm.register, "product");
		assert.equal(fm.created, "2026-07-06");
		assert.equal(fm.timestamp, "2026-07-06T12:00:00Z");
		assert.match(raw, /# Direction\n\nEditorial, calm/);
		assert.match(raw, /# Responsive\n\nBreakpoints 640\/1024/);
		assert.ok(
			!raw.includes("# Signature"),
			"omitted optional section not written",
		);

		assert.match(
			read(root, "index.md"),
			/\* \[Design\]\(design\.md\) - Quiet editorial tool\./,
		);
		assert.match(
			read(root, "log.md"),
			/\*\*Design\*\*: Captured project design parameters\./,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("design op validates plan, required sections, and register", () => {
	const root = makeRepo();
	try {
		assert.throws(() => applyOp(DESIGN_OP, root), /no memory\/plan\.md/);
		applyOp(PLAN_OP, root);
		assert.throws(
			() => applyOp({ ...DESIGN_OP, sections: { direction: "d" } }, root),
			/design op needs sections\.typography/,
		);
		assert.throws(
			() => applyOp({ ...DESIGN_OP, register: "marketing" }, root),
			/invalid register 'marketing'/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("design op re-run preserves created and logs an update; chunk writes keep the index line", () => {
	const root = makeRepo();
	try {
		applyOp(PLAN_OP, root);
		applyOp(DESIGN_OP, root);

		process.env.ITERATOR_NOW = "2026-07-08T09:00:00Z";
		try {
			applyOp({ ...DESIGN_OP, description: "Bolder second pass." }, root);
		} finally {
			process.env.ITERATOR_NOW = "2026-07-06T12:00:00Z";
		}
		const fm = frontmatter(read(root, "design.md"));
		assert.equal(fm.created, "2026-07-06", "created preserved on re-run");
		assert.equal(fm.timestamp, "2026-07-08T09:00:00Z");
		assert.match(
			read(root, "log.md"),
			/\*\*Design\*\*: Updated project design parameters\./,
		);

		// Regression: regenerate() runs on every op and must keep the Design line.
		applyOp(CHUNKS_OP, root);
		assert.match(
			read(root, "index.md"),
			/\* \[Design\]\(design\.md\) - Bolder second pass\./,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

// ---------------------------------------------------------------------------
// okf-memory shared-bundle integration

const OKF_INDEX = `---
okf_version: "0.1"
last_memorized_commit: 1d5c63300b8412ceb9f8933166127441f2fba0b7
custom_key: keep-me
---

# Project Memory

Agent knowledge for this repo.

# Areas

* [Architecture](/architecture/) - How the system is structured.
* [Patterns & Conventions](/patterns/) - House style.

# Workflow

* Use /okf-memorize after notable commits.
`;

test("regenerate merges into an okf root index instead of overwriting it", () => {
	const root = makeRepo();
	try {
		// The okf index as okf-init would have written it, before any iterator op.
		mkdirSync(join(root, "memory"), { recursive: true });
		writeFileSync(join(root, "memory", "index.md"), OKF_INDEX);
		applyOp(PLAN_OP, root);

		const idx = read(root, "index.md");
		assert.match(
			idx,
			/last_memorized_commit: 1d5c6330/,
			"okf pointer preserved",
		);
		assert.match(idx, /custom_key: keep-me/, "unknown fm keys preserved");
		assert.match(idx, /# Project Memory/, "okf heading preserved");
		assert.match(
			idx,
			/\[Architecture\]\(\/architecture\/\)/,
			"area links preserved",
		);
		assert.match(
			idx,
			/\* \[Plan\]\(plan\.md\) - Protect the API with JWT\./,
			"iterator link added",
		);
		assert.match(idx, /\* \[Chunks\]\(chunks\/\)/, "chunks link added");

		// Idempotent: further ops must not duplicate iterator's lines.
		applyOp(CHUNKS_OP, root);
		const idx2 = read(root, "index.md");
		assert.equal(
			(idx2.match(/\]\(plan\.md\)/g) || []).length,
			1,
			"no duplicate plan link",
		);
		assert.match(idx2, /last_memorized_commit: 1d5c6330/);
		assert.match(
			idx2,
			/# Workflow/,
			"okf prose sections survive re-regeneration",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("memorize op creates/updates/deletes concepts, regenerates the area index, advances the pointer", () => {
	const root = makeRepo();
	try {
		applyOp(PLAN_OP, root);
		const sha = "a".repeat(40);
		const res = applyOp(
			{
				op: "memorize",
				memories: [
					{
						action: "create",
						area: "patterns",
						slug: "error-handling",
						type: "Pattern",
						title: "Error handling",
						description: "Wrap all IO in Result.",
						tags: ["errors"],
						files: ["src/errors.ts"],
						body: "# Pattern\n\nAlways wrap IO.",
					},
				],
				advanceTo: sha,
			},
			root,
		);
		assert.deepEqual(res.applied, ["create patterns/error-handling"]);
		assert.equal(res.advancedTo, sha);

		const concept = read(root, "patterns", "error-handling.md");
		const fm = frontmatter(concept);
		assert.equal(fm.type, "Pattern");
		assert.equal(fm.title, "Error handling");
		assert.deepEqual(fm.tags, ["errors"]);
		assert.equal(fm.timestamp, "2026-07-06T12:00:00Z");
		assert.match(concept, /Always wrap IO\./);

		const areaIdx = read(root, "patterns", "index.md");
		assert.match(
			areaIdx,
			/\* \[Error handling\]\(\/patterns\/error-handling\.md\) - Wrap all IO in Result\./,
		);

		const idx = read(root, "index.md");
		assert.match(
			idx,
			new RegExp(`last_memorized_commit: ${sha}`),
			"pointer advanced",
		);
		assert.match(
			idx,
			/\[Patterns & Conventions\]\(\/patterns\/\)/,
			"area linked from root",
		);
		assert.match(
			read(root, "log.md"),
			/\*\*Creation\*\*: Memorized \[Error handling\]/,
		);

		// update: only the given keys change; body stays unless provided
		applyOp(
			{
				op: "memorize",
				memories: [
					{
						action: "update",
						area: "patterns",
						slug: "error-handling",
						description: "Updated line.",
					},
				],
			},
			root,
		);
		const updated = read(root, "patterns", "error-handling.md");
		assert.match(updated, /description: Updated line\./);
		assert.match(
			updated,
			/Always wrap IO\./,
			"body preserved on frontmatter-only update",
		);
		assert.match(
			read(root, "patterns", "index.md"),
			/Updated line\./,
			"area index refreshed",
		);

		// delete removes the concept and its index bullet
		applyOp(
			{
				op: "memorize",
				memories: [
					{ action: "delete", area: "patterns", slug: "error-handling" },
				],
			},
			root,
		);
		assert.ok(
			!existsSync(join(root, "memory", "patterns", "error-handling.md")),
		);
		assert.doesNotMatch(read(root, "patterns", "index.md"), /error-handling/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("memorize op validates areas, slugs, actions, and the pointer", () => {
	const root = makeRepo();
	try {
		applyOp(PLAN_OP, root);
		const create = (over) => ({
			op: "memorize",
			memories: [
				{
					action: "create",
					area: "patterns",
					slug: "x",
					type: "Pattern",
					title: "t",
					description: "d",
					body: "b",
					...over,
				},
			],
		});
		assert.throws(
			() => applyOp(create({ area: "chunks" }), root),
			/owned by the plan\/chunk ops/,
		);
		assert.throws(
			() => applyOp(create({ area: "nope" }), root),
			/unknown area/,
		);
		// Fixable slugs are auto-normalized (reported), unrepairable ones fail.
		const norm = applyOp(create({ slug: "Bad Slug" }), root);
		assert.deepEqual(norm.normalized, [{ from: "Bad Slug", to: "bad-slug" }]);
		assert.throws(
			() => applyOp(create({ slug: "!!!" }), root),
			/invalid slug/,
		);
		assert.throws(
			() => applyOp(create({ action: "upsert" }), root),
			/invalid action/,
		);
		assert.throws(
			() => applyOp(create({ body: undefined }), root),
			/needs type, title, description, body/,
		);
		assert.throws(
			() =>
				applyOp(
					{
						op: "memorize",
						memories: [
							{
								action: "update",
								area: "patterns",
								slug: "missing",
								description: "d",
							},
						],
					},
					root,
				),
			/no concept 'patterns\/missing'/,
		);
		assert.throws(
			() => applyOp({ op: "memorize", advanceTo: "not-a-sha" }, root),
			/not a commit sha/,
		);
		assert.throws(() => applyOp({ op: "memorize" }, root), /needs memories/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("memorize op with only advanceTo works in an okf-only bundle (no plan)", () => {
	const root = makeRepo();
	try {
		const sha = "b".repeat(40);
		const res = applyOp({ op: "memorize", advanceTo: sha }, root);
		assert.equal(res.advancedTo, sha);
		assert.match(
			read(root, "index.md"),
			new RegExp(`last_memorized_commit: ${sha}`),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

// ---------------------------------------------------------------------------
// deterministic result processing (accept-commit / record-review)

const WAVE_CHUNKS_OP = {
	op: "chunks",
	chunks: [
		{
			name: "chunk-a",
			title: "Chunk A",
			description: "First independent chunk",
			files: ["src/a.ts"],
			dependsOn: [],
			size: "small",
		},
		{
			name: "chunk-b",
			title: "Chunk B",
			description: "Second independent chunk",
			files: ["src/b.ts"],
			dependsOn: [],
			size: "small",
		},
	],
};

/** Plan + two independent chunks, committed on the default branch. */
function makeWaveRepo() {
	const root = makeRepo();
	git(root, "config", "user.email", "t@t");
	git(root, "config", "user.name", "t");
	applyOp(PLAN_OP, root);
	applyOp(WAVE_CHUNKS_OP, root);
	mkdirSync(join(root, "src"), { recursive: true });
	writeFileSync(join(root, "src", "base.ts"), "export {};\n");
	git(root, "add", ".");
	git(root, "commit", "-qm", "init");
	// The implemented wave: one new file per chunk, staged like the review saw it.
	writeFileSync(join(root, "src", "a.ts"), "export const a = 1;\n");
	writeFileSync(join(root, "src", "b.ts"), "export const b = 1;\n");
	git(root, "add", "src/a.ts", "src/b.ts");
	return root;
}

test("accept-commit lands the wave: branch safety, per-chunk commits, done flips, shas, memory", () => {
	const root = makeWaveRepo();
	try {
		const res = applyOp(
			{
				op: "accept-commit",
				chunks: [
					"chunk-a",
					{ slug: "chunk-b", testsStatus: "green", summary: "custom summary" },
				],
				memory: {
					proposals: [
						{
							action: "create",
							area: "patterns",
							slug: "kept",
							type: "Pattern",
							title: "Kept",
							description: "d",
							body: "b",
						},
						{
							action: "create",
							area: "patterns",
							slug: "dropped",
							type: "Pattern",
							title: "Dropped",
							description: "d",
							body: "b",
						},
					],
					accepted: ["patterns/kept"],
				},
				advance: true,
			},
			root,
		);

		assert.match(
			res.branch,
			/^iterator\/chunk-a$/,
			"moved off the default branch",
		);
		assert.equal(git(root, "rev-parse", "--abbrev-ref", "HEAD"), res.branch);
		assert.equal(res.committed.length, 2);
		assert.deepEqual(res.uncommitted, []);

		// One commit per chunk with the trailer; bookkeeping commit on top.
		const log = git(root, "log", "--format=%s");
		assert.match(
			log,
			/chore\(iterator\): record chunk commits and memory updates/,
		);
		assert.match(log, /chunk\(chunk-a\): Chunk A/);
		assert.match(log, /chunk\(chunk-b\): custom summary/);
		assert.equal(
			git(root, "log", "--format=%H", "--grep", "^Chunk: chunk-a$"),
			res.committed[0].sha,
		);

		// Bundle state: done, tests_status, recorded shas.
		const a = frontmatter(read(root, "chunks", "chunk-a.md"));
		const bFm = frontmatter(read(root, "chunks", "chunk-b.md"));
		assert.equal(a.status, "done");
		assert.equal(bFm.status, "done");
		assert.equal(bFm.tests_status, "green");
		assert.match(
			read(root, "chunks", "chunk-a.md"),
			new RegExp(`sha: ${res.committed[0].sha}`),
		);

		// Memory verdicts: accepted card written, skipped card dropped, pointer advanced.
		assert.ok(existsSync(join(root, "memory", "patterns", "kept.md")));
		assert.ok(!existsSync(join(root, "memory", "patterns", "dropped.md")));
		assert.match(
			read(root, "index.md"),
			new RegExp(`last_memorized_commit: ${res.committed[1].sha}`),
		);

		assert.equal(
			git(root, "status", "--porcelain"),
			"",
			"working tree is clean after the op",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("accept-commit validates chunks and dependencies, and skips already-done chunks on rerun", () => {
	const root = makeWaveRepo();
	try {
		assert.throws(
			() => applyOp({ op: "accept-commit", chunks: ["nope"] }, root),
			/no chunk 'nope'/,
		);
		assert.throws(
			() => applyOp({ op: "accept-commit", chunks: [] }, root),
			/non-empty chunks list/,
		);

		applyOp(
			{
				op: "chunks",
				chunks: [
					{
						name: "dependent",
						title: "Dependent",
						description: "d",
						files: ["src/d.ts"],
						dependsOn: ["chunk-a"],
						size: "small",
					},
				],
			},
			root,
		);
		assert.throws(
			() => applyOp({ op: "accept-commit", chunks: ["dependent"] }, root),
			/waiting on: chunk-a/,
		);

		applyOp({ op: "accept-commit", chunks: ["chunk-a"] }, root);
		// Rerun with a done chunk in the list: resumable, not an error.
		const res = applyOp(
			{
				type: "accept-commit",
				chunk: "chunk-a",
				chunks: ["chunk-a", "chunk-b"],
			},
			root,
		);
		assert.deepEqual(res.skipped, ["chunk-a"]);
		assert.deepEqual(
			res.committed.map((c) => c.chunk),
			["chunk-b"],
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("record-review consumes the review-feedback payload verbatim", () => {
	const root = makeWaveRepo();
	try {
		const res = applyOp(
			{
				type: "review-feedback",
				branch: "test",
				features: [
					{ name: "chunk-a", status: "approved", note: null },
					{
						name: "chunk-b",
						status: "changes",
						note: "tighten error handling",
					},
					{ name: "uncategorized", status: "question", note: "ignored" },
				],
				lineComments: [{ chunk: "chunk-a", file: "src/a.ts", comment: "why?" }],
			},
			root,
		);
		assert.deepEqual(res.recorded, ["chunk-a", "chunk-b"]);
		assert.equal(res.lineComments, 1);

		const a = read(root, "chunks", "chunk-a.md");
		assert.match(a, /\* \*\*Approved\*\* — no changes requested/);
		assert.equal(frontmatter(a).reviewed, "2026-07-06");
		assert.match(
			read(root, "chunks", "chunk-b.md"),
			/\* \*\*Needs changes\*\* — tighten error handling/,
		);
		assert.match(
			read(root, "log.md"),
			/\*\*Review\*\*: Reviewed \[Chunk A\]\(\/chunks\/chunk-a\.md\); approved\./,
		);

		assert.throws(
			() => applyOp({ type: "review-feedback", features: [] }, root),
			/needs features/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

// ---------------------------------------------------------------------------
// op: apply-review (absorbed from okf-memory)

const REVIEW_CARD = {
	id: "patterns/error-handling",
	area: "patterns",
	action: "create",
	type: "Pattern",
	title: "Error handling",
	description: "Wrap all IO in Result.",
	tags: ["errors"],
	files: ["src/errors.ts"],
	body: "# Pattern\n\nAlways wrap IO.",
};

test("apply-review writes accepted cards, skips rejected, regenerates indexes, advances the pointer", () => {
	const root = makeRepo();
	try {
		writeFileSync(join(root, "x"), "x\n");
		git(root, "add", ".");
		git(root, "commit", "-qm", "init");
		const head = git(root, "rev-parse", "HEAD");

		const res = applyOp(
			{
				op: "apply-review",
				mode: "memorize",
				headCommit: head,
				memories: [
					REVIEW_CARD,
					{ ...REVIEW_CARD, id: "patterns/dropped", title: "Dropped" },
				],
				decisions: [
					{ id: "patterns/error-handling", verdict: "accept" },
					{ id: "patterns/dropped", verdict: "reject" },
				],
			},
			root,
		);
		assert.deepEqual(res.written, ["patterns/error-handling"]);
		assert.equal(res.rejected, 1);
		assert.equal(res.advancedTo, head);
		assert.equal(res.validation.ok, true, res.validation.errors?.join("\n"));

		const concept = read(root, "patterns", "error-handling.md");
		assert.match(concept, /type: Pattern/);
		assert.match(concept, /tags:\n {2}- errors/);
		assert.match(concept, /timestamp: 2026-07-06T12:00:00Z/);
		assert.match(concept, /Always wrap IO\./);
		assert.ok(!existsSync(join(root, "memory", "patterns", "dropped.md")));

		assert.match(
			read(root, "patterns", "index.md"),
			/\* \[Error handling\]\(\/patterns\/error-handling\.md\) - Wrap all IO in Result\./,
		);
		const idx = read(root, "index.md");
		assert.match(idx, new RegExp(`last_memorized_commit: ${head}`));
		assert.match(idx, /\[Patterns & Conventions\]\(\/patterns\/\)/);
		assert.match(
			read(root, "log.md"),
			/\*\*Creation\*\*: Memorized \[Error handling\]/,
		);
		assert.match(
			read(root, "log.md"),
			/\*\*Memorize\*\*: Set last_memorized_commit/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("apply-review preserves foreign root-index content and unknown concept keys on update", () => {
	const root = makeRepo();
	try {
		mkdirSync(join(root, "memory", "patterns"), { recursive: true });
		writeFileSync(
			join(root, "memory", "index.md"),
			'---\nokf_version: "0.1"\ncustom_key: keep-me\n---\n\n# Project Memory\n\n# Areas\n\n* [Patterns & Conventions](/patterns/) - House style.\n* [Plan](plan.md) - An iterator plan.\n',
		);
		writeFileSync(
			join(root, "memory", "patterns", "error-handling.md"),
			"---\ntype: Pattern\ntitle: Error handling\ndescription: Old line.\nsource_note: hand-added\n---\n\n# Pattern\n\nOld body.\n",
		);

		applyOp(
			{
				op: "apply-review",
				mode: "consolidate",
				memories: [
					{
						...REVIEW_CARD,
						action: "update",
						description: "New line.",
						body: "",
					},
				],
				decisions: [{ id: "patterns/error-handling", verdict: "accept" }],
			},
			root,
		);

		const concept = read(root, "patterns", "error-handling.md");
		assert.match(concept, /description: New line\./);
		assert.match(
			concept,
			/source_note: hand-added/,
			"unknown fm keys carried over",
		);
		assert.match(
			concept,
			/Old body\./,
			"empty card body keeps the existing body",
		);

		const idx = read(root, "index.md");
		assert.match(idx, /custom_key: keep-me/);
		assert.match(
			idx,
			/\* \[Plan\]\(plan\.md\) - An iterator plan\./,
			"iterator links preserved",
		);
		assert.equal(
			(idx.match(/\(\/patterns\/\)/g) || []).length,
			1,
			"no duplicate area link",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("apply-review delete verdicts remove concepts and refresh the area index", () => {
	const root = makeRepo();
	try {
		mkdirSync(join(root, "memory", "pitfalls"), { recursive: true });
		writeFileSync(
			join(root, "memory", "pitfalls", "stale-thing.md"),
			"---\ntype: Pitfall\ntitle: Stale thing\ndescription: Gone soon.\n---\n\n# Pitfall\n",
		);
		const res = applyOp(
			{
				op: "apply-review",
				mode: "consolidate",
				memories: [],
				decisions: [{ id: "pitfalls/stale-thing", verdict: "delete" }],
			},
			root,
		);
		assert.deepEqual(res.deleted, ["pitfalls/stale-thing"]);
		assert.ok(!existsSync(join(root, "memory", "pitfalls", "stale-thing.md")));
		assert.doesNotMatch(read(root, "pitfalls", "index.md"), /stale-thing/);
		assert.match(
			read(root, "log.md"),
			/\*\*Deletion\*\*: Removed memory \/pitfalls\/stale-thing\.md\./,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("apply-review validates verdicts, ids, ownership, and card completeness before writing", () => {
	const root = makeRepo();
	try {
		const apply = (p) => applyOp({ op: "apply-review", ...p }, root);
		assert.throws(() => apply({ decisions: [] }), /needs decisions/);
		assert.throws(
			() => apply({ decisions: [{ id: "patterns/x", verdict: "maybe" }] }),
			/invalid verdict/,
		);
		assert.throws(
			() => apply({ decisions: [{ id: "no-area", verdict: "accept" }] }),
			/invalid concept id/,
		);
		assert.throws(
			() => apply({ decisions: [{ id: "chunks/auth", verdict: "accept" }] }),
			/owned by the plan\/chunk ops/,
		);
		assert.throws(
			() => apply({ decisions: [{ id: "extras/x", verdict: "keep" }] }),
			/unknown area 'extras'/,
		);
		assert.throws(
			() =>
				apply({
					mode: "consolidate",
					headCommit: "a".repeat(40),
					decisions: [{ id: "patterns/x", verdict: "keep" }],
				}),
			/consolidate reviews must not include headCommit/,
		);
		assert.throws(
			() =>
				apply({
					mode: "memorize",
					headCommit: "not-a-sha",
					decisions: [{ id: "patterns/x", verdict: "keep" }],
				}),
			/headCommit 'not-a-sha' is not a commit sha/,
		);
		assert.throws(
			() =>
				apply({
					memories: [],
					decisions: [{ id: "patterns/x", verdict: "accept" }],
				}),
			/no matching draft card/,
		);
		assert.ok(!existsSync(join(root, "memory")), "nothing written on failure");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("apply-review works without a plan (okf-init on a plan-less repo)", () => {
	const root = makeRepo();
	try {
		const res = applyOp(
			{
				op: "apply-review",
				mode: "init",
				memories: [REVIEW_CARD],
				decisions: [{ id: "patterns/error-handling", verdict: "accept" }],
			},
			root,
		);
		assert.deepEqual(res.written, ["patterns/error-handling"]);
		assert.equal(res.validation.ok, true, res.validation.errors?.join("\n"));
		assert.ok(!existsSync(join(root, "memory", "plan.md")));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("refresh-format copies the current template over the bundle copy", () => {
	const root = makeRepo();
	try {
		assert.throws(
			() => applyOp({ op: "refresh-format" }, root),
			/no memory\/ bundle/,
		);
		applyOp(PLAN_OP, root);
		writeFileSync(join(root, "memory", "format.md"), "# Old schema copy\n");
		const res = applyOp({ op: "refresh-format" }, root);
		assert.deepEqual(res.written, ["format.md", "log.md"]);
		assert.match(
			read(root, "format.md"),
			/iterator memory format/,
			"template content restored",
		);
		assert.doesNotMatch(read(root, "format.md"), /Old schema copy/);
		assert.match(read(root, "log.md"), /Refreshed format\.md/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

// ---------------------------------------------------------------------------
// op: retire-plan

test("retire-plan condenses a finished plan into a decision and archives the work", () => {
	const root = makeRepo();
	try {
		applyOp(PLAN_OP, root);
		applyOp(CHUNKS_OP, root);
		applyOp({ op: "adjustments", accept: true }, root);
		applyOp(
			{ op: "update-chunk", chunk: "config-module", set: { status: "done" } },
			root,
		);

		// Refuses while chunks are pending.
		assert.throws(
			() =>
				applyOp(
					{
						op: "retire-plan",
						concept: {
							slug: "jwt-auth",
							title: "JWT auth",
							description: "d",
							body: "b",
						},
					},
					root,
				),
			/chunks not done: auth-middleware/,
		);

		applyOp(
			{ op: "update-chunk", chunk: "auth-middleware", set: { status: "done" } },
			root,
		);
		const res = applyOp(
			{
				op: "retire-plan",
				concept: {
					slug: "jwt-auth",
					title: "JWT auth shipped",
					description: "HS256 middleware behind config.",
					body: "# What was built\n\nJWT middleware.\n\n# Why\n\nProtect the API.",
					tags: ["auth"],
				},
			},
			root,
		);
		assert.equal(res.concept, "decisions/jwt-auth");
		assert.equal(res.validation.ok, true, res.validation.errors?.join("\n"));

		// The decision concept exists, anchored to the chunks' files by default.
		const concept = read(root, "decisions", "jwt-auth.md");
		assert.match(concept, /type: Decision/);
		assert.match(concept, /src\/auth\/\*\.ts/);
		assert.match(concept, /src\/config\.ts/);
		assert.match(concept, /# Retired plan/);

		// Plan + chunks moved to the archive, invisible to the gathers.
		assert.ok(!existsSync(join(root, "memory", "plan.md")));
		assert.ok(
			!existsSync(join(root, "memory", "chunks", "auth-middleware.md")),
		);
		assert.match(res.archived, /^chunks\/archive\//);
		assert.ok(existsSync(join(root, "memory", res.archived, "plan.md")));
		assert.ok(
			existsSync(join(root, "memory", res.archived, "auth-middleware.md")),
		);
		const hub = gather(root);
		assert.equal(hub.plan, null, "hub shows the create-plan hero again");
		assert.deepEqual(hub.chunks, [], "archived chunks are invisible");

		// Root index: work links gone, knowledge side present.
		const idx = read(root, "index.md");
		assert.doesNotMatch(idx, /\]\(plan\.md\)/);
		assert.doesNotMatch(idx, /\]\(chunks\/\)/);
		assert.match(idx, /\]\(\/decisions\/\)/);
		assert.match(
			read(root, "log.md"),
			/\*\*Retirement\*\*: Plan "Add JWT auth" condensed/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("retire-plan validates the concept and honors force for unfinished plans", () => {
	const root = makeRepo();
	try {
		assert.throws(
			() =>
				applyOp(
					{
						op: "retire-plan",
						concept: { slug: "x", title: "t", description: "d", body: "b" },
					},
					root,
				),
			/no memory\/plan\.md/,
		);
		applyOp(PLAN_OP, root);
		applyOp(CHUNKS_OP, root);
		assert.throws(
			() =>
				applyOp(
					{
						op: "retire-plan",
						concept: {
							slug: "Bad Slug",
							title: "t",
							description: "d",
							body: "b",
						},
					},
					root,
				),
			/invalid concept slug/,
		);
		assert.throws(
			() =>
				applyOp(
					{ op: "retire-plan", concept: { slug: "x", title: "t" } },
					root,
				),
			/needs title, description, body/,
		);
		const res = applyOp(
			{
				op: "retire-plan",
				force: true,
				concept: {
					slug: "abandoned",
					title: "Abandoned plan",
					description: "d",
					body: "b",
				},
			},
			root,
		);
		assert.equal(res.concept, "decisions/abandoned");
		assert.ok(!existsSync(join(root, "memory", "plan.md")));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("accept-commit includes untracked files matching the chunk and never unrelated ones", () => {
	const root = makeWaveRepo();
	try {
		// a.ts/b.ts were staged by makeWaveRepo; add a brand-new UNSTAGED file
		// for chunk-a's glob and one unrelated stray.
		git(root, "reset");
		writeFileSync(join(root, "src", "unrelated.txt"), "stray\n");

		const res = applyOp({ op: "accept-commit", chunks: ["chunk-a"] }, root);
		const shown = git(
			root,
			"show",
			"--name-only",
			"--format=",
			res.committed[0].sha,
		)
			.split("\n")
			.filter(Boolean);
		assert.ok(shown.includes("src/a.ts"), "untracked chunk file committed");
		assert.ok(
			!shown.includes("src/unrelated.txt"),
			"unrelated stray stays out of the chunk commit",
		);
		assert.ok(
			!shown.includes("src/b.ts"),
			"other chunk's file stays out of the chunk commit",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("accept-commit refuses to stage the whole tree when a chunk matches nothing", () => {
	const root = makeWaveRepo();
	const memAbs = mkdtempSync(join(tmpdir(), "iterator-absmem-"));
	try {
		// Absolute bundle dir → memory/ is not stageable; chunk-a's diff exists
		// but chunk-b... give chunk-a no matching changes at all by resetting
		// and removing its file.
		git(root, "reset");
		rmSync(join(root, "src", "a.ts"));
		writeFileSync(join(root, "src", "innocent.txt"), "must never be committed\n");
		process.env.ITERATOR_MEMORY_DIR = memAbs;
		// Rebuild an absolute-dir bundle so the op can load chunks from it.
		applyOp(PLAN_OP, root);
		applyOp(WAVE_CHUNKS_OP, root);
		assert.throws(
			() => applyOp({ op: "accept-commit", chunks: ["chunk-a"] }, root),
			/nothing to stage/,
		);
		const staged = git(root, "diff", "--cached", "--name-only");
		assert.ok(
			!staged.includes("innocent.txt"),
			"empty pathspec must not stage the tree",
		);
	} finally {
		delete process.env.ITERATOR_MEMORY_DIR;
		rmSync(root, { recursive: true, force: true });
		rmSync(memAbs, { recursive: true, force: true });
	}
});

test("adjustments validates the whole batch before writing anything", () => {
	const root = makeRepo();
	try {
		applyOp(PLAN_OP, root);
		applyOp(WAVE_CHUNKS_OP, root);
		const before = read(root, "chunks", "chunk-a.md");
		assert.throws(
			() =>
				applyOp(
					{
						op: "adjustments",
						moves: [{ file: "src/a.ts", from: "chunk-a", to: "chunk-b" }],
						renames: [{ from: "nope", to: "new-name" }],
					},
					root,
				),
			/rename: no chunk 'nope'/,
		);
		assert.equal(
			read(root, "chunks", "chunk-a.md"),
			before,
			"a failing batch must leave earlier items unapplied",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("memorize resolves advanceTo HEAD and advance:true to the real sha", () => {
	const root = makeWaveRepo();
	try {
		git(root, "commit", "-qm", "work");
		const head = git(root, "rev-parse", "HEAD");
		const res = applyOp({ op: "memorize", advanceTo: "HEAD" }, root);
		assert.equal(res.advancedTo, head);
		assert.match(read(root, "index.md"), new RegExp(`last_memorized_commit: ${head}`));
		const res2 = applyOp({ op: "memorize", advance: true }, root);
		assert.equal(res2.advancedTo, head);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("chunks op auto-normalizes fixable slugs and reports the repair", () => {
	const root = makeRepo();
	try {
		applyOp(PLAN_OP, root);
		const res = applyOp(
			{
				op: "chunks",
				chunks: [
					{ name: "Config Module!", description: "d", files: ["src/c.ts"] },
					{
						name: "auth-middleware",
						description: "d",
						files: ["src/a.ts"],
						dependsOn: ["Config Module!"],
					},
				],
			},
			root,
		);
		assert.deepEqual(res.normalized, [
			{ from: "Config Module!", to: "config-module" },
		]);
		const fm = frontmatter(read(root, "chunks", "auth-middleware.md"));
		assert.deepEqual(fm.depends_on, ["config-module"]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("commit-tests commits test files with trailer, records status and sha", () => {
	const root = makeWaveRepo();
	try {
		git(root, "reset");
		mkdirSync(join(root, "test"), { recursive: true });
		writeFileSync(join(root, "test", "a.test.ts"), "assert(true);\n");
		const res = applyOp(
			{ op: "commit-tests", chunk: "chunk-a", files: ["test/a.test.ts"] },
			root,
		);
		assert.equal(res.testsStatus, "red", "pending chunk defaults to red");
		assert.match(res.branch, /^iterator\/chunk-a$/, "moved off main");
		const subject = git(root, "log", "--format=%s%n%b", "-1", res.sha);
		assert.match(subject, /test\(chunk-a\):/);
		assert.match(
			git(root, "log", "--format=%B", "-1", res.sha),
			/Chunk: chunk-a/,
		);
		const fm = frontmatter(read(root, "chunks", "chunk-a.md"));
		assert.deepEqual(fm.tests, ["test/a.test.ts"]);
		assert.equal(fm.tests_status, "red");
		assert.match(
			read(root, "chunks", "chunk-a.md"),
			new RegExp(`sha: ${res.sha}[\\s\\S]*kind: test`),
		);
		assert.match(git(root, "log", "--format=%s"), /chore\(iterator\): record test commit/);
		assert.equal(res.validation.ok, true, "every op result carries validation");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("extensions op writes the contract file and links it from the root index", () => {
	const root = makeRepo();
	try {
		applyOp(PLAN_OP, root);
		const res = applyOp(
			{ op: "extensions", preamble: "This project is a Node CLI." },
			root,
		);
		assert.deepEqual(res.written, ["EXTENSIONS.md", "index.md", "log.md"]);
		const doc = read(root, "EXTENSIONS.md");
		assert.match(doc, /type: Reference/);
		assert.match(doc, /This project is a Node CLI\./);
		assert.match(doc, /progressive disclosure/);
		assert.match(read(root, "index.md"), /\[Extension contract\]\(EXTENSIONS\.md\)/);
		// Idempotent: a second run must not duplicate the index link.
		applyOp({ op: "extensions" }, root);
		const links = read(root, "index.md").match(/EXTENSIONS\.md/g);
		assert.equal(links.length, 1);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("chunks op warns about globs that match nothing in the repo", () => {
	const root = makeWaveRepo();
	try {
		const res = applyOp(
			{
				op: "chunks",
				chunks: [
					{ name: "typo-chunk", description: "d", files: ["src/doesnotexist/**"] },
				],
			},
			root,
		);
		assert.deepEqual(res.warnings.unmatchedGlobs, [
			{ chunk: "typo-chunk", globs: ["src/doesnotexist/**"] },
		]);
		assert.equal(res.validation.ok, true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
