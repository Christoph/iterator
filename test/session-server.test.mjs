import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The session server runs in-process; env must be pinned BEFORE the lib
// modules load (CANCEL_GRACE_MS / REMOTE / BIND_HOST are module constants).
process.env.ITERATOR_NO_OPEN = "1";
process.env.ITERATOR_PORT = "0";
process.env.ITERATOR_REMOTE = "0";
process.env.ITERATOR_CANCEL_GRACE_MS = "250";
const CANCEL_GRACE_MS = 250;

const srvMod = await import("../lib/server.mjs"); // namespace: live RUN_ID binding
const { createSessionServer, tabFor } = await import(
	"../lib/session-server.mjs"
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Start a fresh session server on an ephemeral port + its own registry. */
async function startSession(opts = {}) {
	process.env.ITERATOR_REGISTRY = join(
		tmpdir(),
		`iterator-session-${randomUUID()}.json`,
	);
	const session = createSessionServer({ log: () => {}, ...opts });
	const { port, url } = await session.start();
	return {
		session,
		port,
		url,
		// Connect over IPv4 explicitly: the display URL says localhost, but the
		// server binds 127.0.0.1 and localhost may resolve to ::1 first.
		origin: `http://127.0.0.1:${port}`,
		registry: process.env.ITERATOR_REGISTRY,
	};
}

const viewHtml = (marker) =>
	`<!DOCTYPE html><html><body>${marker} run=${srvMod.RUN_ID}</body></html>`;

/** Read the first SSE event from /events. */
function firstSseEvent(origin) {
	return new Promise((resolve, reject) => {
		const req = http.get(`${origin}/events`, (res) => {
			let buf = "";
			res.on("data", (d) => {
				buf += d;
				const m = buf.match(/event: (\w+)\ndata: (.*)\n/);
				if (m) {
					try {
						const data = JSON.parse(m[2]);
						req.destroy();
						resolve({ event: m[1], data });
					} catch (error) {
						req.destroy();
						reject(error);
					}
				}
			});
		});
		req.on("error", () => {}); // destroyed on purpose
		setTimeout(() => reject(new Error("no SSE event")), 3000).unref();
	});
}

test("GET / serves the persistent shell (iframe + EventSource); status says session", async () => {
	const { session, origin } = await startSession();
	try {
		const shell = await (await fetch(origin + "/")).text();
		assert.ok(shell.includes("new EventSource('/events')"));
		assert.ok(shell.includes('<iframe id="v">'));
		assert.ok(
			shell.includes('data-tab="planning"'),
			"shell has a Planning tab",
		);
		assert.ok(shell.includes('data-tab="work"'), "shell has a Work tab");
		assert.ok(
			shell.includes('data-tab="knowledge"'),
			"shell has a Knowledge tab",
		);
		const status = await (await fetch(origin + "/__iterator/status")).json();
		assert.equal(status.app, "iterator");
		assert.equal(status.mode, "session");
		assert.equal(status.pid, process.pid);
	} finally {
		await session.stop();
	}
});

test("GET /view serves a placeholder before the first step", async () => {
	const { session, origin } = await startSession();
	try {
		const view = await (await fetch(origin + "/view")).text();
		assert.match(view, /waiting for the next step/);
	} finally {
		await session.stop();
	}
});

test("showStep pushes an SSE view event, serves the html, and resolves on /submit", async () => {
	const { session, origin } = await startSession();
	try {
		const round = session.showStep({
			step: "plan",
			render: () => viewHtml("PLAN-VIEW"),
		});
		const view = await (await fetch(origin + "/view")).text();
		assert.ok(view.includes("PLAN-VIEW"));
		const sse = await firstSseEvent(origin);
		assert.equal(sse.event, "view");

		const res = await fetch(`${origin}/submit?r=${srvMod.RUN_ID}`, {
			method: "POST",
			body: '{"type":"plan-approved"}',
		});
		assert.equal(res.status, 200);
		assert.deepEqual(await round, { type: "plan-approved" });
		// After a submit the dashboard shows the working overlay state.
		const after = await firstSseEvent(origin);
		assert.equal(after.event, "working");
	} finally {
		await session.stop();
	}
});

test("interactive submit resumes the same agent work owner", async () => {
	const { session, origin } = await startSession();
	try {
		const owner = session.ensureWorking({ text: "agent work", feature: "auth" });
		const round = session.showStep({
			step: "review",
			render: () => viewHtml("REVIEW"),
		});
		assert.equal(session.isWorking(), false, "the interactive view is usable");
		const res = await fetch(`${origin}/submit?r=${srvMod.RUN_ID}`, {
			method: "POST",
			body: '{"type":"accept-commit"}',
		});
		assert.equal(res.status, 200);
		assert.deepEqual(await round, { type: "accept-commit" });
		assert.equal(session.isWorking(), true, "work resumes after the answer");
		assert.equal(
			session.clearWorking(owner),
			true,
			"the original agent_end can release the resumed overlay",
		);
	} finally {
		await session.stop();
	}
});

test("a /submit with a stale run id is rejected and the round stays pending", async () => {
	const { session, origin } = await startSession();
	try {
		const round = session.showStep({
			step: "plan",
			render: () => viewHtml("X"),
		});
		const res = await fetch(`${origin}/submit?r=deadbeefdeadbeef`, {
			method: "POST",
			body: '{"type":"evil"}',
		});
		assert.equal(res.status, 409);
		assert.equal(session.hasPending(), true);
		await fetch(`${origin}/submit?r=${srvMod.RUN_ID}`, {
			method: "POST",
			body: '{"type":"ok"}',
		});
		assert.deepEqual(await round, { type: "ok" });
	} finally {
		await session.stop();
	}
});

test("a /submit with no pending round is handed to onUnsolicited (idle dashboard click)", async () => {
	let unsolicited = null;
	const { session, origin } = await startSession({
		onUnsolicited: (r) => (unsolicited = r),
	});
	try {
		session.showView({ step: "hub", render: () => viewHtml("HUB") });
		const res = await fetch(`${origin}/submit?r=${srvMod.RUN_ID}`, {
			method: "POST",
			body: '{"type":"action","action":"implement","feature":"auth"}',
		});
		assert.equal(res.status, 200);
		await sleep(20);
		assert.deepEqual(unsolicited, {
			type: "action",
			action: "implement",
			feature: "auth",
		});
	} finally {
		await session.stop();
	}
});

test("an idle Settings close is handed to onUnsolicited for Work-tab restoration", async () => {
	let unsolicited = null;
	const { session, origin } = await startSession({
		onUnsolicited: (r) => (unsolicited = r),
	});
	try {
		session.showView({ step: "settings", render: () => viewHtml("SETTINGS") });
		const res = await fetch(`${origin}/submit?r=${srvMod.RUN_ID}`, {
			method: "POST",
			body: '{"type":"cancel"}',
		});
		assert.equal(res.status, 200);
		await sleep(20);
		assert.deepEqual(unsolicited, { type: "cancel" });
	} finally {
		await session.stop();
	}
});

test("unsolicited /submit while working is rejected with 409 busy", async () => {
	let unsolicited = null;
	const { session, origin } = await startSession({
		onUnsolicited: (r) => (unsolicited = r),
	});
	try {
		session.showView({ step: "hub", render: () => viewHtml("HUB") });
		const owner = session.showWorking("Auto: implementing…");
		const res = await fetch(`${origin}/submit?r=${srvMod.RUN_ID}`, {
			method: "POST",
			body: '{"type":"action","action":"implement","feature":"auth"}',
		});
		assert.equal(res.status, 409);
		assert.deepEqual(await res.json(), { busy: true });
		await sleep(20);
		assert.equal(unsolicited, null, "busy dashboard must not dispatch");
		// An idle refresh updates underneath the overlay but cannot unblock Work.
		session.showView({ step: "hub", render: () => viewHtml("HUB2") });
		assert.equal(session.isWorking(), true);
		const stillBlocked = await fetch(`${origin}/submit?r=${srvMod.RUN_ID}`, {
			method: "POST",
			body: '{"type":"action","action":"implement","feature":"auth"}',
		});
		assert.equal(stillBlocked.status, 409);
		assert.equal(session.clearWorking(owner), true);
		const ok = await fetch(`${origin}/submit?r=${srvMod.RUN_ID}`, {
			method: "POST",
			body: '{"type":"action","action":"implement","feature":"auth"}',
		});
		assert.equal(ok.status, 200);
		await sleep(20);
		assert.deepEqual(unsolicited, {
			type: "action",
			action: "implement",
			feature: "auth",
		});
	} finally {
		await session.stop();
	}
});

test("backlog writes remain available while an agent is working", async () => {
	let unsolicited = null;
	const { session, origin } = await startSession({
		onUnsolicited: (r) => (unsolicited = r),
	});
	try {
		session.showView({ step: "planning", render: () => viewHtml("PLANNING") });
		session.showWorking("Auto: implementing…");
		const res = await fetch(`${origin}/submit?r=${srvMod.RUN_ID}`, {
			method: "POST",
			body: '{"type":"backlog","action":"create","title":"Next idea"}',
		});
		assert.equal(res.status, 200);
		await sleep(20);
		assert.deepEqual(unsolicited, {
			type: "backlog",
			action: "create",
			title: "Next idea",
		});
		assert.equal(
			session.isWorking(),
			true,
			"backlog writes preserve the active model guard",
		);
		const blocked = await fetch(`${origin}/submit?r=${srvMod.RUN_ID}`, {
			method: "POST",
			body: '{"type":"action","action":"implement","feature":"other"}',
		});
		assert.equal(blocked.status, 409);
		assert.deepEqual(await blocked.json(), { busy: true });
	} finally {
		await session.stop();
	}
});

test("showWorking accepts a structured payload and replays it to new SSE clients", async () => {
	const { session, origin } = await startSession();
	try {
		session.showWorking({
			text: "Auto: implement auth (1/3 done)…",
			step: "implement",
			feature: "auth",
			progress: { done: 1, total: 3 },
			activity: ["Reading lib/status.mjs…"],
		});
		session.showView({ step: "hub", render: () => viewHtml("LATEST HUB") });
		const sse = await firstSseEvent(origin);
		assert.equal(sse.event, "working");
		assert.equal(sse.data.step, "implement");
		assert.equal(sse.data.feature, "auth");
		assert.deepEqual(sse.data.progress, { done: 1, total: 3 });
		assert.equal(sse.data.activity[0], "Reading lib/status.mjs…");
		assert.match(
			await (await fetch(`${origin}/view?tab=work`)).text(),
			/LATEST HUB/,
			"the newest view waits underneath the replayed overlay",
		);
	} finally {
		await session.stop();
	}
});

test("a stale work owner cannot clear a newer agent overlay", async () => {
	const { session, origin } = await startSession();
	try {
		const first = session.showWorking({ text: "first agent", feature: "a" });
		assert.equal(session.ensureWorking(), first, "the active agent keeps its claim");
		const second = session.showWorking({ text: "second agent", feature: "b" });
		assert.notEqual(second, first);
		assert.equal(session.clearWorking(first), false);
		assert.equal(session.isWorking(), true);
		const sse = await firstSseEvent(origin);
		assert.equal(sse.event, "working");
		assert.equal(sse.data.feature, "b");
		assert.equal(session.clearWorking(second), true);
		assert.equal(session.isWorking(), false);
	} finally {
		await session.stop();
	}
});

test("pushActivity keeps the last two lines newest-first and replays them", async () => {
	const { session, origin } = await startSession();
	try {
		session.showWorking({ text: "Auto: implement auth…", step: "implement" });
		session.pushActivity("first");
		session.pushActivity("second");
		session.pushActivity("second"); // a repeat must not push the previous line out
		session.pushActivity("third");
		session.pushActivity("   "); // blank lines are not activity
		// firstSseEvent connects after the pushes, so this is the replay path too.
		const sse = await firstSseEvent(origin);
		assert.equal(sse.event, "working");
		assert.deepEqual(sse.data.activity, ["third", "second"]);
		assert.equal(
			sse.data.text,
			"Auto: implement auth…",
			"the step header survives",
		);
	} finally {
		await session.stop();
	}
});

test("a new working step never inherits the last one's activity", async () => {
	const { session, origin } = await startSession();
	try {
		session.showWorking({ text: "step one", feature: "a" });
		session.pushActivity("a's line");
		session.showWorking({ text: "step two", feature: "b" });
		const sse = await firstSseEvent(origin);
		assert.equal(sse.data.text, "step two");
		assert.equal(sse.data.activity, undefined);
	} finally {
		await session.stop();
	}
});

test("pushActivity never resurrects a cleared overlay", async () => {
	const { session, origin } = await startSession();
	try {
		session.showView({ step: "hub", render: () => viewHtml("HUB") });
		session.showWorking("working…");
		session.clearWorking();
		session.pushActivity("a message landing after the abort");
		const sse = await firstSseEvent(origin);
		assert.equal(sse.event, "view", "the overlay stays dismissed");
	} finally {
		await session.stop();
	}
});

test("the shell scopes the overlay to the Work tab and posts read-only state into views", async () => {
	const { session, origin } = await startSession();
	try {
		const shell = await (await fetch(origin + "/")).text();
		assert.ok(
			shell.includes("tab === 'work' && working"),
			"overlay guarded by active tab",
		);
		assert.ok(
			shell.includes("navigator.sendBeacon('/cancel'"),
			"the persistent shell owns cancellation when the dashboard unloads",
		);
		assert.ok(
			shell.includes("postMessage({ iterator: 'working'"),
			"read-only state posted into the iframe",
		);
		assert.ok(shell.includes('id="ov-abort"'), "overlay has an Abort control");
		assert.ok(shell.includes('id="ov-pause"'), "overlay has a Pause control");
	} finally {
		await session.stop();
	}
});

test("a second showStep supersedes the first, and the old view's cancel beacon is ignored", async () => {
	const { session, origin } = await startSession();
	try {
		const first = session.showStep({
			step: "plan",
			render: () => viewHtml("ONE"),
		});
		const oldRun = srvMod.RUN_ID;
		const second = session.showStep({
			step: "feature",
			render: () => viewHtml("TWO"),
		});
		assert.deepEqual(
			await first,
			{ type: "cancel" },
			"superseded round resolves as cancel",
		);
		assert.notEqual(srvMod.RUN_ID, oldRun, "run id must rotate per round");

		// The outgoing iframe fires its pagehide beacon with the OLD id — ignored.
		await fetch(`${origin}/cancel?r=${oldRun}`, { method: "POST", body: "{}" });
		await sleep(CANCEL_GRACE_MS + 100);
		assert.equal(
			session.hasPending(),
			true,
			"live round must survive the stale beacon",
		);

		await fetch(`${origin}/submit?r=${srvMod.RUN_ID}`, {
			method: "POST",
			body: '{"type":"ok"}',
		});
		assert.deepEqual(await second, { type: "ok" });
	} finally {
		await session.stop();
	}
});

test("cancel grace: a reload (GET /view) keeps the round; ?now=1 cancels immediately", async () => {
	const { session, origin } = await startSession();
	try {
		const round = session.showStep({
			step: "plan",
			render: () => viewHtml("X"),
		});
		await fetch(`${origin}/cancel?r=${srvMod.RUN_ID}`, {
			method: "POST",
			body: "{}",
		});
		await fetch(origin + "/view"); // the reloaded iframe arrives within the grace window
		await sleep(CANCEL_GRACE_MS + 100);
		assert.equal(
			session.hasPending(),
			true,
			"reload must not cancel the round",
		);

		await fetch(`${origin}/cancel?r=${srvMod.RUN_ID}&now=1`, {
			method: "POST",
			body: "{}",
		});
		assert.deepEqual(await round, { type: "cancel" });
	} finally {
		await session.stop();
	}
});

test("explicit cancel pre-empts a pending pagehide grace timer", async () => {
	const { session, origin } = await startSession();
	try {
		const round = session.showStep({
			step: "review",
			render: () => viewHtml("REVIEW"),
		});
		await fetch(`${origin}/cancel?r=${srvMod.RUN_ID}`, {
			method: "POST",
			body: "{}",
		});
		await fetch(`${origin}/cancel?r=${srvMod.RUN_ID}&now=1`, {
			method: "POST",
			body: "{}",
		});
		assert.deepEqual(
			await Promise.race([
				round,
				sleep(100).then(() => ({ type: "too-slow" })),
			]),
			{ type: "cancel" },
		);
	} finally {
		await session.stop();
	}
});

test("an aborted signal resolves the round as cancel", async () => {
	const { session } = await startSession();
	try {
		const ac = new AbortController();
		const round = session.showStep({
			step: "plan",
			render: () => viewHtml("X"),
			signal: ac.signal,
		});
		ac.abort();
		assert.deepEqual(await round, { type: "cancel" });
		assert.equal(session.hasPending(), false);
	} finally {
		await session.stop();
	}
});

test("stop() resolves a pending round, frees the port, and removes the registry entry", async () => {
	const { session, origin, port, registry } = await startSession();
	const round = session.showStep({ step: "plan", render: () => viewHtml("X") });
	await session.stop();
	assert.deepEqual(await round, { type: "cancel" });
	assert.equal(session.isRunning(), false);
	assert.equal(
		existsSync(registry),
		false,
		"registry entry must be cleaned up",
	);
	await assert.rejects(
		() => fetch(origin + "/view"),
		undefined,
		`port ${port} must be free`,
	);
});

test("showView can intentionally activate Planning for the startup landing page", async () => {
	const { session, origin } = await startSession();
	try {
		session.showView({
			step: "planning",
			render: () => viewHtml("PLANLESS-PLANNING"),
			activate: true,
		});
		const sse = await firstSseEvent(origin);
		assert.equal(sse.event, "view");
		assert.equal(sse.data.tab, "planning");
		assert.ok(
			(await (await fetch(origin + "/view?tab=planning")).text()).includes(
				"PLANLESS-PLANNING",
			),
		);
		assert.ok((await (await fetch(origin + "/")).text()).includes('let tab = "planning"'));
	} finally {
		await session.stop();
	}
});

test("tabs: steps render into their tab; inactive-tab refreshes are stored silently", async () => {
	const { session, origin } = await startSession();
	try {
		// A knowledge round lands on the knowledge tab and directs the shell there.
		const round = session.showStep({
			step: "knowledge",
			render: () => viewHtml("KNOWLEDGE-VIEW"),
		});
		const sse = await firstSseEvent(origin);
		assert.equal(sse.event, "view");
		assert.equal(sse.data.tab, "knowledge");
		const kView = await (await fetch(origin + "/view?tab=knowledge")).text();
		assert.ok(kView.includes("KNOWLEDGE-VIEW"));
		assert.match(
			await (await fetch(origin + "/view?tab=work")).text(),
			/waiting for the next step/,
			"work tab untouched",
		);
		await fetch(`${origin}/submit?r=${srvMod.RUN_ID}`, {
			method: "POST",
			body: '{"type":"cancel"}',
		});
		await round;

		// With knowledge active, a hub refresh is stored silently (no broadcast,
		// no run-id rotation) but served on the next work-tab fetch.
		const runBefore = srvMod.RUN_ID;
		session.showView({ step: "hub", render: () => viewHtml("HUB-VIEW") });
		assert.equal(
			srvMod.RUN_ID,
			runBefore,
			"silent store must not rotate the run id",
		);
		assert.ok(
			(await (await fetch(origin + "/view?tab=work")).text()).includes(
				"HUB-VIEW",
			),
		);
		assert.ok(
			(await (await fetch(origin + "/view?tab=knowledge")).text()).includes(
				"KNOWLEDGE-VIEW",
			),
		);

		// The shell reports a manual switch; the work tab becomes active.
		await fetch(origin + "/tab", { method: "POST", body: '{"tab":"work"}' });
		const shell = await (await fetch(origin + "/")).text();
		assert.ok(shell.includes('let tab = "work"'));
	} finally {
		await session.stop();
	}
});

test("review survives Planning navigation and can submit after returning to Work", async () => {
	const { session, origin } = await startSession();
	try {
		// Seed the inactive Planning tab, then open an interactive review round
		// on Work. Switching the shell's iframe between them is navigation only.
		session.showView({ step: "planning", render: () => viewHtml("PLANNING") });
		const round = session.showStep({
			step: "review",
			render: () => viewHtml("ACTIVE-REVIEW"),
		});
		const reviewRun = srvMod.RUN_ID;

		await fetch(origin + "/tab", {
			method: "POST",
			body: '{"tab":"planning"}',
		});
		assert.match(
			await (await fetch(origin + "/view?tab=planning")).text(),
			/PLANNING/,
		);
		await fetch(origin + "/tab", {
			method: "POST",
			body: '{"tab":"work"}',
		});
		assert.match(
			await (await fetch(origin + "/view?tab=work")).text(),
			/ACTIVE-REVIEW/,
		);
		assert.equal(
			srvMod.RUN_ID,
			reviewRun,
			"navigation preserves round identity",
		);
		assert.equal(session.hasPending(), true, "review remains pending");

		const response = await fetch(`${origin}/submit?r=${reviewRun}`, {
			method: "POST",
			body: '{"type":"review-feedback","features":[]}',
		});
		assert.equal(response.status, 200);
		assert.deepEqual(await round, {
			type: "review-feedback",
			features: [],
		});
	} finally {
		await session.stop();
	}
});

test("an idle submit from a stale-run view still dispatches as unsolicited", async () => {
	let unsolicited = null;
	const { session, origin } = await startSession({
		onUnsolicited: (r) => (unsolicited = r),
	});
	try {
		session.showView({ step: "hub", render: () => viewHtml("HUB") });
		// The knowledge tab's stored document embeds an older run id; with no
		// round pending its clicks must still count.
		const res = await fetch(`${origin}/submit?r=deadbeefdeadbeef`, {
			method: "POST",
			body: '{"type":"action","action":"iterator-memorize"}',
		});
		assert.equal(res.status, 200);
		await sleep(20);
		assert.deepEqual(unsolicited, {
			type: "action",
			action: "iterator-memorize",
		});
	} finally {
		await session.stop();
	}
});

test("an idle backlog submission is forwarded without unrelated dashboard state", async () => {
	let unsolicited = null;
	const { session, origin } = await startSession({
		onUnsolicited: (r) => (unsolicited = r),
	});
	try {
		session.showView({ step: "hub", render: () => viewHtml("HUB") });
		const payload = {
			type: "backlog",
			action: "select",
			id: "fix-shell",
			selected: true,
		};
		const res = await fetch(`${origin}/submit`, {
			method: "POST",
			body: JSON.stringify(payload),
		});
		assert.equal(res.status, 200);
		await sleep(20);
		assert.deepEqual(unsolicited, payload);
	} finally {
		await session.stop();
	}
});

test("a legacy one-shot takeover pass leaves the session server alive (mode guard)", async () => {
	const { session, origin, registry } = await startSession();
	try {
		// Simulate what a concurrently-launched one-shot server does before
		// binding: read the registry, probe the holder, and (normally) kill it.
		await srvMod.takeoverStale(registry);
		assert.equal(
			session.isRunning(),
			true,
			"session server must never be killed",
		);
		assert.equal(existsSync(registry), true, "registry entry must survive");
		const status = await (await fetch(origin + "/__iterator/status")).json();
		assert.equal(status.mode, "session");
	} finally {
		await session.stop();
	}
});

test("POST /control routes control-strip actions to onControl", async () => {
	const controls = [];
	const { session, origin } = await startSession({
		onControl: (a) => controls.push(a),
	});
	try {
		await fetch(origin + "/control", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "pause" }),
		});
		await fetch(origin + "/control", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "open-settings" }),
		});
		await sleep(50);
		assert.deepEqual(
			controls.map((c) => c.action),
			["pause", "open-settings"],
		);
	} finally {
		await session.stop();
	}
});

test("setStatus broadcasts a status SSE event and replays it to new connections", async () => {
	const { session, origin } = await startSession();
	try {
		session.setStatus({
			plan: "Add JWT auth",
			branch: "main",
			mode: "auto",
			paused: false,
			phase: "implementing",
		});
		// A shell connecting AFTER the status was set still receives it (replay).
		const events = await new Promise((resolve, reject) => {
			const out = [];
			const req = http.get(`${origin}/events`, (res) => {
				let buf = "";
				res.on("data", (d) => {
					buf += d;
					for (const m of buf.matchAll(/event: (\w+)\ndata: (.*)\n/g)) {
						out.push({ event: m[1], data: JSON.parse(m[2]) });
					}
					if (out.length >= 2) {
						req.destroy();
						resolve(out);
					}
				});
			});
			req.on("error", () => {});
			setTimeout(() => reject(new Error("no status event")), 3000).unref();
		});
		const status = events.find((e) => e.event === "status");
		assert.ok(status, "status event replayed on connect");
		assert.equal(status.data.plan, "Add JWT auth");
		assert.equal(status.data.phase, "implementing");

		const shell = await (await fetch(origin + "/")).text();
		assert.ok(
			shell.includes('id="identity"'),
			"shell carries the centered project identity",
		);
		assert.ok(
			shell.includes('id="project"'),
			"identity receives the working-directory name",
		);
		assert.ok(shell.includes("'./' + tab"), "identity follows the active tab");
		assert.ok(
			shell.includes('id="ctl-pause"'),
			"shell carries the control strip",
		);
		assert.ok(shell.includes("'/control'"), "strip posts to /control");
	} finally {
		await session.stop();
	}
});

test("tabFor maps steps to their shell tabs", () => {
	assert.equal(tabFor("planning"), "planning");
	assert.equal(tabFor("plan"), "planning");
	assert.equal(tabFor("feature"), "planning");
	assert.equal(tabFor("archive"), "planning");
	assert.equal(tabFor("hub"), "work");
	assert.equal(tabFor("test"), "work");
	assert.equal(tabFor("review"), "work");
	assert.equal(tabFor("settings"), "work");
	assert.equal(tabFor("question"), "work");
	assert.equal(tabFor("knowledge"), "knowledge");
	assert.equal(tabFor("memory-review"), "knowledge");
	assert.equal(tabFor("usage"), "usage");
});
