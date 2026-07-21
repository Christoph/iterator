import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { dispatchAfterRefresh } from "../lib/dashboard-dispatch.mjs";

const source = readFileSync(
	new URL("../extensions/iterator.js", import.meta.url),
	"utf8",
);

function sourceSection(start, end) {
	const from = source.indexOf(start);
	const to = source.indexOf(end, from + start.length);
	assert.notEqual(from, -1, `missing section start: ${start}`);
	assert.notEqual(to, -1, `missing section end: ${end}`);
	return source.slice(from, to);
}

test("accepted feature breakdown intentionally activates Work", () => {
	const section = sourceSection(
		"// Issue 5: auto mode starts right after the feature set is approved",
		'pi.registerTool({\n\t\tname: "okf_write"',
	);
	assert.match(section, /const approved\s*=/);
	assert.match(
		section,
		/if \(approved\) \{\s*void refreshHub\(ctx\.cwd, \{ activateWork: true \}\);/,
	);
});

test("starting a plan from Planning intentionally activates Work", () => {
	const from = source.indexOf("const cmd = actionToCommand(result);");
	assert.notEqual(from, -1);
	const section = source.slice(from, from + 800);
	assert.match(section, /if \(result\.action === "plan"\)/);
	assert.match(section, /dispatchAfterRefresh\(/);
	assert.match(
		section,
		/\(\) => refreshHub\(ctxCwd\(\), \{ activateWork: true \}\)/,
	);
	assert.match(
		section,
		/session\.showWorking\(`Dispatched \$\{cmd\} — Agent is working…`\);\n\s*dispatch\(cmd\);/,
	);
});

test("plan dispatch survives a failed Work refresh exactly once", async () => {
	const calls = [];
	await dispatchAfterRefresh(
		async () => {
			calls.push("refresh");
			throw new Error("gather failed");
		},
		() => calls.push("dispatch"),
		(error) => calls.push(`warning: ${error.message}`),
	);
	assert.deepEqual(calls, ["refresh", "warning: gather failed", "dispatch"]);
});

test("plan dispatch survives a broken refresh reporter", async () => {
	let dispatched = 0;
	await dispatchAfterRefresh(
		async () => {
			throw new Error("gather failed");
		},
		() => {
			dispatched += 1;
		},
		() => {
			throw new Error("notification failed");
		},
	);
	assert.equal(dispatched, 1);
});

test("approved plan application intentionally activates Work", () => {
	const section = sourceSection(
		"// Apply-on-approve (mirrors lib/app.mjs)",
		"return asText(result);",
	);
	assert.match(section, /result\?\.type === "plan-approved"/);
	assert.match(
		section,
		/if \(applied\?\.ok\) await refreshHub\(ctx\.cwd, \{ activateWork: true \}\);/,
	);
});
