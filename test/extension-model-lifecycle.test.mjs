import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("dashboard dispatch identifies the active Agent", () => {
	const extension = readFileSync(
		new URL("../extensions/iterator.js", import.meta.url),
		"utf8",
	);
	assert.match(extension, /Dispatched \$\{cmd\} — Agent is working…/);
	assert.doesNotMatch(extension, /Dispatched \$\{cmd\} — Claude is working…/);
});

test("agent plan review completion converges the auto dashboard immediately", () => {
	const extension = readFileSync(
		new URL("../extensions/iterator.js", import.meta.url),
		"utf8",
	);
	assert.match(extension, /if \(result\?\.autoCompleted\)/);
	assert.match(extension, /await restoreModel\(\);\n\s+session\?\.clearWorking\?\.\(\);/);
	assert.match(extension, /await refreshHub\(ctx\.cwd, \{ activateWork: true \}\);/);
});

const require = createRequire(import.meta.url);
const extensionDependenciesAvailable = (() => {
	try {
		require.resolve("typebox");
		return true;
	} catch {
		return false;
	}
})();

async function iteratorExtension(pi) {
	const { default: register } = await import("../extensions/iterator.js");
	return register(pi);
}

function fixture(settings = {}) {
	const root = mkdtempSync(join(tmpdir(), "iterator-role-model-"));
	execFileSync("git", ["init", "--quiet"], { cwd: root });
	mkdirSync(join(root, "memory"), { recursive: true });
	writeFileSync(
		join(root, "memory", "plan.md"),
		"---\ntype: Plan\ntitle: Role model test\nstatus: approved\n---\n\n# Goal\nTest role models.\n",
	);
	writeFileSync(
		join(root, "memory", "settings.md"),
		`---\ntype: Settings\n${Object.entries(settings)
			.map(([key, value]) => `${key}: ${value}`)
			.join("\n")}\n---\n`,
	);
	writeFileSync(
		join(root, "memory", "state.md"),
		"---\ntype: State\nmode: manual\n---\n",
	);
	return root;
}

function mockPi() {
	const handlers = new Map();
	const setModels = [];
	const currentModel = { provider: "proxy", id: "managed" };
	const overrideModel = { provider: "openai", id: "override" };
	const pi = {
		on(name, handler) {
			handlers.set(name, handler);
		},
		registerCommand() {},
		registerTool() {},
		setThinkingLevel() {},
		async setModel(model) {
			setModels.push(model);
			return model !== overrideModel || pi.overrideSucceeds;
		},
	};
	return { pi, handlers, setModels, currentModel, overrideModel };
}

async function startTurn(handlers, root, modelRegistry, model) {
	await handlers.get("before_agent_start")(
		{},
		{
			cwd: root,
			hasUI: false,
			modelRegistry,
			model,
		},
	);
}

test("failed tester override does not restore or alter the following active implementer", {
	skip: !extensionDependenciesAvailable,
}, async () => {
	const root = fixture({ tester_model: "openai/override" });
	try {
		const { pi, handlers, setModels, currentModel, overrideModel } = mockPi();
		await iteratorExtension(pi);
		const registry = { find: () => overrideModel };

		await handlers.get("input")({
			text: "/iterator-test safe-role-model-handoff",
		});
		await startTurn(handlers, root, registry, currentModel);
		await handlers.get("agent_end")({}, { cwd: root, hasUI: false });

		await handlers.get("input")({
			text: "/iterator-implement safe-role-model-handoff",
		});
		await startTurn(handlers, root, registry, currentModel);
		await handlers.get("agent_end")({}, { cwd: root, hasUI: false });

		assert.deepEqual(setModels, [overrideModel]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("successful manual override restores once and a role input is consumed by one turn", {
	skip: !extensionDependenciesAvailable,
}, async () => {
	const root = fixture({ tester_model: "openai/override" });
	try {
		const { pi, handlers, setModels, currentModel, overrideModel } = mockPi();
		pi.overrideSucceeds = true;
		await iteratorExtension(pi);
		const registry = { find: () => overrideModel };

		await handlers.get("input")({
			text: "/iterator-test safe-role-model-handoff",
		});
		await startTurn(handlers, root, registry, currentModel);
		await startTurn(handlers, root, registry, currentModel);
		await handlers.get("agent_end")({}, { cwd: root, hasUI: false });

		assert.deepEqual(setModels, [overrideModel, currentModel]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("active role settings never call setModel", {
	skip: !extensionDependenciesAvailable,
}, async () => {
	const root = fixture({ implementer_model: "active" });
	try {
		const { pi, handlers, setModels, currentModel } = mockPi();
		await iteratorExtension(pi);

		await handlers.get("input")({
			text: "/iterator-implement safe-role-model-handoff",
		});
		await startTurn(handlers, root, { find: () => null }, currentModel);
		await handlers.get("agent_end")({}, { cwd: root, hasUI: false });

		assert.deepEqual(setModels, []);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
