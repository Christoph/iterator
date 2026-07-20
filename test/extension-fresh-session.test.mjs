import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const extensionDependenciesAvailable = (() => {
	try {
		require.resolve("typebox");
		return true;
	} catch {
		return false;
	}
})();

async function loadExtension() {
	const { default: register } = await import("../extensions/iterator.js");
	return register;
}

function mockPi() {
	const commands = new Map();
	return {
		pi: {
			on() {},
			registerTool() {},
			registerCommand(name, definition) {
				commands.set(name, definition);
			},
			sendUserMessage() {},
			setThinkingLevel() {},
			async setModel() {
				return true;
			},
		},
		commands,
	};
}

test("iterator-implement starts a clean replacement session with only its feature command", {
	skip: !extensionDependenciesAvailable,
}, async () => {
	const { pi, commands } = mockPi();
	const register = await loadExtension();
	register(pi);
	const marker = [];
	const sent = [];
	const ctx = {
		hasUI: true,
		sessionManager: { getSessionFile: () => "/tmp/parent.jsonl" },
		async newSession(options) {
			assert.equal(options.parentSession, "/tmp/parent.jsonl");
			await options.setup({
				appendCustomEntry(type, data) {
					marker.push({ type, data });
				},
			});
			await options.withSession({
				async sendUserMessage(command) {
					sent.push(command);
				},
			});
			return { cancelled: false };
		},
	};

	await commands.get("iterator-implement").handler("auth --auto", ctx);

	assert.deepEqual(sent, ["/skill:iterator-implement auth --auto"]);
	assert.deepEqual(marker, [
		{
			type: "iterator-implementation-handoff",
			data: {
				feature: "auth",
				auto: true,
				autoSteps: 0,
				featureWave: null,
			},
		},
	]);
});
