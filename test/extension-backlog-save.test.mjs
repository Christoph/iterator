import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
	new URL("../extensions/iterator.js", import.meta.url),
	"utf8",
);

test("backlog saves refresh stored dashboards without clearing active work", () => {
	const from = source.indexOf("const saveBacklog = async (input) => {");
	const to = source.indexOf("/** Persist the Usage tab", from);
	assert.notEqual(from, -1);
	assert.notEqual(to, -1);
	const section = source.slice(from, to);
	assert.match(
		section,
		/const preserveAgentWorking = session\?\.isWorking\?\.\(\) === true/,
	);
	assert.match(
		section,
		/if \(!preserveAgentWorking\) session\?\.clearWorking\?\.\(\);\s*await refreshHub\(cwd\);/,
	);
});
