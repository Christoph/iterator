import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isRemoteSession } from "../lib/server.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER = join(root, "skills", "iterator", "server.mjs");
const CANCEL_GRACE_MS = 250;

/**
 * Spawn the shared UI server with a payload on stdin; resolve once it prints
 * its URL. Every spawn gets its own registry file so takeover only happens in
 * the tests that opt into a shared one.
 */
function parseJson(text) {
	try {
		return JSON.parse(text);
	} catch (err) {
		throw new Error(`invalid JSON in test fixture/output: ${err.message}`);
	}
}

// Every spawned server, so a test that fails mid-flight can't leak a child
// that idles for 2h and keeps the runner alive.
const CHILDREN = new Set();
after(() => {
	for (const child of CHILDREN) if (child.exitCode == null) child.kill();
});

function startServer(payload, extraEnv = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [SERVER], {
			env: {
				...process.env,
				ITERATOR_NO_OPEN: "1",
				ITERATOR_PORT: "0", // ephemeral port, no collisions between tests
				ITERATOR_CANCEL_GRACE_MS: String(CANCEL_GRACE_MS),
				ITERATOR_REMOTE: "0", // deterministic even when the tests run over SSH / in a container
				ITERATOR_REGISTRY: join(tmpdir(), `iterator-test-${randomUUID()}.json`),
				...extraEnv,
			},
		});
		CHILDREN.add(child);
		child.on("exit", () => CHILDREN.delete(child));
		let stderr = "",
			stdout = "";
		const io = { child, url: null, stdout: () => stdout, stderr: () => stderr };
		child.stdout.on("data", (d) => (stdout += d));
		child.stderr.on("data", (d) => {
			stderr += d;
			const m = stderr.match(/listening on (http:\/\/127\.0\.0\.1:\d+\/)/);
			if (m && !io.url) {
				try {
					io.url = new URL(m[1]);
				} catch (err) {
					reject(err);
					return;
				}
				resolve(io);
			}
		});
		child.on("error", reject);
		child.on("exit", (code) => {
			if (!io.url)
				reject(new Error(`exited ${code} before listening: ${stderr}`));
		});
		child.stdin.write(JSON.stringify(payload));
		child.stdin.end();
		setTimeout(
			() => reject(new Error("server did not start: " + stderr)),
			10_000,
		).unref();
	});
}

const waitExit = (child) =>
	new Promise((r) => {
		child.on("exit", r);
		if (child.exitCode != null) r(child.exitCode);
	});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// What a cancelled plan-step server prints: since the server owns the human
// cancel summaries (P9), the line carries the step's report alongside type.
const PLAN_CANCEL_LINE = {
	type: "cancel",
	report: "User cancelled the plan review. Write nothing and stop this flow.",
};

const PLAN_PAYLOAD = {
	step: "plan",
	branch: "test",
	title: "Add JWT auth",
	plan: { goal: "g", architecture: "a", keyDecisions: "k", productFit: "p" },
	dependencies: ["jsonwebtoken — signing"],
};

test("GET / serves the page and POST /submit echoes the body to stdout", async () => {
	const io = await startServer(PLAN_PAYLOAD);
	const res = await fetch(io.url);
	assert.equal(res.status, 200);
	const body = await res.text();
	assert.ok(body.includes("const D = "));
	assert.ok(body.includes("Add JWT auth"));

	const submitted = JSON.stringify({ type: "plan-approved", ok: true });
	await fetch(io.url.origin + "/submit", { method: "POST", body: submitted });
	const code = await waitExit(io.child);
	assert.equal(code, 0);
	assert.equal(io.stdout().trim(), submitted);
});

test("payload containing </script> is embedded inertly", async () => {
	const io = await startServer({
		...PLAN_PAYLOAD,
		title: "x</script><script>alert(1)</script>",
	});
	const body = await (await fetch(io.url)).text();
	assert.ok(!body.includes("<script>alert(1)"));
	io.child.kill();
	await waitExit(io.child);
});

test("requests with a non-local Host header are rejected (DNS rebinding)", async () => {
	const io = await startServer(PLAN_PAYLOAD);
	const status = await new Promise((resolve, reject) => {
		const req = http.request(
			{
				host: "127.0.0.1",
				port: io.url.port,
				path: "/",
				headers: { Host: "evil.example.com" },
			},
			(res) => {
				res.resume();
				resolve(res.statusCode);
			},
		);
		req.on("error", reject);
		req.end();
	});
	assert.equal(status, 403);
	io.child.kill();
	await waitExit(io.child);
});

test("GET /__iterator/status identifies the server without auth", async () => {
	const io = await startServer(PLAN_PAYLOAD);
	const status = await (
		await fetch(io.url.origin + "/__iterator/status")
	).json();
	assert.equal(status.app, "iterator");
	assert.equal(status.step, "plan");
	assert.equal(status.pid, io.child.pid);
	io.child.kill();
	await waitExit(io.child);
});

test("beacon /cancel is dropped if the page reloads within the grace period", async () => {
	const io = await startServer(PLAN_PAYLOAD);
	await fetch(io.url.origin + "/cancel", { method: "POST" }); // pagehide beacon (reload)
	await fetch(io.url); // the reloaded page arrives
	await sleep(CANCEL_GRACE_MS + 100);
	assert.equal(io.child.exitCode, null, "reload must not cancel the flow");
	assert.equal(io.stdout(), "");
	io.child.kill();
	await waitExit(io.child);
});

test('beacon /cancel with no reload emits {"type":"cancel"} after the grace period', async () => {
	const io = await startServer(PLAN_PAYLOAD);
	await fetch(io.url.origin + "/cancel", { method: "POST" });
	await waitExit(io.child);
	assert.deepEqual(parseJson(io.stdout()), PLAN_CANCEL_LINE);
});

test("explicit Cancel (/cancel?now=1) cancels immediately", async () => {
	const io = await startServer(PLAN_PAYLOAD);
	const t0 = Date.now();
	await fetch(io.url.origin + "/cancel?now=1", { method: "POST" });
	await waitExit(io.child);
	assert.ok(
		Date.now() - t0 < CANCEL_GRACE_MS,
		"must not wait for the grace period",
	);
	assert.deepEqual(parseJson(io.stdout()), PLAN_CANCEL_LINE);
});

test("a /cancel carrying a previous run's id is ignored (stale-tab guard)", async () => {
	const io = await startServer(PLAN_PAYLOAD);
	await fetch(io.url.origin + "/cancel?r=deadbeefdeadbeef", { method: "POST" });
	await sleep(CANCEL_GRACE_MS + 100);
	assert.equal(
		io.child.exitCode,
		null,
		"stale beacon must not cancel the live round",
	);
	assert.equal(io.stdout(), "");
	io.child.kill();
	await waitExit(io.child);
});

test("a /submit carrying a previous run's id is rejected; the current page still works", async () => {
	const io = await startServer(PLAN_PAYLOAD);
	const forged = await fetch(io.url.origin + "/submit?r=deadbeefdeadbeef", {
		method: "POST",
		body: '{"type":"evil"}',
	});
	assert.equal(forged.status, 409);
	assert.equal(io.child.exitCode, null);
	assert.equal(io.stdout(), "");
	// The live page's own run id must be accepted.
	const page = await (await fetch(io.url)).text();
	const run = page.match(/const __RUN = "([0-9a-f]+)"/)[1];
	await fetch(`${io.url.origin}/submit?r=${run}`, {
		method: "POST",
		body: '{"type":"ok"}',
	});
	assert.equal(await waitExit(io.child), 0);
	assert.equal(io.stdout().trim(), '{"type":"ok"}');
});

test('SIGTERM resolves the contract with {"type":"cancel"} and exit 0', async () => {
	const io = await startServer(PLAN_PAYLOAD);
	io.child.kill("SIGTERM");
	const code = await waitExit(io.child);
	assert.equal(code, 0);
	assert.deepEqual(parseJson(io.stdout()), PLAN_CANCEL_LINE);
});

test("a new server takes over the fixed port from a lingering one", async () => {
	// Shared registry + fixed port: the second server must evict the first and
	// land on the SAME port — the port a sandbox forwards (7777 in production).
	const shared = {
		ITERATOR_REGISTRY: join(tmpdir(), `iterator-takeover-${randomUUID()}.json`),
		ITERATOR_PORT: String(17_000 + Math.floor(Math.random() * 4000)),
	};
	const a = await startServer(PLAN_PAYLOAD, shared);
	const b = await startServer(PLAN_PAYLOAD, shared);
	const codeA = await waitExit(a.child);
	assert.equal(codeA, 0);
	assert.deepEqual(
		parseJson(a.stdout()),
		PLAN_CANCEL_LINE,
		"evicted server must resolve as cancel",
	);
	assert.equal(
		b.url.port,
		a.url.port,
		"successor must reuse the same fixed port",
	);
	assert.match(b.stderr(), /closing previous UI server/);
	assert.equal(b.child.exitCode, null, "successor must still be running");
	b.child.kill();
	await waitExit(b.child);
});

test("a session-mode dashboard is never killed — the one-shot walks ports instead", async () => {
	// Fake the in-process session server (lib/session-server.mjs): it answers
	// the status probe with mode:'session' and its pid is the agent process.
	const fake = http.createServer((req, res) => {
		if (req.url === "/__iterator/status") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					app: "iterator",
					mode: "session",
					step: "hub",
					pid: process.pid,
				}),
			);
		} else {
			res.writeHead(200);
			res.end("session dashboard");
		}
	});
	await new Promise((r) => fake.listen(0, "127.0.0.1", r));
	const port = fake.address().port;
	const registry = join(
		tmpdir(),
		`iterator-session-guard-${randomUUID()}.json`,
	);
	const { writeFileSync } = await import("node:fs");
	writeFileSync(
		registry,
		JSON.stringify({ pid: process.pid, port, mode: "session" }) + "\n",
	);

	const io = await startServer(PLAN_PAYLOAD, {
		ITERATOR_REGISTRY: registry,
		ITERATOR_PORT: String(port),
	});
	assert.match(io.stderr(), /session dashboard owns port/);
	assert.notEqual(
		Number(io.url.port),
		port,
		"one-shot must walk to another port",
	);
	// The session server is still alive and still owns its port.
	const probe = await fetch(`http://127.0.0.1:${port}/__iterator/status`);
	assert.equal((await probe.json()).mode, "session");
	io.child.kill();
	await waitExit(io.child);
	await new Promise((r) => fake.close(r));
});

test("ITERATOR_NO_TAKEOVER leaves a running server alone (port walk instead)", async () => {
	const shared = {
		ITERATOR_REGISTRY: join(tmpdir(), `iterator-walk-${randomUUID()}.json`),
		ITERATOR_PORT: String(21_000 + Math.floor(Math.random() * 4000)),
	};
	const a = await startServer(PLAN_PAYLOAD, shared);
	const b = await startServer(PLAN_PAYLOAD, {
		...shared,
		ITERATOR_NO_TAKEOVER: "1",
	});
	assert.equal(a.child.exitCode, null, "first server must survive");
	assert.notEqual(
		b.url.port,
		a.url.port,
		"second server must walk to the next port",
	);
	a.child.kill();
	b.child.kill();
	await waitExit(a.child);
	await waitExit(b.child);
});

test("isRemoteSession: explicit override beats SSH markers, SSH markers imply remote", () => {
	assert.equal(isRemoteSession({ ITERATOR_REMOTE: "1" }), true);
	assert.equal(isRemoteSession({ ITERATOR_REMOTE: "true" }), true);
	assert.equal(
		isRemoteSession({ ITERATOR_REMOTE: "0", SSH_TTY: "/dev/pts/0" }),
		false,
	);
	assert.equal(
		isRemoteSession({
			ITERATOR_REMOTE: "false",
			SSH_CONNECTION: "1.2.3.4 5 6.7.8.9 22",
		}),
		false,
	);
	assert.equal(
		isRemoteSession({ SSH_CONNECTION: "1.2.3.4 5 6.7.8.9 22" }),
		true,
	);
	assert.equal(isRemoteSession({ SSH_TTY: "/dev/pts/0" }), true);
});

const reqStatus = (io, path, host) =>
	new Promise((resolve, reject) => {
		const req = http.request(
			{
				host: "127.0.0.1",
				port: io.url.port,
				path,
				headers: { Host: host },
			},
			(res) => {
				res.resume();
				resolve(res.statusCode);
			},
		);
		req.on("error", reject);
		req.end();
	});

test("ITERATOR_REMOTE=1 binds all interfaces and prints a loopback URL", async () => {
	const io = await startServer(PLAN_PAYLOAD, { ITERATOR_REMOTE: "1" });
	// The printed URL must be clickable on the host: 127.0.0.1, never 0.0.0.0.
	assert.ok(io.url.href.startsWith("http://127.0.0.1:"));
	await sleep(100); // the hint line lands right after the resolving "listening on" line
	assert.match(io.stderr(), /remote session — bound to 0\.0\.0\.0/);
	// Host browser reaching a container by IP/hostname: allowed when exposed.
	assert.equal(await reqStatus(io, "/", "172.17.0.2:7777"), 200);
	io.child.kill();
	await waitExit(io.child);
});

test("SSH markers imply remote unless ITERATOR_REMOTE=0 forces local", async () => {
	const ssh = { SSH_CONNECTION: "1.2.3.4 5 6.7.8.9 22", ITERATOR_REMOTE: "" };
	const remote = await startServer(PLAN_PAYLOAD, ssh);
	await sleep(100);
	assert.match(remote.stderr(), /remote session — bound to 0\.0\.0\.0/);
	remote.child.kill();
	await waitExit(remote.child);

	const local = await startServer(PLAN_PAYLOAD, {
		...ssh,
		ITERATOR_REMOTE: "0",
	});
	await sleep(100);
	assert.ok(!/remote session/.test(local.stderr()));
	assert.equal(await reqStatus(local, "/", "evil.example.com"), 403);
	local.child.kill();
	await waitExit(local.child);
});

test("ITERATOR_BIND_HOST overrides the bind address (ITERATOR_HOST is the deprecated alias)", async () => {
	for (const env of [
		{ ITERATOR_BIND_HOST: "0.0.0.0" },
		{ ITERATOR_HOST: "0.0.0.0" },
	]) {
		const io = await startServer(PLAN_PAYLOAD, env);
		assert.equal(await reqStatus(io, "/", "172.17.0.2:7777"), 200);
		io.child.kill();
		await waitExit(io.child);
	}
});

// Smoke-test every view through the one shared server: the step field picks
// the view, the page contains a step-specific marker, and the round trip
// echoes the submitted JSON.
const SMOKE = [
	[
		"hub",
		"Dependency graph",
		{
			step: "hub",
			branch: "test",
			plan: { title: "Add JWT auth", status: "approved" },
			progress: { done: 1, total: 2 },
			chunks: [
				{
					name: "config-module",
					title: "Config module",
					description: "Config",
					status: "done",
					size: "small",
					linesEstimate: 30,
					testsStatus: "green",
					dependsOn: [],
					hasDiff: false,
					hasCommits: true,
				},
				{
					name: "auth-middleware",
					title: "Auth middleware",
					description: "JWT middleware",
					status: "pending",
					size: "small",
					linesEstimate: 60,
					testsStatus: "red",
					dependsOn: ["config-module"],
					hasDiff: true,
					hasCommits: false,
				},
			],
		},
	],
	[
		"chunk",
		"Dependency graph",
		{
			step: "chunk",
			branch: "test",
			plan: "Add JWT auth",
			chunks: [
				{
					name: "config-module",
					description: "Config",
					files: ["src/config.ts"],
					dependsOn: [],
					linesEstimate: 30,
					size: "small",
					status: "pending",
					snippets: [],
				},
				{
					name: "auth-middleware",
					description: "JWT middleware",
					files: ["src/auth.ts"],
					dependsOn: ["config-module"],
					linesEstimate: 60,
					size: "small",
					status: "pending",
					snippets: [{ lang: "ts", code: "x" }],
				},
			],
		},
	],
	[
		"review",
		"Feedback",
		{
			step: "review",
			branch: "test",
			commit: "abc123 add auth",
			plan: "Add JWT auth",
			progress: { done: 1, total: 3 },
			hasChunksFile: true,
			chunks: [
				{
					name: "auth-middleware",
					description: "JWT middleware",
					dependsOn: ["config-module"],
					stats: { added: 42, removed: 8, files: 1, complexity: "yellow" },
					files: [
						{
							path: "src/auth.ts",
							hunks: [
								{
									header: "@@ -41,5 +41,12 @@",
									oldStart: 41,
									newStart: 41,
									lines: [
										{ type: "context", content: "function login(user) {" },
										{
											type: "addition",
											content: "  const jwt = sign(payload, SECRET);",
										},
									],
								},
							],
						},
					],
				},
			],
			uncategorized: [],
		},
	],
	[
		"test",
		"test cases Claude proposes",
		{
			step: "test",
			branch: "test",
			chunk: { name: "auth-middleware", description: "JWT middleware" },
			runner: "vitest",
			cases: [
				{ title: "passes a valid token", kind: "happy", rationale: "core" },
			],
		},
	],
];

for (const [step, marker, payload] of SMOKE) {
	test(`step "${step}" renders its view and round-trips`, async () => {
		const io = await startServer(payload);
		assert.match(io.stderr(), new RegExp(`iterator: ${step} listening`));
		const body = await (await fetch(io.url)).text();
		assert.ok(body.includes("const D = "));
		assert.ok(body.includes(marker), `page must contain "${marker}"`);
		await fetch(io.url.origin + "/submit", {
			method: "POST",
			body: '{"type":"ok"}',
		});
		assert.equal(await waitExit(io.child), 0);
		assert.equal(io.stdout().trim(), '{"type":"ok"}');
	});
}

test("commit mode embeds the wave chunks and okf memory proposals", async () => {
	const io = await startServer({
		step: "review",
		mode: "commit",
		branch: "test",
		hasChunksFile: true,
		chunks: [
			{
				name: "auth-middleware",
				description: "JWT middleware",
				stats: { added: 1, removed: 0, files: 1, complexity: "green" },
				files: [],
				tests: { status: "green", total: 3, passing: 3 },
			},
			{
				name: "logging",
				description: "Structured logs",
				stats: { added: 2, removed: 0, files: 1, complexity: "green" },
				files: [],
			},
		],
		uncategorized: [],
		memory: {
			proposals: [
				{
					action: "update",
					area: "patterns",
					slug: "auth-flow",
					type: "Pattern",
					title: "Auth flow",
					description: "JWT verification pattern.",
					reason: "Middleware changed the token check.",
					files: ["src/auth.ts"],
					tags: ["auth"],
					sourceCommits: ["abcdef1234567890"],
					body: "# Pattern\n\nVerify JWTs in middleware before route handlers.",
					existingBody: "# Pattern\n\nOld token check guidance.",
				},
			],
		},
	});
	const body = await (await fetch(io.url)).text();
	assert.ok(
		body.includes("Memory updates"),
		"memory section machinery is in the page",
	);
	assert.ok(
		body.includes("Memory proposal details"),
		"full memory-review panel is present",
	);
	assert.ok(
		body.includes("Middleware changed the token check."),
		"proposal reason embedded",
	);
	assert.ok(
		body.includes("Verify JWTs in middleware before route handlers."),
		"proposal body embedded for review",
	);
	assert.ok(
		body.includes("Old token check guidance."),
		"existing body embedded for comparison",
	);
	assert.ok(body.includes("src/auth.ts"), "file anchors embedded for review");
	assert.ok(
		body.includes("abcdef1234567890"),
		"source commits embedded for review",
	);
	assert.ok(
		body.includes("data-mem-body"),
		"client renders proposal markdown bodies",
	);
	assert.ok(
		body.includes("chunks: names"),
		"accept-commit carries the whole wave",
	);
	io.child.kill();
	await waitExit(io.child);
});

test('a mode:"commit" payload without step falls back to the review view', async () => {
	const io = await startServer({
		mode: "commit",
		branch: "test",
		hasChunksFile: true,
		chunks: [
			{
				name: "auth-middleware",
				description: "JWT middleware",
				stats: { added: 1, removed: 0, files: 1, complexity: "green" },
				files: [{ path: "src/auth.ts", hunks: [] }],
			},
		],
		uncategorized: [],
	});
	assert.match(io.stderr(), /iterator: review listening/);
	const body = await (await fetch(io.url)).text();
	assert.ok(body.includes("Accept and commit"));
	io.child.kill();
	await waitExit(io.child);
});

// ---------------------------------------------------------------------------
// knowledge + memory-review views (absorbed from okf-memory)

const fixture = (name) =>
	parseJson(
		readFileSync(join(root, "test", "fixtures", `${name}.json`), "utf8"),
	);

test("knowledge view renders memory state, areas, concepts, design, and actions", async () => {
	const io = await startServer(fixture("knowledge"));
	const page = await (await fetch(io.url)).text();
	assert.match(page, /Memory status/);
	assert.match(page, /Knowledge areas/);
	assert.match(page, /All memories/);
	assert.match(page, /Safe browser rendering/);
	assert.match(page, /data-action="update-memory"/);
	assert.match(page, /data-target="pitfalls\/gone-anchor"/);
	assert.match(page, /badge-stale/);
	assert.match(page, /Design parameters/, "design.md card present");
	assert.match(page, /data-action="refresh-format"/, "formatStale affordance");
	assert.match(page, /data-action="okf-memorize"/);
	assert.match(page, /Draft memory from prompt/);
	assert.doesNotMatch(
		page,
		/data-action="okf-init"/,
		"initialized bundle hides Initialize",
	);

	const payload = {
		type: "action",
		action: "update-memory",
		target: "pitfalls/gone-anchor",
		prompt: "Re-anchor it.",
	};
	await fetch(io.url.origin + "/submit", {
		method: "POST",
		body: JSON.stringify(payload),
	});
	const code = await waitExit(io.child);
	assert.equal(code, 0);
	// The server dispatches action results: update-memory belongs to /okf.
	assert.deepEqual(parseJson(io.stdout().trim()), { ...payload, skill: "okf" });
});

test("memorize review renders conflicts, range, and grouped cards", async () => {
	const io = await startServer(fixture("memorize"));
	const page = await (await fetch(io.url)).text();
	assert.match(page, /CONFLICT/);
	assert.match(
		page,
		/Existing memory says handlers return Result values instead of throwing/,
	);
	assert.match(
		page,
		/Patterns &amp; Conventions <span class="count">2<\/span>/,
	);
	assert.match(page, /abc1234\.\.def5678/);
	io.child.kill();
	await waitExit(io.child);
});

test("consolidate review renders stale badge and current versions for keep/update", async () => {
	const io = await startServer(fixture("consolidate"));
	const page = await (await fetch(io.url)).text();
	assert.match(page, /STALE/);
	assert.match(
		page,
		/Referenced file packages\/api\/src\/server.ts no longer exists/,
	);
	assert.match(page, /Current version on disk/);
	io.child.kill();
	await waitExit(io.child);
});

test("memory-review feedback body round-trips verbatim (no apply on feedback)", async () => {
	const io = await startServer({ ...fixture("init"), apply: true });
	const payload = {
		type: "review-feedback",
		mode: "init",
		decisions: [{ id: "patterns/error-handling", verdict: "accept" }],
		comments: [
			{
				id: "patterns/error-handling",
				comment: "Mention middleware. Keep > and < chars.",
			},
		],
		general: "Add one architecture memory.",
	};
	await fetch(io.url.origin + "/submit", {
		method: "POST",
		body: JSON.stringify(payload),
	});
	await waitExit(io.child);
	assert.equal(io.stdout().trim(), JSON.stringify(payload));
});

test("memory-review with apply:true applies review-approved via the writer", async () => {
	const { execFileSync } = await import("node:child_process");
	const { mkdtempSync, rmSync, existsSync: exists } = await import("node:fs");
	const { tmpdir: tmp } = await import("node:os");
	const repo = mkdtempSync(join(tmp(), "iterator-apply-"));
	const git = (...args) =>
		execFileSync("git", args, {
			cwd: repo,
			encoding: "utf8",
			env: {
				...process.env,
				GIT_AUTHOR_NAME: "t",
				GIT_AUTHOR_EMAIL: "t@t",
				GIT_COMMITTER_NAME: "t",
				GIT_COMMITTER_EMAIL: "t@t",
			},
		}).trim();
	try {
		git("init", "-q");
		const { writeFileSync: wf } = await import("node:fs");
		wf(join(repo, "x"), "x\n");
		git("add", ".");
		git("commit", "-qm", "init");
		const head = git("rev-parse", "HEAD");

		const card = {
			id: "patterns/error-handling",
			area: "patterns",
			action: "create",
			type: "Pattern",
			title: "Error handling",
			description: "Wrap all IO.",
			body: "# Pattern\n\nAlways wrap IO.",
		};
		const io = await startServer(
			{
				step: "memory-review",
				mode: "memorize",
				apply: true,
				project: repo,
				headCommit: head,
				commitCount: 1,
				areas: [
					{ id: "patterns", title: "Patterns & Conventions", description: "" },
				],
				memories: [card],
			},
			{ ITERATOR_NOW: "2026-07-06T12:00:00Z" },
		);
		await fetch(io.url.origin + "/submit", {
			method: "POST",
			body: JSON.stringify({
				type: "review-approved",
				mode: "memorize",
				decisions: [{ id: "patterns/error-handling", verdict: "accept" }],
			}),
		});
		await waitExit(io.child);

		const out = parseJson(io.stdout().trim());
		assert.equal(out.type, "review-approved");
		assert.equal(out.applied.ok, true, JSON.stringify(out.applied));
		assert.deepEqual(out.applied.written, ["patterns/error-handling"]);
		assert.equal(out.applied.advancedTo, head);
		assert.equal(out.applied.validation.ok, true);
		assert.ok(
			exists(join(repo, "memory", "patterns", "error-handling.md")),
			"concept written on disk before the agent sees the result",
		);
	} finally {
		rmSync(repo, { recursive: true, force: true });
	}
});

test("POST /submit with a non-JSON body emits a JSON error line, never garbage", async () => {
	const io = await startServer(PLAN_PAYLOAD);
	await fetch(io.url.origin + "/submit", {
		method: "POST",
		body: "this is not json {{{",
	});
	const code = await waitExit(io.child);
	assert.equal(code, 0);
	const line = JSON.parse(io.stdout().trim());
	assert.equal(line.type, "error");
	assert.match(line.error, /malformed/);
});

test("one-command request form gathers in-process and cancel carries a report", async () => {
	// A bare temp git repo: hub gathers plan:null; the served page must exist
	// and explicit cancel must carry the step's human report.
	const { mkdtempSync, rmSync } = await import("node:fs");
	const { execFileSync } = await import("node:child_process");
	const dir = mkdtempSync(join(tmpdir(), "iterator-onecmd-"));
	execFileSync("git", ["init", "-q"], { cwd: dir });
	let io;
	try {
		io = await startServer({ gather: true, step: "hub", project: dir });
		const page = await (await fetch(io.url)).text();
		assert.ok(page.includes("const D = "));
		await fetch(io.url.origin + "/cancel?now=1", { method: "POST" });
		await waitExit(io.child);
		const line = parseJson(io.stdout().trim());
		assert.equal(line.type, "cancel");
		assert.match(line.report, /dashboard/);
	} finally {
		if (io && io.child.exitCode == null) io.child.kill();
		rmSync(dir, { recursive: true, force: true });
	}
});
