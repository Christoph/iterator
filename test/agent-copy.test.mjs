import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ACTOR_SURFACES = [
	"extensions/iterator.js",
	"lib/server.mjs",
	"lib/ui.mjs",
	"lib/session-server.mjs",
	"lib/views/plan.mjs",
	"lib/views/feature.mjs",
	"lib/views/review.mjs",
	"lib/views/memory-review.mjs",
	"lib/views/question.mjs",
	"lib/views/test.mjs",
	"lib/views/widgets.mjs",
];

test("interactive surfaces use provider-neutral Agent wording", () => {
	for (const path of ACTOR_SURFACES) {
		const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
		assert.doesNotMatch(
			source,
			/\bClaude\b(?! Code)/,
			`${path} must reserve Claude for the explicit Claude Code product name`,
		);
		assert.match(source, /\bAgent\b/, `${path} identifies the active Agent`);
	}
});
