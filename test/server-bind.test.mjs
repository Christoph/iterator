/**
 * The dual-stack bind downgrade. BIND_HOST is a module constant, so the env
 * must be pinned before lib/server/listen.mjs loads — hence its own file
 * (node --test gives each file a fresh process). The fake server keeps these
 * off real sockets, so they behave the same on IPv6-less CI.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.ITERATOR_BIND_HOST = "::"; // what REMOTE resolves to
process.env.ITERATOR_NO_TAKEOVER = "1"; // never touch real processes here

const { listenWithTakeover } = await import("../lib/server/listen.mjs");

/**
 * A minimal http.Server stand-in. `fail(port, host)` returns an errno string
 * to reject that bind, or null to accept it; every attempt is recorded.
 */
function fakeServer(fail = () => null) {
	const handlers = new Map();
	return {
		attempts: [],
		bound: null,
		once(ev, cb) {
			handlers.set(ev, cb);
		},
		removeListener(ev) {
			handlers.delete(ev);
		},
		address() {
			return { port: this.bound };
		},
		listen(port, host, cb) {
			this.attempts.push({ host, port });
			const code = fail(port, host);
			if (code) {
				const err = new Error(`bind ${host}:${port} failed`);
				err.code = code;
				queueMicrotask(() => handlers.get("error")?.(err));
				return;
			}
			this.bound = port === 0 ? 45000 : port; // 0 = OS-picked ephemeral
			queueMicrotask(cb);
		},
	};
}

const noIpv6 = (_port, host) => (host === "::" ? "EAFNOSUPPORT" : null);

test("listenWithTakeover downgrades '::' to 0.0.0.0 where there is no IPv6 stack", async () => {
	const server = fakeServer(noIpv6);
	const port = await listenWithTakeover(server, { startPort: 7777, maxRetries: 2 });
	assert.equal(port, 7777, "binds rather than failing to start");
	assert.deepEqual(
		server.attempts,
		[
			{ host: "::", port: 7777 },
			{ host: "0.0.0.0", port: 7777 },
		],
		"dual-stack first, then downgrade on the same port — never drifts",
	);
});

test("every no-IPv6 errno downgrades; both families failing rejects, never loops", async () => {
	for (const code of ["EAFNOSUPPORT", "EPROTONOSUPPORT", "EADDRNOTAVAIL", "EINVAL"]) {
		const server = fakeServer((_p, host) => (host === "::" ? code : null));
		assert.equal(await listenWithTakeover(server, { startPort: 7777 }), 7777, code);
		assert.equal(server.attempts.length, 2, code);
	}
	const dead = fakeServer(() => "EAFNOSUPPORT"); // v4 fails too
	await assert.rejects(
		listenWithTakeover(dead, { startPort: 7777, maxRetries: 2 }),
		/bind 0\.0\.0\.0:7777 failed/,
		"the downgrade fires once, then the error propagates",
	);
	assert.deepEqual(dead.attempts, [
		{ host: "::", port: 7777 },
		{ host: "0.0.0.0", port: 7777 },
	]);
});

test("a healthy '::' bind is left alone", async () => {
	const server = fakeServer();
	assert.equal(await listenWithTakeover(server, { startPort: 7777 }), 7777);
	assert.deepEqual(server.attempts, [{ host: "::", port: 7777 }], "bind once, stop");
});

test("the walk-up keeps the downgraded family", async () => {
	// No IPv6 and the start port busy: downgrade, then walk up still on v4.
	const server = fakeServer((port, host) => {
		if (host === "::") return "EAFNOSUPPORT";
		return port === 7777 ? "EADDRINUSE" : null;
	});
	assert.equal(await listenWithTakeover(server, { startPort: 7777, maxRetries: 5 }), 7778);
	assert.deepEqual(server.attempts, [
		{ host: "::", port: 7777 },
		{ host: "0.0.0.0", port: 7777 },
		{ host: "0.0.0.0", port: 7778 },
	]);
});
