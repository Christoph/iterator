import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionServer } from "../lib/session-server.mjs";

test("working overlay identifies AI work and remains scoped to Work", async () => {
	process.env.ITERATOR_REGISTRY = `/tmp/iterator-overlay-${Date.now()}.json`;
	const session = createSessionServer({ log: () => {} });
	try {
		const { url } = await session.start();
		const shell = await (await fetch(url)).text();
		assert.match(shell, /AI is working/);
		assert.match(shell, /tab === 'work' && working/);
		// The overlay lives inside the view stage, absolutely positioned, so it
		// can never cover the tab bar — Knowledge/Usage stay one click away.
		assert.match(shell, /#overlay\{position:absolute/);
		const nav = shell.indexOf("<nav");
		const stage = shell.indexOf('<main id="stage">');
		const overlay = shell.indexOf('<div id="overlay">');
		assert.ok(nav !== -1 && stage !== -1 && overlay > stage, "overlay nested in the stage, after the nav");
		assert.ok(nav < stage, "tab bar is a sibling above the stage, outside the overlay");
		// Wide viewports: overlay content is constrained and centered.
		assert.match(shell, /#overlay>\*\{max-width:min\(640px,92%\)\}/);
	} finally {
		await session.stop();
	}
});
