import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
	new URL("../extensions/iterator.js", import.meta.url),
	"utf8",
);

test("Work conflicts dispatch reviewed targeted decision updates", () => {
	const from = source.indexOf("const startConflictResolution = (result) => {");
	const to = source.indexOf("/**\n\t * Apply a role", from);
	assert.notEqual(from, -1);
	assert.notEqual(to, -1);
	const section = source.slice(from, to);
	assert.match(section, /\/skill:iterator-knowledge update-memory/);
	assert.match(section, /explicit memory verdict/);
	assert.match(section, /Re-check against anchored files/);
	assert.match(section, /re-check only \$\{feature\} against \$\{target\}/);
	assert.match(section, /preserving every unrelated feature and conflict flag/);
	assert.doesNotMatch(section, /iterator_write|runJson\(scriptPath\("write"\)/);
});

test("the dashboard intercepts conflict resolution before generic actions", () => {
	const marker = 'result.action === "resolve-memory-conflict"';
	const at = source.indexOf(marker);
	assert.notEqual(at, -1);
	const route = source.slice(at, at + 180);
	assert.match(route, /startConflictResolution\(result\)/);
});
