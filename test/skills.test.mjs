import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = join(root, "skills");

/** Every markdown doc under skills/<name>/, keyed by its skill folder. */
function skillDocs() {
	const docs = [];
	for (const skill of readdirSync(skillsDir, { withFileTypes: true })) {
		if (!skill.isDirectory()) continue;
		const dir = join(skillsDir, skill.name);
		for (const f of readdirSync(dir)) {
			if (f.endsWith(".md")) docs.push({ skill: skill.name, dir, file: join(dir, f) });
		}
	}
	return docs;
}

// A `<skill-dir>`-anchored path reference (script invocation or doc pointer),
// as written in the SKILL.mds: <skill-dir>/../iterator/gather.mjs, <skill-dir>/PI.md, …
const REF_RE = /<skill-dir>(\/[A-Za-z0-9_./-]+)/g;

test("every <skill-dir> path in the skill docs points at an existing file", () => {
	const docs = skillDocs();
	assert.ok(docs.length >= 11, `expected the full skill set, found ${docs.length} docs`);
	const missing = [];
	for (const { skill, dir, file } of docs) {
		const text = readFileSync(file, "utf8");
		for (const m of text.matchAll(REF_RE)) {
			const target = resolve(dir, "." + m[1]);
			if (!existsSync(target)) missing.push(`${skill}: <skill-dir>${m[1]}`);
		}
	}
	assert.deepEqual(missing, [], `dangling references:\n${missing.join("\n")}`);
});

test("every SKILL.md references the shared pi-mode doc exactly once", () => {
	for (const { skill, file } of skillDocs()) {
		if (!file.endsWith("SKILL.md")) continue;
		const text = readFileSync(file, "utf8");
		const hits = text.match(/PI\.md/g) || [];
		// okf sub-skills inherit the pi pointer via PROTOCOL.md instead.
		const viaProtocol = /PROTOCOL\.md/.test(text);
		assert.ok(
			hits.length === 1 || viaProtocol,
			`${skill}/SKILL.md should point at PI.md once (or via PROTOCOL.md), found ${hits.length}`,
		);
	}
});

test("write.mjs ops named in the skill docs exist in the writer's schema table", () => {
	const schemas = readFileSync(join(root, "lib", "write.mjs"), "utf8");
	const ops = ["plan", "features", "update-feature", "apply-review", "retire-plan",
		"accept-commit", "commit-feature", "commit-tests", "refresh-format", "extensions"];
	for (const op of ops) {
		assert.ok(schemas.includes(`"${op}"`) || schemas.includes(`'${op}'`),
			`op ${op} referenced by the skills is missing from lib/write.mjs`);
	}
});
