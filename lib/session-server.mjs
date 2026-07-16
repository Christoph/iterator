/**
 * iterator: session-scoped UI server (pi extension mode).
 *
 * The one-shot server (./server.mjs serve()) lives for exactly one question:
 * render page → user answers → print JSON to stdout → exit. In pi the
 * extension owns the whole session, so this server starts once, keeps a
 * single browser tab open, and swaps views into it over SSE — the tab never
 * reloads, there is no takeover dance, and nothing orphans the port (the
 * server dies with the pi process).
 *
 * Page structure: GET / serves a thin persistent shell (a Work | Knowledge
 * tab bar, an <iframe>, and an EventSource); each step view — the same full
 * HTML documents the one-shot server uses — is served at GET /view?tab=… and
 * swapped in by bumping the iframe src when a `view` SSE event arrives (the
 * event names the tab, so agent-driven rounds pull the user to the right
 * one; manual switches are reported back via POST /tab). Because the iframe
 * is same-origin, the views' existing /submit + /cancel client code works
 * unchanged.
 *
 * Round model: at most one pending waiter (an awaited iterator_ui tool
 * call). Every round rotates the shared RUN_ID (./server.mjs newRunId())
 * *before* rendering, so the outgoing view's pagehide /cancel beacon —
 * fired when the iframe swaps — carries a stale id and is ignored. A
 * /submit with no waiter pending is an *unsolicited* user action (the agent
 * is idle, the user clicked something on the dashboard); it is handed to
 * the onUnsolicited callback, which the extension turns into a new turn.
 *
 * Registry/takeover compat: we register in the same per-user registry file
 * with mode:'session'; a concurrent legacy one-shot server sees that mode
 * via /__iterator/status and walks to another port instead of SIGTERMing
 * the pi process (see takeoverStale in ./server.mjs).
 */
import http from "node:http";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

import {
	BIND_HOST,
	CANCEL_GRACE_MS,
	EXPOSED,
	LOCAL_HOST_RE,
	REMOTE,
	RUN_ID,
	STATUS_PATH,
	TIMEOUT_MS,
	listenWithTakeover,
	newRunId,
	openBrowser,
	registryPath,
	takeoverStale,
} from "./server.mjs";

const MAX_PORT_RETRIES = 20;

/** Which shell tab a step's view renders into. */
export function tabFor(step) {
	if (step === "knowledge" || step === "memory-review") return "knowledge";
	if (step === "usage") return "usage";
	if (["planning", "plan", "feature", "archive"].includes(step))
		return "planning";
	return "work";
}

const TABS = ["planning", "work", "knowledge", "usage"];

/** The persistent shell page: tab bar + iframe + SSE client + overlay. */
function shellHtml(activeTab = "work") {
	const project = basename(process.cwd()) || "iterator";
	return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>iterator</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:#0d1117}
body{display:flex;flex-direction:column}
#tabs{display:flex;gap:4px;padding:6px 12px 0;background:#010409;border-bottom:1px solid #30363d;align-items:flex-end;position:relative}
#identity{position:absolute;left:50%;transform:translateX(-50%);display:flex;align-items:baseline;gap:2px;pointer-events:none;white-space:nowrap;font:600 14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#c9d1d9}
#identity .project{max-width:28vw;overflow:hidden;text-overflow:ellipsis}
#identity .context{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#8b949e}
#tabs button.tab{font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#8b949e;
  background:transparent;border:1px solid transparent;border-bottom:none;border-radius:6px 6px 0 0;
  padding:7px 18px;cursor:pointer}
#tabs button.tab.sel{color:#c9d1d9;background:#0d1117;border-color:#30363d}
#ctl{margin-left:auto;display:flex;align-items:center;gap:8px;padding-bottom:5px;
  font:12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#8b949e}
#ctl .chip{border:1px solid #30363d;border-radius:10px;padding:2px 9px;max-width:220px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ctl .chip.mode-auto{color:#3fb950;border-color:#238636}
#ctl .chip.mode-paused{color:#d29922;border-color:#9e6a03}
#ctl button{font:12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#c9d1d9;
  background:#21262d;border:1px solid #30363d;border-radius:6px;padding:3px 10px;cursor:pointer}
#ctl button:hover{border-color:#8b949e}
#ctl button#ctl-gear{padding:3px 8px}
#ctl .hidden{display:none}
#stage{position:relative;display:flex;flex:1;min-height:0}
iframe{display:block;width:100%;flex:1;border:0}
/* The overlay covers ONLY the view area (#stage) — never the tab bar, so
   Knowledge/Usage stay reachable while the agent works. */
#overlay{position:absolute;inset:0;display:none;align-items:center;justify-content:center;
  flex-direction:column;gap:12px;padding:24px;background:rgba(13,17,23,.82);color:#c9d1d9;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;z-index:50}
#overlay>*{max-width:min(640px,92%)}
#overlay .spin{width:22px;height:22px;border:3px solid #30363d;border-top-color:#388bfd;
  border-radius:50%;animation:r 1s linear infinite}
@keyframes r{to{transform:rotate(360deg)}}
#overlay-detail{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:#8b949e}
#overlay-bar{width:260px;height:6px;background:#21262d;border:1px solid #30363d;
  border-radius:4px;overflow:hidden}
#overlay-bar i{display:block;height:100%;background:#388bfd;width:0}
#overlay-mem{max-width:440px;width:90%;display:flex;flex-direction:column;gap:4px;
  font:12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:left}
#overlay-mem .mh{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#8b949e}
#overlay-mem .m{border:1px solid #30363d;border-radius:6px;padding:4px 8px;background:#161b22;color:#8b949e}
#overlay-mem .m b{color:#c9d1d9}
#overlay-mem .m .a{color:#388bfd;font-size:10px;text-transform:uppercase;margin-right:6px}
#overlay-note{font:11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#8b949e}
#overlay-btns{display:flex;gap:8px}
#overlay-btns button{font:12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#c9d1d9;
  background:#21262d;border:1px solid #30363d;border-radius:6px;padding:4px 14px;cursor:pointer}
#overlay-btns button:hover{border-color:#8b949e}
#overlay-btns button#ov-abort{color:#f85149;border-color:#6e2c28}
#overlay-btns button#ov-abort:hover{border-color:#f85149}
#conn{position:fixed;right:10px;bottom:10px;display:none;font:12px -apple-system,sans-serif;
  color:#d29922;background:#161b22;border:1px solid #30363d;border-radius:12px;padding:3px 10px;z-index:60}
</style>
</head>
<body>
<nav id="tabs">
<div id="identity" aria-label="Current dashboard location"><span class="project" id="project">${project}</span><span class="context" id="context">./planning</span></div>
<button class="tab" data-tab="planning">Planning</button>
<button class="tab" data-tab="work">Work</button>
<button class="tab" data-tab="knowledge">Knowledge</button>
<button class="tab" data-tab="usage">Usage</button>
<div id="ctl">
  <span class="chip hidden" id="ctl-plan" title="Active plan"></span>
  <span class="chip hidden" id="ctl-branch" title="Git branch"></span>
  <span class="chip hidden" id="ctl-mode"></span>
  <button class="hidden" id="ctl-pause"></button>
  <button id="ctl-gear" title="Project settings">&#9881;</button>
</div>
</nav>
<main id="stage">
<iframe id="v"></iframe>
<div id="overlay">
  <div class="spin"></div>
  <div id="overlay-text">AI is working…</div>
  <div id="overlay-detail" class="hidden"></div>
  <div id="overlay-bar" class="hidden"><i></i></div>
  <div id="overlay-mem" class="hidden"></div>
  <div id="overlay-note">Only the Work surface is blocked — Planning, Knowledge and Usage stay browsable in the other tabs meanwhile.</div>
  <div id="overlay-btns">
    <button id="ov-pause">Pause</button>
    <button id="ov-abort" title="Cancel the in-flight step and reset to a clean state">Abort</button>
  </div>
</div>
</main>
<div id="conn">reconnecting…</div>
<script>
const frame = document.getElementById('v');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlay-text');
const conn = document.getElementById('conn');
let tab = ${JSON.stringify(activeTab)};
let seq = 0;
let working = null; // structured working state { text, step?, feature?, progress?, memories? } | null
const escS = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function postWorking() {
  // Tell the iframe'd view whether the agent is busy, so non-Work tabs render
  // read-only (lib/ui.mjs toggles body.iterator-ro on this message).
  try { frame.contentWindow.postMessage({ iterator: 'working', working: !!working }, '*'); } catch (e) {}
}
function applyWorking() {
  postWorking();
  // The overlay blocks ONLY the Work tab — Knowledge/Usage stay browsable.
  if (!(tab === 'work' && working)) { overlay.style.display = 'none'; return; }
  overlayText.textContent = working.text || 'AI is working…';
  const det = document.getElementById('overlay-detail');
  const detText = [working.step, working.feature].filter(Boolean).join(' \\u00b7 ');
  det.classList.toggle('hidden', !detText);
  det.textContent = detText;
  const bar = document.getElementById('overlay-bar');
  const p = working.progress;
  const hasBar = p && p.total > 0;
  bar.classList.toggle('hidden', !hasBar);
  if (hasBar) bar.querySelector('i').style.width = Math.round(p.done / p.total * 100) + '%';
  const mem = document.getElementById('overlay-mem');
  const ms = Array.isArray(working.memories) ? working.memories : [];
  mem.classList.toggle('hidden', !ms.length);
  mem.innerHTML = ms.length
    ? '<div class="mh">Related memories</div>' + ms.slice(0, 6).map(m =>
        '<div class="m"><span class="a">' + escS((m.id || '').split('/')[0]) + '</span><b>' +
        escS(m.title || m.id) + '</b>' +
        (m.description ? '<div>' + escS(m.description) + '</div>' : '') + '</div>').join('')
    : '';
  document.getElementById('ov-pause').textContent = paused ? 'Continue' : 'Pause';
  overlay.style.display = 'flex';
}
function setTab(t, v) {
  tab = t;
  document.getElementById('context').textContent = './' + tab;
  document.querySelectorAll('#tabs button.tab').forEach(b => b.classList.toggle('sel', b.dataset.tab === t));
  frame.src = '/view?tab=' + t + '&v=' + (v != null ? v : 'u' + Date.now());
  applyWorking();
}
// A freshly loaded view missed earlier postMessages — re-send on load.
frame.addEventListener('load', postWorking);
document.querySelectorAll('#tabs button.tab').forEach(b => {
  b.addEventListener('click', () => {
    if (b.dataset.tab === tab) return;
    setTab(b.dataset.tab);
    // Tell the server where the user is looking, so idle refreshes of this
    // tab are pushed live instead of stored silently.
    fetch('/tab', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tab: b.dataset.tab }) }).catch(() => {});
  });
});
const es = new EventSource('/events');
es.addEventListener('view', e => {
  conn.style.display = 'none';
  working = null;
  const d = JSON.parse(e.data);
  setTab(d.tab || 'work', d.v);
});
es.addEventListener('working', e => {
  conn.style.display = 'none';
  const d = JSON.parse(e.data);
  working = (d && typeof d === 'object') ? d : { text: String(d || 'AI is working…') };
  applyWorking();
});
// Control strip: plan/branch/mode chips + pause/continue, fed by 'status'
// events; buttons post deterministic /control actions handled by the
// extension without a model turn.
let paused = false;
function ctlSet(id, text, show) {
  const el = document.getElementById(id);
  el.textContent = text || '';
  el.classList.toggle('hidden', !show);
}
es.addEventListener('status', e => {
  const s = JSON.parse(e.data || '{}');
  paused = !!s.paused;
  ctlSet('ctl-plan', s.plan, !!s.plan);
  ctlSet('ctl-branch', s.branch, !!s.branch);
  document.getElementById('context').textContent = './' + (tab || 'planning');
  const mode = document.getElementById('ctl-mode');
  if (s.phase === 'escalated' && s.escalation) {
    // Escalation outranks the normal auto chip: red, with the reason a
    // hover away — the hub view carries the full banner + recovery actions.
    mode.textContent = '\\u26a0 needs you' + (s.escalation.feature ? ' \\u00b7 ' + s.escalation.feature : '');
    mode.title = s.escalation.reason || '';
    mode.className = 'chip mode-paused';
    mode.classList.remove('hidden');
  } else if (s.mode === 'auto') {
    mode.textContent = paused ? 'auto · paused' : 'auto · ' + (s.phase || 'running');
    mode.title = '';
    mode.className = 'chip ' + (paused ? 'mode-paused' : 'mode-auto');
    mode.classList.remove('hidden');
  } else mode.classList.add('hidden');
  const pauseBtn = document.getElementById('ctl-pause');
  pauseBtn.textContent = paused ? 'Continue' : 'Pause';
  pauseBtn.classList.toggle('hidden', s.mode !== 'auto' && !paused);
  if (overlay.style.display === 'flex') applyWorking(); // keep ov-pause label fresh
});
function control(action) {
  fetch('/control', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }) }).catch(() => {});
}
document.getElementById('ctl-pause').addEventListener('click', () => control(paused ? 'continue' : 'pause'));
document.getElementById('ctl-gear').addEventListener('click', () => control('open-settings'));
document.getElementById('ov-pause').addEventListener('click', () => control(paused ? 'continue' : 'pause'));
document.getElementById('ov-abort').addEventListener('click', () => control('abort'));
es.onopen = () => { conn.style.display = 'none'; };
es.onerror = () => { conn.style.display = 'block'; };
setTab(tab, 0);
</script>
</body>
</html>`;
}

const PLACEHOLDER = `<!DOCTYPE html><html data-theme="dark"><head><meta charset="UTF-8"><style>
*{box-sizing:border-box;margin:0;padding:0}body{background:#0d1117;color:#8b949e;
font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;
height:100vh}</style></head><body><p>iterator — waiting for the next step…</p></body></html>`;

/**
 * Create the session server. Call start() once; then showStep()/showView()
 * per round. All methods are safe to call before start() except showStep.
 *
 * @param {object} o
 * @param {(result: object) => void} [o.onUnsolicited] user acted while no
 *   round was pending (agent idle) — receives the parsed /submit body.
 * @param {(action: object) => void} [o.onControl] control-strip / overlay
 *   click ({ action: 'pause'|'continue'|'open-settings'|'abort' }) — always
 *   deterministic, never a model turn (abort must work while the agent is
 *   stuck).
 * @param {(msg: string) => void} [o.log] diagnostic sink (default stderr).
 */
export function createSessionServer({ onUnsolicited, onControl, log } = {}) {
	const say = log || ((s) => process.stderr.write(`iterator: ${s}\n`));
	const regPath = registryPath();
	const sseClients = new Set();

	let server = null;
	let port = null;
	let seq = 0;
	let currentStep = "hub";
	let activeTab = "work"; // the tab the user is (last known) looking at
	const htmls = { planning: null, work: null, knowledge: null, usage: null }; // per-tab documents at GET /view
	let working = null; // { text, step?, feature?, progress?, memories? } | null while no view is interactive
	let pending = null; // { resolve, timer, onAbort, signal } | null
	let cancelTimer = null;
	let status = null; // last control-strip status, replayed on connect

	const broadcast = (event, data) => {
		const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
		for (const res of sseClients) {
			try {
				res.write(msg);
			} catch {}
		}
	};

	const stateEvent = () =>
		working != null
			? ["working", working]
			: ["view", { v: seq, tab: activeTab }];

	/** Resolve the pending round (if any) and detach its timers/signal. */
	const settle = (result) => {
		if (!pending) return false;
		const p = pending;
		pending = null;
		if (p.timer) clearTimeout(p.timer);
		if (p.signal && p.onAbort) p.signal.removeEventListener("abort", p.onAbort);
		p.resolve(result);
		return true;
	};

	const clearCancelGrace = () => {
		if (cancelTimer) {
			clearTimeout(cancelTimer);
			cancelTimer = null;
		}
	};

	const handler = (req, res) => {
		const url = new URL(req.url, "http://127.0.0.1");
		if (req.method === "GET" && url.pathname === STATUS_PATH) {
			// Tokenless read-only status; mode:'session' is what tells a legacy
			// one-shot server not to SIGTERM us (that pid is the agent process).
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					app: "iterator",
					mode: "session",
					step: currentStep,
					pid: process.pid,
				}),
			);
			return;
		}
		if (!EXPOSED && !LOCAL_HOST_RE.test(String(req.headers.host || ""))) {
			res.writeHead(403, { "Content-Type": "text/plain" });
			res.end("Forbidden");
			return;
		}
		if (req.method === "GET" && url.pathname === "/") {
			clearCancelGrace(); // a reload of the shell is not a cancel
			res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
			res.end(shellHtml(activeTab));
		} else if (req.method === "GET" && url.pathname === "/view") {
			clearCancelGrace(); // the view coming (back) up is not a cancel
			const tab = TABS.includes(url.searchParams.get("tab"))
				? url.searchParams.get("tab")
				: activeTab;
			res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
			res.end(htmls[tab] || PLACEHOLDER);
		} else if (req.method === "POST" && url.pathname === "/tab") {
			// The shell reports manual tab switches so idle refreshes of the
			// watched tab are pushed live instead of stored silently.
			let body = "";
			req.on("data", (c) => (body += c));
			req.on("end", () => {
				res.writeHead(204);
				res.end();
				try {
					const t = JSON.parse(body || "{}").tab;
					if (TABS.includes(t)) activeTab = t;
				} catch {}
			});
		} else if (req.method === "GET" && url.pathname === "/events") {
			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			});
			res.write(": connected\n\n");
			const [event, data] = stateEvent();
			res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
			if (status)
				res.write(`event: status\ndata: ${JSON.stringify(status)}\n\n`);
			const heartbeat = setInterval(() => {
				try {
					res.write(": ping\n\n");
				} catch {}
			}, 25_000);
			heartbeat.unref();
			sseClients.add(res);
			req.on("close", () => {
				clearInterval(heartbeat);
				sseClients.delete(res);
			});
		} else if (req.method === "POST" && url.pathname === "/submit") {
			// The run-id guard protects the pending ROUND from stale tabs; with no
			// round pending, every visible view (including the inactive tab's
			// stored document, whose embedded id is older) is a live dashboard —
			// its clicks are valid unsolicited actions.
			const r = url.searchParams.get("r");
			if (pending && r && r !== RUN_ID) {
				say("ignored /submit from a previous round’s view");
				res.writeHead(409);
				res.end();
				return;
			}
			let body = "";
			req.on("data", (c) => (body += c));
			req.on("end", () => {
				// Defense in depth: while the agent is busy (working state, no round
				// pending), an unsolicited dashboard action must not dispatch a second
				// concurrent model turn — a stale or JS-disabled tab bypasses the
				// client-side read-only guard.
				if (!pending && working != null) {
					say("rejected unsolicited /submit while working");
					res.writeHead(409, { "Content-Type": "application/json" });
					res.end('{"busy":true}');
					return;
				}
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end('{"ok":true}');
				let parsed;
				try {
					parsed = JSON.parse(body.trim() || "{}");
				} catch {
					parsed = {};
				}
				if (pending) {
					working = { text: "Sent to Claude — working…" };
					broadcast("working", working);
					settle(parsed);
				} else if (onUnsolicited) {
					onUnsolicited(parsed);
				}
			});
		} else if (req.method === "POST" && url.pathname === "/control") {
			// Control-strip clicks (pause/continue/open-settings): deterministic
			// session control, valid with or without a pending round.
			let body = "";
			req.on("data", (c) => (body += c));
			req.on("end", () => {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end('{"ok":true}');
				let parsed;
				try {
					parsed = JSON.parse(body.trim() || "{}");
				} catch {
					parsed = {};
				}
				if (parsed.action && onControl) onControl(parsed);
			});
		} else if (req.method === "POST" && url.pathname === "/cancel") {
			const r = url.searchParams.get("r");
			let body = "";
			req.on("data", (c) => (body += c));
			req.on("end", () => {
				res.writeHead(204);
				res.end();
				if (r && r !== RUN_ID) return; // an outgoing iframe's pagehide beacon
				if (!pending || cancelTimer) return;
				if (url.searchParams.get("now") === "1") {
					settle({ type: "cancel" });
					return;
				}
				// Held: a reload (GET / or /view) within the grace window keeps the
				// round alive; a really-closed tab lets the timer fire.
				cancelTimer = setTimeout(() => {
					cancelTimer = null;
					settle({ type: "cancel" });
				}, CANCEL_GRACE_MS);
			});
		} else {
			res.writeHead(404);
			res.end();
		}
	};

	// The EADDRINUSE walk-up (+ one-shot reclaim under force-port mode) is the
	// shared listen dance in ./server/listen.mjs.
	const listen = (startPort) => {
		server = http.createServer(handler);
		return listenWithTakeover(server, {
			startPort,
			maxRetries: MAX_PORT_RETRIES,
			say: (m) => say(m.trim()),
			onReclaimFail: (r, p) => {
				if (r.reason !== "session")
					say(
						`could not reclaim port ${p} — walking up (the dashboard may be unreachable through the sandbox's port publish)`,
					);
			},
		});
	};

	const writeRegistry = () => {
		try {
			writeFileSync(
				regPath,
				JSON.stringify({
					pid: process.pid,
					port,
					mode: "session",
					step: currentStep,
					started: new Date().toISOString(),
				}) + "\n",
				{ mode: 0o600 },
			);
		} catch {}
	};

	const api = {
		isRunning: () => Boolean(server && server.listening),
		hasPending: () => pending != null,

		async start() {
			if (api.isRunning()) return { port, url: `http://127.0.0.1:${port}/` };
			const startPort = parseInt(process.env.ITERATOR_PORT || "7777", 10);
			if (!process.env.ITERATOR_NO_TAKEOVER) await takeoverStale(regPath);
			port = await listen(startPort);
			writeRegistry();
			const url = `http://127.0.0.1:${port}/`;
			openBrowser(url);
			say(`session dashboard listening on ${url}`);
			if (REMOTE)
				say(
					`remote session — bound to ${BIND_HOST}; forward port ${port} to the host loopback`,
				);
			return { port, url };
		},

		/**
		 * Show a view and wait for the user's answer.
		 *
		 * @param {object} o
		 * @param {string} o.step    step name (status endpoint / logs)
		 * @param {() => string} o.render  builds the full HTML document; called
		 *   AFTER the run id rotates so the embedded __RUN matches this round.
		 * @param {AbortSignal} [o.signal] resolves the round {type:'cancel'} on abort
		 */
		showStep({ step, render, signal }) {
			settle({ type: "cancel" }); // a new round supersedes an unanswered one
			clearCancelGrace();
			newRunId();
			currentStep = step;
			activeTab = tabFor(step);
			htmls[activeTab] = render();
			working = null;
			seq += 1;
			writeRegistry();
			broadcast("view", { v: seq, tab: activeTab });
			return new Promise((resolve) => {
				const timer = setTimeout(() => settle({ type: "timeout" }), TIMEOUT_MS);
				timer.unref();
				let onAbort = null;
				if (signal) {
					onAbort = () => settle({ type: "cancel" });
					if (signal.aborted) {
						clearTimeout(timer);
						resolve({ type: "cancel" });
						return;
					}
					signal.addEventListener("abort", onAbort, { once: true });
				}
				pending = { resolve, timer, signal, onAbort };
			});
		},

		/**
		 * Push a view without waiting for an answer (idle dashboard refresh).
		 * Submits from such a view arrive as unsolicited actions. A refresh of
		 * the tab the user is NOT looking at is stored silently — they see the
		 * fresh document on their next tab switch (GET /view is uncached).
		 */
		showView({ step, render }) {
			const tab = tabFor(step);
			if (tab !== activeTab) {
				htmls[tab] = render();
				return;
			}
			settle({ type: "cancel" });
			clearCancelGrace();
			newRunId();
			currentStep = step;
			htmls[tab] = render();
			working = null;
			seq += 1;
			writeRegistry();
			broadcast("view", { v: seq, tab });
		},

		/**
		 * Cover the Work tab with a "working" overlay (no pending round). Accepts
		 * a plain string or a structured { text, step, feature, progress:{done,
		 * total}, memories:[{id,title,description}] } object — the shell renders
		 * whatever fields are present and posts read-only mode into other tabs.
		 */
		showWorking(textOrObj) {
			working =
				textOrObj && typeof textOrObj === "object"
					? { ...textOrObj, text: textOrObj.text || "AI is working…" }
					: { text: textOrObj || "AI is working…" };
			broadcast("working", working);
		},

		/**
		 * Drop the working state without pushing a new document (abort recovery —
		 * the overlay must never wedge even when no fresh view can be gathered).
		 * Broadcasts the current view so connected shells hide the overlay.
		 */
		clearWorking() {
			if (working == null) return;
			working = null;
			broadcast("view", { v: seq, tab: activeTab });
		},

		/**
		 * Update the control strip ({ plan, branch, mode, paused, phase }).
		 * Stored and replayed to newly connected shells.
		 */
		setStatus(next) {
			status = next && typeof next === "object" ? next : null;
			if (status) broadcast("status", status);
		},

		async stop() {
			settle({ type: "cancel" });
			clearCancelGrace();
			for (const res of sseClients) {
				try {
					res.end();
				} catch {}
			}
			sseClients.clear();
			if (server) {
				await new Promise((r) => server.close(r));
				server = null;
			}
			try {
				const cur = JSON.parse(readFileSync(regPath, "utf8"));
				if (cur && cur.pid === process.pid) unlinkSync(regPath);
			} catch {}
		},
	};

	return api;
}
