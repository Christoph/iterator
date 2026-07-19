#!/usr/bin/env node
/**
 * iterator: deterministic state gathering for every step of the flow.
 *
 * Prints a step payload JSON to stdout so the SKILL.mds can pipe it straight
 * into server.mjs — no LLM-improvised file reading or git parsing:
 *
 *   node <skill-dir>/gather.mjs [project-root] [--step <step>] [--feature <slug>]
 *
 * Steps:
 *   hub        (default) full dashboard payload: plan, features, badges,
 *              hasDiff/hasCommits per feature
 *   plan       plan-review skeleton: branch + existing plan sections/deps
 *              (the agent fills/edits the semantic text, then pipes to server)
 *   feature      feature-plan payload: existing features with notes/snippets bodies
 *   review     complete review payload: git diff parsed into hunks, mapped to
 *              features via their `files` globs, with stats/complexity; for a
 *              done feature with a clean tree the diff is rebuilt from its
 *              recorded commits (or the `Feature: <slug>` trailer)
 *   test       test-plan skeleton: feature contract, red/green mode from
 *              status, detected runner + existing test-file conventions
 *   implement  not a server payload — every dependency-ready feature with its
 *              full contract (`wave`, first repeated as `next`), plus what is
 *              blocked on what and the designFile path when memory/design.md
 *              exists
 *   memorize   not a server payload — okf shared-bundle state: whether the
 *              bundle carries OKF knowledge areas, their concept inventory,
 *              and the commits `last_memorized_commit` has not covered yet
 *              (for the post-accept memory evaluation)
 *   range      not a server payload — the commit range /iterator-memorize must
 *              study: pointer validation, merge-base fallback, commit list
 *   knowledge  Knowledge-view payload: bundle status (pointer, staleness,
 *              unmemorized commits), knowledge areas + concepts, design card
 *
 * Resolves the bundle at <git-root>/memory (or $ITERATOR_MEMORY_DIR relative
 * to the git root). No bundle → hub prints `"plan": null` (Create-plan hero).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { git } from "./git.mjs";
import { effectiveSettings, parseState } from "./settings.mjs";
import { planStage, readiness, satisfiedSet } from "./status.mjs";
import {
	backlogItems,
	body,
	frontmatter,
	globToRegExp,
	listy,
	matchConcepts,
	OKF_AREA_NAMES,
	OKF_AREAS,
	resolveTemplate,
	sections,
	snippets,
} from "./bundle.mjs";

// Re-export the shared bundle helpers so existing importers (write.mjs, the
// test suites) keep one entry point for reading the bundle.
export {
	body,
	frontmatter,
	globToRegExp,
	listy,
	matchConcepts,
	sections,
	snippets,
};

/**
 * feature-slug → commit shas (oldest first), from ONE `git log` trailer scan
 * instead of a per-feature `--grep` pass (which is O(features × history)).
 * Memoized per (root, HEAD) so repeated gathers in one process stay cheap
 * while a commit made mid-process invalidates the cache.
 */
let featureCommitCache = null;
export function featureCommitMap(root) {
	const head = git(["rev-parse", "HEAD"], root);
	const key = `${root}\0${head}`;
	if (featureCommitCache?.key === key) return featureCommitCache.map;
	const map = new Map();
	if (head) {
		const out = git(
			[
				"log",
				"--reverse",
				"--format=%H%x09%(trailers:key=Feature,valueonly,separator=%x2C)",
			],
			root,
		);
		for (const line of out.split("\n")) {
			const [sha, trailers] = line.split("\t");
			if (!sha || !trailers) continue;
			for (const slug of trailers.split(",")) {
				const s = slug.trim();
				if (!s) continue;
				if (!map.has(s)) map.set(s, []);
				map.get(s).push(sha);
			}
		}
	}
	featureCommitCache = { key, map };
	return map;
}

/**
 * Commits `base..HEAD` excluding memory-only bookkeeping (sha recording,
 * memory writes) — shared by the memorize and range steps so their ranges
 * can never drift apart.
 */
function commitsSince(b, base) {
	const pathspec = isAbsolute(b.memName)
		? []
		: ["--", ".", `:(exclude)${b.memName}`];
	return git(["log", "--format=%H%x09%s", `${base}..HEAD`, ...pathspec], b.root)
		.split("\n")
		.filter(Boolean)
		.map((l) => {
			const [sha, ...s] = l.split("\t");
			return { sha, subject: s.join("\t") };
		});
}

/**
 * Load the whole bundle once: root/branch from git, plan + feature documents
 * with parsed frontmatter and body sections, features in index (topological)
 * order. Shared by every gather step and by write.mjs.
 */
export function loadBundle(startDir) {
	const cwd = startDir || process.cwd();
	const root = git(["rev-parse", "--show-toplevel"], cwd) || cwd;
	const memName = process.env.ITERATOR_MEMORY_DIR || "memory";
	const memDir = isAbsolute(memName) ? memName : join(root, memName);
	const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], root) || "HEAD";

	let plan = null;
	const planFile = join(memDir, "plan.md");
	if (existsSync(planFile)) {
		const raw = readFileSync(planFile, "utf8");
		plan = { raw, fm: frontmatter(raw), sections: sections(raw) };
	}

	// ALL plan work happens in the plan's worktree when one is recorded
	// (worktree_per_plan): re-root so every gather/write — and therefore every
	// implement/review/commit — operates on that checkout no matter where it
	// was invoked from. The session may sit in the main checkout while the
	// work lives in the worktree; this is also what lets plans run in
	// parallel later. The worktree's own plan.md records the same path, so
	// the recursion terminates after one hop.
	if (plan?.fm.worktree) {
		const wt = isAbsolute(String(plan.fm.worktree))
			? String(plan.fm.worktree)
			: resolve(root, String(plan.fm.worktree));
		if (existsSync(wt) && resolve(wt) !== resolve(root)) {
			return loadBundle(wt);
		}
	}

	let design = null;
	const designFile = join(memDir, "design.md");
	if (existsSync(designFile)) {
		const raw = readFileSync(designFile, "utf8");
		design = { raw, fm: frontmatter(raw), sections: sections(raw) };
	}

	const backlogFile = join(memDir, "backlog", "index.md");
	const backlog = existsSync(backlogFile)
		? backlogItems(readFileSync(backlogFile, "utf8"))
		: [];

	// Project settings + runtime state: always-present normalized objects
	// (defaults when the files are missing or mangled).
	const settingsFile = join(memDir, "settings.md");
	const settings = effectiveSettings(
		existsSync(settingsFile)
			? frontmatter(readFileSync(settingsFile, "utf8"))
			: null,
	);
	const settingsDefined = existsSync(settingsFile);
	const stateFile = join(memDir, "state.md");
	const state = parseState(
		existsSync(stateFile) ? frontmatter(readFileSync(stateFile, "utf8")) : null,
	);

	const featuresDir = join(memDir, "features");
	let slugs = [];
	if (existsSync(featuresDir)) {
		slugs = readdirSync(featuresDir)
			.filter((f) => f.endsWith(".md") && f !== "index.md")
			.map((f) => f.slice(0, -3));
	}
	// Keep the index's (topological) order when it exists; append strays.
	const indexFile = join(featuresDir, "index.md");
	if (existsSync(indexFile)) {
		const ordered = [
			...readFileSync(indexFile, "utf8").matchAll(/\]\(([^)]+)\.md\)/g),
		]
			.map((m) => m[1])
			.filter((s) => slugs.includes(s));
		slugs = [...ordered, ...slugs.filter((s) => !ordered.includes(s))];
	}
	const features = slugs.map((slug) => {
		const raw = readFileSync(join(featuresDir, `${slug}.md`), "utf8");
		return { slug, raw, fm: frontmatter(raw), sections: sections(raw) };
	});

	return {
		cwd,
		root,
		memName,
		memDir,
		branch,
		plan,
		design,
		backlog,
		settings,
		settingsDefined,
		state,
		features,
	};
}

/** Decision conflicts stored in a feature's frontmatter (JSON scalar). */
export function featureConflicts(fm) {
	try {
		const v = JSON.parse(String(fm?.conflicts || "[]"));
		return Array.isArray(v) ? v.filter((x) => x && x.decision) : [];
	} catch {
		return [];
	}
}

/** A feature document in the shape the feature-plan UI expects. */
function featureToUi(c) {
	return {
		name: c.slug,
		title: c.fm.title || c.slug,
		description: c.fm.description || "",
		implementationNotes: c.sections["Implementation notes"] || "",
		files: listy(c.fm.files),
		dependsOn: listy(c.fm.depends_on),
		size: c.fm.size || "small",
		status: c.fm.status || "pending",
		snippets: snippets(c.sections["Snippets"]),
		// Writer-computed at feature time: the memory files the implementer reads
		// first, and any decision conflicts the slicing model flagged.
		memories: listy(c.fm.memories),
		conflicts: featureConflicts(c.fm),
	};
}

const progress = (features) => ({
	done: features.filter((c) => (c.fm.status || "pending") === "done").length,
	total: features.length,
});

// ---------------------------------------------------------------------------
// knowledge concepts + anchor matching (memory flowing back into the work)

/**
 * Every knowledge concept with its `files:` anchors, cheap enough to load on
 * each gather: [{ id, area, type, title, description, path, files }].
 * `path` is absolute so consumers can read the concept body directly.
 */
export function loadConcepts(memDir) {
	const out = [];
	for (const area of OKF_AREA_NAMES) {
		const dir = join(memDir, area);
		if (!existsSync(dir)) continue;
		for (const f of readdirSync(dir).sort()) {
			if (!f.endsWith(".md") || f === "index.md" || f === "log.md") continue;
			const fm = frontmatter(readFileSync(join(dir, f), "utf8"));
			out.push({
				id: `${area}/${f.slice(0, -3)}`,
				area,
				type: fm.type || "",
				title: fm.title || f.slice(0, -3),
				description: fm.description || "",
				path: join(dir, f),
				files: listy(fm.files),
			});
		}
	}
	return out;
}

/**
 * Knowledge side initialized: root index.md plus at least one knowledge
 * area directory (the work side alone — plan/features — doesn't count).
 */
function knowledgeReady(memDir) {
	return (
		existsSync(join(memDir, "index.md")) &&
		OKF_AREA_NAMES.some((a) => existsSync(join(memDir, a)))
	);
}

// Pitfalls first — they are constraints; then structure, then conventions.
const AREA_PRIORITY = [
	"pitfalls",
	"architecture",
	"patterns",
	"decisions",
	"setup",
];
const MAX_RELEVANT_MEMORIES = 8;

const areaRank = (area) => {
	const rank = AREA_PRIORITY.indexOf(area);
	return rank === -1 ? AREA_PRIORITY.length : rank;
};

/**
 * Rank the complete implementation-reading set. Stored feature references are
 * a snapshot from feature slicing; fresh anchor matches can add newer context.
 * Both sources share one cap so a feature never grows an unbounded contract.
 */
function rankedMemories(concepts, fileGlobs, storedIds = []) {
	const byId = new Map();
	for (const concept of matchConcepts(concepts, fileGlobs)) {
		byId.set(concept.id, { ...concept, stored: false });
	}
	for (const id of storedIds) {
		const concept = concepts.find((candidate) => candidate.id === id);
		if (!concept) continue;
		const existing = byId.get(id);
		byId.set(id, { ...concept, ...existing, stored: true });
	}
	return [...byId.values()]
		.sort(
			(a, b) =>
				areaRank(a.area) - areaRank(b.area) ||
				Number(b.stored) - Number(a.stored) ||
				a.id.localeCompare(b.id),
		)
		.slice(0, MAX_RELEVANT_MEMORIES);
}

/** The concepts an implementer should read before touching these files. */
export function relevantMemories(concepts, fileGlobs) {
	return rankedMemories(concepts, fileGlobs).map(
		({ id, title, description, path }) => ({ id, title, description, path }),
	);
}

// ---------------------------------------------------------------------------
// hub

export function gather(startDir) {
	const b = loadBundle(startDir);
	if (!b.plan) {
		return {
			step: "hub",
			branch: b.branch,
			plan: null,
			stage: planStage(null, [], b.settings),
			progress: { done: 0, total: 0 },
			features: [],
			readyWave: [],
			reviewWave: [],
			// Tracked files for the goal box's @-mention suggestions (capped so
			// the embedded payload stays small).
			files: git(["ls-files"], b.root)
				.split("\n")
				.filter(Boolean)
				.slice(0, 1000),
			knowledgeInitialized: knowledgeReady(b.memDir),
			settings: b.settings,
			state: b.state,
			// A just-retired plan leaves the hero showing — its archive must
			// still be browsable from here.
			backlog: b.backlog,
			retired: archiveDirs(b.memDir).map(({ name, dir }) => {
				const planFile = join(dir, "plan.md");
				const fm = existsSync(planFile)
					? frontmatter(readFileSync(planFile, "utf8"))
					: {};
				return { name, title: fm.title || name, created: fm.created || null };
			}),
		};
	}

	// Working-tree changes: diff vs HEAD when HEAD exists (fresh repos don't),
	// plus untracked files — a feature's brand-new file is a diff too.
	const hasHead = git(["rev-parse", "--verify", "HEAD"], b.root) !== "";
	const diffFiles = [
		...(hasHead
			? git(["diff", "HEAD", "--name-only"], b.root)
			: git(["diff", "--name-only"], b.root)
		)
			.split("\n")
			.filter(Boolean),
		...git(["ls-files", "--others", "--exclude-standard"], b.root)
			.split("\n")
			.filter(Boolean),
	];

	const trailerMap = featureCommitMap(b.root);
	// Readiness is computed here, once, server-side — views only render it.
	const ready = readiness(b.features, b.settings);
	const features = b.features.map((c) => {
		const files = listy(c.fm.files);
		const globs = files.map(globToRegExp);
		const hasDiff = diffFiles.some((f) => globs.some((re) => re.test(f)));
		const recorded = Array.isArray(c.fm.commits) && c.fm.commits.length > 0;
		const hasCommits = recorded || trailerMap.has(c.slug);
		return {
			name: c.slug,
			title: c.fm.title || c.slug,
			description: c.fm.description || "",
			status: c.fm.status || "pending",
			size: c.fm.size || "small",
			testsStatus: c.fm.tests_status || "none",
			dependsOn: listy(c.fm.depends_on),
			...ready.get(c.slug),
			hasDiff,
			hasCommits,
			conflicts: featureConflicts(c.fm).length,
		};
	});

	// Working-tree dirt outside the bundle: the tight-git-flow signal (hub
	// warning chip + footer ⚠) — leftovers must never linger silently.
	const dirtyFiles = [...new Set(diffFiles)].filter(
		(f) => !f.startsWith(`${b.memName}/`),
	);

	return {
		step: "hub",
		branch: b.branch,
		dirty: { count: dirtyFiles.length, files: dirtyFiles.slice(0, 20) },
		plan: {
			title: b.plan.fm.title || "Plan",
			status: b.plan.fm.status || "draft",
			// Whole-plan review marker (record-plan-review op) and the plan's
			// worktree, when one was created at approval time.
			planReviewed: b.plan.fm.plan_reviewed || null,
			worktree: b.plan.fm.worktree || null,
		},
		// Derived plan lifecycle stage — views drive their plan controls from
		// this instead of re-deriving it from feature statuses.
		stage: planStage(b.plan, b.features, b.settings),
		progress: progress(b.features),
		features,
		// Snapshot candidates for the Work surface's "Implement next wave" action.
		// Readiness is server-derived above; the browser only renders this list.
		readyWave: features
			.filter((feature) => feature.status === "pending" && feature.ready)
			.map((feature) => feature.name),
		reviewWave: features
			.filter(
				(feature) => feature.status === "implemented" && feature.hasCommits,
			)
			.map((feature) => feature.name),
		knowledgeInitialized: knowledgeReady(b.memDir),
		settings: b.settings,
		state: b.state,
		backlog: b.backlog,
		// Retired plans (newest first) — the Work tab's history browser.
		retired: archiveDirs(b.memDir).map(({ name, dir }) => {
			const planFile = join(dir, "plan.md");
			const fm = existsSync(planFile)
				? frontmatter(readFileSync(planFile, "utf8"))
				: {};
			return { name, title: fm.title || name, created: fm.created || null };
		}),
	};
}

// ---------------------------------------------------------------------------
// plan

export function gatherPlan(startDir) {
	const b = loadBundle(startDir);
	const s = b.plan?.sections || {};
	const dependencies = (s["Dependencies"] || "")
		.split("\n")
		.map((l) => l.match(/^[*-]\s+(.*)$/))
		.filter(Boolean)
		.map((m) => m[1].replaceAll("`", "").trim());
	const concepts = loadConcepts(b.memDir);
	const conceptList = (area) =>
		concepts
			.filter((c) => c.area === area)
			.map(({ id, title, description, files, path }) => ({
				id,
				title,
				description,
				files,
				path,
			}));
	return {
		step: "plan",
		branch: b.branch,
		title: b.plan?.fm.title || "",
		exists: !!b.plan,
		status: b.plan?.fm.status || null,
		legacy: {
			plan: existsSync(join(b.root, "PLAN.md")),
			features: existsSync(join(b.root, "FEATURES.md")),
		},
		plan: {
			goal: s["Goal"] || "",
			architecture: s["Architecture"] || "",
			keyDecisions: s["Key decisions"] || "",
		},
		dependencies,
		// The bundle's recorded knowledge — the planner drafts on top of it:
		// architecture concepts seed the Architecture section, and the plan
		// must follow (or explicitly flag deviation from) decisions/pitfalls.
		knowledge: {
			architecture: conceptList("architecture"),
			decisions: conceptList("decisions"),
			pitfalls: conceptList("pitfalls"),
		},
		// Project design params (memory/design.md) — a plan touching UI reads
		// them while drafting; null means /iterator-design hasn't captured any.
		designFile: b.design ? join(b.memDir, "design.md") : null,
		knowledgeInitialized: knowledgeReady(b.memDir),
	};
}

// ---------------------------------------------------------------------------
// feature

export function gatherFeature(startDir) {
	const b = loadBundle(startDir);
	const concepts = loadConcepts(b.memDir);
	return {
		step: "feature",
		branch: b.branch,
		plan: b.plan?.fm.title || null,
		planStatus: b.plan?.fm.status || null,
		features: b.features.map(featureToUi),
		// The bundle's architecture concepts: real subsystem seams (with their
		// files: anchors) to cut feature boundaries along, instead of an imagined
		// architecture.
		architecture: concepts
			.filter((c) => c.area === "architecture")
			.map(({ id, title, description, files }) => ({
				id,
				title,
				description,
				files,
			})),
		// The project's decision concepts: each feature must be checked against
		// them — a feature contradicting one gets a conflicts flag in the write.
		decisions: concepts
			.filter((c) => c.area === "decisions")
			.map(({ id, title, description, path }) => ({
				id,
				title,
				description,
				path,
			})),
	};
}

// ---------------------------------------------------------------------------
// implement (agent-facing, not a server payload)

/** A ready feature's full contract for the implement step. */
const implementContract = (c, concepts = []) => ({
	...featureToUi(c),
	blastRadius: c.sections["Blast radius"] || "",
	tests: listy(c.fm.tests),
	testsStatus: c.fm.tests_status || "none",
	// Knowledge the implementer reads BEFORE coding (progressive disclosure —
	// only these concept files, never all of memory/): the list stored in the
	// feature at feature time, unioned with a fresh anchor match so memories
	// written after slicing still surface.
	relevantMemories: unionMemories(c, concepts),
});

// Per-concept ceiling for inlined bodies — a runaway concept file must not
// blow up the implement contract; the `path` stays readable for the rest.
const MAX_MEMORY_BODY = 6000;

/** Concept body with the frontmatter stripped — the metadata (tags, anchors,
 * timestamps) is machine bookkeeping the implementer doesn't need in context. */
function memoryBody(path) {
	let raw;
	try {
		raw = readFileSync(path, "utf8");
	} catch {
		return "";
	}
	const text = body(raw).trim();
	return text.length > MAX_MEMORY_BODY
		? `${text.slice(0, MAX_MEMORY_BODY)}\n… (truncated — read the file at \`path\` for the rest)`
		: text;
}

function unionMemories(c, concepts) {
	const memories = rankedMemories(
		concepts,
		listy(c.fm.files),
		listy(c.fm.memories),
	);
	// Inline the stripped body so the implementer reads knowledge straight from
	// the contract instead of round-tripping Read calls over raw files.
	return memories.map(({ id, title, description, path }) => ({
		id,
		title,
		description,
		path,
		body: memoryBody(path),
	}));
}

export function gatherImplement(startDir) {
	const b = loadBundle(startDir);
	const concepts = loadConcepts(b.memDir);
	const satisfied = satisfiedSet(b.features, b.settings);
	// Drafts are not implementable — they are an unaccepted feature proposal.
	const pending = b.features.filter(
		(c) => (c.fm.status || "pending") === "pending",
	);
	const implemented = b.features
		.filter((c) => c.fm.status === "implemented")
		.map((c) => c.slug);
	const drafts = b.features
		.filter((c) => c.fm.status === "draft")
		.map((c) => c.slug);
	const ready = pending.filter((c) =>
		listy(c.fm.depends_on).every((d) => satisfied.has(d)),
	);
	const nextFeature = ready[0] || null;
	// Implemented-but-unreviewed features are not stuck — they are awaiting
	// review, which unblocks their dependents once accepted.
	const stuck =
		pending.length > 0 && ready.length === 0 && implemented.length === 0;
	return {
		step: "implement",
		branch: b.branch,
		// Where the work lives: the plan worktree when one is recorded (loadBundle
		// re-roots) — every file edit must happen under this path.
		root: b.root,
		plan: b.plan?.fm.title || null,
		progress: progress(b.features),
		next: nextFeature && implementContract(nextFeature, concepts),
		// One feature per round: the wave carries only `next` (field kept for
		// contract stability with existing consumers).
		wave: nextFeature ? [implementContract(nextFeature, concepts)] : [],
		ready: ready.map((c) => c.slug),
		implemented,
		drafts,
		// What this plan already changed — so a fresh context can implement the
		// next feature without assuming conversation memory.
		finishedFeatures: b.features
			.filter((c) => ["done", "implemented"].includes(c.fm.status))
			.map((c) => ({
				name: c.slug,
				title: c.fm.title || c.slug,
				description: c.fm.description || "",
				status: c.fm.status,
				files: listy(c.fm.files),
				commits: resolveFeatureCommits(b.root, c).map((sha) => ({
					sha: sha.slice(0, 10),
					subject: git(["log", "-1", "--format=%s", sha], b.root),
				})),
			})),
		// Project design params (memory/design.md) — path when captured, else null.
		designFile: b.design ? join(b.memDir, "design.md") : null,
		settings: b.settings,
		state: b.state,
		blocked: pending
			.filter((c) => !ready.includes(c))
			.map((c) => ({
				name: c.slug,
				waitingOn: listy(c.fm.depends_on).filter((d) => !satisfied.has(d)),
			})),
		// pending features remain but nothing is ready or awaiting review →
		// cycle or missing dependency
		stuck,
		advice: stuck
			? "No feature is ready but pending features remain — a dependency cycle or a missing dependency; fix depends_on via /iterator-feature."
			: !ready.length && implemented.length
				? `Awaiting review: ${implemented.join(", ")} — review (and accept) before dependents unblock.`
				: !ready.length && drafts.length
					? "Only draft features exist — accept the feature breakdown (/iterator-feature) before implementing."
					: !ready.length
						? "Nothing to implement — every feature is done (or no features exist yet)."
						: `Implement exactly ONE feature this round: '${nextFeature.slug}' (the contract in \`next\`). Other ready features wait for their own round.`,
	};
}

// ---------------------------------------------------------------------------
// memorize (agent-facing, not a server payload)

/**
 * State for the post-accept memory evaluation: is this bundle shared with
 * okf-memory, what knowledge exists (area/concept inventory), and which
 * commits `last_memorized_commit` has not covered yet. The agent uses this
 * to decide whether an accepted feature should create/update memories (written
 * through write.mjs `op: memorize`).
 */
export function gatherMemorize(startDir) {
	const b = loadBundle(startDir);
	const indexFile = join(b.memDir, "index.md");
	const rootFm = existsSync(indexFile)
		? frontmatter(readFileSync(indexFile, "utf8"))
		: {};

	const concepts = loadConcepts(b.memDir);
	const areas = OKF_AREA_NAMES.filter((a) =>
		existsSync(join(b.memDir, a, "index.md")),
	).map((a) => ({
		name: a,
		concepts: concepts
			.filter((c) => c.area === a)
			.map(({ id, type, title, description, files }) => ({
				id,
				type,
				title,
				description,
				files,
			})),
	}));

	const head = git(["rev-parse", "HEAD"], b.root) || null;
	const base = rootFm.last_memorized_commit || null;
	const baseValid =
		!!base &&
		git(["rev-parse", "--verify", "--quiet", `${base}^{commit}`], b.root) !==
			"";
	// Commits that touch only the bundle (bookkeeping like sha recording or
	// memory writes) are definitionally not memorizable — exclude them so the
	// pending range reflects real work only.
	const pending = baseValid && head ? commitsSince(b, base) : [];

	return {
		step: "memorize",
		branch: b.branch,
		// okf-memory shares this bundle when knowledge areas or the memorize
		// pointer exist; when false, skip the memory evaluation entirely.
		okf: areas.length > 0 || !!base,
		head,
		lastMemorizedCommit: base,
		baseValid,
		pendingCount: pending.length,
		pendingCommits: pending.slice(0, 50),
		areas,
		extensionsContract: existsSync(join(b.memDir, "EXTENSIONS.md"))
			? join(b.memDir, "EXTENSIONS.md")
			: null,
	};
}

// ---------------------------------------------------------------------------
// range (agent-facing — the commit range /iterator-memorize must study)

/**
 * Everything mechanical about "what happened since last_memorized_commit":
 * pointer validation, the merge-base fallback after rebases, the commit list.
 */
export function gatherRange(startDir) {
	const b = loadBundle(startDir);
	const idx = join(b.memDir, "index.md");
	const base = existsSync(idx)
		? (frontmatter(readFileSync(idx, "utf8")).last_memorized_commit ?? null)
		: null;
	const head = git(["rev-parse", "HEAD"], b.root) || null;
	const baseValid =
		!!base &&
		git(["rev-parse", "--verify", "--quiet", `${base}^{commit}`], b.root) !==
			"";
	// After a rebase/force-push the recorded sha may be gone; merge-base
	// recovers the closest shared ancestor when the object still exists.
	const mergeBaseFallback =
		base && !baseValid
			? git(["merge-base", "HEAD", base], b.root) || null
			: null;
	const effectiveBase = baseValid ? base : mergeBaseFallback;
	// Memory-only bookkeeping commits do not represent project work to study.
	// Keep /iterator-memorize's explicit range aligned with the footer/implement
	// memorize gather, which already excludes the bundle path.
	const commits = effectiveBase && head ? commitsSince(b, effectiveBase) : [];
	// The branchy pointer-state table, pre-composed: the skill follows this
	// sentence instead of carrying the state machine as prose.
	const advice = !existsSync(idx)
		? "No memory/index.md — run /iterator-init first."
		: !base
			? "No last_memorized_commit pointer — run /iterator-init (it seeds the pointer), or apply a memorize with advance:true after reviewing the history."
			: !baseValid && !mergeBaseFallback
				? `Recorded pointer ${String(base).slice(0, 7)} no longer exists and no merge-base is reachable — review recent history manually, then advance the pointer with advanceTo:"HEAD".`
				: commits.length === 0
					? "Nothing to memorize — every commit since the pointer is bundle bookkeeping."
					: `Study the ${commits.length} commit(s) in ${String(effectiveBase).slice(0, 7)}..HEAD${baseValid ? "" : ` (recorded pointer is gone — using merge-base ${String(mergeBaseFallback).slice(0, 7)})`} and draft memory cards.`;

	return {
		step: "range",
		initialized: existsSync(idx),
		head,
		lastMemorizedCommit: base,
		baseValid,
		mergeBaseFallback,
		effectiveBase,
		commitCount: commits.length,
		commits: commits.slice(0, 100),
		nothingToMemorize: !!effectiveBase && commits.length === 0,
		advice,
	};
}

// ---------------------------------------------------------------------------
// session (agent-facing — everything the pi extension needs per turn, in ONE
// process instead of three spawns: footer, ambient context, hub refresh)

export function gatherSession(startDir) {
	const b = loadBundle(startDir);
	const hub = gather(startDir);
	return {
		step: "session",
		hub,
		implement: hub.plan ? gatherImplement(startDir) : null,
		memorize: gatherMemorize(startDir),
		settings: b.settings,
		state: b.state,
	};
}

// ---------------------------------------------------------------------------
// usage (the Usage tab payload) + archive (retired-plan browsing)

const USAGE_TOKEN_FIELDS = ["input", "output", "cacheRead", "cacheWrite"];

/** Parse usage.md's totals/prices JSON scalars (mirrors write.mjs's shape). */
function usageDataAt(file) {
	if (!existsSync(file)) return null;
	const fm = frontmatter(readFileSync(file, "utf8"));
	let totals;
	let prices;
	try {
		const value = JSON.parse(String(fm.totals || "{}"));
		totals = {
			steps: value.steps && typeof value.steps === "object" ? value.steps : {},
			features:
				value.features && typeof value.features === "object"
					? value.features
					: {},
			featureModels:
				value.featureModels && typeof value.featureModels === "object"
					? value.featureModels
					: {},
		};
	} catch {
		totals = { steps: {}, features: {}, featureModels: {} };
	}
	try {
		const value = JSON.parse(String(fm.prices || "{}"));
		prices = value && typeof value === "object" ? value : {};
	} catch {
		prices = {};
	}
	return { totals, prices };
}

function usageTotalsAt(file) {
	return usageDataAt(file)?.totals || null;
}

function usageGrand(totals) {
	const g = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, turns: 0 };
	for (const models of Object.values(totals?.steps || {})) {
		for (const u of Object.values(models)) {
			for (const f of USAGE_TOKEN_FIELDS) g[f] += u[f] || 0;
			g.turns += u.turns || 0;
		}
	}
	return g;
}

function rowCost(usage, rates) {
	if (!rates || typeof rates !== "object") return null;
	let cost = 0;
	for (const field of USAGE_TOKEN_FIELDS) {
		const tokens = Number(usage?.[field] || 0);
		if (!tokens) continue;
		const rate = Number(rates[field]);
		if (!Number.isFinite(rate) || rate < 0) return null;
		cost += (tokens / 1_000_000) * rate;
	}
	return cost;
}

/** Cost rollups from raw usage and project-owned USD-per-million rates. */
export function usageCosts(totals, prices) {
	const steps = {};
	let grand = 0;
	let grandComplete = true;
	for (const [step, models] of Object.entries(totals?.steps || {})) {
		steps[step] = {};
		for (const [model, usage] of Object.entries(models)) {
			const cost = rowCost(usage, prices?.[model]);
			steps[step][model] = cost;
			if (cost === null) grandComplete = false;
			else grand += cost;
		}
	}
	const features = {};
	for (const slug of Object.keys(totals?.features || {})) {
		const models = totals?.featureModels?.[slug];
		if (!models) {
			features[slug] = null;
			continue;
		}
		let cost = 0;
		let complete = true;
		for (const [model, usage] of Object.entries(models)) {
			const part = rowCost(usage, prices?.[model]);
			if (part === null) complete = false;
			else cost += part;
		}
		features[slug] = complete ? cost : null;
	}
	return { steps, features, grand: grandComplete ? grand : null };
}

export function gatherUsage(startDir) {
	const b = loadBundle(startDir);
	const data = usageDataAt(join(b.memDir, "usage.md"));
	const totals = data?.totals || { steps: {}, features: {}, featureModels: {} };
	const prices = data?.prices || {};
	return {
		step: "usage",
		branch: b.branch,
		plan: b.plan?.fm.title || null,
		exists: data !== null,
		totals,
		prices,
		costs: usageCosts(totals, prices),
		grand: usageGrand(totals),
	};
}

/** Retired-plan archive dirs, newest first: [{ name, dir }]. */
function archiveDirs(memDir) {
	const root = join(memDir, "features", "archive");
	if (!existsSync(root)) return [];
	return readdirSync(root)
		.filter((n) => statSync(join(root, n)).isDirectory())
		.sort()
		.reverse()
		.map((name) => ({ name, dir: join(root, name) }));
}

/**
 * Retired plans. Without target: the list (name, title, created, feature
 * count, usage grand total). With target: one archive fully parsed — plan
 * sections, every feature incl. its # Review history, and the usage totals —
 * for the read-only archive view.
 */
export function gatherArchive(startDir, target) {
	const b = loadBundle(startDir);
	if (!target) {
		return {
			step: "archive",
			branch: b.branch,
			archives: archiveDirs(b.memDir).map(({ name, dir }) => {
				const planFile = join(dir, "plan.md");
				const fm = existsSync(planFile)
					? frontmatter(readFileSync(planFile, "utf8"))
					: {};
				const featureCount = readdirSync(dir).filter(
					(f) =>
						f.endsWith(".md") &&
						!["plan.md", "usage.md", "index.md"].includes(f),
				).length;
				const usageData = usageDataAt(join(dir, "usage.md"));
				return {
					name,
					title: fm.title || name,
					created: fm.created || null,
					features: featureCount,
					usage: {
						...usageGrand(usageData?.totals),
						cost: usageData
							? usageCosts(usageData.totals, usageData.prices).grand
							: null,
					},
				};
			}),
		};
	}

	const entry = archiveDirs(b.memDir).find((a) => a.name === target);
	if (!entry) {
		return {
			step: "archive",
			branch: b.branch,
			error: `no archived plan '${target}'`,
			archives: archiveDirs(b.memDir).map((a) => a.name),
		};
	}
	const planFile = join(entry.dir, "plan.md");
	const planRaw = existsSync(planFile) ? readFileSync(planFile, "utf8") : "";
	const planFm = frontmatter(planRaw);
	const features = readdirSync(entry.dir)
		.filter(
			(f) =>
				f.endsWith(".md") && !["plan.md", "usage.md", "index.md"].includes(f),
		)
		.sort()
		.map((f) => {
			const raw = readFileSync(join(entry.dir, f), "utf8");
			const fm = frontmatter(raw);
			const secs = sections(raw);
			return {
				name: f.slice(0, -3),
				title: fm.title || f.slice(0, -3),
				description: fm.description || "",
				status: fm.status || "",
				size: fm.size || "",
				files: listy(fm.files),
				dependsOn: listy(fm.depends_on),
				implementationNotes: secs["Implementation notes"] || "",
				review: secs["Review"] || "",
				commits: Array.isArray(fm.commits) ? fm.commits : [],
			};
		});
	const usageData = usageDataAt(join(entry.dir, "usage.md"));
	const totals = usageData?.totals || {
		steps: {},
		features: {},
		featureModels: {},
	};
	const prices = usageData?.prices || {};
	return {
		step: "archive",
		branch: b.branch,
		name: entry.name,
		title: planFm.title || entry.name,
		created: planFm.created || null,
		planStatus: planFm.status || null,
		sections: sections(planRaw),
		features,
		usage: {
			totals,
			prices,
			costs: usageCosts(totals, prices),
			grand: usageGrand(totals),
		},
	};
}

// ---------------------------------------------------------------------------
// settings (the settings view / extension driver payload)

export function gatherSettings(startDir) {
	const b = loadBundle(startDir);
	return {
		step: "settings",
		branch: b.branch,
		plan: b.plan?.fm.title || null,
		// Effective values (defaults merged) — the view renders and edits these;
		// `defined` says whether memory/settings.md exists yet.
		settings: b.settings,
		defined: b.settingsDefined,
		state: b.state,
	};
}

// ---------------------------------------------------------------------------
// knowledge (the Knowledge tab / okf dashboard payload)

/** Markdown concept files under dir, recursively (index/log excluded). */
function mdFilesUnder(dir) {
	const out = [];
	if (!existsSync(dir)) return out;
	for (const name of readdirSync(dir).sort()) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) out.push(...mdFilesUnder(p));
		else if (name.endsWith(".md") && name !== "index.md" && name !== "log.md")
			out.push(p);
	}
	return out;
}

// Bundle files owned by the Work side (plan/features/design/format, incl.
// retired plans under features/archive/) — the knowledge browser shows the
// knowledge areas plus root-level references (e.g. EXTENSIONS.md), never
// iterator's own documents.
const WORK_OWNED_RE =
	/^(plan\.md|design\.md|format\.md|settings\.md|state\.md|usage\.md|features\/)/;

/**
 * State for the Knowledge view: bundle status (pointer, staleness,
 * unmemorized commits), the five knowledge areas with their concepts, the
 * design.md card, and whether the bundle's format.md drifted from the
 * template.
 */
export function gatherKnowledge(startDir) {
	const b = loadBundle(startDir);
	const idx = join(b.memDir, "index.md");
	const initialized = existsSync(idx);
	const rootFm = initialized ? frontmatter(readFileSync(idx, "utf8")) : {};
	const lastCommit = rootFm.last_memorized_commit ?? null;

	const tracked = new Set(
		git(["ls-files"], b.root).split("\n").filter(Boolean),
	);
	const trackedPaths = [...tracked];
	const anchorIsStale = (anchor) => {
		const a = String(anchor || "");
		if (!a) return false;
		if (tracked.has(a)) return false;
		const re = globToRegExp(a);
		return !trackedPaths.some((p) => re.test(p));
	};
	const memories = [];
	for (const p of mdFilesUnder(b.memDir)) {
		const rel = relative(b.memDir, p).split("\\").join("/");
		if (WORK_OWNED_RE.test(rel)) continue;
		const raw = readFileSync(p, "utf8");
		const fm = frontmatter(raw);
		const id = rel.replace(/\.md$/, "");
		const files = listy(fm.files);
		memories.push({
			id,
			slug: id.split("/").pop(),
			path: rel,
			area: id.includes("/") ? id.split("/")[0] : "root",
			type: fm.type || "",
			title: fm.title || id,
			description: fm.description || "",
			status: fm.status || "",
			files,
			stale: tracked.size > 0 && files.some(anchorIsStale),
			// The concept body (frontmatter stripped) — the Knowledge browser's
			// read-in-place drawer renders it, so checking a decision never
			// requires leaving the tab.
			body: body(raw).trim(),
		});
	}

	// Feature-aware consolidation evidence. Stored references reveal what a
	// feature was sliced with; anchor matches reveal what would be selected now.
	// Keep the raw candidate set here (rather than the capped implementation
	// contract) so consolidation can see pressure that the cap intentionally
	// hides from implementers.
	const conceptIds = new Set(memories.map((memory) => memory.id));
	const featureAttachments = b.features.map((feature) => {
		const files = listy(feature.fm.files);
		const stored = listy(feature.fm.memories);
		const matched = matchConcepts(memories, files).map((memory) => memory.id);
		const candidates = [
			...new Set([...stored.filter((id) => conceptIds.has(id)), ...matched]),
		];
		const dangling = stored.filter((id) => !conceptIds.has(id));
		return {
			feature: feature.slug,
			files,
			stored,
			matched,
			candidates,
			candidateCount: candidates.length,
			overLimit: candidates.length > MAX_RELEVANT_MEMORIES,
			dangling,
		};
	});
	for (const memory of memories) {
		memory.referencedByFeatures = featureAttachments
			.filter((usage) => usage.stored.includes(memory.id))
			.map((usage) => usage.feature);
		memory.matchedByFeatures = featureAttachments
			.filter((usage) => usage.matched.includes(memory.id))
			.map((usage) => usage.feature);
		memory.candidateFeatureCount = new Set([
			...memory.referencedByFeatures,
			...memory.matchedByFeatures,
		]).size;
	}
	const overloadedFeatures = featureAttachments.filter(
		(usage) => usage.overLimit,
	);
	const danglingReferences = featureAttachments.flatMap((usage) =>
		usage.dangling.map((id) => ({ feature: usage.feature, id })),
	);
	const byAnchors = new Map();
	for (const memory of memories) {
		if (!memory.files.length) continue;
		const signature = [...memory.files].map(String).sort().join("\n");
		const group = byAnchors.get(signature) || [];
		group.push(memory.id);
		byAnchors.set(signature, group);
	}
	const overlapCandidates = [...byAnchors.entries()]
		.filter(([, ids]) => ids.length > 1)
		.map(([signature, ids]) => ({
			files: signature.split("\n"),
			memories: ids.sort(),
		}));

	let unmemorized = "?";
	if (lastCommit) {
		if (git(["rev-parse", "--verify", `${lastCommit}^{commit}`], b.root)) {
			const out = git(["log", "--oneline", `${lastCommit}..HEAD`], b.root);
			unmemorized = out ? out.split("\n").filter(Boolean).length : 0;
		}
	}

	const areas = OKF_AREA_NAMES.map((id) => ({
		id,
		title: OKF_AREAS[id][0],
		description: OKF_AREAS[id][1],
		count: memories.filter((m) => m.area === id).length,
	}));

	// memory/format.md is copied from the template once (on the first plan
	// write) and drifts as the template evolves — surface that.
	const template = resolveTemplate("format.md");
	const formatFile = join(b.memDir, "format.md");
	const formatStale =
		!!template &&
		existsSync(formatFile) &&
		readFileSync(template, "utf8") !== readFileSync(formatFile, "utf8");

	const staleCount = memories.filter((m) => m.stale).length;
	// The forcing sentence consolidate follows: the review round ALWAYS opens
	// (even all-keep) so the run produces a visible outcome — the model must
	// never conclude "nothing to do" from this inventory alone.
	let advice;
	if (!initialized) {
		advice = "No memory/index.md — run /iterator-init first.";
	} else if (memories.length === 0) {
		advice =
			"No knowledge concepts yet — nothing to consolidate; run /iterator-memorize (or /iterator-init) to create concepts first.";
	} else {
		const findings = [];
		if (staleCount) findings.push(`${staleCount} stale concept(s)`);
		if (danglingReferences.length)
			findings.push(
				`${danglingReferences.length} dangling feature reference(s)`,
			);
		if (overloadedFeatures.length)
			findings.push(`${overloadedFeatures.length} over-limit feature(s)`);
		if (overlapCandidates.length)
			findings.push(`${overlapCandidates.length} shared-anchor group(s)`);
		advice = findings.length
			? `${findings.join(", ")} found — inspect feature attachment evidence, draft reviewed keep/update/delete or merge repairs, and open the review round.`
			: "No stale anchors or feature-attachment pressure detected — still open the review round with keep verdicts so the user sees and confirms the result.";
	}

	return {
		step: "knowledge",
		branch: b.branch,
		project: b.root,
		bundlePath: `${b.memName}/`,
		memory: {
			initialized,
			okfVersion: rootFm.okf_version ?? null,
			lastMemorizedCommit: lastCommit,
			conceptCount: memories.length,
			staleCount,
			danglingReferenceCount: danglingReferences.length,
			overloadedFeatureCount: overloadedFeatures.length,
			unmemorizedCommitCount: unmemorized,
		},
		hasStale: staleCount > 0,
		advice,
		areas,
		memories,
		consolidation: {
			memoryLimit: MAX_RELEVANT_MEMORIES,
			featureAttachments,
			overloadedFeatures,
			danglingReferences,
			overlapCandidates,
		},
		design: b.design
			? {
					title: b.design.fm.title || "Design parameters",
					description: b.design.fm.description || "",
					path: "design.md",
					register: b.design.fm.register || "product",
					sections: {
						direction: b.design.sections["Direction"] || "",
						typography: b.design.sections["Typography"] || "",
						color: b.design.sections["Color"] || "",
						spacing: b.design.sections["Spacing"] || "",
						elements: b.design.sections["Elements"] || "",
						responsive: b.design.sections["Responsive"] || "",
						signature: b.design.sections["Signature"] || "",
					},
				}
			: null,
		formatStale,
	};
}

/**
 * Fill `existingBody` on memory cards from disk — the server owns file
 * loading, so the LLM never echoes a concept's current body. Covers both
 * card shapes: memory-review `memories[]` ({ action, id }) and the accept
 * review's `memory.proposals[]` ({ action, area, slug }). Only cards whose
 * action shows an existing concept (update|delete|keep) and whose
 * `existingBody` is absent are touched — an explicitly passed body wins.
 * Mutates and returns `data`.
 */
export function hydrateMemoryCards(data, startDir) {
	const cards =
		data?.step === "memory-review"
			? data.memories
			: data?.step === "review" || data?.mode === "commit"
				? data.memory?.proposals
				: null;
	if (!Array.isArray(cards)) return data;
	const SLUG = /^[a-z0-9][a-z0-9._-]*$/;
	const needy = cards.filter(
		(m) =>
			m &&
			["update", "delete", "keep"].includes(m.action) &&
			m.existingBody == null,
	);
	if (!needy.length) return data;
	const b = loadBundle(startDir);
	for (const m of needy) {
		const [area, slug] = m.id ? String(m.id).split("/") : [m.area, m.slug];
		if (!SLUG.test(area || "") || !SLUG.test(slug || "")) continue;
		const file = join(b.memDir, area, `${slug}.md`);
		if (existsSync(file))
			m.existingBody = body(readFileSync(file, "utf8")).trim();
	}
	return data;
}

// ---------------------------------------------------------------------------
// test

function detectRunner(root) {
	try {
		const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
		const script = pkg.scripts?.test || "";
		const deps = { ...pkg.devDependencies, ...pkg.dependencies };
		for (const r of ["vitest", "jest", "mocha", "ava", "tap"]) {
			if (script.includes(r) || deps?.[r]) return r;
		}
		if (script.includes("node --test") || script.includes("node:test"))
			return "node:test";
		if (script) return script.split(" ")[0];
	} catch {
		/* no package.json */
	}
	if (existsSync(join(root, "pytest.ini"))) return "pytest";
	try {
		if (readFileSync(join(root, "pyproject.toml"), "utf8").includes("pytest"))
			return "pytest";
	} catch {
		/* no pyproject */
	}
	return null;
}

export function gatherTest(startDir, slug) {
	const b = loadBundle(startDir);
	const c = b.features.find((x) => x.slug === slug);
	if (!c) {
		return {
			step: "test",
			error: `no feature '${slug || ""}'`,
			features: b.features.map((x) => x.slug),
		};
	}
	const existingTests = git(["ls-files"], b.root)
		.split("\n")
		.filter((f) => /(\.test\.|\.spec\.|_test\.|(^|\/)tests?\/)/i.test(f))
		.slice(0, 5);
	return {
		step: "test",
		branch: b.branch,
		mode: ["done", "implemented"].includes(c.fm.status) ? "green" : "red",
		settings: b.settings,
		feature: { name: c.slug, description: c.fm.description || "" },
		contract: {
			implementationNotes: c.sections["Implementation notes"] || "",
			snippets: snippets(c.sections["Snippets"]),
			files: listy(c.fm.files),
			dependsOn: listy(c.fm.depends_on),
		},
		runner: detectRunner(b.root),
		existingTests,
		// Convention-derived suggestion (dir + naming infix + extension copied
		// from the nearest existing test file) — the model writes assertions,
		// not paths.
		suggestedTestPath: suggestTestPath(existingTests, c.slug),
		cases: [],
	};
}

/** Derive `<test-dir>/<slug><infix><ext>` from an existing test's naming. */
function suggestTestPath(existingTests, slug) {
	const sample = existingTests[0];
	if (!sample) return null;
	const dir = sample.includes("/")
		? sample.slice(0, sample.lastIndexOf("/"))
		: "";
	const base = sample.slice(sample.lastIndexOf("/") + 1);
	const ext = base.includes(".") ? base.slice(base.lastIndexOf(".")) : "";
	const infix = base.includes(".test.")
		? ".test"
		: base.includes(".spec.")
			? ".spec"
			: /_test\./.test(base)
				? "_test"
				: "";
	const name = /^test_/.test(base) ? `test_${slug.replaceAll("-", "_")}` : slug;
	return `${dir ? `${dir}/` : ""}${name}${infix}${ext}`;
}

// ---------------------------------------------------------------------------
// review

/** Decode a git C-quoted path (`"a/caf\303\251.md"`) to its real name. */
function unquoteGitPath(p) {
	if (!(p.length >= 2 && p.startsWith('"') && p.endsWith('"'))) return p;
	const bytes = [];
	for (let i = 1; i < p.length - 1; i++) {
		const c = p[i];
		if (c !== "\\") {
			bytes.push(...Buffer.from(c, "utf8"));
			continue;
		}
		const n = p[++i];
		if (n >= "0" && n <= "7") {
			let oct = n;
			while (oct.length < 3 && p[i + 1] >= "0" && p[i + 1] <= "7")
				oct += p[++i];
			bytes.push(parseInt(oct, 8));
		} else {
			const map = { n: 10, t: 9, r: 13, '"': 34, "\\": 92 };
			bytes.push(map[n] ?? n.charCodeAt(0));
		}
	}
	return Buffer.from(bytes).toString("utf8");
}

const stripSide = (p) => unquoteGitPath(p).replace(/^[ab]\//, "");

/**
 * Parse unified `git diff` output into the review UI's files/hunks shape.
 * Keeps binary changes ({ binary: true }, no hunks) and pure renames
 * ({ renamedFrom }, no hunks) — dropping them silently would leave real
 * changes invisible to review and staging. Git-quoted paths are decoded.
 */
export function parseDiff(text) {
	const files = [];
	let cur = null,
		hunk = null,
		minus = null;
	for (const line of text.split("\n")) {
		if (line.startsWith("diff --git ")) {
			cur = null;
			hunk = null;
			minus = null;
			continue;
		}
		// Pure renames (100% similarity) have no ---/+++ lines at all.
		if (!cur && line.startsWith("rename from ")) {
			minus = line.slice("rename from ".length);
			continue;
		}
		if (!cur && line.startsWith("rename to ")) {
			cur = {
				path: unquoteGitPath(line.slice("rename to ".length)),
				renamedFrom: unquoteGitPath(minus || ""),
				hunks: [],
			};
			files.push(cur);
			continue;
		}
		const bin = line.match(/^Binary files (.+) and (.+) differ$/);
		if (bin) {
			const side = bin[2] === "/dev/null" ? bin[1] : bin[2];
			if (cur) cur.binary = true;
			else files.push({ path: stripSide(side), binary: true, hunks: [] });
			continue;
		}
		if (!hunk && line.startsWith("--- ")) {
			minus = line.slice(4);
			continue;
		}
		if (!hunk && line.startsWith("+++ ")) {
			let p = line.slice(4);
			if (p === "/dev/null") p = minus || "";
			// A modified rename already opened its entry on `rename to`.
			if (cur?.renamedFrom) {
				cur.path = stripSide(p);
				continue;
			}
			cur = { path: stripSide(p), hunks: [] };
			files.push(cur);
			continue;
		}
		const h = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
		if (h && cur) {
			hunk = { header: line, oldStart: +h[1], newStart: +h[2], lines: [] };
			cur.hunks.push(hunk);
			continue;
		}
		if (hunk) {
			if (line.startsWith("+"))
				hunk.lines.push({ type: "addition", content: line.slice(1) });
			else if (line.startsWith("-"))
				hunk.lines.push({ type: "deletion", content: line.slice(1) });
			else if (line.startsWith(" "))
				hunk.lines.push({ type: "context", content: line.slice(1) });
			// '\ No newline at end of file' markers are dropped
		}
	}
	return files.filter((f) => f.hunks.length || f.binary || f.renamedFrom);
}

// Documentation files: every changed line counts as comment/doc, not code.
const DOC_FILE_RE = /\.(md|mdx|markdown|txt|rst|adoc)$/i;
// A changed line that is blank or starts with a comment marker. Heuristic on
// purpose: //, /* */ and JSDoc `*`, #, <!--, and `-- ` (SQL/Lua; `--flag` and
// CSS `--var:` don't match because they have no space after the dashes).
const COMMENT_LINE_RE = /^\s*($|\/\/|\/\*|\*\/|\*($|\s)|#|<!--|--($|\s))/;

/**
 * Diff for a set of feature commits, oldest first: a single range diff when
 * the commits are contiguous in history, else concatenated per-commit shows
 * (independent features' commits interleave, so a naive range would drag in
 * foreign work). Shared by the focused review and the whole-plan review.
 */
export function diffForCommits(root, shas, pathspec) {
	const ordered = shas.length
		? git(["rev-list", "--reverse", "--no-walk", ...shas], root)
				.split("\n")
				.filter(Boolean)
		: [];
	if (!ordered.length) return { diff: "", label: "", ordered };
	const first = ordered[0];
	const last = ordered[ordered.length - 1];
	if (ordered.length === 1)
		return {
			diff: git(["show", "--text", "--format=", first, ...pathspec], root),
			label: first.slice(0, 7),
			ordered,
		};
	const between = git(["rev-list", "--count", `${first}^..${last}`], root);
	if (between && Number(between) === ordered.length)
		return {
			diff: git(["diff", "--text", `${first}^`, last, ...pathspec], root),
			label: `${first.slice(0, 7)}..${last.slice(0, 7)}`,
			ordered,
		};
	return {
		diff: ordered
			.map((sha) =>
				git(
					["show", "--text", "--format=commit %h %s", sha, ...pathspec],
					root,
				),
			)
			.join("\n"),
		label: `${ordered.length} feature commits (non-contiguous)`,
		ordered,
	};
}

/** Validated commit shas for a feature, oldest first (recorded → trailer). */
export function resolveFeatureCommits(root, c) {
	const recorded = listy(c.fm.commits)
		.map((e) => String(e).match(/sha:\s*([0-9a-f]{6,40})/i)?.[1])
		.filter(Boolean)
		.filter(
			(sha) =>
				git(["rev-parse", "--verify", "--quiet", `${sha}^{commit}`], root) !==
				"",
		);
	if (recorded.length) return recorded;
	return featureCommitMap(root).get(c.slug) || [];
}

export function gatherReview(startDir, opts = {}) {
	const b = loadBundle(startDir);

	// Consolidated review is an explicit scope, never the old unscoped
	// working-tree fallback. Reuse the focused commit-backed gather once per
	// implemented feature, then combine the already-attributed payloads. This
	// keeps overlapping files, incidental changes, stats, and pitfalls attached
	// to the feature whose commits introduced them.
	if (opts.feature === "all") {
		const selected = b.features.filter(
			(c) =>
				c.fm.status === "implemented" &&
				resolveFeatureCommits(b.root, c).length > 0,
		);
		const rounds = selected.map((c) =>
			gatherReview(b.root, { feature: c.slug }),
		);
		const features = rounds.flatMap((round) => round.features);
		return {
			step: "review",
			multiReview: true,
			reviewScope: selected.map((c) => c.slug),
			diffTruncated: rounds.some((round) => round.diffTruncated),
			diffOmittedFiles: [
				...new Set(rounds.flatMap((round) => round.diffOmittedFiles || [])),
			],
			branch: b.branch,
			root: b.root,
			commit: `${rounds.length} implemented feature${rounds.length === 1 ? "" : "s"}`,
			plan: b.plan?.fm.title || "",
			progress: progress(b.features),
			hasFeaturesFile: b.features.length > 0,
			hasChanges: features.some((feature) => feature.files.length > 0),
			source: "commits",
			uncommittedOverlap: [
				...new Set(rounds.flatMap((round) => round.uncommittedOverlap || [])),
			],
			features,
			activeFeature: selected[0]?.slug || null,
			defaulted: [],
			uncategorized: [],
			pitfalls: [],
			designFile: b.design ? join(b.memDir, "design.md") : null,
		};
	}

	const hasHead = git(["rev-parse", "--verify", "HEAD"], b.root) !== "";

	const selected = opts.feature
		? b.features.filter((c) => c.slug === opts.feature)
		: b.features;

	// Commits-first: a focused feature that has committed its work (implement
	// commits carry the `Feature:` trailer) is always reviewed from those
	// commits — unrelated working-tree churn must never pollute or block its
	// review. The working tree is the diff source only for features with no
	// commits yet (the interactive accept-and-commit flow).
	const commitShas =
		opts.feature && ["implemented", "done"].includes(selected[0]?.fm.status)
			? resolveFeatureCommits(b.root, selected[0])
			: [];

	let diffText;
	let commitLabel;
	let source;
	let stagedSet = new Set();
	let untrackedSet = new Set();
	if (commitShas.length) {
		const rebuilt = diffForCommits(b.root, commitShas, [
			"--",
			".",
			`:(exclude)${b.memName}`,
		]);
		diffText = rebuilt.diff;
		commitLabel = rebuilt.label;
		source = "commits";
	} else {
		// Untracked files are invisible to `git diff HEAD`. Intent-to-add
		// (`git add -N`) makes them diffable as all-addition hunks without
		// committing anything — a brand-new file created by a feature must show
		// in review and land in its commit. Bundle bookkeeping files stay
		// untouched.
		const untracked = git(
			["ls-files", "--others", "--exclude-standard"],
			b.root,
		)
			.split("\n")
			.filter(Boolean)
			.filter((f) => !f.startsWith(`${b.memName}/`));
		// Snapshot the index BEFORE intent-to-add: content already staged when
		// the round started (a pre-existing baseline) gets a bootstrap
		// disposition instead of dead-ending the review as unattributable.
		stagedSet = new Set(
			git(["diff", "--cached", "--name-only"], b.root)
				.split("\n")
				.filter(Boolean),
		);
		if (untracked.length) git(["add", "-N", "--", ...untracked], b.root);
		untrackedSet = new Set(untracked);
		diffText = hasHead
			? git(["diff", "--text", "HEAD"], b.root)
			: git(["diff", "--text"], b.root);
		commitLabel = git(["log", "-1", "--format=%h %s"], b.root);
		source = "working-tree";
	}

	// Map each changed file to its owning feature: an exact `tests` entry wins
	// (a feature's tests are reviewed WITH its logic, never as uncategorized),
	// then the first feature whose `files` globs match. Every file gets a
	// group — declared | tests | incidental | bootstrap — so the review is
	// fully structured by feature: unmatched files are never left floating,
	// they default to the round's active feature (incidental) or, when they
	// were already staged before the round, to a bootstrap disposition.
	const parsed = parseDiff(diffText).filter(
		(f) => !f.path.startsWith(`${b.memName}/`),
	);
	for (const f of parsed) if (untrackedSet.has(f.path)) f.untracked = true;

	// Commit mode: surface (never block on) uncommitted working-tree changes
	// that touch the same files the reviewed commits touched — the reviewer
	// sees that the tree has drifted past what is under review. (Commits
	// exist, so HEAD does too.)
	let uncommittedOverlap = [];
	if (source === "commits") {
		const reviewedPaths = new Set(parsed.map((f) => f.path));
		uncommittedOverlap = [
			...new Set([
				...git(["diff", "--name-only", "HEAD"], b.root).split("\n"),
				...git(["ls-files", "--others", "--exclude-standard"], b.root).split(
					"\n",
				),
			]),
		].filter((p) => reviewedPaths.has(p));
	}
	const owners = b.features.map((c) => ({
		slug: c.slug,
		res: listy(c.fm.files).map(globToRegExp),
		tests: new Set(listy(c.fm.tests).map(String)),
	}));
	// Default owner for unmatched files: the requested/round feature, else the
	// runtime's active feature, else the first feature still in flight.
	const inFlight = (c) =>
		["pending", "implemented"].includes(c.fm.status || "pending");
	const defaultOwner =
		opts.defaultOwner ||
		(opts.feature && selected[0]?.slug) ||
		(b.features.some((c) => c.slug === b.state.active_feature && inFlight(c))
			? b.state.active_feature
			: null) ||
		b.features.find(inFlight)?.slug ||
		b.features[0]?.slug ||
		null;
	const byFeature = new Map();
	const uncategorized = [];
	const defaulted = [];
	for (const f of parsed) {
		// A focused review belongs to the requested feature even when an earlier,
		// already-done feature declares an overlapping file. The normal round
		// review retains its stable first-owner mapping.
		const matches = (o) =>
			o.tests.has(f.path) || o.res.some((re) => re.test(f.path));
		let owner = owners.find(matches);
		const selectedOwner = opts.feature
			? owners.find((o) => o.slug === opts.feature)
			: null;
		if (opts.feature && source === "commits") {
			// The requested feature's commits are the attribution boundary. A path
			// declared only by another feature still belongs in this commit-backed
			// review as incidental; otherwise focused/consolidated review silently
			// drops part of the selected feature's diff.
			if (selectedOwner && matches(selectedOwner)) {
				owner = selectedOwner;
				f.group = selectedOwner.tests.has(f.path) ? "tests" : "declared";
			} else {
				owner = { slug: opts.feature };
				f.group = "incidental";
			}
		} else if (opts.feature && selectedOwner && matches(selectedOwner)) {
			owner = selectedOwner;
			f.group = selectedOwner.tests.has(f.path) ? "tests" : "declared";
		} else if (owner) {
			f.group = owner.tests.has(f.path) ? "tests" : "declared";
		} else if (source === "commits") {
			// Already committed with the focused feature — nothing will be
			// staged, so no disposition/defaulted bookkeeping; the file simply
			// displays under the feature that committed it.
			f.group = "incidental";
			owner = { slug: defaultOwner };
		} else {
			const bootstrap = stagedSet.has(f.path) && !untrackedSet.has(f.path);
			f.group = bootstrap ? "bootstrap" : "incidental";
			if (!defaultOwner) {
				uncategorized.push(f);
				continue;
			}
			f.defaulted = true;
			f.disposition = bootstrap ? "bootstrap" : defaultOwner;
			defaulted.push(f.path);
			owner = { slug: defaultOwner };
		}
		if (opts.feature && owner.slug !== opts.feature) continue;
		if (!byFeature.has(owner.slug)) byFeature.set(owner.slug, []);
		byFeature.get(owner.slug).push(f);
	}

	// Pitfall concepts anchored to the changed files: a known sharp edge in
	// exactly the code under review is shown next to the feature.
	const pitfallConcepts = loadConcepts(b.memDir).filter(
		(c) => c.area === "pitfalls",
	);
	const pitfallsFor = (paths) =>
		pitfallConcepts
			.map((c) => ({
				c,
				matched: paths.filter((p) => matchConcepts([c], [p]).length > 0),
			}))
			.filter((x) => x.matched.length)
			.map(({ c, matched }) => ({
				id: c.id,
				title: c.title,
				description: c.description,
				path: c.path,
				matched,
			}));

	const features = [];
	for (const c of selected) {
		const files = byFeature.get(c.slug) || [];
		if (!files.length && !opts.feature) continue;
		let added = 0,
			removed = 0,
			codeAdded = 0,
			codeRemoved = 0;
		for (const f of files) {
			const doc = DOC_FILE_RE.test(f.path);
			for (const h of f.hunks)
				for (const l of h.lines) {
					if (l.type === "addition") {
						added++;
						if (!doc && !COMMENT_LINE_RE.test(l.content)) codeAdded++;
					} else if (l.type === "deletion") {
						removed++;
						if (!doc && !COMMENT_LINE_RE.test(l.content)) codeRemoved++;
					}
				}
		}
		// Review-size verdicts run on CODE lines only: comment/doc changes belong
		// in the feature (reviewed together) but never push it over the size limit.
		const codeTotal = codeAdded + codeRemoved;
		features.push({
			name: c.slug,
			description: c.fm.description || "",
			blastRadius: c.sections["Blast radius"] || "",
			dependsOn: listy(c.fm.depends_on),
			stats: {
				added,
				removed,
				codeAdded,
				codeRemoved,
				files: files.length,
				complexity:
					codeTotal <= 100 ? "green" : codeTotal <= 200 ? "yellow" : "red",
			},
			files,
			pitfalls: pitfallsFor(files.map((f) => f.path)),
		});
	}

	// The deterministic zero-change guard: a review view must never open on
	// nothing (enforced at every render entry, not by skill prose).
	const hasChanges =
		features.some((c) => c.files.length > 0) || uncategorized.length > 0;

	// Cap the embedded hunk text like plan-review caps its raw diff — a huge
	// round must not blow the payload (or the agent's context). Structure is
	// never dropped: every file keeps its path, group, and disposition (the
	// accept-commit staging runs on paths), only overflow hunks are stripped
	// and flagged so the reviewer digs into those files with git instead.
	const MAX_DIFF = 400_000;
	let diffTruncated = false;
	const diffOmittedFiles = [];
	{
		let budget = MAX_DIFF;
		const allFiles = [...features.flatMap((c) => c.files), ...uncategorized];
		for (const f of allFiles) {
			const size = JSON.stringify(f.hunks || []).length;
			if (size <= budget) {
				budget -= size;
			} else if (f.hunks?.length) {
				f.hunks = [];
				f.omitted = true;
				diffTruncated = true;
				diffOmittedFiles.push(f.path);
			}
		}
	}

	return {
		step: "review",
		diffTruncated,
		diffOmittedFiles,
		branch: b.branch,
		root: b.root,
		commit: commitLabel,
		plan: b.plan?.fm.title || "",
		progress: progress(b.features),
		hasFeaturesFile: b.features.length > 0,
		hasChanges,
		source,
		// Commit mode only: reviewed files that ALSO carry uncommitted
		// working-tree changes — shown as a hint, never a review blocker.
		uncommittedOverlap,
		features,
		// Unmatched files that were auto-assigned to the active feature — the
		// review UI shows them under "Incidental" with a reassignable default.
		activeFeature: defaultOwner,
		defaulted,
		uncategorized,
		pitfalls: pitfallsFor(uncategorized.map((f) => f.path)),
		// Project design params — UI-touching diffs are reviewed against them.
		designFile: b.design ? join(b.memDir, "design.md") : null,
	};
}

// ---------------------------------------------------------------------------
// plan-review (whole-plan review — /iterator-review-plan)

/**
 * Everything the plan reviewer needs to check the finished work against the
 * plan: the plan's sections, every feature (status, review history, commits),
 * and the whole-plan diff built from the union of feature commits — a single
 * range diff when they are contiguous in history, else concatenated shows.
 * Agent-facing (no UI): the reviewer reads this and records its report via
 * the record-plan-review op.
 */
export function gatherPlanReview(startDir) {
	const b = loadBundle(startDir);
	if (!b.plan) return { step: "plan-review", error: "no plan.md to review" };
	const full = (sha) => git(["rev-parse", sha], b.root) || sha;
	const feats = b.features.map((c) => ({
		name: c.slug,
		title: c.fm.title || c.slug,
		description: c.fm.description || "",
		status: c.fm.status || "pending",
		files: listy(c.fm.files),
		review: c.sections["Review"] || "",
		commits: resolveFeatureCommits(b.root, c).map(full),
	}));
	const shas = [...new Set(feats.flatMap((f) => f.commits))];
	const pathspec = ["--", ".", `:(exclude)${b.memName}`];
	const {
		diff,
		label: diffLabel,
		ordered,
	} = diffForCommits(b.root, shas, pathspec);
	// Cap the raw diff so a huge plan cannot blow the payload; the reviewer
	// still has the per-feature commit list to dig further with git.
	const MAX_DIFF = 400_000;
	const truncated = diff.length > MAX_DIFF;
	return {
		step: "plan-review",
		branch: b.branch,
		root: b.root,
		plan: {
			title: b.plan.fm.title || "Plan",
			description: b.plan.fm.description || "",
			planReviewed: b.plan.fm.plan_reviewed || null,
			goal: b.plan.sections["Goal"] || "",
			architecture: b.plan.sections["Architecture"] || "",
			keyDecisions: b.plan.sections["Key decisions"] || "",
			dependencies: b.plan.sections["Dependencies"] || "",
		},
		progress: progress(b.features),
		features: feats,
		commits: ordered.map((sha) => ({
			sha: sha.slice(0, 10),
			subject: git(["log", "-1", "--format=%s", sha], b.root),
			feature: feats.find((f) => f.commits.includes(sha))?.name || null,
		})),
		diffLabel,
		diffTruncated: truncated,
		diff: truncated ? diff.slice(0, MAX_DIFF) : diff,
		settings: b.settings,
	};
}

/**
 * The retire step's whole context: plan sections plus condensed per-feature
 * summaries (title, description, status, files, review notes) — everything
 * the retiring agent needs to write the decision concept without reading the
 * plan and every feature file wholesale.
 */
export function gatherRetire(startDir) {
	const b = loadBundle(startDir);
	if (!b.plan) return { step: "retire", error: "no plan.md to retire" };
	const feats = b.features.map((c) => ({
		name: c.slug,
		title: c.fm.title || c.slug,
		description: c.fm.description || "",
		status: c.fm.status || "pending",
		files: listy(c.fm.files),
		review: c.sections["Review"] || "",
	}));
	const memorizeEnabled = b.settings.memorize_on_retire === "on";
	const memorizeRange = memorizeEnabled ? gatherRange(b.root) : null;
	const memorizeRequired =
		memorizeEnabled &&
		(!memorizeRange.initialized ||
			!memorizeRange.effectiveBase ||
			memorizeRange.commitCount > 0);
	return {
		step: "retire",
		branch: b.branch,
		root: b.root,
		plan: {
			title: b.plan.fm.title || "Plan",
			description: b.plan.fm.description || "",
			created: b.plan.fm.created || null,
			goal: b.plan.sections["Goal"] || "",
			architecture: b.plan.sections["Architecture"] || "",
			keyDecisions: b.plan.sections["Key decisions"] || "",
		},
		features: feats,
		// The default `files:` anchor set for the condensed decision concept.
		filesUnion: [...new Set(feats.flatMap((f) => f.files))],
		allDone: feats.length > 0 && feats.every((f) => f.status === "done"),
		memorize: {
			enabled: memorizeEnabled,
			required: memorizeRequired,
			range: memorizeRange,
		},
	};
}

// ---------------------------------------------------------------------------
// CLI (invoked through the skills/iterator/gather.mjs shim)

export function runCli(args) {
	let step = "hub",
		feature = null,
		rootArg = null;
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--step") step = args[++i];
		else if (args[i] === "--feature") feature = args[++i];
		else rootArg = args[i];
	}
	const steps = {
		hub: () => gather(rootArg),
		plan: () => gatherPlan(rootArg),
		feature: () => gatherFeature(rootArg),
		implement: () => gatherImplement(rootArg),
		memorize: () => gatherMemorize(rootArg),
		range: () => gatherRange(rootArg),
		session: () => gatherSession(rootArg),
		settings: () => gatherSettings(rootArg),
		usage: () => gatherUsage(rootArg),
		archive: () => gatherArchive(rootArg, feature),
		knowledge: () => gatherKnowledge(rootArg),
		test: () => gatherTest(rootArg, feature),
		review: () => gatherReview(rootArg, { feature }),
		"plan-review": () => gatherPlanReview(rootArg),
		retire: () => gatherRetire(rootArg),
	};
	// One-JSON-line contract, success or failure: a throw (corrupt bundle,
	// racing file deletion, unreadable file) must never print a stack trace
	// where the caller expects a payload — mirror write.mjs's envelope.
	try {
		if (!steps[step]) {
			throw new Error(
				`unknown step '${step}' (hub|plan|feature|implement|memorize|range|session|settings|usage|archive|knowledge|test|review|plan-review|retire)`,
			);
		}
		process.stdout.write(JSON.stringify(steps[step]()) + "\n");
	} catch (e) {
		process.stdout.write(
			JSON.stringify({ ok: false, error: e.message }) + "\n",
		);
		process.exit(1);
	}
}
