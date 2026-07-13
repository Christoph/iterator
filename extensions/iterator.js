/**
 * iterator: pi extension — session dashboard, first-class tools, guardrails,
 * ambient context, footer status.
 *
 * What this registers on top of the friendly commands (incl. the /okf* four):
 *
 * Tools (mechanical scripts as real tools; typebox-validated, structured
 * results, writer validation errors surface as tool errors):
 *   iterator_gather  { step, chunk? }        → the step payload (JSON)
 *   iterator_write   { op, ... }             → write.mjs result
 *   okf_write        { mode, memories, decisions, headCommit? }
 *                                            → apply-review result (schema-tight)
 *   iterator_ui      { step, chunk?, extra? } → the user's answer
 *
 * Ambient context (before_agent_start): each turn opens with the flow state
 * plus knowledge concepts anchored to recently touched files (display:false,
 * deduped). Footer (ctx.ui.setStatus): `⛭ 3/7 · next: … · 🧠 N unmemorized`,
 * refreshed on session_start/agent_end/write ops, with an /okf-memorize
 * nudge once the unmemorized count passes ITERATOR_MEMORIZE_NUDGE (default
 * 5, 0 disables).
 *
 * iterator_ui gathers the payload ITSELF (spawning gather.mjs) and only
 * merges the small agent-authored `extra` on top — the model never pipes
 * gathered/chunk payloads around. The view lands in a session-scoped
 * dashboard (lib/session-server.mjs): one browser tab for the whole pi
 * session, views swapped over SSE, started on session_start when a bundle
 * exists (else lazily), stopped on session_shutdown. While the agent is
 * idle the hub stays clickable — an unsolicited click (e.g. "Implement
 * chunk X") is dispatched as a /skill:iterator-* turn.
 *
 * Guardrails (lib/guardrails.mjs): direct Write/Edit to writer-owned chunk
 * frontmatter is blocked/warned with a pointer at the update-chunk op, and
 * a `git commit` without a `Chunk: <slug>` trailer warns while a chunk is
 * in flight. Body-text edits stay allowed — hand-editability is a feature.
 */
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { Type } from "typebox";

import { matchConcepts, OKF_AREA_NAMES } from "../lib/bundle.mjs";
import {
	checkBashCommit,
	checkEdit,
	checkWrite,
	isBundleIndexFile,
	isChunkFile,
	isConceptFile,
} from "../lib/guardrails.mjs";
import {
	actionToCommand,
	bundleExists,
	chunksDirEntries,
	composeAmbientContext,
	extractPathsFromBash,
	footerText,
	mergePayload,
	projectRoot,
	runJson,
	scriptPath,
	shouldNudge,
} from "../lib/pi-tools.mjs";
import { createSessionServer } from "../lib/session-server.mjs";
import { render as chunkView } from "../lib/views/chunk.mjs";
import { render as hubView } from "../lib/views/hub.mjs";
import { render as knowledgeView } from "../lib/views/knowledge.mjs";
import { render as memoryReviewView } from "../lib/views/memory-review.mjs";
import { render as planView } from "../lib/views/plan.mjs";
import { render as reviewView } from "../lib/views/review.mjs";
import { render as testView } from "../lib/views/test.mjs";

const VIEWS = {
	hub: hubView,
	plan: planView,
	chunk: chunkView,
	test: testView,
	review: reviewView,
	knowledge: knowledgeView,
	"memory-review": memoryReviewView,
};

const GATHER_STEPS = ["hub", "plan", "chunk", "implement", "memorize", "range", "knowledge", "test", "review"];
const UI_STEPS = ["hub", "plan", "chunk", "test", "review", "knowledge", "memory-review"];

const COMMANDS = [
	{
		name: "iterator",
		description:
			"Open the iterator dashboard — the control plane for the plan → chunk → implement → review flow.",
	},
	{
		name: "iterator-plan",
		description: "Create or revise the plan in the memory/ OKF bundle.",
	},
	{
		name: "iterator-chunk",
		description:
			"Break the approved plan into small, dependency-ordered chunks.",
	},
	{
		name: "iterator-test",
		description: "Write red (pre-implementation) or green tests for a chunk.",
	},
	{
		name: "iterator-implement",
		description:
			"Implement the next dependency-ready chunk and drive its tests green.",
	},
	{
		name: "iterator-design",
		description:
			"Capture or revise the project's design params (memory/design.md) applied to every UI chunk.",
	},
	{
		name: "iterator-review",
		description: "Review a chunk's diff and record the outcome.",
	},
	{
		name: "okf",
		description:
			"Open the Knowledge view — the bundle's okf memory plane (areas, concepts, staleness).",
	},
	{
		name: "okf-init",
		description: "Analyze the repo and draft the initial okf knowledge bundle.",
	},
	{
		name: "okf-consolidate",
		description:
			"Re-review existing memories against the current code (stale anchors, dead concepts).",
	},
	{
		name: "okf-memorize",
		description:
			"Study the commits since last_memorized_commit and memorize what changed.",
	},
];

const asText = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj) }], details: obj });
const asError = (msg) => ({ content: [{ type: "text", text: String(msg) }], isError: true });

export default function iteratorExtension(pi) {
	let session = null;

	// Repo-relative paths the agent touched recently (LRU, newest last) — the
	// anchor set for ambient knowledge injection.
	const RECENT_FILES_MAX = 20;
	const recentFiles = new Set();
	let lastAmbient = null;

	const rememberFile = (cwd, path) => {
		if (!path) return;
		try {
			const rel = relative(projectRoot(cwd), resolve(cwd, String(path)))
				.split("\\").join("/");
			if (!rel || rel.startsWith("..")) return;
			recentFiles.delete(rel); // re-insert → newest position
			recentFiles.add(rel);
			while (recentFiles.size > RECENT_FILES_MAX) {
				recentFiles.delete(recentFiles.values().next().value);
			}
		} catch {
			/* untrackable path */
		}
	};

	const gatherPayload = async (cwd, step, chunk) => {
		const args = ["--step", step];
		if (chunk) args.push("--chunk", chunk);
		return runJson(scriptPath("gather"), args, { cwd });
	};

	// One `--step session` spawn per turn instead of ~5 single-step spawns:
	// footer, ambient context, and hub refresh all read the same snapshot.
	// Invalidated by writes and at turn end, so the next reader re-gathers.
	let sessionSnapshot = null;
	const gatherSession = async (cwd) => {
		if (sessionSnapshot?.cwd === cwd) return sessionSnapshot.value;
		const value = await gatherPayload(cwd, "session");
		sessionSnapshot = { cwd, value };
		return value;
	};
	const invalidateSession = () => {
		sessionSnapshot = null;
	};

	// Footer segment + unmemorized-commit nudge (IDEAS §5/§11). Runs on the
	// same lifecycle beats as the dashboard refresh, but independently of it —
	// the footer works with the browser dashboard closed.
	let lastNudgedAt = 0;
	const refreshStatus = async (ctx) => {
		if (!ctx?.hasUI) return;
		try {
			if (!bundleExists(ctx.cwd)) {
				ctx.ui.setStatus("iterator", undefined);
				return;
			}
			const { hub, implement, memorize } = await gatherSession(ctx.cwd);
			const pending = memorize.okf ? memorize.pendingCount : 0;
			ctx.ui.setStatus("iterator", footerText(hub, implement, pending) || undefined);

			if (pending < lastNudgedAt) lastNudgedAt = 0; // pointer advanced — reset
			const threshold = parseInt(process.env.ITERATOR_MEMORIZE_NUDGE || "5", 10);
			if (memorize.okf && shouldNudge(pending, lastNudgedAt, threshold)) {
				lastNudgedAt = pending;
				ctx.ui.notify(
					`iterator: ${pending} commits since the last memorize — consider /okf-memorize`,
					"info",
				);
			}
		} catch {
			/* a broken bundle read must never take pi down */
		}
	};

	/** Refresh the idle dashboard tabs (no pending round). */
	const refreshHub = async (cwd) => {
		if (!session || !session.isRunning() || session.hasPending()) return;
		try {
			// Knowledge first: with the Work tab active its refresh is stored
			// silently, so the hub view stays what the user ends up watching.
			const knowledge = await gatherPayload(cwd, "knowledge");
			session.showView({ step: "knowledge", render: () => VIEWS.knowledge(knowledge) });
			const { hub } = await gatherSession(cwd);
			session.showView({ step: "hub", render: () => VIEWS.hub(hub) });
		} catch {
			/* a broken bundle read must never take pi down */
		}
	};

	const ensureServer = async (ctx) => {
		if (!session) {
			session = createSessionServer({
				onUnsolicited: (result) => {
					const cmd = actionToCommand(result);
					if (!cmd) return;
					session.showWorking(`Dispatched ${cmd} — Claude is working…`);
					pi.sendUserMessage(cmd);
				},
			});
		}
		if (!session.isRunning()) await session.start();
		return session;
	};

	// ---------------------------------------------------------------------
	// Friendly commands (skills stay the source of the flow logic).
	// /iterator-implement with no argument turns into a TUI chunk picker.

	for (const command of COMMANDS) {
		pi.registerCommand(command.name, {
			description: command.description,
			handler: async (args = "", ctx) => {
				const trimmedArgs = String(args).trim();
				if (command.name === "iterator-implement" && !trimmedArgs && ctx?.hasUI) {
					const picked = await pickReadyChunk(ctx);
					if (picked === undefined) return; // dismissed / nothing ready
					pi.sendUserMessage(`/skill:iterator-implement ${picked}`.trim());
					return;
				}
				pi.sendUserMessage(
					`/skill:${command.name}${trimmedArgs ? ` ${trimmedArgs}` : ""}`,
				);
			},
		});
	}

	pi.registerCommand("iterator-next", {
		description: "Implement the next dependency-ready chunk, no questions asked.",
		handler: async (_args, ctx) => {
			try {
				const imp = await gatherPayload(ctx.cwd, "implement");
				if (!imp.next) {
					const why = imp.drafts?.length
						? `only drafts exist — accept the chunk set first (/iterator-chunk)`
						: imp.stuck
							? "pending chunks exist but none is ready (dependency cycle?)"
							: "no pending chunks";
					if (ctx.hasUI) ctx.ui.notify(`iterator: nothing to implement — ${why}`, "warning");
					return;
				}
				pi.sendUserMessage(`/skill:iterator-implement ${imp.next.name}`);
			} catch (e) {
				if (ctx.hasUI) ctx.ui.notify(`iterator: ${e.message}`, "error");
			}
		},
	});

	/** TUI selector over the ready chunks; returns a slug, '' for "next", undefined to abort. */
	async function pickReadyChunk(ctx) {
		try {
			const imp = await gatherPayload(ctx.cwd, "implement");
			if (!imp.ready?.length) {
				ctx.ui.notify(
					imp.drafts?.length
						? "iterator: only draft chunks exist — accept the chunk set first (/iterator-chunk)"
						: "iterator: no chunk is ready to implement",
					"warning",
				);
				return undefined;
			}
			if (imp.ready.length === 1) return imp.ready[0];
			const labels = imp.ready.map((slug) =>
				slug === imp.next?.name ? `${slug} (next)` : slug,
			);
			const choice = await ctx.ui.select("Implement which chunk?", labels);
			if (!choice) return undefined;
			return choice.replace(/ \(next\)$/, "");
		} catch (e) {
			ctx.ui.notify(`iterator: ${e.message}`, "error");
			return undefined;
		}
	}

	// ---------------------------------------------------------------------
	// Tools

	pi.registerTool({
		name: "iterator_gather",
		label: "iterator gather",
		description:
			"Deterministically gather iterator flow state (the memory/ bundle + git). " +
			"Returns the step payload as JSON: hub (dashboard), plan (existing plan skeleton), " +
			"chunk (chunk set incl. drafts + architecture concepts), implement (ready wave with " +
			"full contracts incl. relevantMemories), test (chunk contract + runner), review " +
			"(diff mapped to chunks, with pitfall cards), memorize (knowledge-areas state + " +
			"uncovered commits), range (the commit range /okf-memorize must study), knowledge " +
			"(the Knowledge view payload: areas, concepts, staleness).",
		parameters: Type.Object({
			step: Type.Union(GATHER_STEPS.map((s) => Type.Literal(s)), {
				description: "Which step payload to gather.",
			}),
			chunk: Type.Optional(
				Type.String({ description: "Chunk slug (required for test, optional for review)." }),
			),
		}),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			try {
				return asText(await gatherPayload(ctx.cwd, params.step, params.chunk));
			} catch (e) {
				return asError(e.message);
			}
		},
	});

	pi.registerTool({
		name: "iterator_write",
		label: "iterator write",
		description:
			"Write to the memory/ bundle through the deterministic writer (never edit bundle " +
			"frontmatter/indexes by hand). Ops: plan (write plan.md), chunks (write the chunk set — " +
			"pass status 'draft' when proposing; returns sizing warnings), update-chunk (targeted " +
			"frontmatter update: status/tests/done/reviewed + appendCommit/appendReview), adjustments " +
			"(apply a chunk UI result verbatim: spread the result object in, e.g. " +
			"{op:'adjustments', ...uiResult}; accept:true or type:'plan-approved' promotes drafts to pending), " +
			"memorize (okf-memory shared bundle: create/update/delete knowledge concepts in " +
			"architecture/decisions/patterns/pitfalls/setup and/or advance last_memorized_commit), " +
			"accept-commit (process the review UI's accept result end to end: branch safety, " +
			"per-chunk commits with trailers, done flips, sha recording, memory verdicts, pointer " +
			"advance — pass the UI result plus per-chunk testsStatus/summary and advance:true|false), " +
			"record-review (pipe a review-feedback UI result verbatim to record statuses/notes), " +
			"refresh-format (recopy templates/format.md over the bundle's stale copy), " +
			"retire-plan (condense a finished plan into a decisions/ concept and archive its " +
			"chunks — pass concept:{slug,title,description,body}). For okf memory reviews " +
			"prefer the schema-tight okf_write tool over op apply-review here.",
		parameters: Type.Object(
			{
				op: Type.Union(
					["plan", "chunks", "design", "update-chunk", "adjustments", "memorize", "apply-review", "refresh-format", "retire-plan", "accept-commit", "record-review"].map((s) => Type.Literal(s)),
					{ description: "Writer operation." },
				),
			},
			{ additionalProperties: true },
		),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			try {
				const result = await runJson(scriptPath("write"), [], {
					cwd: ctx.cwd,
					stdin: JSON.stringify(params),
				});
				invalidateSession(); // the bundle just changed under the snapshot
			void refreshStatus(ctx); // writes move the footer's numbers
				return asText(result);
			} catch (e) {
				return asError(e.message);
			}
		},
	});

	pi.registerTool({
		name: "okf_write",
		label: "okf write",
		description:
			"Apply a memory review's verdicts through the deterministic writer (write.mjs op " +
			"apply-review) — the schema-validated path for okf knowledge writes, so memorize " +
			"payloads cannot be malformed. Verdicts: accept writes the card (or deletes it when " +
			"the card's action is 'delete'), reject discards the proposal, keep leaves the " +
			"existing concept, delete removes it. Afterwards the writer regenerates area " +
			"indexes, updates the root index (advancing last_memorized_commit to headCommit " +
			"when given — memorize/init only, never consolidate), appends the log, and " +
			"validates the bundle.",
		parameters: Type.Object({
			mode: Type.Union(["init", "consolidate", "memorize"].map((s) => Type.Literal(s)), {
				description: "Which okf flow this review belongs to.",
			}),
			headCommit: Type.Optional(
				Type.String({ description: "The reviewed head sha; advances last_memorized_commit. Omit for consolidate." }),
			),
			memories: Type.Array(
				Type.Object(
					{
						id: Type.String({ description: "<area>/<slug>" }),
						area: Type.Union(OKF_AREA_NAMES.map((a) => Type.Literal(a))),
						action: Type.Union(["create", "update", "delete", "keep"].map((s) => Type.Literal(s))),
						type: Type.Optional(Type.String()),
						title: Type.Optional(Type.String()),
						description: Type.Optional(Type.String()),
						status: Type.Optional(Type.String()),
						date: Type.Optional(Type.String()),
						tags: Type.Optional(Type.Array(Type.String())),
						files: Type.Optional(Type.Array(Type.String({ description: "Repo-relative anchor paths/globs." }))),
						body: Type.Optional(Type.String()),
						sourceCommits: Type.Optional(Type.Array(Type.String())),
					},
					{ additionalProperties: true },
				),
				{ description: "The draft cards, exactly as reviewed." },
			),
			decisions: Type.Array(
				Type.Object({
					id: Type.String(),
					verdict: Type.Union(["accept", "reject", "keep", "delete"].map((s) => Type.Literal(s))),
				}),
				{ description: "The review's verdicts (review-approved output)." },
			),
		}),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			try {
				const result = await runJson(scriptPath("write"), [], {
					cwd: ctx.cwd,
					stdin: JSON.stringify({ op: "apply-review", ...params }),
				});
				invalidateSession(); // the bundle just changed under the snapshot
			void refreshStatus(ctx); // the pointer/counts just changed
				return asText(result);
			} catch (e) {
				return asError(e.message);
			}
		},
	});

	pi.registerTool({
		name: "iterator_ui",
		label: "iterator UI",
		description:
			"Show an iterator step in the session dashboard (persistent browser tab) and wait for " +
			"the user's answer. The server gathers the step payload itself from the bundle — do NOT " +
			"pass gathered payloads or chunk bodies. `extra` is only for the small agent-authored " +
			"fields: plan → {title, plan:{goal,architecture,keyDecisions,productFit}, dependencies}; " +
			"test → {cases:[...]}; review after implementing → {mode:'commit', tests:{status,total,passing}}; " +
			"hub/chunk/review → none (chunk drafts are read from disk).",
		parameters: Type.Object({
			step: Type.Union(UI_STEPS.map((s) => Type.Literal(s)), {
				description: "Which view to show.",
			}),
			chunk: Type.Optional(
				Type.String({ description: "Chunk slug (required for test, optional for review)." }),
			),
			extra: Type.Optional(
				Type.Any({ description: "Agent-authored fields merged over the gathered payload." }),
			),
		}),
		async execute(_id, params, signal, _onUpdate, ctx) {
			try {
				await ensureServer(ctx);
				// memory-review has no gather step of its own: the cards are
				// agent-drafted (extra.memories); areas/branch come from the
				// knowledge payload.
				const gathered = params.step === "memory-review"
					? (({ branch, project, bundlePath, areas }) =>
						({ step: "memory-review", branch, project, bundlePath, areas }))(
						await gatherPayload(ctx.cwd, "knowledge"))
					: await gatherPayload(ctx.cwd, params.step, params.chunk);
				const payload = mergePayload(gathered, params.extra);
				const result = await session.showStep({
					step: params.step,
					render: () => VIEWS[params.step](payload),
					signal,
				});
				return asText(result);
			} catch (e) {
				return asError(e.message);
			}
		},
	});

	// ---------------------------------------------------------------------
	// Ambient bundle awareness: every turn starts with a one-paragraph state
	// line plus the knowledge concepts anchored to recently touched files —
	// the agent knows a pitfall exists before editing the file, and never
	// re-derives flow state mid-conversation.

	pi.on("before_agent_start", async (_event, ctx) => {
		try {
			if (!bundleExists(ctx.cwd)) return undefined;
			const { hub, implement } = await gatherSession(ctx.cwd);
			let matched = [];
			if (recentFiles.size) {
				const knowledge = await gatherPayload(ctx.cwd, "knowledge");
				matched = matchConcepts(knowledge.memories || [], [...recentFiles])
					.slice(0, 5)
					.map((m) => ({
						id: m.id,
						title: m.title,
						description: m.description,
						ref: `${knowledge.bundlePath || "memory/"}${m.path}`,
					}));
			}
			const content = composeAmbientContext(hub, implement, matched);
			// Identical context to last turn → skip (no context spam).
			if (!content || content === lastAmbient) return undefined;
			lastAmbient = content;
			return {
				message: { customType: "iterator-context", content, display: false },
			};
		} catch {
			return undefined; // a broken bundle must never take pi down
		}
	});

	// ---------------------------------------------------------------------
	// Session lifecycle: dashboard up while a bundle exists, down with pi.

	pi.on("session_start", async (_event, ctx) => {
		await refreshStatus(ctx);
		if (!bundleExists(ctx.cwd)) return; // start lazily on first use instead
		try {
			await ensureServer(ctx);
			await refreshHub(ctx.cwd);
		} catch (e) {
			if (ctx.hasUI) ctx.ui.notify(`iterator: dashboard failed to start: ${e.message}`, "warning");
		}
	});

	pi.on("session_shutdown", async () => {
		if (session) await session.stop();
	});

	// Keep the idle dashboard + footer current so they reflect reality.
	pi.on("agent_end", async (_event, ctx) => {
		invalidateSession(); // the turn may have changed files/commits
		await refreshHub(ctx.cwd);
		await refreshStatus(ctx);
	});

	// ---------------------------------------------------------------------
	// Guardrails: protect writer-owned bundle state against direct edits.

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName === "write" || event.toolName === "edit") {
			const path = event.input?.path;
			rememberFile(ctx.cwd, path);
			if (!path) return undefined;
			// Anchor classification to the resolved bundle dir so a project's own
			// src/memory/chunks/*.md is never blocked as a bundle file.
			const root = projectRoot(ctx.cwd);
			const abs = resolve(ctx.cwd, String(path)).split("\\").join("/");
			const opts = { root };
			if (
				!(
					isChunkFile(abs, process.env, root) ||
					isConceptFile(abs, process.env, root) ||
					isBundleIndexFile(abs, process.env, root)
				)
			) {
				return undefined;
			}
			let oldContent = null;
			try {
				oldContent = readFileSync(resolve(ctx.cwd, path), "utf8");
			} catch {
				/* new file */
			}
			const verdict =
				event.toolName === "write"
					? checkWrite({ ...event.input, path: abs }, oldContent, opts)
					: checkEdit({ ...event.input, path: abs }, oldContent, opts);
			if (!verdict) return undefined;
			if (verdict.block) return { block: true, reason: `iterator: ${verdict.reason}` };
			if (ctx.hasUI) ctx.ui.notify(`iterator: ${verdict.reason}`, "warning");
			return undefined;
		}
		if (event.toolName === "bash") {
			const command = String(event.input?.command || "");
			for (const p of extractPathsFromBash(command)) {
				if (existsSync(resolve(ctx.cwd, p))) rememberFile(ctx.cwd, p);
			}
			if (!/\bgit\b/.test(command) || !bundleExists(ctx.cwd)) return undefined;
			const verdict = checkBashCommit(
				{ command },
				{ chunks: chunksDirEntries(ctx.cwd) },
			);
			if (verdict?.warn && ctx.hasUI) ctx.ui.notify(`iterator: ${verdict.reason}`, "warning");
		}
		return undefined;
	});
}
