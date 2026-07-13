/**
 * iterator: project settings + runtime state definitions.
 *
 * Single source of truth for every configurable key: the writer validates
 * against these defs (op `settings`), gather merges them into effective
 * values, and the settings view renders its form from the same table.
 * Settings live in `memory/settings.md` (type: Settings, user-owned via the
 * UI); machine runtime state lives in `memory/state.md` (type: State,
 * writer-owned, never hand-edited).
 *
 * Model-valued keys hold `"active"` (use the session's current model) or a
 * `"<provider>/<model-id>"` string resolved by the pi extension at dispatch
 * time — this module never talks to a model registry.
 */

/** Key definitions: kind (enum|int|model), allowed values / bounds, default. */
export const SETTINGS_DEFS = {
	auto_mode: {
		kind: "enum",
		values: ["off", "on"],
		default: "off",
		label: "Auto mode",
		help: "After the chunk set is approved, run test → implement → review automatically; a reviewer agent replaces the human until escalation.",
	},
	planner_model: {
		kind: "model",
		default: "active",
		label: "Planner model",
		help: "Model for /iterator-plan turns — 'active' uses the session model.",
	},
	implementer_model: {
		kind: "model",
		default: "active",
		label: "Implementer model",
		help: "Model for /iterator-implement turns.",
	},
	tester_model: {
		kind: "model",
		default: "active",
		label: "Tester model",
		help: "Model for /iterator-test turns.",
	},
	reviewer_model: {
		kind: "model",
		default: "active",
		label: "Reviewer model",
		help: "Model for auto-mode review turns — pick a strong model here; it stands in for you until escalation.",
	},
	// Thinking defaults are per-task judgment calls: planning and reviewing
	// are where deep reasoning pays off (architecture trade-offs, catching
	// subtle defects); implementing follows an already-thought-out contract
	// (medium), and test-writing is the most mechanical step (low). 'active'
	// keeps the session's current level instead.
	planner_thinking: {
		kind: "enum",
		values: ["active", "off", "minimal", "low", "medium", "high", "xhigh"],
		default: "high",
		label: "Planner thinking",
		help: "Thinking level for /iterator-plan turns — planning trade-offs reward deep reasoning; 'active' keeps the session's current level.",
	},
	implementer_thinking: {
		kind: "enum",
		values: ["active", "off", "minimal", "low", "medium", "high", "xhigh"],
		default: "medium",
		label: "Implementer thinking",
		help: "Thinking level for /iterator-implement turns — the chunk contract already carries the thinking; medium keeps it sharp without burning tokens.",
	},
	tester_thinking: {
		kind: "enum",
		values: ["active", "off", "minimal", "low", "medium", "high", "xhigh"],
		default: "low",
		label: "Tester thinking",
		help: "Thinking level for /iterator-test turns — test-writing follows the contract mechanically.",
	},
	reviewer_thinking: {
		kind: "enum",
		values: ["active", "off", "minimal", "low", "medium", "high", "xhigh"],
		default: "high",
		label: "Reviewer thinking",
		help: "Thinking level for review turns — the stand-in reviewer needs depth to catch what you would.",
	},
	testing_default: {
		kind: "enum",
		values: ["on", "off"],
		default: "on",
		label: "Tests by default",
		help: "Write red tests for each chunk before implementing (auto mode and /iterator-next).",
	},
	branch_per_plan: {
		kind: "enum",
		values: ["on", "off"],
		default: "on",
		label: "Branch per plan",
		help: "Create an iterator/<plan-slug> branch when a plan is approved on main/master.",
	},
	worktree_per_plan: {
		kind: "enum",
		values: ["on", "off"],
		default: "on",
		label: "Worktree per plan",
		help: "Check the plan branch out in a separate git worktree (../<repo>-iterator-<plan-slug>) so the main checkout stays untouched; off = plain checkout -b in place. Only applies when branch-per-plan is on.",
	},
	max_review_iterations: {
		kind: "int",
		min: 1,
		max: 10,
		default: 3,
		label: "Max review iterations",
		help: "Auto mode: after this many needs-work reviews on the same chunk, stop and escalate to you.",
	},
	block_commit_on_leftovers: {
		kind: "enum",
		values: ["on", "off"],
		default: "on",
		label: "Block commit on leftovers",
		help: "Refuse accept-commit while changed files are neither assigned to a chunk nor explicitly skipped.",
	},
	memorize_nudge: {
		kind: "int",
		min: 0,
		max: 100,
		default: 5,
		label: "Memorize nudge",
		help: "Nudge toward /okf-memorize once this many commits are unmemorized (0 disables).",
	},
	usage_ledger: {
		kind: "enum",
		values: ["on", "off"],
		default: "on",
		label: "Token usage ledger",
		help: "Record per-step model/token usage into memory/usage.md (pi sessions only).",
	},
	auto_retire_prompt: {
		kind: "enum",
		values: ["on", "off"],
		default: "on",
		label: "Retire prompt",
		help: "Offer retiring the plan once every chunk is done.",
	},
};

export const SETTINGS_KEYS = Object.keys(SETTINGS_DEFS);

/** The full defaults object. */
export function settingsDefaults() {
	const out = {};
	for (const k of SETTINGS_KEYS) out[k] = SETTINGS_DEFS[k].default;
	return out;
}

/**
 * Validate a partial settings object against the defs.
 * Returns { ok, errors, values } — `values` holds the normalized entries
 * (ints coerced) for exactly the keys present in `partial`.
 */
export function validateSettings(partial) {
	const errors = [];
	const values = {};
	for (const [key, raw] of Object.entries(partial || {})) {
		const def = SETTINGS_DEFS[key];
		if (!def) {
			errors.push(`unknown setting '${key}' (${SETTINGS_KEYS.join("|")})`);
			continue;
		}
		if (def.kind === "enum") {
			if (!def.values.includes(String(raw))) {
				errors.push(`${key}: '${raw}' is not one of ${def.values.join("|")}`);
				continue;
			}
			values[key] = String(raw);
		} else if (def.kind === "int") {
			const n = Number(raw);
			if (!Number.isInteger(n) || n < def.min || n > def.max) {
				errors.push(`${key}: '${raw}' must be an integer in [${def.min}, ${def.max}]`);
				continue;
			}
			values[key] = n;
		} else if (def.kind === "model") {
			const s = String(raw).trim();
			if (!s || /\s/.test(s)) {
				errors.push(`${key}: '${raw}' must be 'active' or '<provider>/<model-id>'`);
				continue;
			}
			values[key] = s;
		}
	}
	return { ok: errors.length === 0, errors, values };
}

/**
 * Effective settings: defaults overlaid with whatever the settings.md
 * frontmatter defines (unknown/invalid entries are ignored, never fatal —
 * a hand-mangled settings file must not take a gather down).
 */
export function effectiveSettings(fm) {
	const out = settingsDefaults();
	const { values } = validateSettings(
		Object.fromEntries(
			Object.entries(fm || {}).filter(([k]) => SETTINGS_KEYS.includes(k)),
		),
	);
	return { ...out, ...values };
}

// ---------------------------------------------------------------------------
// Runtime state (memory/state.md)

export const STATE_PHASES = [
	"idle",
	"chunking",
	"testing",
	"implementing",
	"reviewing",
	"escalated",
	"done",
];

export const STATE_DEFAULTS = {
	mode: "manual", // manual | auto
	paused: false,
	phase: "idle",
	active_chunk: null,
	strikes: {}, // { <chunk-slug>: needs-work count }
};

/**
 * Parse a state.md frontmatter object into a normalized state (defaults for
 * anything missing; `strikes` is stored as a JSON string scalar).
 */
export function parseState(fm) {
	const out = { ...STATE_DEFAULTS, strikes: {} };
	if (!fm || typeof fm !== "object") return out;
	if (fm.mode === "auto" || fm.mode === "manual") out.mode = fm.mode;
	out.paused = String(fm.paused) === "true";
	if (STATE_PHASES.includes(fm.phase)) out.phase = fm.phase;
	if (fm.active_chunk && fm.active_chunk !== "null") {
		out.active_chunk = String(fm.active_chunk);
	}
	try {
		const s = JSON.parse(String(fm.strikes || "{}"));
		if (s && typeof s === "object" && !Array.isArray(s)) {
			for (const [k, v] of Object.entries(s)) {
				const n = Number(v);
				if (Number.isInteger(n) && n >= 0) out.strikes[k] = n;
			}
		}
	} catch {
		/* mangled strikes → empty */
	}
	return out;
}
