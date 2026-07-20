import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	actionToCommand,
	activityTextFromMessage,
	implementationCommand,
	bundleExists,
	featuresDirEntries,
	composeAmbientContext,
	extractPathsFromBash,
	footerText,
	mergePayload,
	runJson,
	scriptPath,
	shouldNudge,
	uiPort,
} from "../lib/pi-tools.mjs";

test("mergePayload: extra wins, gathered object untouched, junk extra ignored", () => {
	const gathered = { step: "plan", title: "old", dependencies: [] };
	const merged = mergePayload(gathered, { title: "new", plan: { goal: "g" } });
	assert.equal(merged.title, "new");
	assert.deepEqual(merged.plan, { goal: "g" });
	assert.equal(gathered.title, "old", "input must not be mutated");
	assert.deepEqual(mergePayload(gathered, null), gathered);
	assert.deepEqual(mergePayload(gathered, "nonsense"), gathered);
});

test("actionToCommand maps hub actions to skill commands", () => {
	assert.equal(
		actionToCommand({ type: "action", action: "plan", feature: null }),
		"/skill:iterator-plan",
	);
	assert.equal(
		actionToCommand({ type: "action", action: "feature", feature: null }),
		"/skill:iterator-feature",
	);
	assert.equal(
		actionToCommand({ type: "action", action: "test", feature: "auth" }),
		"/skill:iterator-test auth",
	);
	assert.equal(
		actionToCommand({ type: "action", action: "implement", feature: "auth" }),
		"/iterator-implement auth",
	);
	assert.equal(
		actionToCommand({ type: "action", action: "review", feature: "auth" }),
		"/skill:iterator-review auth",
	);
	assert.equal(
		actionToCommand({ type: "action", action: "review-all" }),
		"/skill:iterator-review --all",
	);
});

test("implementationCommand creates fresh-session command invocations", () => {
	assert.equal(implementationCommand("auth"), "/iterator-implement auth");
	assert.equal(
		implementationCommand("auth", { auto: true, guidance: "keep tests red" }),
		"/iterator-implement auth --auto — keep tests red",
	);
});

test("actionToCommand returns null for cancel/timeout/garbage", () => {
	assert.equal(actionToCommand({ type: "cancel" }), null);
	assert.equal(actionToCommand({ type: "timeout" }), null);
	assert.equal(actionToCommand({ type: "action", action: "rm -rf" }), null);
	assert.equal(actionToCommand(null), null);
	assert.equal(actionToCommand({}), null);
});

test("bundleExists and featuresDirEntries read the fixture bundle", () => {
	const root = mkdtempSync(join(tmpdir(), "iterator-pitools-"));
	try {
		mkdirSync(join(root, ".git"), { recursive: true }); // git root marker
		assert.equal(bundleExists(root), false);

		mkdirSync(join(root, "memory", "features"), { recursive: true });
		writeFileSync(join(root, "memory", "plan.md"), "---\ntype: Plan\n---\n");
		assert.equal(bundleExists(root), true);
		assert.equal(bundleExists(join(root)), true);

		writeFileSync(
			join(root, "memory", "features", "auth.md"),
			"---\ntype: Feature\nstatus: pending\ntests_status: red\n---\n",
		);
		writeFileSync(join(root, "memory", "features", "index.md"), "# Features\n");
		const entries = featuresDirEntries(root);
		assert.deepEqual(
			entries.map((e) => e.slug),
			["auth"],
		);
		assert.equal(entries[0].fm.tests_status, "red");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("runJson surfaces gather output and writer validation errors", async () => {
	const root = mkdtempSync(join(tmpdir(), "iterator-pitools-run-"));
	try {
		mkdirSync(join(root, ".git"), { recursive: true });
		// gather hub on an empty dir → create-plan shape
		const hub = await runJson(
			scriptPath("gather"),
			["--step", "hub", root],
			{},
		);
		assert.equal(hub.step, "hub");
		assert.equal(hub.plan, null);
		// writer refuses an unknown op with its own error message
		await assert.rejects(
			() => runJson(scriptPath("write"), [root], { stdin: '{"op":"nope"}' }),
			/unknown op/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("actionToCommand maps knowledge actions to knowledge skills", () => {
	assert.equal(
		actionToCommand({ type: "action", action: "iterator-init" }),
		"/skill:iterator-init",
	);
	assert.equal(
		actionToCommand({ type: "action", action: "iterator-consolidate" }),
		"/skill:iterator-consolidate",
	);
	assert.equal(
		actionToCommand({ type: "action", action: "iterator-memorize" }),
		"/skill:iterator-memorize",
	);
	assert.equal(
		actionToCommand({ type: "action", action: "design" }),
		"/skill:iterator-design",
	);
	assert.equal(
		actionToCommand({
			type: "action",
			action: "draft-memory",
			target: "pitfalls",
			prompt: "",
		}),
		"/skill:iterator-knowledge draft-memory pitfalls",
	);
	assert.equal(
		actionToCommand({
			type: "action",
			action: "update-memory",
			target: "pitfalls/gone-anchor",
			prompt: "Re-anchor it.",
		}),
		"/skill:iterator-knowledge update-memory pitfalls/gone-anchor — Re-anchor it.",
	);
	assert.equal(
		actionToCommand({
			type: "action",
			action: "draft-memory-prompt",
			target: null,
			prompt: "Capture the port story.",
		}),
		"/skill:iterator-knowledge draft-memory-prompt — Capture the port story.",
	);
	assert.equal(
		actionToCommand({ type: "action", action: "refresh-format" }),
		"/skill:iterator-knowledge refresh-format",
	);
	assert.equal(actionToCommand({ type: "action", action: "close" }), null);
});

test("actionToCommand maps retire to the hub retirement flow", () => {
	assert.equal(
		actionToCommand({ type: "action", action: "retire", feature: null }),
		"/skill:iterator retire-plan",
	);
});

test("extractPathsFromBash finds path-looking tokens and dedupes", () => {
	assert.deepEqual(
		extractPathsFromBash(
			"node ./lib/server.mjs test/a.test.mjs && cat lib/server.mjs",
		),
		["lib/server.mjs", "test/a.test.mjs"],
	);
	assert.deepEqual(extractPathsFromBash("git status"), []);
	assert.deepEqual(extractPathsFromBash(""), []);
});

test("composeAmbientContext builds the state line and anchored-knowledge list", () => {
	const hub = {
		plan: { title: "Add JWT auth", status: "approved" },
		progress: { done: 3, total: 7 },
		features: [
			{ name: "auth-middleware", testsStatus: "red" },
			{ name: "config-module", testsStatus: "green" },
		],
	};
	const implement = { next: { name: "auth-middleware" } };
	const concepts = [
		{
			id: "pitfalls/token-clock-skew",
			title: "JWT clock skew",
			description: "Fresh tokens fail without leeway.",
			ref: "memory/pitfalls/token-clock-skew.md",
		},
	];
	const out = composeAmbientContext(hub, implement, concepts);
	assert.match(out, /Plan "Add JWT auth" — 3\/7 features done/);
	assert.match(out, /next ready: auth-middleware/);
	assert.match(out, /tests red: auth-middleware/);
	assert.match(
		out,
		/\[pitfalls\/token-clock-skew\] JWT clock skew — Fresh tokens fail without leeway\. \(memory\/pitfalls\/token-clock-skew\.md\)/,
	);

	// Knowledge lines alone still inject; nothing at all → null.
	assert.match(
		composeAmbientContext({ plan: null }, null, concepts),
		/token-clock-skew/,
	);
	assert.equal(composeAmbientContext({ plan: null }, null, []), null);
	// No red tests → no red segment.
	const quiet = composeAmbientContext(
		{ ...hub, features: [] },
		{ next: null },
		[],
	);
	assert.doesNotMatch(quiet, /tests red/);
	assert.match(quiet, /next ready: none/);
});

test("footerText composes segments and omits what is absent", () => {
	const hub = {
		plan: { title: "X" },
		progress: { done: 3, total: 7 },
		features: [
			{ name: "a", testsStatus: "red" },
			{ name: "b", testsStatus: "green" },
		],
	};
	assert.equal(
		footerText(hub, { next: { name: "auth-middleware" } }, 4),
		"⛭ 3/7 · next: auth-middleware · 🔴 1 red · 🧠 4 unmemorized",
	);
	assert.equal(footerText(hub, { next: null }, 0), "⛭ 3/7 · 🔴 1 red");
	assert.equal(footerText({ plan: null }, null, 4), "🧠 4 unmemorized");
	assert.equal(footerText({ plan: null }, null, 0), null);
});

test("footerText trails the ui port rightmost, and shows it with no plan", () => {
	const hub = {
		plan: { title: "X" },
		progress: { done: 3, total: 7 },
		features: [
			{ name: "a", testsStatus: "red" },
			{ name: "b", testsStatus: "green" },
		],
	};
	assert.equal(
		footerText(hub, { next: { name: "auth" } }, 4, 53421),
		"⛭ 3/7 · next: auth · 🔴 1 red · 🧠 4 unmemorized · 🌐 ui:53421",
	);
	assert.equal(
		footerText({ plan: null }, null, 0, 53421),
		"🌐 ui:53421",
		"the port is a property of the agent — it shows with nothing else to say",
	);
	assert.equal(
		footerText({ plan: null }, null, 0, null),
		null,
		"no port and nothing else clears the segment",
	);
});

test("uiPort reads ITERATOR_DISPLAY_PORT and rejects junk", () => {
	const none = "/nonexistent/.pisbx-env";
	assert.equal(uiPort({ ITERATOR_DISPLAY_PORT: "53421" }, none), 53421);
	assert.equal(uiPort({}, none), null, "unset — not sandboxed");
	assert.equal(uiPort({ ITERATOR_DISPLAY_PORT: "" }, none), null);
	assert.equal(uiPort({ ITERATOR_DISPLAY_PORT: "nonsense" }, none), null);
	assert.equal(
		uiPort({ ITERATOR_DISPLAY_PORT: "0" }, none),
		null,
		"0 is not a port",
	);
	assert.equal(uiPort({ ITERATOR_DISPLAY_PORT: "-1" }, none), null);
});

test("uiPort falls back to ~/.pisbx-env — sbx run never sources it into the env", (t) => {
	const dir = mkdtempSync(join(tmpdir(), "pisbx-"));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	const file = join(dir, ".pisbx-env");

	// The exact line pisbx writes.
	writeFileSync(file, "export ITERATOR_DISPLAY_PORT=49159\n");
	assert.equal(uiPort({}, file), 49159, "reads the port pisbx wrote");
	assert.equal(
		uiPort({ ITERATOR_DISPLAY_PORT: "53421" }, file),
		53421,
		"a real env var still wins over the file",
	);

	writeFileSync(file, 'ITERATOR_DISPLAY_PORT="49160"\n');
	assert.equal(uiPort({}, file), 49160, "bare/quoted assignment also parses");

	writeFileSync(file, "export SOMETHING_ELSE=1\n");
	assert.equal(uiPort({}, file), null, "unrelated file — no port");

	writeFileSync(file, "export ITERATOR_DISPLAY_PORT=nonsense\n");
	assert.equal(uiPort({}, file), null, "junk in the file is not a port");

	assert.equal(
		uiPort({}, join(dir, "missing")),
		null,
		"missing file never throws",
	);
});

test("shouldNudge fires once per threshold-multiple and can be disabled", () => {
	assert.equal(shouldNudge(4, 0, 5), false, "below threshold");
	assert.equal(shouldNudge(5, 0, 5), true, "reaches threshold");
	assert.equal(
		shouldNudge(7, 5, 5),
		false,
		"already nudged at 5 — wait for 10",
	);
	assert.equal(
		shouldNudge(10, 5, 5),
		true,
		"a full threshold past the last nudge",
	);
	assert.equal(shouldNudge(100, 0, 0), false, "threshold 0 disables");
	assert.equal(shouldNudge(100, 0, NaN), false, "unparseable env disables");
});

test("actionToCommand carries a typed plan goal through to the skills", () => {
	assert.equal(
		actionToCommand({
			type: "action",
			action: "plan",
			feature: null,
			prompt: "Build a CLI for tides",
		}),
		"/skill:iterator-plan — Build a CLI for tides",
	);
	assert.equal(
		actionToCommand({
			type: "action",
			action: "iterator-init",
			prompt: "Build a CLI for tides",
		}),
		"/skill:iterator-init — when initialization finishes, continue into /skill:iterator-plan — Build a CLI for tides",
	);
	// No prompt → unchanged classic forms.
	assert.equal(
		actionToCommand({ type: "action", action: "plan", feature: null }),
		"/skill:iterator-plan",
	);
	assert.equal(
		actionToCommand({ type: "action", action: "iterator-init" }),
		"/skill:iterator-init",
	);
});

test("attributionFromInput maps flow commands to ledger steps", async () => {
	const { attributionFromInput } = await import("../lib/pi-tools.mjs");
	assert.deepEqual(
		attributionFromInput("/skill:iterator-implement auth-middleware"),
		{ step: "implement", feature: "auth-middleware" },
	);
	assert.deepEqual(attributionFromInput("/iterator-plan — build a tide CLI"), {
		step: "plan",
		feature: null,
	});
	assert.deepEqual(attributionFromInput("/iterator-memorize"), {
		step: "memory",
		feature: null,
	});
	assert.deepEqual(attributionFromInput("/iterator-next"), {
		step: "implement",
		feature: null,
	});
	assert.equal(
		attributionFromInput("fix the login bug"),
		null,
		"plain prose keeps the previous attribution",
	);
	assert.equal(attributionFromInput("/help"), null);
});

test("roleFromInput maps exact role commands with plan review precedence", async () => {
	const { roleFromInput } = await import("../lib/pi-tools.mjs");
	assert.equal(roleFromInput("/skill:iterator-plan Build a CLI"), "planner");
	assert.equal(roleFromInput("/iterator-test auth"), "tester");
	assert.equal(roleFromInput("/iterator-implement auth"), "implementer");
	assert.equal(roleFromInput("/iterator-next"), "implementer");
	assert.equal(roleFromInput("/iterator-review auth"), "reviewer");
	assert.equal(roleFromInput("/skill:iterator-review-plan"), "plan_reviewer");
	assert.equal(roleFromInput("/iterator-review-plans"), null);
	assert.equal(roleFromInput("fix the login bug"), null);
});

test("usageRowFromMessage extracts assistant usage with attribution", async () => {
	const { usageRowFromMessage } = await import("../lib/pi-tools.mjs");
	const msg = {
		role: "assistant",
		provider: "openai",
		model: "gpt-5.5",
		usage: { input: 100, output: 40, cacheRead: 10, cacheWrite: 2 },
	};
	assert.deepEqual(
		usageRowFromMessage(msg, { step: "review", feature: "auth" }),
		{
			step: "review",
			feature: "auth",
			provider: "openai",
			model: "gpt-5.5",
			input: 100,
			output: 40,
			cacheRead: 10,
			cacheWrite: 2,
		},
	);
	assert.equal(usageRowFromMessage(msg, null).step, "other");
	assert.equal(usageRowFromMessage({ role: "user" }, null), null);
	assert.equal(
		usageRowFromMessage({ role: "assistant" }, null),
		null,
		"no usage → no row",
	);
});

// ---------------------------------------------------------------------------
// Auto mode state machine

const {
	completeFeatureWaveAbort,
	nextAutoAction,
	nextFeatureWaveAction,
	pauseFeatureWave,
	roleModelSpec,
	AUTO_PHASE_FOR_STEP,
} = await import("../lib/pi-tools.mjs");

const S = (over = {}) => ({
	auto_mode: "on",
	testing_default: "on",
	max_review_iterations: 3,
	block_commit_on_leftovers: "on",
	...over,
});
const ST = (over = {}) => ({
	mode: "auto",
	paused: false,
	phase: "implementing",
	active_feature: null,
	strikes: {},
	...over,
});
const sess = ({
	features = [],
	next = null,
	drafts = [],
	stuck = false,
	done = 0,
	total = features.length,
} = {}) => ({
	hub: { plan: { title: "P" }, progress: { done, total }, features },
	implement: { next, drafts, stuck },
});

test("nextFeatureWaveAction freezes the queue and reports each implementation result", () => {
	let wave = { queue: ["a", "b"], active: null, results: [] };
	let decision = nextFeatureWaveAction(wave, [
		{ name: "a", status: "pending", conflicts: 0 },
		{ name: "b", status: "pending", conflicts: 0 },
		{ name: "later", status: "pending", conflicts: 0 },
	]);
	assert.equal(decision.action.feature, "a");
	assert.equal(decision.action.cmd, "/skill:iterator-implement a --auto");
	assert.deepEqual(
		decision.wave.queue,
		["b"],
		"newly ready features never join the snapshot",
	);

	wave = decision.wave;
	decision = nextFeatureWaveAction(wave, [
		{ name: "a", status: "implemented", conflicts: 0 },
		{ name: "b", status: "pending", conflicts: 0 },
		{ name: "later", status: "pending", conflicts: 0 },
	]);
	assert.equal(decision.action.feature, "b");
	assert.deepEqual(decision.wave.results, [
		{ feature: "a", status: "implemented" },
	]);

	decision = nextFeatureWaveAction(decision.wave, [
		{ name: "a", status: "implemented", conflicts: 0 },
		{ name: "b", status: "pending", conflicts: 0 },
	]);
	assert.equal(decision.done, true);
	assert.deepEqual(decision.wave.results, [
		{ feature: "a", status: "implemented" },
		{ feature: "b", status: "failed" },
	]);
});

test("pauseFeatureWave waits for the aborted agent_end in either Continue ordering", () => {
	const features = [
		{ name: "a", status: "pending", conflicts: 0 },
		{ name: "b", status: "pending", conflicts: 0 },
	];
	const paused = pauseFeatureWave({ queue: ["b"], active: "a", results: [] });
	assert.deepEqual(paused, {
		queue: ["a", "b"],
		active: null,
		results: [],
		abortPending: true,
	});

	// Continue before the stale agent_end must not dispatch yet.
	const earlyContinue = nextFeatureWaveAction(paused, features);
	assert.equal(earlyContinue.waiting, true);
	assert.equal(earlyContinue.action, undefined);
	const afterEarlyAgentEnd = completeFeatureWaveAbort(earlyContinue.wave);
	const earlyResumed = nextFeatureWaveAction(afterEarlyAgentEnd, features);
	assert.equal(earlyResumed.action.feature, "a");
	assert.deepEqual(earlyResumed.wave.results, []);

	// If agent_end arrives while still paused, a later Continue dispatches once.
	const afterLateAgentEnd = completeFeatureWaveAbort(paused);
	const lateResumed = nextFeatureWaveAction(afterLateAgentEnd, features);
	assert.equal(lateResumed.action.feature, "a");
	assert.deepEqual(lateResumed.wave.results, []);
});

test("nextFeatureWaveAction skips conflicts without dispatching them", () => {
	const decision = nextFeatureWaveAction(
		{ queue: ["blocked"], active: null, results: [] },
		[{ name: "blocked", status: "pending", conflicts: 1 }],
	);
	assert.equal(decision.done, true);
	assert.deepEqual(decision.wave.results, [
		{ feature: "blocked", status: "conflict" },
	]);
});

test("nextAutoAction is inert outside active auto mode", () => {
	const s = sess({
		features: [{ name: "a", status: "pending" }],
		next: { name: "a", testsStatus: "none" },
	});
	assert.equal(nextAutoAction(s, S(), ST({ mode: "manual" })), null);
	assert.equal(nextAutoAction(s, S(), ST({ paused: true })), null);
	assert.equal(
		nextAutoAction({ hub: { plan: null } }, S(), ST()),
		null,
		"no plan",
	);
});

test("nextAutoAction dispatches test → implement → review from bundle state", () => {
	const feature = { name: "a", status: "pending" };
	// No tests yet + testing on → tester turn.
	let a = nextAutoAction(
		sess({ features: [feature], next: { name: "a", testsStatus: "none" } }),
		S(),
		ST(),
	);
	assert.deepEqual(a, {
		step: "test",
		role: "tester",
		feature: "a",
		cmd: "/skill:iterator-test a --auto",
	});
	assert.equal(AUTO_PHASE_FOR_STEP[a.step], "testing");
	// Tests red, still pending → implementer turn.
	a = nextAutoAction(
		sess({ features: [feature], next: { name: "a", testsStatus: "red" } }),
		S(),
		ST(),
	);
	assert.equal(a.step, "implement");
	assert.equal(a.cmd, "/skill:iterator-implement a --auto");
	// Testing off skips straight to implement.
	a = nextAutoAction(
		sess({ features: [feature], next: { name: "a", testsStatus: "none" } }),
		S({ testing_default: "off" }),
		ST(),
	);
	assert.equal(a.step, "implement");
	// Feature flipped to implemented → reviewer turn (a status, not a diff
	// heuristic), even when no other feature is ready.
	a = nextAutoAction(
		sess({ features: [{ name: "a", status: "implemented" }], next: null }),
		S(),
		ST(),
	);
	assert.deepEqual(a, {
		step: "review",
		role: "reviewer",
		feature: "a",
		cmd: "/skill:iterator-review a --agent",
	});
	// Awaiting review is never misread as stuck.
	a = nextAutoAction(
		sess({
			features: [
				{ name: "a", status: "implemented" },
				{ name: "b", status: "pending" },
			],
			next: null,
			total: 2,
		}),
		S(),
		ST(),
	);
	assert.equal(a.step, "review");
});

test("nextAutoAction reads the review verdict from the bundle and strikes", () => {
	// Review round returned, feature NOT done → needs-work → strike + rework.
	const s = sess({
		features: [{ name: "a", status: "pending", hasDiff: true }],
		next: { name: "a", testsStatus: "red" },
	});
	let a = nextAutoAction(
		s,
		S(),
		ST({ phase: "reviewing", active_feature: "a" }),
	);
	assert.equal(a.step, "implement");
	assert.equal(a.strike, "a");
	// Two prior strikes: the third failure escalates.
	a = nextAutoAction(
		s,
		S(),
		ST({ phase: "reviewing", active_feature: "a", strikes: { a: 2 } }),
	);
	assert.equal(a.escalate, true);
	assert.match(a.reason, /failed agent review 3/);
	// Feature done → approved: the plan is finished, so the once-only
	// whole-plan review dispatches before done.
	const approved = sess({
		features: [{ name: "a", status: "done" }],
		next: null,
		done: 1,
		total: 1,
	});
	a = nextAutoAction(
		approved,
		S(),
		ST({ phase: "reviewing", active_feature: "a" }),
	);
	assert.deepEqual(a, {
		step: "plan-review",
		role: "plan_reviewer",
		cmd: "/skill:iterator-review-plan --auto",
	});
	// plan_reviewed recorded → truly done (no loop around the plan review).
	const reviewed = sess({
		features: [{ name: "a", status: "done" }],
		next: null,
		done: 1,
		total: 1,
	});
	reviewed.hub.plan.planReviewed = "2026-07-15";
	a = nextAutoAction(
		reviewed,
		S(),
		ST({ phase: "reviewing", active_feature: null }),
	);
	assert.deepEqual(a, { done: true });
});

test("nextAutoAction escalates on conflicts, prior strikes, drafts, and stuck graphs", () => {
	let a = nextAutoAction(
		sess({
			features: [{ name: "a", status: "pending" }],
			next: {
				name: "a",
				testsStatus: "red",
				conflicts: [{ decision: "decisions/no-orm" }],
			},
		}),
		S(),
		ST(),
	);
	assert.equal(a.escalate, true);
	assert.match(a.reason, /decisions\/no-orm/);

	a = nextAutoAction(
		sess({
			features: [{ name: "a", status: "pending" }],
			next: { name: "a", testsStatus: "red" },
		}),
		S(),
		ST({ strikes: { a: 3 } }),
	);
	assert.equal(a.escalate, true);

	a = nextAutoAction(
		sess({ features: [], next: null, drafts: ["d"] }),
		S(),
		ST(),
	);
	assert.match(a.reason, /draft/);

	a = nextAutoAction(
		sess({
			features: [{ name: "a", status: "pending" }],
			next: null,
			stuck: true,
			total: 1,
		}),
		S(),
		ST(),
	);
	assert.match(a.reason, /cycle or missing/);
});

test("roleModelSpec resolves overrides and leaves active alone", () => {
	const settings = {
		reviewer_model: "anthropic/claude-opus-4-8",
		reviewer_thinking: "high",
		implementer_model: "active",
		implementer_thinking: "medium",
	};
	assert.deepEqual(roleModelSpec(settings, "reviewer"), {
		model: "anthropic/claude-opus-4-8",
		thinking: "high",
	});
	assert.deepEqual(roleModelSpec(settings, "implementer"), {
		model: null,
		thinking: "medium",
	});
	assert.deepEqual(roleModelSpec({}, "tester"), {
		model: null,
		thinking: null,
	});
});

// ---------------------------------------------------------------------------
// activityTextFromMessage — the working overlay's live line

const assistant = (content, extra = {}) => ({
	role: "assistant",
	content,
	...extra,
});

test("activityTextFromMessage: joins text blocks and collapses whitespace", () => {
	const msg = assistant([
		{ type: "text", text: "Adding requireAuth\n\n  to src/auth.ts" },
		{ type: "text", text: "then wiring the router." },
	]);
	assert.equal(
		activityTextFromMessage(msg),
		"Adding requireAuth to src/auth.ts then wiring the router.",
	);
});

test("activityTextFromMessage: takes text and skips thinking, even when thinking leads", () => {
	// The typical tool-using turn: thinking first, then prose, then tool calls.
	const msg = assistant(
		[
			{ type: "thinking", thinking: "Let me check the config first." },
			{ type: "text", text: "Checking the config secret." },
			{ type: "toolCall", id: "1", name: "read", arguments: {} },
		],
		{ stopReason: "toolUse" },
	);
	assert.equal(activityTextFromMessage(msg), "Checking the config secret.");
});

test("activityTextFromMessage: falls back to a tool summary when a message has no prose", () => {
	const msg = assistant(
		[
			{ type: "thinking", thinking: "silent work" },
			{ type: "toolCall", id: "1", name: "read", arguments: {} },
			{ type: "toolCall", id: "2", name: "edit", arguments: {} },
			{ type: "toolCall", id: "3", name: "edit", arguments: {} },
		],
		{ stopReason: "toolUse" },
	);
	assert.equal(activityTextFromMessage(msg), "Running read, edit ×2");
});

test("activityTextFromMessage: null for thinking-only and for messages without usable content", () => {
	assert.equal(
		activityTextFromMessage(assistant([{ type: "thinking", thinking: "hm" }])),
		null,
	);
	assert.equal(activityTextFromMessage(assistant([])), null);
	assert.equal(activityTextFromMessage(assistant(undefined)), null);
	assert.equal(activityTextFromMessage(assistant("not an array")), null);
	assert.equal(
		activityTextFromMessage(assistant([{ type: "text", text: "   " }])),
		null,
	);
	assert.equal(activityTextFromMessage(null), null);
});

test("activityTextFromMessage: only assistant messages produce a line", () => {
	// message_end fires for every role — anything but assistant must stay silent.
	for (const role of [
		"user",
		"toolResult",
		"bashExecution",
		"custom",
		"branchSummary",
		"compactionSummary",
	]) {
		assert.equal(
			activityTextFromMessage({
				role,
				content: [{ type: "text", text: "nope" }],
			}),
			null,
			`${role} must not reach the overlay`,
		);
	}
});

test("activityTextFromMessage: aborted turns stay silent, errored ones still speak", () => {
	const content = [{ type: "text", text: "partial work" }];
	assert.equal(
		activityTextFromMessage(assistant(content, { stopReason: "aborted" })),
		null,
	);
	assert.equal(
		activityTextFromMessage(assistant(content, { stopReason: "error" })),
		"partial work",
	);
});

test("activityTextFromMessage: clips long prose on a word boundary", () => {
	const long = assistant([{ type: "text", text: "word ".repeat(2000) }]);
	const line = activityTextFromMessage(long);
	assert.ok(line.length <= 801, `clipped to the cap, got ${line.length}`);
	assert.ok(line.endsWith("…"), "clipping is visible");
	assert.ok(!line.includes("wor…"), "cuts between words, not mid-word");
	// A custom cap is honoured, and short text is returned untouched.
	assert.equal(
		activityTextFromMessage(assistant([{ type: "text", text: "abcdef" }]), 4),
		"abcd…",
	);
	assert.equal(
		activityTextFromMessage(assistant([{ type: "text", text: "abcd" }]), 4),
		"abcd",
	);
});
