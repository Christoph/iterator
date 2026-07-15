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
import { isAbsolute, join, relative } from "node:path";
import { git } from "./git.mjs";
import { effectiveSettings, parseState } from "./settings.mjs";
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

/** The concepts an implementer should read before touching these files. */
export function relevantMemories(concepts, fileGlobs) {
	return matchConcepts(concepts, fileGlobs)
		.sort(
			(a, b) => AREA_PRIORITY.indexOf(a.area) - AREA_PRIORITY.indexOf(b.area),
		)
		.slice(0, MAX_RELEVANT_MEMORIES)
		.map(({ id, title, description, path }) => ({
			id,
			title,
			description,
			path,
		}));
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
			progress: { done: 0, total: 0 },
			features: [],
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
		},
		progress: progress(b.features),
		features,
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

function unionMemories(c, concepts) {
	const dynamic = relevantMemories(concepts, listy(c.fm.files));
	const byId = new Map();
	for (const id of listy(c.fm.memories)) {
		const m = concepts.find((x) => x.id === id);
		if (m) {
			byId.set(id, {
				id,
				title: m.title,
				description: m.description,
				path: m.path,
			});
		}
	}
	for (const m of dynamic) if (!byId.has(m.id)) byId.set(m.id, m);
	return [...byId.values()];
}

export function gatherImplement(startDir) {
	const b = loadBundle(startDir);
	const concepts = loadConcepts(b.memDir);
	const done = new Set(
		b.features.filter((c) => c.fm.status === "done").map((c) => c.slug),
	);
	// Drafts are not implementable — they are an unaccepted feature proposal.
	const pending = b.features.filter(
		(c) => (c.fm.status || "pending") === "pending",
	);
	const drafts = b.features
		.filter((c) => c.fm.status === "draft")
		.map((c) => c.slug);
	const ready = pending.filter((c) =>
		listy(c.fm.depends_on).every((d) => done.has(d)),
	);
	const nextFeature = ready[0] || null;
	return {
		step: "implement",
		branch: b.branch,
		plan: b.plan?.fm.title || null,
		progress: progress(b.features),
		next: nextFeature && implementContract(nextFeature, concepts),
		// The wave: EVERY dependency-ready feature with its full contract — they
		// are mutually independent, so one implement round can build them all.
		wave: ready.map((c) => implementContract(c, concepts)),
		ready: ready.map((c) => c.slug),
		drafts,
		// Project design params (memory/design.md) — path when captured, else null.
		designFile: b.design ? join(b.memDir, "design.md") : null,
		settings: b.settings,
		state: b.state,
		blocked: pending
			.filter((c) => !ready.includes(c))
			.map((c) => ({
				name: c.slug,
				waitingOn: listy(c.fm.depends_on).filter((d) => !done.has(d)),
			})),
		// pending features remain but none is ready → cycle or missing dependency
		stuck: pending.length > 0 && ready.length === 0,
		advice:
			pending.length > 0 && ready.length === 0
				? "No feature is ready but pending features remain — a dependency cycle or a missing dependency; fix depends_on via /iterator-feature."
				: !ready.length && drafts.length
					? "Only draft features exist — accept the feature breakdown (/iterator-feature) before implementing."
					: !ready.length
						? "Nothing to implement — every feature is done (or no features exist yet)."
						: `Implement the dependency-ready wave (${ready.map((c) => c.slug).join(", ")}) — the features are mutually independent, build them all in this round.`,
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

/** Parse usage.md's totals JSON scalar (mirrors write.mjs's writer shape). */
function usageTotalsAt(file) {
	if (!existsSync(file)) return null;
	try {
		const v = JSON.parse(
			String(frontmatter(readFileSync(file, "utf8")).totals || "{}"),
		);
		return {
			steps: v.steps && typeof v.steps === "object" ? v.steps : {},
			features: v.features && typeof v.features === "object" ? v.features : {},
		};
	} catch {
		return { steps: {}, features: {} };
	}
}

function usageGrand(totals) {
	const g = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, turns: 0 };
	for (const models of Object.values(totals?.steps || {})) {
		for (const u of Object.values(models)) {
			for (const f of ["input", "output", "cacheRead", "cacheWrite"])
				g[f] += u[f] || 0;
			g.turns += u.turns || 0;
		}
	}
	return g;
}

export function gatherUsage(startDir) {
	const b = loadBundle(startDir);
	const totals = usageTotalsAt(join(b.memDir, "usage.md"));
	return {
		step: "usage",
		branch: b.branch,
		plan: b.plan?.fm.title || null,
		exists: totals !== null,
		totals: totals || { steps: {}, features: {} },
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
				return {
					name,
					title: fm.title || name,
					created: fm.created || null,
					features: featureCount,
					usage: usageGrand(usageTotalsAt(join(dir, "usage.md"))),
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
	const totals = usageTotalsAt(join(entry.dir, "usage.md"));
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
			totals: totals || { steps: {}, features: {} },
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
			body: raw.startsWith("---\n")
				? raw.slice(raw.indexOf("\n---", 4) + 4).trim()
				: raw.trim(),
		});
	}

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
			staleCount: memories.filter((m) => m.stale).length,
			unmemorizedCommitCount: unmemorized,
		},
		areas,
		memories,
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
		mode: c.fm.status === "done" ? "green" : "red",
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

/** Validated commit shas for a feature, oldest first (recorded → trailer). */
function resolveFeatureCommits(root, c) {
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
	const hasHead = git(["rev-parse", "--verify", "HEAD"], b.root) !== "";
	// Untracked files are invisible to `git diff HEAD`. Intent-to-add
	// (`git add -N`) makes them diffable as all-addition hunks without
	// committing anything — a brand-new file created by a feature must show in
	// review and land in its commit. Bundle bookkeeping files stay untouched.
	const untracked = git(["ls-files", "--others", "--exclude-standard"], b.root)
		.split("\n")
		.filter(Boolean)
		.filter((f) => !f.startsWith(`${b.memName}/`));
	if (untracked.length) git(["add", "-N", "--", ...untracked], b.root);
	const untrackedSet = new Set(untracked);
	let diffText = hasHead
		? git(["diff", "--text", "HEAD"], b.root)
		: git(["diff", "--text"], b.root);
	let commitLabel = git(["log", "-1", "--format=%h %s"], b.root);
	let source = "working-tree";

	const selected = opts.feature
		? b.features.filter((c) => c.slug === opts.feature)
		: b.features;

	// Done feature + clean tree: rebuild the diff from the feature's commits,
	// excluding the bundle's own bookkeeping paths.
	if (!diffText.trim() && opts.feature && selected[0]?.fm.status === "done") {
		const shas = resolveFeatureCommits(b.root, selected[0]);
		if (shas.length) {
			const pathspec = ["--", ".", `:(exclude)${b.memName}`];
			diffText =
				shas.length === 1
					? git(["show", "--format=", shas[0], ...pathspec], b.root)
					: git(
							["diff", `${shas[0]}^`, shas[shas.length - 1], ...pathspec],
							b.root,
						);
			commitLabel =
				shas.length === 1
					? shas[0].slice(0, 7)
					: `${shas[0].slice(0, 7)}..${shas[shas.length - 1].slice(0, 7)}`;
			source = "commits";
		}
	}

	// Map each changed file to its owning feature: an exact `tests` entry wins
	// (a feature's tests are reviewed WITH its logic, never as uncategorized),
	// then the first feature whose `files` globs match.
	const parsed = parseDiff(diffText).filter(
		(f) => !f.path.startsWith(`${b.memName}/`),
	);
	for (const f of parsed) if (untrackedSet.has(f.path)) f.untracked = true;
	const owners = b.features.map((c) => ({
		slug: c.slug,
		res: listy(c.fm.files).map(globToRegExp),
		tests: new Set(listy(c.fm.tests).map(String)),
	}));
	const byFeature = new Map();
	const uncategorized = [];
	for (const f of parsed) {
		// A focused review belongs to the requested feature even when an earlier,
		// already-done feature declares an overlapping file. The normal wave
		// review retains its stable first-owner mapping.
		const matches = (o) =>
			o.tests.has(f.path) || o.res.some((re) => re.test(f.path));
		let owner = owners.find(matches);
		if (opts.feature) {
			const selectedOwner = owners.find(
				(o) => o.slug === opts.feature && matches(o),
			);
			if (selectedOwner) owner = selectedOwner;
		}
		if (!owner) {
			uncategorized.push(f);
			continue;
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

	return {
		step: "review",
		branch: b.branch,
		commit: commitLabel,
		plan: b.plan?.fm.title || "",
		progress: progress(b.features),
		hasFeaturesFile: b.features.length > 0,
		hasChanges,
		source,
		features,
		uncategorized,
		pitfalls: pitfallsFor(uncategorized.map((f) => f.path)),
		// Project design params — UI-touching diffs are reviewed against them.
		designFile: b.design ? join(b.memDir, "design.md") : null,
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
	};
	// One-JSON-line contract, success or failure: a throw (corrupt bundle,
	// racing file deletion, unreadable file) must never print a stack trace
	// where the caller expects a payload — mirror write.mjs's envelope.
	try {
		if (!steps[step]) {
			throw new Error(
				`unknown step '${step}' (hub|plan|feature|implement|memorize|range|session|settings|usage|archive|knowledge|test|review)`,
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
