/**
 * iterator: pi extension — session dashboard, first-class tools, guardrails,
 * ambient context, footer status.
 *
 * What this registers on top of the friendly commands (incl. the /iterator-knowledge* four):
 *
 * Tools (mechanical scripts as real tools; typebox-validated, structured
 * results, writer validation errors surface as tool errors):
 *   iterator_gather  { step, feature? }        → the step payload (JSON)
 *   iterator_write   { op, ... }             → write.mjs result
 *   okf_write        { mode, memories, decisions, headCommit? }
 *                                            → apply-review result (schema-tight)
 *   iterator_ui      { step, feature?, extra? } → the user's answer
 *
 * Ambient context (before_agent_start): each turn opens with the flow state
 * plus knowledge concepts anchored to recently touched files (display:false,
 * deduped). Footer (ctx.ui.setStatus): `⛭ 3/7 · next: … · 🧠 N unmemorized ·
 * 🌐 ui:PORT` (the sandbox-published host port, ITERATOR_DISPLAY_PORT),
 * refreshed on session_start/agent_end/write ops, with an /iterator-memorize
 * nudge once the unmemorized count passes ITERATOR_MEMORIZE_NUDGE (default
 * 5, 0 disables).
 *
 * iterator_ui gathers the payload ITSELF (spawning gather.mjs) and only
 * merges the small agent-authored `extra` on top — the model never pipes
 * gathered/feature payloads around. The view lands in a session-scoped
 * dashboard (lib/session-server.mjs): one browser tab for the whole pi
 * session, views swapped over SSE, started on every session_start so a fresh
 * project immediately receives the Create-plan hero, stopped on
 * session_shutdown. While the agent is
 * idle the hub stays clickable — an unsolicited click (e.g. "Implement
 * feature X") is dispatched as a /skill:iterator-* turn.
 *
 * Guardrails (lib/guardrails.mjs): direct Write/Edit to writer-owned feature
 * frontmatter is blocked/warned with a pointer at the update-feature op, and
 * a `git commit` without a `Feature: <slug>` trailer warns while a feature is
 * in flight. Body-text edits stay allowed — hand-editability is a feature.
 */
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { Type } from "typebox";

import { matchConcepts, OKF_AREA_NAMES } from "../lib/bundle.mjs";
import { hydrateMemoryCards } from "../lib/gather.mjs";
import {
	checkBashCommit,
	checkEdit,
	checkWrite,
	isBundleIndexFile,
	isFeatureFile,
	isConceptFile,
} from "../lib/guardrails.mjs";
import {
	actionToCommand,
	activityTextFromMessage,
	attributionFromInput,
	AUTO_PHASE_FOR_STEP,
	bundleExists,
	featuresDirEntries,
	composeAmbientContext,
	completeFeatureWaveAbort,
	extractPathsFromBash,
	footerText,
	implementationCommand,
	implementationHandoffState,
	mergePayload,
	nextAutoAction,
	nextFeatureWaveAction,
	pauseFeatureWave,
	projectRoot,
	roleFromInput,
	roleModelSpec,
	runJson,
	shouldApplyRole,
	scriptPath,
	shouldNudge,
	uiPort,
	usageRowFromMessage,
} from "../lib/pi-tools.mjs";
import { createSessionServer } from "../lib/session-server.mjs";
import { render as featureView } from "../lib/views/feature.mjs";
import { render as hubView } from "../lib/views/hub.mjs";
import { render as planningView } from "../lib/views/planning.mjs";
import { render as knowledgeView } from "../lib/views/knowledge.mjs";
import { render as memoryReviewView } from "../lib/views/memory-review.mjs";
import { render as archiveView } from "../lib/views/archive.mjs";
import { render as planView } from "../lib/views/plan.mjs";
import { render as questionView } from "../lib/views/question.mjs";
import { render as reviewView } from "../lib/views/review.mjs";
import { render as settingsView } from "../lib/views/settings.mjs";
import { render as testView } from "../lib/views/test.mjs";
import { render as usageView } from "../lib/views/usage.mjs";

const VIEWS = {
	hub: hubView,
	planning: planningView,
	plan: planView,
	feature: featureView,
	test: testView,
	review: reviewView,
	knowledge: knowledgeView,
	"memory-review": memoryReviewView,
	settings: settingsView,
	question: questionView,
	usage: usageView,
	archive: archiveView,
};

const GATHER_STEPS = [
	"hub",
	"plan",
	"feature",
	"implement",
	"memorize",
	"range",
	"session",
	"settings",
	"usage",
	"archive",
	"knowledge",
	"test",
	"review",
	"plan-review",
];
const UI_STEPS = [
	"hub",
	"plan",
	"feature",
	"test",
	"review",
	"knowledge",
	"memory-review",
	"settings",
	"question",
	"usage",
	"archive",
];

const COMMANDS = [
	{
		name: "iterator",
		description:
			"Open the iterator dashboard — the control plane for the plan → feature → implement → review flow.",
	},
	{
		name: "iterator-plan",
		description: "Create or revise the plan in the memory/ OKF bundle.",
	},
	{
		name: "iterator-feature",
		description:
			"Break the approved plan into small, dependency-ordered features.",
	},
	{
		name: "iterator-test",
		description: "Write red (pre-implementation) or green tests for a feature.",
	},
	{
		name: "iterator-implement",
		description:
			"Implement the next dependency-ready feature and drive its tests green.",
	},
	{
		name: "iterator-design",
		description:
			"Capture or revise the project's design params (memory/design.md) applied to every UI feature.",
	},
	{
		name: "iterator-review",
		description: "Review a feature's diff and record the outcome.",
	},
	{
		name: "iterator-review-plan",
		description:
			"Review the whole finished plan against its goals and decisions; record the report in plan.md.",
	},
	{
		name: "iterator-knowledge",
		description:
			"Open the Knowledge view — the bundle's OKF memory plane (areas, concepts, staleness).",
	},
	{
		name: "iterator-init",
		description: "Analyze the repo and draft the initial OKF knowledge bundle.",
	},
	{
		name: "iterator-consolidate",
		description:
			"Re-review existing memories against the current code (stale anchors, dead concepts).",
	},
	{
		name: "iterator-memorize",
		description:
			"Study the commits since last_memorized_commit and memorize what changed.",
	},
];

const asText = (obj) => ({
	content: [{ type: "text", text: JSON.stringify(obj) }],
	details: obj,
});
const asError = (msg) => ({
	content: [{ type: "text", text: String(msg) }],
	isError: true,
});

export default function iteratorExtension(pi) {
	let session = null;
	// before_agent_start/agent_end can overlap around abort + follow-up dispatch.
	// FIFO ownership lets a stale end clear only the overlay its own start claimed.
	const agentWorkOwners = [];

	// Latest lifecycle ctx — server callbacks (control strip, unsolicited
	// settings saves) run outside a tool call and need cwd/ui/abort from it.
	let lastCtx = null;
	const rememberCtx = (ctx) => {
		if (ctx) lastCtx = ctx;
	};
	const ctxCwd = () => lastCtx?.cwd || process.cwd();

	// Repo-relative paths the agent touched recently (LRU, newest last) — the
	// anchor set for ambient knowledge injection.
	const RECENT_FILES_MAX = 20;
	const recentFiles = new Set();
	let lastAmbient = null;

	const rememberFile = (cwd, path) => {
		if (!path) return;
		try {
			const rel = relative(projectRoot(cwd), resolve(cwd, String(path)))
				.split("\\")
				.join("/");
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

	const gatherPayload = async (cwd, step, feature) => {
		const args = ["--step", step];
		if (feature) args.push("--feature", feature);
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
			// The port is a property of the agent, not of the plan, so it shows
			// even with no bundle here — otherwise it would vanish in exactly
			// the sessions where there is nothing else in the segment.
			const port = uiPort();
			if (!bundleExists(ctx.cwd)) {
				ctx.ui.setStatus(
					"iterator",
					footerText(null, null, 0, port) || undefined,
				);
				return;
			}
			const { hub, implement, memorize } = await gatherSession(ctx.cwd);
			const pending = memorize.okf ? memorize.pendingCount : 0;
			ctx.ui.setStatus(
				"iterator",
				footerText(hub, implement, pending, port) || undefined,
			);

			if (pending < lastNudgedAt) lastNudgedAt = 0; // pointer advanced — reset
			const threshold = parseInt(
				process.env.ITERATOR_MEMORIZE_NUDGE || "5",
				10,
			);
			if (memorize.okf && shouldNudge(pending, lastNudgedAt, threshold)) {
				lastNudgedAt = pending;
				ctx.ui.notify(
					`iterator: ${pending} commits since the last memorize — consider /iterator-memorize`,
					"info",
				);
			}
		} catch {
			/* a broken bundle read must never take pi down */
		}
	};

	/** Push the control-strip status (plan/branch/auto state) to the shell. */
	const pushStatus = async (cwd) => {
		if (!session || !session.isRunning()) return;
		try {
			const { hub, settings, state } = await gatherSession(cwd);
			session.setStatus({
				plan: hub?.plan?.title || null,
				branch: hub?.branch || null,
				mode: settings?.auto_mode === "on" ? state?.mode || "manual" : "manual",
				paused: !!state?.paused,
				phase: state?.phase || "idle",
				escalation: state?.escalation || null,
			});
		} catch {
			/* a broken bundle read must never take pi down */
		}
	};

	/** Refresh the idle dashboard tabs (no pending round). */
	const refreshHub = async (
		cwd,
		{ preferPlanning = false, activateWork = false } = {},
	) => {
		if (!session || !session.isRunning() || session.hasPending()) return;
		try {
			// Inactive tabs first: their refreshes are stored silently. On first
			// startup only, a plan-less project deliberately lands on Planning so
			// the goal and initialization controls are the first useful surface.
			const knowledge = await gatherPayload(cwd, "knowledge");
			session.showView({
				step: "knowledge",
				render: () => VIEWS.knowledge(knowledge),
			});
			const usage = await gatherPayload(cwd, "usage");
			session.showView({ step: "usage", render: () => VIEWS.usage(usage) });
			const { hub } = await gatherSession(cwd);
			const landOnPlanning = preferPlanning && !hub.plan;
			// Planning renders from the same snapshot as the hub — the two
			// surfaces can never disagree about state.
			session.showView({
				step: "planning",
				render: () => VIEWS.planning({ ...hub, step: "planning" }),
				activate: landOnPlanning,
			});
			session.showView({
				step: "hub",
				render: () => VIEWS.hub(hub),
				activate: activateWork,
			});
			await pushStatus(cwd);
		} catch {
			/* a broken bundle read must never take pi down */
		}
	};

	/** Models available to this Pi session as settings-view dropdown entries. */
	const modelOptions = async () => {
		try {
			const models = (await lastCtx?.modelRegistry?.getAvailable?.()) || [];
			const out = models.map((m) => ({
				id: `${m.provider}/${m.id}`,
				label: `${m.provider}/${m.id}`,
			}));
			return out.length ? out : null;
		} catch {
			return null;
		}
	};

	/** Deterministically write the settings op and refresh the dashboard. */
	const saveSettings = async (values) => {
		const cwd = ctxCwd();
		try {
			const result = await runJson(scriptPath("write"), [], {
				cwd,
				stdin: JSON.stringify({ op: "settings", values }),
			});
			invalidateSession();
			if (lastCtx?.hasUI) {
				lastCtx.ui.notify(
					`iterator: settings saved (${Object.keys(result.changed || values).join(", ")})`,
					"info",
				);
			}
			session?.closeModal?.();
			await refreshStatus(cwd);
		} catch (e) {
			if (lastCtx?.hasUI)
				lastCtx.ui.notify(
					`iterator: settings not saved — ${e.message}`,
					"error",
				);
		}
	};

	/** Save one backlog mutation without spending a model turn. */
	const saveBacklog = async (input) => {
		const cwd = ctxCwd();
		// Backlog writes are allowed during a model turn, but must not replace or
		// clear that turn's working guard. The normal turn-end refresh will pick up
		// the filesystem change; idle saves still refresh immediately.
		const preserveAgentWorking = session?.isWorking?.() === true;
		if (!preserveAgentWorking)
			session?.showWorking?.("Saving backlog candidate…");
		try {
			const result = await runJson(scriptPath("write"), [], {
				cwd,
				stdin: JSON.stringify({
					op: "backlog",
					action: input.action,
					id: input.id,
					title: input.title,
					details: input.details,
					kind: input.kind,
					selected: input.selected,
				}),
			});
			invalidateSession();
			notifyUi(`backlog ${result.action}d: ${result.item.title}`, "info");
		} catch (e) {
			notifyUi(`backlog not saved — ${e.message}`, "error");
		} finally {
			if (!preserveAgentWorking) {
				session?.clearWorking?.();
				await refreshHub(cwd);
			}
		}
	};

	/** Persist the Usage tab's complete optional model-price table. */
	const saveUsagePrices = async (prices) => {
		const cwd = ctxCwd();
		try {
			const result = await runJson(scriptPath("write"), [], {
				cwd,
				stdin: JSON.stringify({ op: "usage", prices }),
			});
			invalidateSession();
			notifyUi(`usage prices saved (${result.prices} model(s))`, "info");
			await refreshHub(cwd);
		} catch (e) {
			notifyUi(`usage prices not saved — ${e.message}`, "error");
		}
	};

	/** Open Settings above the shell without replacing its tab or pending round. */
	const openSettings = async () => {
		const cwd = ctxCwd();
		try {
			const payload = await gatherPayload(cwd, "settings");
			const models = await modelOptions();
			session.showModal({
				render: () =>
					VIEWS.settings({ ...(models ? { ...payload, models } : payload), modal: true }),
			});
		} catch (e) {
			if (lastCtx?.hasUI) lastCtx.ui.notify(`iterator: ${e.message}`, "error");
		}
	};

	/** Deterministically write the state op (pause/continue bookkeeping). */
	const writeState = async (set) => {
		const cwd = ctxCwd();
		const result = await runJson(scriptPath("write"), [], {
			cwd,
			stdin: JSON.stringify({ op: "state", set }),
		});
		invalidateSession();
		return result;
	};

	/** Control-strip actions — deterministic, never a model turn. */
	const onControl = async (input) => {
		const cwd = ctxCwd();
		try {
			if (input.action === "open-settings") {
				await openSettings();
			} else if (input.action === "pause") {
				// A wave's active item was removed from its fixed queue when dispatched.
				// Put it back before aborting so Continue retries it instead of treating
				// the interrupted turn as a failed result and moving on.
				if (featureWave) featureWave = pauseFeatureWave(featureWave);
				await writeState({ paused: true });
				// Stop the in-flight stream too — state is saved after each step,
				// so Continue simply picks the flow back up.
				try {
					lastCtx?.abort?.();
				} catch {}
				await restoreModel();
				if (lastCtx?.hasUI)
					lastCtx.ui.notify(
						"iterator: paused — press Continue in the dashboard to resume",
						"info",
					);
				await pushStatus(cwd);
			} else if (input.action === "continue") {
				await writeState({ paused: false, escalation: null });
				if (lastCtx?.hasUI) lastCtx.ui.notify("iterator: continuing", "info");
				await pushStatus(cwd);
				if (featureWave) void advanceFeatureWave(cwd);
				else resumeAuto(cwd); // no-op unless auto mode has work to pick up
			} else if (input.action === "abort") {
				featureWave = null;
				// One-click recovery to a clean state: kill the in-flight stream,
				// reset the runtime flow state, and re-render the hub — works even
				// when a dispatch stalled, because /control never needs a model turn.
				try {
					lastCtx?.abort?.();
				} catch {}
				await writeState({
					mode: "manual",
					paused: false,
					phase: "idle",
					active_feature: null,
					strikes: {},
					escalation: null,
				});
				autoSteps = 0;
				await restoreModel();
				if (lastCtx?.hasUI)
					lastCtx.ui.notify(
						"iterator: aborted — flow state reset, hub is fresh",
						"info",
					);
				session?.clearWorking?.(); // the overlay must never wedge
				await pushStatus(cwd);
				await refreshHub(cwd);
			}
		} catch (e) {
			if (lastCtx?.hasUI) lastCtx.ui.notify(`iterator: ${e.message}`, "error");
		}
	};

	// ---------------------------------------------------------------------
	// Auto mode driver: nextAutoAction (pure, lib/pi-tools.mjs) decides;
	// this glue writes state, switches the role model/thinking, and
	// dispatches the command as a new turn. Runs after every agent_end while
	// state.mode === 'auto' (and after feature approval / the hub auto button).

	const AUTO_MAX_STEPS = 60; // per-session circuit breaker
	let autoSteps = 0;
	let featureWave = null; // fixed ready-feature snapshot; review stays manual
	let preAutoModel = null; // the user's model before the first role switch
	let pendingRole = null; // exact role command captured from the current input
	// A before_agent_start/agent_end pair can overlap a queued follow-up. Keep
	// restoration ownership in FIFO order instead of a shared boolean.
	const manualRoleTurns = [];

	const notifyUi = (msg, level = "info") => {
		if (lastCtx?.hasUI) lastCtx.ui.notify(`iterator: ${msg}`, level);
	};

	/**
	 * Queue a prompt for the agent. Always passes deliverAs:'followUp' (the
	 * runtime's streamingBehavior): several dispatch sites can fire while the
	 * agent is still processing — the write-tool auto-start runs inside a live
	 * tool call, and the agent_end → kickAuto path races its own async
	 * bookkeeping — and without the option the runtime REJECTS the message
	 * ("Agent is already processing…") instead of queueing it, silently
	 * stalling auto mode. followUp = wait for the current turn, then run.
	 */
	const dispatch = (cmd) =>
		pi.sendUserMessage(cmd, {
			deliverAs: "followUp",
			streamingBehavior: "followUp", // older runtimes take the raw option name
		});

	/**
	 * Apply a role's model/thinking overrides and report whether the model
	 * actually changed. Only a successful switch may arm restoration: a failed
	 * provider lookup must leave the active session model (and its credentials)
	 * completely untouched.
	 */
	const applyRole = async (role, settings) => {
		const spec = roleModelSpec(settings, role);
		let switchedModel = false;
		try {
			if (spec.model) {
				const slash = spec.model.indexOf("/");
				const provider = spec.model.slice(0, slash);
				const id = spec.model.slice(slash + 1);
				const m = lastCtx?.modelRegistry?.find?.(provider, id);
				if (m) {
					const previousModel = preAutoModel || lastCtx?.model || null;
					const ok = await pi.setModel(m);
					if (ok) {
						if (!preAutoModel) preAutoModel = previousModel;
						switchedModel = true;
					} else {
						notifyUi(
							`no API key for ${spec.model} — staying on the active model`,
							"warning",
						);
					}
				} else {
					notifyUi(
						`unknown model ${spec.model} for ${role} — staying on the active model`,
						"warning",
					);
				}
			}
			if (spec.thinking) pi.setThinkingLevel(spec.thinking);
		} catch (e) {
			notifyUi(
				`could not switch model/thinking for ${role}: ${e.message}`,
				"warning",
			);
		}
		return switchedModel;
	};

	/** Restore the user's model after an automatic or manual role turn. */
	const restoreModel = async () => {
		if (!preAutoModel) return;
		const m = preAutoModel;
		preAutoModel = null;
		try {
			await pi.setModel(m);
		} catch {
			/* the user can switch back manually */
		}
	};

	/** Advance the fixed dependency-ready implementation wave by one agent turn. */
	const advanceFeatureWave = async (cwd) => {
		if (!featureWave || !bundleExists(cwd)) return;
		try {
			const { hub, settings, state } = await gatherSession(cwd);
			// Pause is persisted before the active agent is aborted. Its agent_end
			// callback may still arrive, but must not consume or dispatch the queue.
			if (state?.paused) return;
			const previousResults = featureWave.results.length;
			const decision = nextFeatureWaveAction(featureWave, hub.features || []);
			if (!decision) return;
			featureWave = decision.wave;
			if (decision.waiting) return;
			for (const result of featureWave.results.slice(previousResults)) {
				notifyUi(
					`wave: ${result.feature} ${result.status}`,
					result.status === "implemented" ? "info" : "warning",
				);
			}
			if (decision.done) {
				const results = featureWave.results;
				const implemented = results.filter(
					(result) => result.status === "implemented",
				).length;
				const failed = results.length - implemented;
				featureWave = null;
				await writeState({
					mode: "manual",
					paused: false,
					phase: "idle",
					active_feature: null,
				});
				await restoreModel();
				session?.clearWorking?.();
				notifyUi(
					`ready wave finished: ${implemented} implemented${failed ? `, ${failed} failed or skipped` : ""} — review remains explicit`,
					failed ? "warning" : "info",
				);
				await refreshHub(cwd);
				return;
			}

			const action = decision.action;
			await writeState({
				mode: "manual",
				paused: false,
				phase: "implementing",
				active_feature: action.feature,
			});
			// The replacement session applies the implementer role when its final
			// skill command starts; switching here would leak a role model into a
			// session that is about to be torn down.
			attribution = { step: action.step, feature: action.feature };
			session?.showWorking({
				text: `Wave: implementing ${action.feature} (${featureWave.results.length}/${featureWave.results.length + featureWave.queue.length + 1} finished)…`,
				step: action.step,
				feature: action.feature,
			});
			await pushStatus(cwd);
			await dispatch(implementationCommand(action.feature, { auto: true }));
		} catch (error) {
			featureWave = null;
			await writeState({
				mode: "manual",
				paused: false,
				phase: "idle",
				active_feature: null,
			});
			await restoreModel();
			session?.clearWorking?.();
			notifyUi(`ready wave stopped: ${error.message}`, "error");
			await refreshHub(cwd);
		}
	};

	/** Snapshot the server-derived ready set, then implement only that wave. */
	const startFeatureWave = async (cwd) => {
		try {
			invalidateSession();
			const { implement } = await gatherSession(cwd);
			const queue = Array.isArray(implement?.ready) ? [...implement.ready] : [];
			if (!queue.length) {
				notifyUi("no dependency-ready features to implement", "warning");
				await refreshHub(cwd);
				return;
			}
			featureWave = { queue, active: null, results: [] };
			session?.showWorking?.(`Ready wave: ${queue.length} feature(s)…`);
			await advanceFeatureWave(cwd);
		} catch (error) {
			featureWave = null;
			session?.clearWorking?.();
			notifyUi(`ready wave did not start: ${error.message}`, "error");
		}
	};

	/** One driver step: decide → bookkeep → dispatch (or finish/escalate). */
	const kickAuto = async (cwd) => {
		if (!bundleExists(cwd)) return;
		try {
			const sess = await gatherSession(cwd);
			const action = nextAutoAction(sess, sess.settings, sess.state);
			if (!action) return;

			if (action.done) {
				await writeState({
					mode: "manual",
					paused: false,
					phase: "done",
					active_feature: null,
				});
				autoSteps = 0;
				await restoreModel();
				notifyUi(
					sess.settings?.auto_retire_prompt === "on"
						? "auto mode: plan complete — every feature landed. Consider retiring the plan from the dashboard."
						: "auto mode: plan complete — every feature landed.",
				);
				await refreshHub(cwd);
				return;
			}
			if (action.escalate) {
				// The escalation detail rides into state.md so the dashboard renders
				// the attention banner (which feature, why, recovery actions) — not
				// just a CLI line.
				await writeState({
					phase: "escalated",
					paused: true,
					escalation: {
						feature: action.feature || null,
						reason: action.reason || "auto mode stopped",
					},
				});
				autoSteps = 0;
				await restoreModel();
				notifyUi(`auto mode needs you: ${action.reason}`, "warning");
				session?.clearWorking?.();
				await pushStatus(cwd);
				await refreshHub(cwd);
				return;
			}
			if (++autoSteps > AUTO_MAX_STEPS) {
				await writeState({
					phase: "escalated",
					paused: true,
					escalation: {
						feature: null,
						reason: `auto mode circuit breaker: ${AUTO_MAX_STEPS} steps in one session — pausing for a human look`,
					},
				});
				autoSteps = 0;
				await restoreModel();
				notifyUi(
					`auto mode circuit breaker: ${AUTO_MAX_STEPS} steps in one session — pausing for a human look`,
					"warning",
				);
				session?.clearWorking?.();
				await pushStatus(cwd);
				await refreshHub(cwd);
				return;
			}

			if (action.strike) {
				await runJson(scriptPath("write"), [], {
					cwd,
					stdin: JSON.stringify({ op: "state", strike: action.strike }),
				});
				invalidateSession();
			}
			await writeState({
				phase: AUTO_PHASE_FOR_STEP[action.step] || "implementing",
				active_feature: action.feature || null,
			});
			if (action.step !== "implement")
				await applyRole(action.role, sess.settings);
			attribution = { step: action.step, feature: action.feature || null };
			const p = sess.hub?.progress || {};
			// Structured working state: the shell renders step/feature and a
			// progress bar; the agent's own messages stream in via pushActivity.
			session?.showWorking({
				text: `Auto: ${action.step} ${action.feature || ""} (${p.done ?? 0}/${p.total ?? 0} done)…`,
				step: action.step,
				feature: action.feature || null,
				progress: { done: p.done ?? 0, total: p.total ?? 0 },
			});
			await pushStatus(cwd);
			try {
				await dispatch(
					action.step === "implement"
						? implementationCommand(action.feature, { auto: true })
						: action.cmd,
				);
			} catch (err) {
				// Recoverable, never a silent stall: keep mode:auto but pause, so
				// the control strip's Continue re-enters kickAuto and re-dispatches.
				await writeState({ paused: true });
				await restoreModel();
				session?.showWorking({
					text: `Auto mode paused — dispatch failed (${err.message}). Press Continue to retry or Abort to reset.`,
				});
				await pushStatus(cwd);
				notifyUi(
					`auto mode paused: dispatch failed (${err.message}) — Continue retries`,
					"warning",
				);
			}
		} catch (e) {
			notifyUi(`auto mode stopped: ${e.message}`, "error");
		}
	};

	/** Flip into auto mode (feature approval with auto_mode:on, or the hub button). */
	const startAuto = async (cwd) => {
		await writeState({
			mode: "auto",
			paused: false,
			phase: "implementing",
			escalation: null,
		});
		autoSteps = 0;
		// All iterator work happens in the plan's worktree (gather/write re-root
		// there automatically) — but if the recorded worktree is missing on
		// disk, auto would silently drive the current checkout: say so.
		try {
			const { hub } = await gatherSession(cwd);
			const wt = hub?.plan?.worktree;
			if (wt && !existsSync(wt)) {
				notifyUi(
					`the plan records worktree ${wt} but it does not exist — auto mode will drive the current checkout`,
					"warning",
				);
			}
		} catch {
			/* advisory only */
		}
		await pushStatus(cwd);
		await kickAuto(cwd);
	};

	const resumeAuto = (cwd) => void kickAuto(cwd);

	/**
	 * Cancel a feature or the whole plan (deterministic write op — never a model
	 * turn, so cancel works even while the agent is stuck). The dashboard's
	 * two-step confirm already happened client-side.
	 */
	const cancelWork = async (op, feature) => {
		const cwd = ctxCwd();
		try {
			const result = await runJson(scriptPath("write"), [], {
				cwd,
				stdin: JSON.stringify({ op, ...(feature ? { feature } : {}) }),
			});
			invalidateSession();
			const d = result.discarded;
			const discardNote =
				d && (d.uncommittedFiles || d.unmergedCommits)
					? ` — discarded ${d.uncommittedFiles} uncommitted file(s), ${d.unmergedCommits} unmerged commit(s)`
					: "";
			notifyUi(
				`${op === "cancel-plan" ? "plan" : `feature ${feature}`} cancelled (archived under ${result.archived})${discardNote}`,
			);
			for (const n of result.notes || []) notifyUi(n, "warning");
			session?.clearWorking?.();
			await pushStatus(cwd);
			await refreshHub(cwd);
		} catch (e) {
			notifyUi(`${op} failed: ${e.message}`, "error");
		}
	};

	/**
	 * Escalation recovery — the dashboard banner's two actions. Both clear the
	 * escalation state; restart additionally discards the feature's changes
	 * (writer op restart-feature, deterministic — no model turn), guide
	 * resumes the flow with the user's instructions as a fresh auto round.
	 */
	const escalationRestart = async (feature) => {
		const cwd = ctxCwd();
		session?.showWorking?.(`Restarting ${feature} — discarding its changes…`);
		try {
			const result = await runJson(scriptPath("write"), [], {
				cwd,
				stdin: JSON.stringify({ op: "restart-feature", feature }),
			});
			invalidateSession();
			notifyUi(
				`feature ${feature} restarted — discarded ${(result.discarded || []).length} file(s)`,
			);
			session?.clearWorking?.();
			await pushStatus(cwd);
			await refreshHub(cwd);
			const { state } = await gatherSession(cwd);
			if (state?.mode === "auto") resumeAuto(cwd);
		} catch (e) {
			session?.clearWorking?.();
			notifyUi(`restart failed: ${e.message}`, "error");
		}
	};

	const escalationGuide = async (feature, guidance) => {
		const cwd = ctxCwd();
		try {
			await runJson(scriptPath("write"), [], {
				cwd,
				stdin: JSON.stringify({
					op: "state",
					set: {
						paused: false,
						phase: "implementing",
						escalation: null,
					},
					...(feature ? { clearStrike: feature } : {}),
				}),
			});
			invalidateSession();
			await pushStatus(cwd);
			session?.showWorking?.("Resuming with your guidance…");
			dispatch(
				feature
					? implementationCommand(feature, {
							auto: true,
							guidance: `user guidance: ${guidance}`,
						})
					: guidance,
			);
		} catch (e) {
			notifyUi(`guide failed: ${e.message}`, "error");
		}
	};

	/** Open one retired plan read-only on the Work tab (deterministic). */
	const openArchive = async (target) => {
		const cwd = ctxCwd();
		try {
			const payload = await gatherPayload(cwd, "archive", target);
			session.showView({
				step: "archive",
				render: () => VIEWS.archive(payload),
			});
		} catch (e) {
			if (lastCtx?.hasUI) lastCtx.ui.notify(`iterator: ${e.message}`, "error");
		}
	};

	const ensureServer = async (ctx) => {
		rememberCtx(ctx);
		if (!session) {
			session = createSessionServer({
				onUnsolicited: (result) => {
					// Deterministic dashboard navigation/actions — no model turn.
					if (result?.type === "settings" && result.values) {
						void saveSettings(result.values);
						return;
					}
					if (result?.type === "backlog") {
						void saveBacklog(result);
						return;
					}
					if (result?.type === "usage-prices" && result.prices) {
						void saveUsagePrices(result.prices);
						return;
					}
					// Settings is shell-owned: dismissal leaves the originating tab,
					// pending round, and Work overlay untouched.
					if (result?.type === "settings-close") {
						session.closeModal();
						return;
					}
					if (result?.type === "cancel") {
						void refreshHub(ctxCwd());
						return;
					}
					if (result?.type === "action" && result.action === "open-settings") {
						void openSettings();
						return;
					}
					if (result?.type === "action" && result.action === "view-archive") {
						void openArchive(result.feature);
						return;
					}
					// Knowledge's page-level Close mirrors Settings: back to Work
					// (decisions/settings-close-returns-to-work) — never a model turn.
					// "planning" is pure navigation too: refresh both dashboard tabs
					// (the shell's Planning tab already holds the view).
					if (result?.type === "action" && result.action === "hub") {
						void refreshHub(ctxCwd(), { activateWork: true });
						return;
					}
					if (
						result?.type === "action" &&
						["close", "planning"].includes(result.action)
					) {
						void refreshHub(ctxCwd());
						return;
					}
					// Implement only the features that are dependency-ready right now;
					// acceptance remains a separate user-controlled review step.
					if (result?.type === "action" && result.action === "implement-wave") {
						session.showWorking("Ready wave: taking a dependency snapshot…");
						void startFeatureWave(ctxCwd());
						return;
					}
					// Hub "Implement all (auto)" button: flip into auto mode for
					// this run without touching the global auto_mode setting.
					if (result?.type === "action" && result.action === "auto-implement") {
						session.showWorking("Auto mode: starting…");
						void startAuto(ctxCwd());
						return;
					}
					if (
						result?.type === "action" &&
						["cancel-feature", "cancel-plan"].includes(result.action)
					) {
						void cancelWork(result.action, result.feature || null);
						return;
					}
					// Escalation banner recovery: deterministic restart, or resume
					// with the user's guidance as a fresh implement round.
					if (
						result?.type === "action" &&
						result.action === "escalation-restart" &&
						result.feature
					) {
						void escalationRestart(result.feature);
						return;
					}
					if (
						result?.type === "action" &&
						result.action === "escalation-guide"
					) {
						void escalationGuide(
							result.feature || null,
							String(result.prompt || "").trim() || "continue",
						);
						return;
					}
					const cmd = actionToCommand(result);
					if (!cmd) return;
					session.showWorking(`Dispatched ${cmd} — Claude is working…`);
					dispatch(cmd);
				},
				onControl,
			});
		}
		if (!session.isRunning()) await session.start();
		return session;
	};

	// ---------------------------------------------------------------------
	// Friendly commands (skills stay the source of the flow logic). An
	// implementation is the one exception: it replaces the Pi session before
	// sending the skill command, so the fresh agent sees the feature contract
	// rather than the accumulated conversation.

	const startImplementationSession = async (args, ctx) => {
		const rawArgs = String(args || "").trim();
		const [commandArgs, guidance] = rawArgs.split(/\s+—\s+/, 2);
		const tokens = commandArgs.split(/\s+/).filter(Boolean);
		let feature = tokens.find((token) => !token.startsWith("--")) || null;
		const auto = tokens.includes("--auto");
		if (!feature) {
			const picked = await pickReadyFeature(ctx);
			if (picked === undefined) return;
			feature = picked;
		}
		const command = `/skill:iterator-implement ${feature}${auto ? " --auto" : ""}${guidance ? ` — ${guidance}` : ""}`;
		const handoff = {
			feature,
			auto,
			autoSteps,
			// A ready-wave lives in extension memory; preserve only its plain,
			// immutable snapshot so the replacement runtime can finish the wave.
			featureWave: featureWave
				? {
						...featureWave,
						queue: [...featureWave.queue],
						results: [...featureWave.results],
					}
				: null,
		};
		// A tester/reviewer role belongs to the old session. Return to the user's
		// model before replacement so an `active` implementer never inherits it.
		await restoreModel();
		const result = await ctx.newSession({
			parentSession: ctx.sessionManager?.getSessionFile?.(),
			setup: async (manager) => {
				manager.appendCustomEntry("iterator-implementation-handoff", handoff);
			},
			withSession: async (replacementCtx) => {
				await replacementCtx.sendUserMessage(command);
			},
		});
		if (result?.cancelled && ctx.hasUI)
			ctx.ui.notify("iterator: fresh implementation session cancelled", "info");
	};

	for (const command of COMMANDS) {
		pi.registerCommand(command.name, {
			description: command.description,
			handler: async (args = "", ctx) => {
				if (command.name === "iterator-implement") {
					await startImplementationSession(args, ctx);
					return;
				}
				const trimmedArgs = String(args).trim();
				dispatch(
					`/skill:${command.name}${trimmedArgs ? ` ${trimmedArgs}` : ""}`,
				);
			},
		});
	}

	pi.registerCommand("iterator-settings", {
		description:
			"Open the project settings (auto mode, per-role models, git flow) in the dashboard.",
		handler: async (_args, ctx) => {
			rememberCtx(ctx);
			try {
				await ensureServer(ctx);
				await openSettings();
			} catch (e) {
				if (ctx.hasUI) ctx.ui.notify(`iterator: ${e.message}`, "error");
			}
		},
	});

	pi.registerCommand("iterator-next", {
		description:
			"Implement the next dependency-ready feature in a fresh session.",
		handler: async (_args, ctx) => {
			try {
				const imp = await gatherPayload(ctx.cwd, "implement");
				if (!imp.next) {
					const why = imp.drafts?.length
						? `only drafts exist — accept the feature set first (/iterator-feature)`
						: imp.stuck
							? "pending features exist but none is ready (dependency cycle?)"
							: "no pending features";
					if (ctx.hasUI)
						ctx.ui.notify(`iterator: nothing to implement — ${why}`, "warning");
					return;
				}
				await startImplementationSession(imp.next.name, ctx);
			} catch (e) {
				if (ctx.hasUI) ctx.ui.notify(`iterator: ${e.message}`, "error");
			}
		},
	});

	/** TUI selector over the ready features; returns a slug, '' for "next", undefined to abort. */
	async function pickReadyFeature(ctx) {
		try {
			const imp = await gatherPayload(ctx.cwd, "implement");
			if (!imp.ready?.length) {
				ctx.ui.notify(
					imp.drafts?.length
						? "iterator: only draft features exist — accept the feature set first (/iterator-feature)"
						: "iterator: no feature is ready to implement",
					"warning",
				);
				return undefined;
			}
			if (imp.ready.length === 1) return imp.ready[0];
			const labels = imp.ready.map((slug) =>
				slug === imp.next?.name ? `${slug} (next)` : slug,
			);
			const choice = await ctx.ui.select("Implement which feature?", labels);
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
			"feature (feature set incl. drafts + architecture concepts), implement (ready wave with " +
			"full contracts incl. relevantMemories), test (feature contract + runner), review " +
			"(diff mapped to features, with pitfall cards), memorize (knowledge-areas state + " +
			"uncovered commits), range (the commit range /iterator-memorize must study), knowledge " +
			"(the Knowledge view payload: areas, concepts, staleness).",
		parameters: Type.Object({
			step: Type.Union(
				GATHER_STEPS.map((s) => Type.Literal(s)),
				{
					description: "Which step payload to gather.",
				},
			),
			feature: Type.Optional(
				Type.String({
					description: "Feature slug (required for test, optional for review).",
				}),
			),
		}),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			try {
				return asText(
					await gatherPayload(ctx.cwd, params.step, params.feature),
				);
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
			"frontmatter/indexes by hand). Ops: plan (write plan.md), features (write the feature set — " +
			"pass status 'draft' when proposing; returns sizing warnings), update-feature (targeted " +
			"frontmatter update: status/tests/done/reviewed + appendCommit/appendReview), adjustments " +
			"(apply a feature UI result verbatim: spread the result object in, e.g. " +
			"{op:'adjustments', ...uiResult}; accept:true or type:'plan-approved' promotes drafts to pending), " +
			"memorize (okf-memory shared bundle: create/update/delete knowledge concepts in " +
			"architecture/decisions/patterns/pitfalls/setup and/or advance last_memorized_commit), " +
			"commit-feature (the implement step's commit: stages the listed files plus the feature's " +
			"files:/tests: matches, commits feature(<slug>) with the Feature: trailer, flips status to " +
			"implemented, records the sha — review then reads the commit diff), " +
			"commit-tests (the test step's twin: test(<slug>) commit + tests/tests_status recording), " +
			"accept-commit (process the review UI's accept result end to end: features already " +
			"committed via commit-feature just flip to done; commit-less ones get branch safety, " +
			"per-feature commits with trailers, done flips, sha recording — plus memory verdicts and " +
			"pointer advance; pass the UI result plus per-feature testsStatus/summary and advance:true|false), " +
			"record-review (pipe a review-feedback UI result verbatim to record statuses/notes), " +
			"record-plan-review (record the whole-plan review's report in plan.md + set plan_reviewed), " +
			"restart-feature (escalation recovery: discard a feature's working-tree changes and reset it to pending), " +
			"refresh-format (recopy templates/format.md over the bundle's stale copy), " +
			"retire-plan (condense a finished plan into a decisions/ concept and archive its " +
			"features — pass concept:{slug,title,description,body}), settings (merge project " +
			"settings into memory/settings.md — pass values:{...}; --schema settings lists the " +
			"keys), state (machine runtime state in memory/state.md: set/strike/clearStrike). " +
			"For okf memory reviews prefer the schema-tight okf_write tool over op apply-review here.",
		parameters: Type.Object(
			{
				op: Type.Union(
					[
						"plan",
						"features",
						"design",
						"settings",
						"state",
						"update-feature",
						"adjustments",
						"memorize",
						"apply-review",
						"refresh-format",
						"retire-plan",
						"accept-commit",
						"commit-feature",
						"commit-tests",
						"record-review",
						"record-plan-review",
						"restart-feature",
					].map((s) => Type.Literal(s)),
					{ description: "Writer operation." },
				),
			},
			{ additionalProperties: true },
		),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			try {
				rememberCtx(ctx);
				const result = await runJson(scriptPath("write"), [], {
					cwd: ctx.cwd,
					stdin: JSON.stringify(params),
				});
				invalidateSession(); // the bundle just changed under the snapshot
				void refreshStatus(ctx); // writes move the footer's numbers
				// Issue 5: auto mode starts right after the feature set is approved
				// (adjustments accept / plan-approved) when the setting is on.
				const approved =
					(params.op === "adjustments" || params.type === "plan-approved") &&
					(params.accept === true || params.type === "plan-approved");
				if (approved) {
					void refreshHub(ctx.cwd, { activateWork: true });
					try {
						const { settings, state } = await gatherSession(ctx.cwd);
						if (settings?.auto_mode === "on" && state?.mode !== "auto") {
							notifyUi(
								"auto mode: feature set approved — driving test → implement → review automatically",
							);
							void startAuto(ctx.cwd);
						}
					} catch {
						/* never block the write result on the driver */
					}
				}
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
			mode: Type.Union(
				["init", "consolidate", "memorize"].map((s) => Type.Literal(s)),
				{
					description: "Which okf flow this review belongs to.",
				},
			),
			headCommit: Type.Optional(
				Type.String({
					description:
						"The reviewed head sha; advances last_memorized_commit. Omit for consolidate.",
				}),
			),
			memories: Type.Array(
				Type.Object(
					{
						id: Type.String({ description: "<area>/<slug>" }),
						area: Type.Union(OKF_AREA_NAMES.map((a) => Type.Literal(a))),
						action: Type.Union(
							["create", "update", "delete", "keep"].map((s) =>
								Type.Literal(s),
							),
						),
						type: Type.Optional(Type.String()),
						title: Type.Optional(Type.String()),
						description: Type.Optional(Type.String()),
						status: Type.Optional(Type.String()),
						date: Type.Optional(Type.String()),
						tags: Type.Optional(Type.Array(Type.String())),
						files: Type.Optional(
							Type.Array(
								Type.String({
									description: "Repo-relative anchor paths/globs.",
								}),
							),
						),
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
					verdict: Type.Union(
						["accept", "reject", "keep", "delete"].map((s) => Type.Literal(s)),
					),
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
			"pass gathered payloads or feature bodies. `extra` is only for the small agent-authored " +
			"fields: plan → {title, plan:{goal,architecture,keyDecisions}, dependencies}; " +
			"test → {cases:[...]}; review after implementing → {mode:'commit', tests:{status,total,passing}}; " +
			"hub/feature/review → none (feature drafts are read from disk).",
		parameters: Type.Object({
			step: Type.Union(
				UI_STEPS.map((s) => Type.Literal(s)),
				{
					description: "Which view to show.",
				},
			),
			feature: Type.Optional(
				Type.String({
					description: "Feature slug (required for test, optional for review).",
				}),
			),
			extra: Type.Optional(
				Type.Any({
					description:
						"Agent-authored fields merged over the gathered payload.",
				}),
			),
		}),
		async execute(_id, params, signal, _onUpdate, ctx) {
			try {
				await ensureServer(ctx);
				// Auto-mode gate guard: an unattended auto run must never block on
				// a browser answer. A skill that ignores its --auto instruction and
				// opens a gate view (test plan / question) would hang the feature in
				// its phase forever — refuse the round and tell the agent to
				// continue non-interactively instead.
				if (["test", "question", "review"].includes(params.step)) {
					const st = (await gatherSession(ctx.cwd))?.state;
					if (st?.mode === "auto" && !st?.paused) {
						return asText({
							type: "auto-skip",
							report:
								"Auto mode is driving this flow — do NOT wait for a browser answer. " +
								"Proceed non-interactively as your skill's --auto/--agent section describes " +
								"(tester: write the red tests and commit via the writer; reviewer: judge the " +
								"gathered diff and record/accept via the writer). Report and stop.",
						});
					}
				}
				// memory-review has no gather step of its own: the cards are
				// agent-drafted (extra.memories); areas/branch come from the
				// knowledge payload. question is fully agent-authored (extra).
				const gathered =
					params.step === "memory-review"
						? (({ branch, project, bundlePath, areas }) => ({
								step: "memory-review",
								branch,
								project,
								bundlePath,
								areas,
							}))(await gatherPayload(ctx.cwd, "knowledge"))
						: params.step === "question"
							? {
									step: "question",
									branch: (await gatherSession(ctx.cwd))?.hub?.branch,
								}
							: await gatherPayload(ctx.cwd, params.step, params.feature);
				// Deterministic zero-change guard: never open a review on nothing.
				if (params.step === "review" && gathered.hasChanges === false) {
					return asText({
						type: "no-changes",
						report:
							"Nothing to review — the chosen scope has no diff and no recorded commits. Relay the progress summary instead of opening a review. If work DID happen, the usual causes are: it was committed outside the accept flow (check `git log` for the feature’s files — a commit without a `Feature:` trailer is invisible here), or it landed in a different checkout (plan worktree vs main).",
						progress: gathered.progress || null,
					});
				}
				// The settings form upgrades its model fields to dropdowns when the
				// registry rides along.
				if (params.step === "settings") {
					const models = modelOptions();
					if (models) gathered.models = models;
				}
				const payload = mergePayload(gathered, params.extra);
				// Memory cards arrive body-less — read current concept bodies from
				// disk for display, so the agent never echoes them.
				hydrateMemoryCards(payload, ctx.cwd);
				const result = await session.showStep({
					step: params.step,
					render: () => VIEWS[params.step](payload),
					signal,
				});
				// Apply-on-approve (mirrors lib/app.mjs): an approved plan is
				// written by the deterministic writer right here, so the agent
				// never echoes the sections back through a second write call.
				if (
					params.step === "plan" &&
					params.extra?.apply === true &&
					result?.type === "plan-approved"
				) {
					let applied;
					try {
						applied = await runJson(scriptPath("write"), [], {
							cwd: ctx.cwd,
							stdin: JSON.stringify({
								op: "plan",
								title: payload.title,
								...(payload.description
									? { description: payload.description }
									: {}),
								sections: result.sections,
								dependencies: result.dependencies || [],
							}),
						});
					} catch (e) {
						applied = { ok: false, error: e.message };
					}
					invalidateSession();
					if (applied?.ok) await refreshHub(ctx.cwd, { activateWork: true });
					return asText({ ...result, applied });
				}
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
		rememberCtx(ctx);
		const workOwner = session?.ensureWorking?.("AI is working…") ?? null;
		agentWorkOwners.push(workOwner);
		const manualRoleTurn = { switched: false };
		manualRoleTurns.push(manualRoleTurn);
		try {
			const { hub, implement, settings, state } = await gatherSession(ctx.cwd);
			const role = pendingRole;
			pendingRole = null; // role input belongs to exactly one agent turn
			if (
				shouldApplyRole(role, {
					mode: state?.mode,
					featureWave,
				})
			) {
				manualRoleTurn.switched = await applyRole(role, settings);
			}
			// Model selection also applies to /iterator-plan before a bundle exists;
			// only the ambient bundle context depends on durable plan state.
			if (!bundleExists(ctx.cwd)) return undefined;
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
	// Token-usage ledger: every assistant turn's tokens are buffered with the
	// current flow attribution and flushed once per agent loop into
	// memory/usage.md (writer op `usage`). usage_ledger: off skips the write.

	let attribution = null; // { step, feature } | null — sticky until the flow changes
	let usageBuffer = [];

	pi.on("input", async (event) => {
		pendingRole = roleFromInput(event.text);
		const a = attributionFromInput(event.text);
		if (a) attribution = a;
	});

	pi.on("turn_end", async (event, ctx) => {
		rememberCtx(ctx);
		const row = usageRowFromMessage(event.message, attribution);
		if (row) usageBuffer.push(row);
	});

	const flushUsage = async (cwd) => {
		if (!usageBuffer.length || !bundleExists(cwd)) return;
		const rows = usageBuffer;
		usageBuffer = [];
		try {
			const { settings } = await gatherSession(cwd);
			if (settings?.usage_ledger === "off") return;
			await runJson(scriptPath("write"), [], {
				cwd,
				stdin: JSON.stringify({ op: "usage", rows }),
			});
			invalidateSession(); // usage.md just changed under the snapshot
		} catch {
			/* a ledger failure must never take pi down */
		}
	};

	// ---------------------------------------------------------------------
	// Working-overlay narration: every finished assistant message becomes the
	// overlay's live line, so the blocked Work tab shows what the agent is
	// doing instead of one string set per step. pushActivity no-ops unless an
	// overlay is actually up, so non-auto turns cost one string build.

	pi.on("message_end", async (event) => {
		const line = activityTextFromMessage(event?.message);
		if (line) session?.pushActivity?.(line);
		return undefined; // returning { message } would REPLACE the message
	});

	// ---------------------------------------------------------------------
	// Session lifecycle: dashboard up for every project, down with pi. A
	// plan-less project lands on Planning's goal/init hero rather than an empty
	// Work tab.

	pi.on("session_start", async (event, ctx) => {
		rememberCtx(ctx);
		const sessionEntries = ctx.sessionManager?.getEntries?.() || [];
		// A persisted marker is only a handoff during the session replacement
		// that created it. On reload/restart, retain the normal auto safety pause.
		const handoff = implementationHandoffState(sessionEntries, event?.reason);
		if (handoff?.featureWave) featureWave = handoff.featureWave;
		if (handoff) autoSteps = handoff.autoSteps;
		await refreshStatus(ctx);
		try {
			await ensureServer(ctx);
			// An auto run interrupted by a restart never resumes by surprise:
			// pause it and let the human press Continue in the dashboard.
			const { state } = await gatherSession(ctx.cwd);
			if (
				!handoff &&
				state?.mode === "auto" &&
				!state.paused &&
				["testing", "implementing", "reviewing"].includes(state.phase)
			) {
				await writeState({ paused: true });
				if (ctx.hasUI)
					ctx.ui.notify(
						"iterator: an auto-mode run was interrupted — press Continue in the dashboard to resume",
						"info",
					);
			}
			await refreshHub(ctx.cwd, { preferPlanning: true });
		} catch (e) {
			if (ctx.hasUI)
				ctx.ui.notify(
					`iterator: dashboard failed to start: ${e.message}`,
					"warning",
				);
		}
	});

	pi.on("session_shutdown", async () => {
		if (session) await session.stop();
	});

	// Keep the idle dashboard + footer current so they reflect reality.
	pi.on("agent_end", async (_event, ctx) => {
		rememberCtx(ctx);
		const endedWorkOwner = agentWorkOwners.shift() ?? null;
		const manualRoleTurn = manualRoleTurns.shift();
		try {
			invalidateSession(); // the turn may have changed files/commits
			await flushUsage(ctx.cwd);
			if (manualRoleTurn?.switched) await restoreModel();
			await refreshHub(ctx.cwd);
			await refreshStatus(ctx);
			// Keep abortPending set until this stale agent_end reaches its final
			// decision. Continue sees the flag and waits; once we clear it, exactly one
			// side owns resumption: this callback when already unpaused, or a later
			// Continue click when still paused.
			if (featureWave?.abortPending) {
				const { state } = await gatherSession(ctx.cwd);
				featureWave = completeFeatureWaveAbort(featureWave);
				if (!state?.paused) await advanceFeatureWave(ctx.cwd);
			} else if (featureWave) {
				// A ready-wave snapshot advances before auto mode. Wave implementation
				// intentionally stops at implemented; review remains a separate action.
				await advanceFeatureWave(ctx.cwd);
			} else {
				await kickAuto(ctx.cwd);
			}
		} finally {
			// If auto/wave dispatch claimed a newer overlay above, this stale owner is
			// ignored. Otherwise the completed or aborted agent reveals the latest
			// dashboard view that refreshHub stored underneath it.
			if (endedWorkOwner !== null) session?.clearWorking?.(endedWorkOwner);
		}
	});

	// ---------------------------------------------------------------------
	// Guardrails: protect writer-owned bundle state against direct edits.

	pi.on("tool_call", async (event, ctx) => {
		rememberCtx(ctx);
		if (event.toolName === "write" || event.toolName === "edit") {
			const path = event.input?.path;
			rememberFile(ctx.cwd, path);
			if (!path) return undefined;
			// Anchor classification to the resolved bundle dir so a project's own
			// src/memory/features/*.md is never blocked as a bundle file.
			const root = projectRoot(ctx.cwd);
			const abs = resolve(ctx.cwd, String(path)).split("\\").join("/");
			const opts = { root };
			if (
				!(
					isFeatureFile(abs, process.env, root) ||
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
			if (verdict.block)
				return { block: true, reason: `iterator: ${verdict.reason}` };
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
				{ features: featuresDirEntries(ctx.cwd) },
			);
			if (verdict?.warn && ctx.hasUI)
				ctx.ui.notify(`iterator: ${verdict.reason}`, "warning");
		}
		return undefined;
	});
}
