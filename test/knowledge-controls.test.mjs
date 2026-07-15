import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "../lib/views/knowledge.mjs";
import { actionToCommand } from "../lib/pi-tools.mjs";

test("Knowledge modal close control is an explicit button with an accessible label", () => {
	const html = render({ branch: "test", memory: {}, areas: [], memories: [] });
	assert.match(
		html,
		/<button class="mclose" id="m-close" type="button" aria-label="Close memory">/,
	);
});

test("every Knowledge data-action routes to a command or a deterministic handler", () => {
	const html = render({
		branch: "test",
		memory: { initialized: false, staleCount: 1, unmemorizedCommitCount: 2 },
		formatStale: true,
		areas: [],
		memories: [],
	});
	const actions = new Set(
		[...html.matchAll(/data-action="([a-z-]+)"/g)].map((m) => m[1]),
	);
	assert.ok(actions.size >= 7, `expected the full control surface, got ${[...actions].join(", ")}`);
	// 'close' is handled deterministically by the extension (back to Work);
	// everything else must map to a /skill:… command.
	const DETERMINISTIC = new Set(["close"]);
	for (const action of actions) {
		if (DETERMINISTIC.has(action)) continue;
		assert.ok(
			actionToCommand({ type: "action", action, target: "x", prompt: "p" }),
			`data-action '${action}' has no command route`,
		);
	}
});

test("Knowledge maintenance controls route to their dedicated skills", () => {
	assert.equal(
		actionToCommand({ type: "action", action: "iterator-consolidate" }),
		"/skill:iterator-consolidate",
	);
	assert.equal(
		actionToCommand({ type: "action", action: "iterator-memorize" }),
		"/skill:iterator-memorize",
	);
});
