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

test("role switching accepts modern void success and preserves runtime matches", () => {
	const extension = readFileSync(
		new URL("../extensions/iterator.js", import.meta.url),
		"utf8",
	);
	assert.match(extension, /resolveRoleModel\(/);
	assert.match(extension, /if \(modelSwitchSucceeded\(result\)\)/);
	assert.match(extension, /else if \(target\.switchRequired\)/);
});

test("saving settings refuses unusable role models before the writer runs", () => {
	const extension = readFileSync(
		new URL("../extensions/iterator.js", import.meta.url),
		"utf8",
	);
	assert.match(extension, /classifyRoleModel\(/);
	// The guard must precede the write and return, never merely warn.
	const save = extension.slice(extension.indexOf("const saveSettings"));
	const guard = save.indexOf("unusableRoleModels");
	const write = save.indexOf('op: "settings"');
	assert.ok(guard !== -1 && guard < write, "validation must gate the write");
	assert.match(save.slice(guard, write), /return;/);
});

test("the settings step awaits the model registry so fields stay dropdowns", () => {
	const extension = readFileSync(
		new URL("../extensions/iterator.js", import.meta.url),
		"utf8",
	);
	// An unawaited modelOptions() assigns a Promise, which is truthy but fails
	// the view's Array.isArray guard — the model fields silently degrade to a
	// free-text box where a wrong provider prefix reaches the provider as a 401.
	assert.match(extension, /const models = await modelOptions\(\);/);
	assert.doesNotMatch(extension, /const models = modelOptions\(\);/);
});

test("agent plan review completion converges the auto dashboard immediately", () => {
	const extension = readFileSync(
		new URL("../extensions/iterator.js", import.meta.url),
		"utf8",
	);
	assert.match(extension, /if \(result\?\.autoCompleted\)/);
	assert.match(
		extension,
		/await restoreModel\(\);\n\s+session\?\.clearWorking\?\.\(\);/,
	);
	assert.match(
		extension,
		/const \{ settings \} = await gatherSession\(ctx\.cwd\);/,
	);
	assert.match(extension, /notifyUi\(autoCompleteMessage\(settings\)\);/);
	assert.match(
		extension,
		/await refreshHub\(ctx\.cwd, \{ activateWork: true \}\);/,
	);
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
			if (model === overrideModel && pi.overrideError) {
				throw new Error("model auth unavailable");
			}
			if (model === overrideModel && pi.overrideReturnsFalse) return false;
			// Current Pi resolves void on success.
			return undefined;
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
		pi.overrideReturnsFalse = true;
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

test("void-returning manual override restores once and a role input is consumed by one turn", {
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
		await startTurn(handlers, root, registry, currentModel);
		await handlers.get("agent_end")({}, { cwd: root, hasUI: false });

		assert.deepEqual(setModels, [overrideModel, currentModel]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("configured active identity keeps the runtime proxy model object", {
	skip: !extensionDependenciesAvailable,
}, async () => {
	const root = fixture({ tester_model: "proxy/managed" });
	try {
		const { pi, handlers, setModels, currentModel } = mockPi();
		await iteratorExtension(pi);
		const registryModel = {
			provider: "proxy",
			id: "managed",
			baseUrl: "https://direct-provider.invalid",
		};

		await handlers.get("input")({
			text: "/iterator-test preserve-runtime-role-model",
		});
		await startTurn(
			handlers,
			root,
			{ find: () => registryModel },
			{ ...currentModel, baseUrl: "https://managed-proxy.test" },
		);
		await handlers.get("agent_end")({}, { cwd: root, hasUI: false });

		assert.deepEqual(setModels, []);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("thrown model switch failure never arms restoration", {
	skip: !extensionDependenciesAvailable,
}, async () => {
	const root = fixture({ tester_model: "openai/override" });
	try {
		const { pi, handlers, setModels, currentModel, overrideModel } = mockPi();
		pi.overrideError = true;
		await iteratorExtension(pi);

		await handlers.get("input")({
			text: "/iterator-test preserve-runtime-role-model",
		});
		await startTurn(
			handlers,
			root,
			{ find: () => overrideModel },
			currentModel,
		);
		await handlers.get("agent_end")({}, { cwd: root, hasUI: false });

		assert.deepEqual(setModels, [overrideModel]);
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
