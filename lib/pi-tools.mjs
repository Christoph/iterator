/**
 * iterator: helpers behind the pi extension's tools (extensions/iterator.js).
 *
 * Every decision the extension makes lives here as a pure/deterministic
 * function so it is testable without a pi runtime — the extension body is
 * glue only. The gather/write scripts are spawned as CLIs (not imported):
 * that keeps the pi path byte-identical to the bash path the skills use,
 * including their validation and exit-code behavior.
 */
import { execFile } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { frontmatter } from "./bundle.mjs";

/** Merge the small agent-authored extra fields over a gathered payload. */
export function mergePayload(gathered, extra) {
	return { ...gathered, ...(extra && typeof extra === "object" ? extra : {}) };
}

/**
 * Map a hub- or knowledge-view result to the command that runs the chosen
 * flow, or null for cancel/timeout/close/anything non-actionable.
 */
export function implementationCommand(
	feature,
	{ auto = false, guidance = null } = {},
) {
	const parts = ["/iterator-implement"];
	if (feature) parts.push(feature);
	if (auto) parts.push("--auto");
	if (guidance) parts.push(`— ${guidance}`);
	return parts.join(" ");
}

/** Read and normalize the marker created for an intentional fresh session. */
export function implementationHandoffState(entries, reason) {
	if (reason !== "new" || !Array.isArray(entries)) return null;
	for (let index = entries.length - 1; index >= 0; index -= 1) {
		const entry = entries[index];
		if (
			entry?.type !== "custom" ||
			entry.customType !== "iterator-implementation-handoff" ||
			!entry.data ||
			typeof entry.data !== "object"
		)
			continue;
		return {
			...entry.data,
			autoSteps:
				Number.isInteger(entry.data.autoSteps) && entry.data.autoSteps >= 0
					? entry.data.autoSteps
					: 0,
		};
	}
	return null;
}

export function shouldApplyRole(role, { mode, featureWave } = {}) {
	if (!role) return false;
	// Auto/wave drivers no longer pre-apply the implementer role because the
	// implementation runs after a session replacement. The resulting skill
	// turn — including a harness-started direct skill invocation — owns it.
	if (role === "implementer") return true;
	return mode !== "auto" && !featureWave;
}

export function actionToCommand(result) {
	if (!result || result.type !== "action") return null;

	// Implementation uses the extension command rather than a direct skill
	// expansion: only a command context can create the focused replacement
	// session before the skill gets its deterministic feature contract.
	if (result.action === "implement")
		return implementationCommand(result.feature, { guidance: result.prompt });

	// Hub (Work tab): other step flows, optionally scoped to a feature. A typed
	// plan goal from the hero rides along so /iterator-plan can skip questions.
	const STEPS = ["plan", "feature", "test", "review", "design"];
	if (STEPS.includes(result.action)) {
		const parts = [`/skill:iterator-${result.action}`];
		if (result.feature) parts.push(result.feature);
		if (result.prompt) parts.push(`— ${result.prompt}`);
		return parts.join(" ");
	}
	// Hub: one commit-backed review containing every implemented feature.
	if (result.action === "review-all") return "/skill:iterator-review --all";
	// Hub: retire a finished plan (the /iterator skill owns the flow).
	if (result.action === "retire") return "/skill:iterator retire-plan";
	// Hub: whole-plan review once every feature is implemented/done.
	if (result.action === "review-plan") return "/skill:iterator-review-plan";

	// Knowledge tab: knowledge skills, and free-form memory actions routed to /iterator-knowledge.
	// iterator-init from the hub hero may carry a stashed plan goal: initialize,
	// then continue straight into planning with it.
	const OKF_SKILLS = [
		"iterator-init",
		"iterator-consolidate",
		"iterator-memorize",
	];
	if (OKF_SKILLS.includes(result.action)) {
		const cmd = `/skill:${result.action}`;
		return result.prompt
			? `${cmd} — when initialization finishes, continue into /skill:iterator-plan — ${result.prompt}`
			: cmd;
	}
	const OKF_ACTIONS = [
		"draft-memory",
		"draft-memory-prompt",
		"update-memory",
		"refresh-format",
	];
	if (OKF_ACTIONS.includes(result.action)) {
		const parts = [`/skill:iterator-knowledge ${result.action}`];
		if (result.target) parts.push(result.target);
		if (result.prompt) parts.push(`— ${result.prompt}`);
		return parts.join(" ");
	}
	return null;
}

/** Resolve the bundle dir for a working directory (mirrors loadBundle). */
export function memoryDir(startDir) {
	const memName = process.env.ITERATOR_MEMORY_DIR || "memory";
	if (isAbsolute(memName)) return memName;
	return join(gitRoot(startDir), memName);
}

/** The git root for a working directory (walked, not spawned — hook-safe). */
export function projectRoot(startDir) {
	return gitRoot(startDir);
}

function gitRoot(startDir) {
	let dir = startDir || process.cwd();
	// Walk up to the git root without spawning git (cheap, hook-safe).
	while (!existsSync(join(dir, ".git"))) {
		const parent = join(dir, "..");
		if (parent === dir) return startDir || process.cwd();
		dir = parent;
	}
	return dir;
}

/** Does a bundle exist (plan or features) for this working directory? */
export function bundleExists(startDir) {
	const mem = memoryDir(startDir);
	return existsSync(join(mem, "plan.md")) || existsSync(join(mem, "features"));
}

/** Absolute path of a hub-skill script (gather|write|server). */
export function scriptPath(name) {
	return fileURLToPath(
		new URL(`../skills/iterator/${name}.mjs`, import.meta.url),
	);
}

/**
 * Spawn a hub script the way the skills do.
 * @returns {Promise<{code, stdout, stderr}>} never rejects on non-zero exit.
 */
export function runScript(script, args = [], { cwd, stdin } = {}) {
	return new Promise((resolve) => {
		const child = execFile(
			process.execPath,
			[script, ...args],
			{ cwd, maxBuffer: 64 * 1024 * 1024 },
			(err, stdout, stderr) =>
				resolve({ code: err?.code ?? 0, stdout, stderr }),
		);
		if (stdin != null) child.stdin.end(stdin);
		else child.stdin.end();
	});
}

/** Run a script that prints one JSON line; throws a readable error if not. */
export async function runJson(script, args, opts) {
	const { code, stdout, stderr } = await runScript(script, args, opts);
	let parsed = null;
	try {
		parsed = JSON.parse(stdout.trim().split("\n").pop() || "");
	} catch {}
	if (parsed == null) {
		throw new Error((stderr || stdout || `exit ${code}`).trim());
	}
	if (code !== 0 || parsed.ok === false) {
		throw new Error(parsed.error || (stderr || `exit ${code}`).trim());
	}
	return parsed;
}

// ---------------------------------------------------------------------------
// Ambient context (before_agent_start injection)

/** Best-effort file-path tokens in a bash command (caller checks existence). */
export function extractPathsFromBash(command) {
	const out = [];
	for (const m of String(command || "").matchAll(/[\w./-]+\.\w{1,8}\b/g)) {
		const p = m[0].replace(/^\.\//, "");
		// Skip pure extensions/domains-looking tokens and obvious non-paths.
		if (!/[a-z]/i.test(p) || p.startsWith("-")) continue;
		out.push(p);
	}
	return [...new Set(out)];
}

/**
 * The one-paragraph turn context injected via before_agent_start: the flow
 * state (so the agent never re-derives it and routes mid-conversation work
 * into the feature flow) plus the knowledge concepts anchored to recently
 * touched files. Returns null when there is nothing worth injecting.
 *
 * @param {object|null} hub        the `--step hub` payload
 * @param {object|null} implement  the `--step implement` payload
 * @param {Array<{id,title,description,ref}>} concepts  anchored concepts
 */
export function composeAmbientContext(hub, implement, concepts = []) {
	const lines = [];
	if (hub?.plan) {
		const p = hub.progress || {};
		const red = (hub.features || [])
			.filter((c) => c.testsStatus === "red")
			.map((c) => ({
				name: c.name,
				tests: Array.isArray(c.tests) ? c.tests.slice(0, 3) : [],
			}));
		const parts = [
			`Plan "${hub.plan.title}" — ${p.done ?? 0}/${p.total ?? 0} features done`,
			`next ready: ${implement?.next?.name || "none"}`,
		];
		if (red.length) {
			parts.push(
				`committed red tests: ${red
					.map((c) =>
						c.tests.length ? `${c.name} (${c.tests.join(", ")})` : c.name,
					)
					.join("; ")}`,
			);
		}
		lines.push(
			`iterator: ${parts.join(" · ")}. Route new implementation work through the feature flow (/iterator-implement or the iterator tools), not ad-hoc edits.`,
		);
	}
	if (concepts.length) {
		lines.push(
			"Knowledge anchored to recently touched files (read the concept before editing further):",
		);
		for (const c of concepts) {
			lines.push(
				`- [${c.id}] ${c.title} — ${c.description}${c.ref ? ` (${c.ref})` : ""}`,
			);
		}
	}
	return lines.length ? lines.join("\n") : null;
}

// ---------------------------------------------------------------------------
// Auto mode: the deterministic driver core. All decisions live here as a
// pure function over (session payload, settings, state) so the loop is
// exhaustively testable without a pi runtime; the extension body only
// dispatches what this returns.

export const AUTO_PHASE_FOR_STEP = {
	test: "testing",
	implement: "implementing",
	review: "reviewing",
	"plan-review": "reviewing",
};

/** The shared terminal notification for both normal and immediate auto completion. */
export function autoCompleteMessage(settings) {
	return settings?.auto_retire_prompt === "on"
		? "auto mode: plan complete — every feature landed. Consider retiring the plan from the dashboard."
		: "auto mode: plan complete — every feature landed.";
}

/** Preserve the active item when a ready wave is paused mid-turn. */
export function pauseFeatureWave(wave) {
	if (!wave || !Array.isArray(wave.queue) || !Array.isArray(wave.results))
		return null;
	return {
		queue: wave.active ? [wave.active, ...wave.queue] : [...wave.queue],
		active: null,
		results: [...wave.results],
		abortPending: Boolean(wave.active),
	};
}

/** Mark the interrupted agent turn finished so the requeued item may resume. */
export function completeFeatureWaveAbort(wave) {
	if (!wave) return null;
	return { ...wave, abortPending: false };
}

/**
 * Advance an implementation-wave snapshot after each agent turn.
 *
 * The queue is fixed when the button is clicked: features that become ready
 * later never join the current wave. Bundle status is the result contract — an
 * active feature that reached implemented/done succeeded; one still pending
 * failed its round. Decision-conflicted entries are reported without dispatch.
 */
export function nextFeatureWaveAction(wave, features = []) {
	if (!wave || !Array.isArray(wave.queue) || !Array.isArray(wave.results))
		return null;
	if (wave.abortPending) return { wave: { ...wave }, waiting: true };
	const byName = new Map(features.map((feature) => [feature.name, feature]));
	const next = {
		queue: [...wave.queue],
		active: wave.active || null,
		results: [...wave.results],
		abortPending: false,
	};

	if (next.active) {
		const feature = byName.get(next.active);
		const success = feature && ["implemented", "done"].includes(feature.status);
		next.results.push({
			feature: next.active,
			status: success ? "implemented" : "failed",
		});
		next.active = null;
	}

	while (next.queue.length) {
		const featureName = next.queue.shift();
		const feature = byName.get(featureName);
		if (!feature) {
			next.results.push({ feature: featureName, status: "missing" });
			continue;
		}
		if (feature.conflicts) {
			next.results.push({ feature: featureName, status: "conflict" });
			continue;
		}
		if (feature.status === "pending") {
			next.active = featureName;
			return {
				wave: next,
				action: {
					step: "implement",
					role: "implementer",
					feature: featureName,
					cmd: `/skill:iterator-implement ${featureName} --auto`,
				},
			};
		}
		next.results.push({
			feature: featureName,
			status: ["implemented", "done"].includes(feature.status)
				? "implemented"
				: "skipped",
		});
	}

	return { wave: next, done: true };
}

/**
 * The next auto-mode action, or a terminal outcome:
 *   { step, role, feature, cmd, strike? }  — dispatch cmd as a role turn;
 *                                          strike = feature whose needs-work
 *                                          counter must be incremented first
 *   { escalate: true, reason, feature? }   — stop, pause, hand to the human
 *   { done: true }                       — every feature landed
 *   null                                 — auto mode is not (or no longer) driving
 *
 * Verdict rule: a dispatched agent review either drove accept-commit (feature
 * status flips to done) or it didn't — the bundle state IS the verdict; no
 * text parsing.
 */
export function nextAutoAction(sessionPayload, settings, state) {
	const hub = sessionPayload?.hub;
	const imp = sessionPayload?.implement;
	if (!hub?.plan || state?.mode !== "auto" || state?.paused) return null;
	const max = settings?.max_review_iterations ?? 3;
	const strikes = state.strikes || {};

	// A review round just came back: done = approved+committed; anything else
	// is a needs-work round → strike, then re-implement with the reviewer's
	// notes (they live in the feature's # Review section).
	if (state.phase === "reviewing" && state.active_feature) {
		const ch = (hub.features || []).find(
			(c) => c.name === state.active_feature,
		);
		if (ch && ch.status !== "done") {
			const count = (strikes[state.active_feature] || 0) + 1;
			if (count >= max) {
				return {
					escalate: true,
					feature: state.active_feature,
					reason: `feature '${state.active_feature}' failed agent review ${count} time(s) — human intervention needed`,
				};
			}
			return {
				step: "implement",
				role: "implementer",
				feature: state.active_feature,
				strike: state.active_feature,
				cmd: `/skill:iterator-implement ${state.active_feature} --auto`,
			};
		}
	}

	// An implemented feature awaits review — review always directly follows
	// implement in auto mode (review_required gates dependents, not the review
	// itself). This also means "awaiting review" is never misread as stuck.
	const awaiting = (hub.features || []).find((c) => c.status === "implemented");
	if (awaiting) {
		return {
			step: "review",
			role: "reviewer",
			feature: awaiting.name,
			cmd: `/skill:iterator-review ${awaiting.name} --agent`,
		};
	}

	const next = imp?.next || null;
	const p = hub.progress || {};
	if (!next) {
		if (p.total > 0 && p.done === p.total) {
			// Every feature landed: run the whole-plan review exactly once (the
			// recorded plan_reviewed date is the once-marker), then stop — no fix
			// loop around it; the human verifies the report.
			if (!hub.plan.planReviewed) {
				return {
					step: "plan-review",
					role: "plan_reviewer",
					cmd: "/skill:iterator-review-plan --auto",
				};
			}
			return { done: true };
		}
		if (imp?.drafts?.length) {
			return {
				escalate: true,
				reason:
					"only draft features exist — accept the feature set first (/iterator-feature)",
			};
		}
		if (imp?.stuck) {
			return {
				escalate: true,
				reason:
					"pending features remain but none is ready — dependency cycle or missing dependency",
			};
		}
		return { done: true };
	}
	if ((next.conflicts || []).length) {
		return {
			escalate: true,
			feature: next.name,
			reason: `feature '${next.name}' conflicts with recorded decisions (${next.conflicts.map((x) => x.decision).join(", ")}) — resolve before implementing`,
		};
	}
	if ((strikes[next.name] || 0) >= max) {
		return {
			escalate: true,
			feature: next.name,
			reason: `feature '${next.name}' already failed review ${strikes[next.name]} time(s)`,
		};
	}

	if (
		settings?.testing_default === "on" &&
		(next.testsStatus || "none") === "none"
	) {
		return {
			step: "test",
			role: "tester",
			feature: next.name,
			cmd: `/skill:iterator-test ${next.name} --auto`,
		};
	}
	// Review readiness is a status, not a diff heuristic: the implement flow
	// flips a feature to `implemented`, which the awaiting-review branch above
	// dispatches. Anything still pending gets (re)implemented.
	return {
		step: "implement",
		role: "implementer",
		feature: next.name,
		cmd: `/skill:iterator-implement ${next.name} --auto`,
	};
}

/** Parse the persisted provider/model identity without losing slashes in ids. */
export function parseModelSpec(spec) {
	const value = String(spec || "");
	const slash = value.indexOf("/");
	if (slash <= 0 || slash === value.length - 1) return null;
	return { provider: value.slice(0, slash), id: value.slice(slash + 1) };
}

/** Whether a runtime model carries the persisted provider/model identity. */
export function modelMatchesSpec(model, spec) {
	const identity = parseModelSpec(spec);
	return Boolean(
		identity &&
			model?.provider === identity.provider &&
			model?.id === identity.id,
	);
}

/**
 * Resolve a configured role model without discarding host-owned runtime model
 * metadata (proxy base URLs, managed credentials, headers). The active model
 * wins, then the model saved for restoration, and only then the registry.
 */
export function resolveRoleModel(
	spec,
	activeModel,
	restoreModel,
	modelRegistry,
) {
	const identity = parseModelSpec(spec);
	if (!identity) return null;
	if (modelMatchesSpec(activeModel, spec)) {
		return { model: activeModel, switchRequired: false };
	}
	if (modelMatchesSpec(restoreModel, spec)) {
		return { model: restoreModel, switchRequired: true };
	}
	const model = modelRegistry?.find?.(identity.provider, identity.id) || null;
	return model ? { model, switchRequired: true } : null;
}

/**
 * Judge a configured role model against what this session can actually reach,
 * so a bad choice is refused where it is made instead of surfacing later as a
 * provider authentication error.
 *
 * Structural only — identity and the registry listing decide, never a probe
 * and never a credential sentinel. Two verdicts are refused:
 *
 *   `unknown`  the registry does not list it at all, so no route exists.
 *   `route`    the registry lists it, but the SAME model id is also listed
 *              under the active runtime model's provider. That duplicate is
 *              the trap: both entries look valid in a dropdown while only the
 *              active provider carries the host's routing and credentials.
 *
 * A model on some other provider with no such duplicate is left alone — it may
 * be perfectly usable with its own credentials, and refusing it would make
 * legitimate models unsettable.
 */
export function classifyRoleModel(spec, activeModel, available) {
	if (!spec || spec === "active") return { ok: true };
	const identity = parseModelSpec(spec);
	if (!identity)
		return {
			ok: false,
			reason: "malformed",
			detail: `"${spec}" is not "active" or "<provider>/<model-id>"`,
		};
	if (modelMatchesSpec(activeModel, spec)) return { ok: true };

	const list = Array.isArray(available) ? available : [];
	// No registry to check against — stay out of the way rather than guess.
	if (!list.length) return { ok: true };

	const listed = list.some(
		(m) => m?.provider === identity.provider && m?.id === identity.id,
	);
	if (!listed) {
		const sameId = list.find((m) => m?.id === identity.id);
		return {
			ok: false,
			reason: "unknown",
			detail: `${spec} is not available in this session`,
			suggestion: sameId ? `${sameId.provider}/${sameId.id}` : null,
		};
	}

	const activeProvider = activeModel?.provider;
	if (activeProvider && activeProvider !== identity.provider) {
		const onActiveProvider = list.some(
			(m) => m?.provider === activeProvider && m?.id === identity.id,
		);
		if (onActiveProvider)
			return {
				ok: false,
				reason: "route",
				detail: `${spec} is listed, but ${identity.id} is also available on the active provider "${activeProvider}" — the configured one routes elsewhere`,
				suggestion: `${activeProvider}/${identity.id}`,
			};
	}
	return { ok: true };
}

/** Modern Pi resolves void on success; older runtimes may return a boolean. */
export function modelSwitchSucceeded(result) {
	return result !== false;
}

/**
 * The model/thinking overrides for a role turn: null fields mean "leave the
 * session as-is" ('active'). The extension resolves the model string while
 * preserving matching runtime model objects, then applies model/thinking.
 */
export function roleModelSpec(settings, role) {
	const model = settings?.[`${role}_model`];
	const thinking = settings?.[`${role}_thinking`];
	return {
		model: model && model !== "active" ? String(model) : null,
		thinking: thinking && thinking !== "active" ? String(thinking) : null,
	};
}

// ---------------------------------------------------------------------------
// Token-usage attribution (pi turn_end capture → usage op rows)

const ROLE_MAP = {
	"iterator-plan": "planner",
	"iterator-test": "tester",
	"iterator-implement": "implementer",
	"iterator-next": "implementer",
	"iterator-review": "reviewer",
	"iterator-review-plan": "plan_reviewer",
};

/** The role model for an exact Iterator command, or null for other input. */
export function roleFromInput(text) {
	const match = String(text || "")
		.trim()
		.match(/^\/(?:skill:)?([a-z-]+)(?=\s|$)/);
	return match ? (ROLE_MAP[match[1]] ?? null) : null;
}

const ATTRIBUTION_MAP = {
	"iterator-plan": "plan",
	"iterator-feature": "feature",
	"iterator-test": "test",
	"iterator-implement": "implement",
	"iterator-review": "review",
	"iterator-review-plan": "review",
	"iterator-design": "design",
	"iterator-next": "implement",
	iterator: "hub",
	"iterator-knowledge": "memory",
	"iterator-init": "memory",
	"iterator-consolidate": "memory",
	"iterator-memorize": "memory",
};

/**
 * Which ledger step (and feature) a turn belongs to, parsed from the user
 * input that started it (`/iterator-implement auth`, `/skill:iterator-memorize`).
 * Returns null when the input is not an iterator/iterator-knowledge command — the previous
 * attribution keeps applying until the flow visibly changes.
 */
export function attributionFromInput(text) {
	const m = String(text || "")
		.trim()
		.match(/^\/(?:skill:)?([a-z-]+)(?:\s+([A-Za-z0-9._/-]+))?/);
	if (!m || !ATTRIBUTION_MAP[m[1]]) return null;
	const feature = m[2] && /^[a-z0-9][a-z0-9-]*$/.test(m[2]) ? m[2] : null;
	return { step: ATTRIBUTION_MAP[m[1]], feature };
}

/**
 * One usage-op row from a turn_end assistant message, attributed to the
 * current flow step; null for non-assistant turns or messages without usage.
 */
export function usageRowFromMessage(message, attribution) {
	if (!message || message.role !== "assistant" || !message.usage) return null;
	const u = message.usage;
	return {
		step: attribution?.step || "other",
		...(attribution?.feature ? { feature: attribution.feature } : {}),
		provider: String(message.provider || "unknown"),
		model: String(message.model || "unknown"),
		input: u.input || 0,
		output: u.output || 0,
		cacheRead: u.cacheRead || 0,
		cacheWrite: u.cacheWrite || 0,
	};
}

// ---------------------------------------------------------------------------
// Working-overlay activity

/** Chars kept per overlay line — the box clips visually, this bounds the SSE payload. */
export const ACTIVITY_TEXT_MAX = 800;

const clipActivity = (s, max) => {
	if (s.length <= max) return s;
	const cut = s.slice(0, max);
	const sp = cut.lastIndexOf(" ");
	return (sp > 0 && sp > max - 80 ? cut.slice(0, sp) : cut).trimEnd() + "…";
};

/** `Running read, edit ×2` — first-seen order, counted, capped at 6 distinct names. */
const toolSummary = (names) => {
	const order = [];
	const counts = new Map();
	for (const n of names) {
		if (!counts.has(n)) order.push(n);
		counts.set(n, (counts.get(n) || 0) + 1);
	}
	const shown = order
		.slice(0, 6)
		.map((n) => (counts.get(n) > 1 ? `${n} ×${counts.get(n)}` : n));
	if (order.length > 6) shown.push("…");
	return `Running ${shown.join(", ")}`;
};

/**
 * One overlay line from a finished agent message: the assistant's prose, or a
 * summary of the tools it called when the message carries no text (the common
 * stopReason:'toolUse' turn — without the fallback the overlay would freeze on
 * the last prose through exactly the stretches it exists to narrate).
 *
 * null when there is nothing worth showing: message_end also fires for user,
 * toolResult, bashExecution, custom, branchSummary and compactionSummary
 * messages; an aborted turn is a torn fragment the abort path is already
 * clearing. Thinking blocks are skipped — they carry `.thinking`, not `.text`.
 */
export function activityTextFromMessage(message, max = ACTIVITY_TEXT_MAX) {
	if (!message || message.role !== "assistant") return null;
	if (message.stopReason === "aborted") return null;
	const blocks = Array.isArray(message.content) ? message.content : [];
	const text = blocks
		.filter((b) => b && b.type === "text" && typeof b.text === "string")
		.map((b) => b.text)
		.join("\n")
		.replace(/\s+/g, " ")
		.trim();
	if (text) return clipActivity(text, max);
	const tools = blocks
		.filter((b) => b && b.type === "toolCall" && b.name)
		.map((b) => String(b.name));
	return tools.length ? clipActivity(toolSummary(tools), max) : null;
}

// ---------------------------------------------------------------------------
// Footer status + memorize nudge

const PISBX_ENV = join(homedir(), ".pisbx-env");
const PORT_RE = /^\s*(?:export\s+)?ITERATOR_DISPLAY_PORT=["']?(\d+)["']?/m;

/**
 * The host-reachable UI port for this agent. A sandbox publishes a distinct
 * host port per agent and writes it into ITERATOR_DISPLAY_PORT (pisbx does
 * this); null outside a sandbox, where the listen port is already the host
 * port.
 *
 * The env var is preferred, but pisbx only writes `~/.pisbx-env` and the
 * image's .bashrc sources it on the *interactive* path — `sbx run` execs pi
 * directly, so the var never reaches the process. Falling back to the file
 * keeps the segment working however pi was launched. (Note displayPort() in
 * server/env.mjs reads the env var only, so printed URLs still miss it.)
 */
export function uiPort(env = process.env, file = PISBX_ENV) {
	const p = parseInt(env.ITERATOR_DISPLAY_PORT || "", 10);
	if (Number.isInteger(p) && p > 0) return p;
	try {
		const m = PORT_RE.exec(readFileSync(file, "utf8"));
		const fp = m ? parseInt(m[1], 10) : NaN;
		return Number.isInteger(fp) && fp > 0 ? fp : null;
	} catch {
		return null; // no file (not sandboxed) or unreadable — never throw
	}
}

/**
 * The footer segment text (ctx.ui.setStatus renders it — pi's footer and
 * pi-powerline-footer both show extension statuses), e.g.
 * `⛭ 3/7 · next: auth-middleware · 🔴 1 red · 🧠 4 unmemorized · 🌐 ui:53421`.
 * The port trails so it sits rightmost, and shows with no plan loaded — it
 * tells the user which port this agent's UI answers on.
 * Returns null when there is nothing to show (clears the segment).
 */
export function footerText(hub, implement, pendingCount = 0, port = null) {
	const segs = [];
	if (hub?.plan) {
		const p = hub.progress || {};
		segs.push(`⛭ ${p.done ?? 0}/${p.total ?? 0}`);
		if (implement?.next?.name) segs.push(`next: ${implement.next.name}`);
		const red = (hub.features || []).filter(
			(c) => c.testsStatus === "red",
		).length;
		if (red) segs.push(`🔴 ${red} red`);
		if (hub.dirty?.count) segs.push(`⚠ ${hub.dirty.count} uncommitted`);
	}
	if (pendingCount > 0) segs.push(`🧠 ${pendingCount} unmemorized`);
	if (port) segs.push(`🌐 ui:${port}`);
	return segs.length ? segs.join(" · ") : null;
}

/**
 * Nudge toward /iterator-memorize at most once per threshold-multiple: fire when
 * the unmemorized count reaches the threshold AND has grown a full threshold
 * past the last nudge (never per-commit nagging). threshold <= 0 disables.
 */
export function shouldNudge(pendingCount, lastNudgedAt, threshold) {
	if (!Number.isFinite(threshold) || threshold <= 0) return false;
	return pendingCount >= threshold && pendingCount >= lastNudgedAt + threshold;
}

/** Feature frontmatter entries for the guardrails ({slug, fm} per feature). */
export function featuresDirEntries(startDir) {
	const dir = join(memoryDir(startDir), "features");
	if (!existsSync(dir)) return [];
	const out = [];
	for (const f of readdirSync(dir)) {
		if (!f.endsWith(".md") || f === "index.md") continue;
		try {
			out.push({
				slug: f.slice(0, -3),
				fm: frontmatter(readFileSync(join(dir, f), "utf8")),
			});
		} catch {}
	}
	return out;
}
