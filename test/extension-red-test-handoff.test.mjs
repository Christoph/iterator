import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
	new URL("../extensions/iterator.js", import.meta.url),
	"utf8",
);

test("committed tests intentionally refresh and activate Work", () => {
	const from = source.indexOf(
		'if (params.op === "commit-tests" && result?.ok)',
	);
	const to = source.indexOf("if (approved)", from);
	assert.notEqual(from, -1, "commit-tests handoff is registered");
	assert.notEqual(to, -1, "test handoff remains separate from plan approval");
	assert.match(
		source.slice(from, to),
		/refreshHub\(ctx\.cwd, \{ activateWork: true \}\)/,
	);
});
