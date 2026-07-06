/**
 * iterator: pi extension — session dashboard, first-class tools, guardrails.
 *
 * What this registers on top of the seven friendly commands:
 *
 * Tools (mechanical scripts as real tools; typebox-validated, structured
 * results, writer validation errors surface as tool errors):
 *   iterator_gather  { step, chunk? }        → the step payload (JSON)
 *   iterator_write   { op, ... }             → write.mjs result
 *   iterator_ui      { step, chunk?, extra? } → the user's answer
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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Type } from "typebox";

import {
	checkBashCommit,
	checkEdit,
	checkWrite,
	isChunkFile,
} from "../lib/guardrails.mjs";
import {
	actionToCommand,
	bundleExists,
	chunksDirEntries,
	mergePayload,
	runJson,
	scriptPath,
} from "../lib/pi-tools.mjs";
import { createSessionServer } from "../lib/session-server.mjs";
import { render as chunkView } from "../lib/views/chunk.mjs";
import { render as hubView } from "../lib/views/hub.mjs";
import { render as planView } from "../lib/views/plan.mjs";
import { render as reviewView } from "../lib/views/review.mjs";
import { render as testView } from "../lib/views/test.mjs";

const VIEWS = {
	hub: hubView,
	plan: planView,
	chunk: chunkView,
	test: testView,
	review: reviewView,
};

const GATHER_STEPS = ["hub", "plan", "chunk", "implement", "memorize", "test", "review"];
const UI_STEPS = ["hub", "plan", "chunk", "test", "review"];

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
];

const asText = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj) }], details: obj });
const asError = (msg) => ({ content: [{ type: "text", text: String(msg) }], isError: true });

export default function iteratorExtension(pi) {
	let session = null;

	const gatherPayload = async (cwd, step, chunk) => {
		const args = ["--step", step];
		if (chunk) args.push("--chunk", chunk);
		return runJson(scriptPath("gather"), args, { cwd });
	};

	/** Refresh the idle dashboard with a fresh hub view (no pending round). */
	const refreshHub = async (cwd) => {
		if (!session || !session.isRunning() || session.hasPending()) return;
		try {
			const payload = await gatherPayload(cwd, "hub");
			session.showView({ step: "hub", render: () => VIEWS.hub(payload) });
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
			"chunk (chunk set incl. drafts), implement (next ready chunk + blocked/drafts), " +
			"test (chunk contract + runner), review (diff mapped to chunks).",
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
			"record-review (pipe a review-feedback UI result verbatim to record statuses/notes).",
		parameters: Type.Object(
			{
				op: Type.Union(
					["plan", "chunks", "design", "update-chunk", "adjustments", "memorize", "accept-commit", "record-review"].map((s) => Type.Literal(s)),
					{ description: "Writer operation." },
				),
			},
			{ additionalProperties: true },
		),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			try {
				return asText(
					await runJson(scriptPath("write"), [], {
						cwd: ctx.cwd,
						stdin: JSON.stringify(params),
					}),
				);
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
				const gathered = await gatherPayload(ctx.cwd, params.step, params.chunk);
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
	// Session lifecycle: dashboard up while a bundle exists, down with pi.

	pi.on("session_start", async (_event, ctx) => {
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

	// Keep the idle dashboard current so its buttons reflect reality.
	pi.on("agent_end", async (_event, ctx) => {
		await refreshHub(ctx.cwd);
	});

	// ---------------------------------------------------------------------
	// Guardrails: protect writer-owned bundle state against direct edits.

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName === "write" || event.toolName === "edit") {
			const path = event.input?.path;
			if (!path || !isChunkFile(path)) return undefined;
			let oldContent = null;
			try {
				oldContent = readFileSync(resolve(ctx.cwd, path), "utf8");
			} catch {
				/* new file */
			}
			const verdict =
				event.toolName === "write"
					? checkWrite(event.input, oldContent)
					: checkEdit(event.input, oldContent);
			if (!verdict) return undefined;
			if (verdict.block) return { block: true, reason: `iterator: ${verdict.reason}` };
			if (ctx.hasUI) ctx.ui.notify(`iterator: ${verdict.reason}`, "warning");
			return undefined;
		}
		if (event.toolName === "bash") {
			const command = String(event.input?.command || "");
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
