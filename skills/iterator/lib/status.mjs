/**
 * The single source of truth for plan/feature states and every rule derived
 * from them. Write guards, gather payloads, and views all delegate here so a
 * status rule is stated exactly once.
 *
 * Feature lifecycle: draft → pending → implemented → done.
 *  - draft:       an unaccepted feature proposal (feature-set review promotes it)
 *  - pending:     accepted, waiting to be implemented
 *  - implemented: committed (feature(<slug>) commits with the Feature:
 *                 trailer, via commit-feature), awaiting review; legacy
 *                 working-tree rounds reach it uncommitted via update-feature
 *  - done:        reviewed & accepted — owned exclusively by accept-commit,
 *                 terminal (restart-feature is an op precondition, not a
 *                 status transition: it discards work, so drafts are excluded)
 *
 * The table deliberately tightens historical behavior: draft can never jump
 * straight to done, and done is never reopened by update-feature.
 */

export const FEATURE_STATUSES = ["draft", "pending", "implemented", "done"];
export const PLAN_STATUSES = ["draft", "approved"];
/** Statuses the features op may create with; done is owned by accept-commit. */
export const CREATABLE_STATUSES = ["draft", "pending"];

/** from → the statuses reachable from it (self-transitions are idempotent). */
export const FEATURE_TRANSITIONS = {
	draft: ["draft", "pending"],
	pending: ["pending", "implemented", "done"],
	implemented: ["implemented", "pending", "done"],
	done: ["done"],
};

export function canTransition(from, to) {
	return (FEATURE_TRANSITIONS[from || "pending"] || []).includes(to);
}

/**
 * A dependency satisfies its dependents when it is done (reviewed &
 * accepted) — or merely implemented (committed, unreviewed), when
 * review_required is off.
 */
export function depSatisfied(status, settings) {
	return (
		status === "done" ||
		(status === "implemented" && settings?.review_required === "off")
	);
}

/** The slugs whose dependents are unblocked. Takes bundle features ({slug, fm}). */
export function satisfiedSet(features, settings) {
	return new Set(
		features
			.filter((c) => depSatisfied(c.fm.status, settings))
			.map((c) => c.slug),
	);
}

/**
 * Op precondition for restart-feature (not a status transition): restart
 * discards the feature's working-tree footprint, which only makes sense for
 * work that started — drafts have nothing to discard.
 */
export const RESTARTABLE_STATUSES = ["pending", "implemented"];

/** The slugs still standing between a plan and retirement. */
export const unfinished = (features) =>
	features
		.filter((c) => (c.fm.status || "pending") !== "done")
		.map((c) => c.slug);

const listy = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/**
 * Per-feature readiness, computed once server-side so views only render:
 * Map slug → { ready, waitingOn: [unsatisfied dependency slugs] }.
 * Takes bundle features ({slug, fm}).
 */
export function readiness(features, settings) {
	const satisfied = satisfiedSet(features, settings);
	const out = new Map();
	for (const c of features) {
		const waitingOn = listy(c.fm.depends_on).filter((d) => !satisfied.has(d));
		out.set(c.slug, { ready: waitingOn.length === 0, waitingOn });
	}
	return out;
}

/**
 * The plan's derived lifecycle stage — never stored, always recomputed, so
 * feature statuses stay the one source of truth. Views drive their
 * plan-lifecycle controls from this.
 *
 *   no-plan | plan-draft | needs-features | feature-review |
 *   implementing | awaiting-plan-review | retirable
 *
 * `retirable` implies every feature is done (whole-plan review remains
 * offered as a re-review); `awaiting-plan-review` means everything landed
 * (implemented|done) but review/acceptance is still outstanding.
 */
export function planStage(plan, features, _settings) {
	if (!plan) return "no-plan";
	if ((plan.fm.status || "draft") !== "approved") return "plan-draft";
	if (!features.length) return "needs-features";
	const statuses = features.map((c) => c.fm.status || "pending");
	if (statuses.includes("draft")) return "feature-review";
	if (statuses.every((s) => s === "done")) return "retirable";
	if (statuses.every((s) => s === "done" || s === "implemented"))
		return "awaiting-plan-review";
	return "implementing";
}
