import assert from "node:assert/strict";
import { test } from "node:test";
import {
	canTransition,
	CREATABLE_STATUSES,
	depSatisfied,
	FEATURE_STATUSES,
	FEATURE_TRANSITIONS,
	planStage,
	readiness,
	RESTARTABLE_STATUSES,
	satisfiedSet,
	unfinished,
} from "../lib/status.mjs";

const feature = (slug, status, dependsOn = []) => ({
	slug,
	fm: { status, depends_on: dependsOn },
});

test("transition table covers every status and stays within the enum", () => {
	assert.deepEqual(Object.keys(FEATURE_TRANSITIONS).sort(), [...FEATURE_STATUSES].sort());
	for (const [from, tos] of Object.entries(FEATURE_TRANSITIONS)) {
		assert.ok(tos.includes(from), `${from} must allow its idempotent self-transition`);
		for (const to of tos)
			assert.ok(FEATURE_STATUSES.includes(to), `${from} → ${to} targets a real status`);
	}
	assert.ok(CREATABLE_STATUSES.every((s) => FEATURE_STATUSES.includes(s)));
	assert.ok(RESTARTABLE_STATUSES.every((s) => FEATURE_STATUSES.includes(s)));
});

test("done is terminal and never reachable from draft", () => {
	assert.equal(canTransition("done", "pending"), false);
	assert.equal(canTransition("done", "implemented"), false);
	assert.equal(canTransition("done", "done"), true);
	assert.equal(canTransition("draft", "done"), false);
	assert.equal(canTransition("draft", "implemented"), false);
	assert.equal(canTransition("pending", "done"), true);
	assert.equal(canTransition("implemented", "done"), true);
	// implemented → pending is the rework/restart path.
	assert.equal(canTransition("implemented", "pending"), true);
	// A missing status counts as pending.
	assert.equal(canTransition(undefined, "implemented"), true);
});

test("depSatisfied honors review_required", () => {
	assert.equal(depSatisfied("done", { review_required: "on" }), true);
	assert.equal(depSatisfied("implemented", { review_required: "on" }), false);
	assert.equal(depSatisfied("implemented", { review_required: "off" }), true);
	assert.equal(depSatisfied("pending", { review_required: "off" }), false);
});

test("satisfiedSet and readiness compute waitingOn server-side", () => {
	const features = [
		feature("a", "done"),
		feature("b", "implemented"),
		feature("c", "pending", ["a", "b"]),
		feature("d", "pending", ["missing"]),
	];
	const on = { review_required: "on" };
	assert.deepEqual([...satisfiedSet(features, on)], ["a"]);
	const r = readiness(features, on);
	assert.deepEqual(r.get("c"), { ready: false, waitingOn: ["b"] });
	assert.deepEqual(r.get("a"), { ready: true, waitingOn: [] });
	// Unknown dependencies keep a feature blocked rather than crashing.
	assert.deepEqual(r.get("d"), { ready: false, waitingOn: ["missing"] });
	const off = { review_required: "off" };
	assert.deepEqual(readiness(features, off).get("c"), { ready: true, waitingOn: [] });
});

test("readiness tolerates dependency cycles (nothing ready, nothing crashes)", () => {
	const features = [
		feature("x", "pending", ["y"]),
		feature("y", "pending", ["x"]),
	];
	const r = readiness(features, { review_required: "on" });
	assert.deepEqual(r.get("x"), { ready: false, waitingOn: ["y"] });
	assert.deepEqual(r.get("y"), { ready: false, waitingOn: ["x"] });
});

test("planStage derives the lifecycle from plan + feature statuses", () => {
	const plan = (status) => ({ fm: { status } });
	const s = { review_required: "on" };
	assert.equal(planStage(null, [], s), "no-plan");
	assert.equal(planStage(plan("draft"), [], s), "plan-draft");
	assert.equal(planStage(plan("approved"), [], s), "needs-features");
	assert.equal(
		planStage(plan("approved"), [feature("a", "draft"), feature("b", "pending")], s),
		"feature-review",
	);
	assert.equal(
		planStage(plan("approved"), [feature("a", "pending")], s),
		"implementing",
	);
	assert.equal(
		planStage(plan("approved"), [feature("a", "implemented"), feature("b", "done")], s),
		"awaiting-plan-review",
	);
	assert.equal(
		planStage(plan("approved"), [feature("a", "done")], s),
		"retirable",
	);
});

test("unfinished lists everything not done", () => {
	assert.deepEqual(
		unfinished([feature("a", "done"), feature("b", "implemented"), feature("c", undefined)]),
		["b", "c"],
	);
});
