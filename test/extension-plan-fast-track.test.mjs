import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
	new URL("../extensions/iterator.js", import.meta.url),
	"utf8",
);

test("structured plans keep review and writer gates before feature breakdown", () => {
	const from = source.indexOf("const startFastPlan = async (input) => {");
	const to = source.indexOf("/** Persist the Usage tab", from);
	assert.notEqual(from, -1);
	assert.notEqual(to, -1);
	const section = source.slice(from, to);
	assert.match(section, /session\.showStep\(\{/);
	assert.match(section, /step: "plan"/);
	assert.match(section, /result\?\.type !== "plan-approved"/);
	assert.match(section, /op: "plan"/);
	assert.match(section, /sections: result\.sections/);
	assert.match(section, /dependencies: result\.dependencies \|\| \[\]/);
	assert.match(section, /refreshHub\(cwd, \{ activateWork: true \}\)/);
	assert.match(section, /dispatch\("\/skill:iterator-feature"\)/);
	assert.ok(
		section.indexOf('result?.type !== "plan-approved"') <
			section.indexOf('op: "plan"'),
		"approval precedes the deterministic write",
	);
	assert.ok(
		section.indexOf('op: "plan"') <
			section.indexOf('dispatch("/skill:iterator-feature")'),
		"feature breakdown starts only after the approved write",
	);
});

test("dashboard routes the fast-track action without starting a planner model", () => {
	const route = source.slice(
		source.indexOf('result.action === "plan-fast-track"') - 100,
		source.indexOf('result.action === "plan-fast-track"') + 180,
	);
	assert.match(route, /void startFastPlan\(result\)/);
});
