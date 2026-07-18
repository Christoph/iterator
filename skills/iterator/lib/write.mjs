#!/usr/bin/env node
/**
 * iterator: deterministic bundle writer.
 *
 * Takes an op payload as JSON on stdin, writes/updates the memory/ OKF bundle,
 * and prints one JSON result line — so the SKILL.mds never hand-author
 * frontmatter, timestamps, indexes, or the log:
 *
 *   node <skill-dir>/write.mjs [project-root] << 'PAYLOAD'
 *   { "op": "...", ... }
 *   PAYLOAD
 *
 * Ops:
 *   plan          write memory/plan.md (+ format.md/index.md/log.md on first
 *                 run) from approved sections + dependencies; preserves an
 *                 existing `# Features` section on re-plan
 *   features        write the full feature set (one OKF file per feature, status
 *                 draft|pending — the featureer writes drafts), delete removed
 *                 slugs, validate acyclic deps + references BEFORE writing,
 *                 regenerate all indexes; never rewrites a done feature
 *   design        write memory/design.md (type: Design) — the project's design
 *                 parameters captured by /iterator-design; preserves `created`
 *                 on re-run so revisions keep the original capture date
 *   update-feature  targeted frontmatter update on one feature (status flips,
 *                 tests, reviewed, done) + optional `# Review` note and
 *                 commits-list entry; regenerates indexes
 *   adjustments   apply the feature UI's mechanical edits verbatim (moves,
 *                 renames incl. depends_on rewiring, description updates) —
 *                 the server's `plan-adjustments` output pipes in unchanged;
 *                 `accept: true` additionally promotes every draft to pending
 *   memorize      create/update/delete okf knowledge concepts
 *                 (architecture/decisions/patterns/pitfalls/setup areas),
 *                 regenerate their area indexes, and/or advance
 *                 `last_memorized_commit` in the root index
 *   apply-review  the knowledge skills' verdict-based writer: the memory review
 *                 UI's decisions plus the original draft cards pipe in
 *                 verbatim (accept/keep/reject/delete per concept), the
 *                 pointer advances to headCommit, the bundle is validated
 *   accept-commit process the review UI's accept-commit result end to end:
 *                 branch safety, per-feature staging + feature(<slug>) commits,
 *                 done flips, sha recording, OKF memory verdicts, pointer
 *                 advance, bookkeeping commit (the UI result pipes verbatim)
 *   record-review record a standalone review's outcome from the UI's
 *                 review-feedback payload verbatim (statuses + notes; line
 *                 comments stay with the model)
 *
 * Every op updates timestamps (override with $ITERATOR_NOW for tests),
 * regenerates memory/features/index.md + the plan `# Features` section +
 * memory/index.md, and prepends a memory/log.md entry. On success prints
 * {"ok":true,...}; on any validation error prints {"ok":false,"error":...}
 * and exits 1 without writing.
 */
import {
	copyFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import {
	basename,
	dirname,
	isAbsolute,
	join,
	relative,
	resolve,
} from "node:path";
import {
	gatherRange,
	gatherReview,
	loadBundle,
	loadConcepts,
	relevantMemories,
	resolveFeatureCommits,
} from "./gather.mjs";
import { git as gitSoft, gitOrFail as gitW, hasStaged } from "./git.mjs";
import {
	canTransition,
	CREATABLE_STATUSES,
	FEATURE_STATUSES,
	RESTARTABLE_STATUSES,
	satisfiedSet,
	unfinished,
} from "./status.mjs";
import {
	parseState,
	SETTINGS_DEFS,
	SETTINGS_KEYS,
	STATE_PHASES,
	validateSettings,
} from "./settings.mjs";
import {
	backlogIndex,
	backlogItems,
	BACKLOG_KINDS,
	fmScalar,
	frontmatter,
	globToRegExp,
	joinDoc,
	listy,
	mergeRootIndex,
	nowIso,
	OKF_AREAS,
	prependLog as prependLogShared,
	regenerateAreaIndex,
	resolveTemplate,
	setFmKeys,
	splitDoc,
	today,
	updateRootIndex,
	validateBundle,
} from "./bundle.mjs";

// Re-export the shared helpers this module used to own (tests and the okf
// skills import them from here).
export { mergeRootIndex, OKF_AREAS, setFmKeys };

const fail = (msg) => {
	throw new Error(msg);
};

/** Deterministically repair a slug to kebab-case (`My Slug!` → `my-slug`). */
const normalizeSlug = (s) =>
	String(s || "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

/**
 * `advanceTo: "HEAD"` / `advance: true` → the writer resolves the sha itself
 * (a model copying shas between payloads is a transcription-error surface).
 */
function resolveAdvance(value, root) {
	if (value !== "HEAD" && value !== true) return value;
	const sha = gitW(["rev-parse", "HEAD"], root);
	if (!/^[0-9a-f]{7,40}$/i.test(sha)) fail("cannot resolve HEAD to a sha");
	return sha;
}

/** Append one { sha, kind, date } entry to the commits block list. */
export function appendCommitFm(fm, { sha, kind, date }) {
	if (!sha || !kind) fail("appendCommit needs { sha, kind }");
	const entry = [
		`  - sha: ${sha}`,
		`    kind: ${kind}`,
		`    date: ${date || today()}`,
	];
	const lines = fm.split("\n");
	const i = lines.findIndex((l) => /^commits:\s*$/.test(l));
	if (i === -1)
		return `${fm.replace(/\s*$/, "")}\ncommits:\n${entry.join("\n")}`;
	let j = i + 1;
	while (j < lines.length && /^\s+\S/.test(lines[j])) j++;
	lines.splice(j, 0, ...entry);
	return lines.join("\n");
}

/** Insert a dated review bullet under `# Review`, newest-first. */
export function appendReviewBody(bodyText, line, date) {
	const d = date || today();
	const lines = bodyText.split("\n");
	const h = lines.findIndex((l) => /^# Review\s*$/.test(l));
	if (h === -1) {
		return `${bodyText.replace(/\s*$/, "")}\n\n# Review\n\n## ${d}\n${line}\n`;
	}
	let j = h + 1;
	while (j < lines.length && lines[j].trim() === "") j++;
	if (lines[j] === `## ${d}`) lines.splice(j + 1, 0, line);
	else lines.splice(j, 0, `## ${d}`, line, "");
	return lines.join("\n");
}

/** Replace one `# Heading` section's content in a body (fence-aware). */
export function replaceSection(raw, name, content) {
	const { fm, body: bodyText } = splitDoc(raw);
	const lines = bodyText.split("\n");
	let fence = false,
		start = -1,
		end = lines.length;
	for (let i = 0; i < lines.length; i++) {
		if (/^```/.test(lines[i])) fence = !fence;
		if (fence) continue;
		if (start === -1 && lines[i].trim() === `# ${name}`) {
			start = i;
			continue;
		}
		if (start !== -1 && /^# /.test(lines[i])) {
			end = i;
			break;
		}
	}
	const block = [`# ${name}`, "", content, ""];
	const out =
		start === -1
			? [...lines, ...(lines[lines.length - 1]?.trim() ? [""] : []), ...block]
			: [...lines.slice(0, start), ...block, ...lines.slice(end)];
	const newBody = out
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.replace(/\s*$/, "\n");
	return fm === null ? newBody : joinDoc(fm, newBody);
}

// ---------------------------------------------------------------------------
// Topological order + validation

/** Kahn's algorithm; ties broken by input order (creation order). */
export function topoSort(items) {
	const slugs = new Set(items.map((c) => c.slug));
	const missing = [];
	for (const c of items) {
		for (const d of c.dependsOn) {
			if (!slugs.has(d)) missing.push(`${c.slug} → ${d}`);
		}
	}
	const order = [];
	const placed = new Set();
	while (placed.size < items.length) {
		const next = items.find(
			(c) =>
				!placed.has(c.slug) &&
				c.dependsOn.every((d) => placed.has(d) || !slugs.has(d)),
		);
		if (!next) break; // remaining nodes form a cycle
		placed.add(next.slug);
		order.push(next.slug);
	}
	return {
		order,
		missing,
		cycle:
			placed.size < items.length
				? items.filter((c) => !placed.has(c.slug)).map((c) => c.slug)
				: [],
	};
}

// ---------------------------------------------------------------------------
// Generated files (features/index.md, plan # Features, memory/index.md, log.md)

function featureIndexLine(c) {
	const status =
		c.fm.status === "done"
			? "✅ done"
			: c.fm.status === "draft"
				? "📝 draft"
				: "⬜ pending";
	const badge =
		c.fm.tests_status === "red"
			? " · 🔴 tests red"
			: c.fm.tests_status === "green"
				? " · 🟢 tests green"
				: "";
	const deps = listy(c.fm.depends_on).length
		? ` · depends: ${listy(c.fm.depends_on).join(", ")}`
		: "";
	return `* [${c.fm.title || c.slug}](${c.slug}.md) - ${status}${badge} · ${c.fm.size || "small"}${deps} · ${c.fm.description || ""}`;
}

/** Iterator's own root-index link lines (only for files that exist). */
function iteratorIndexLinks(b) {
	const links = [];
	if (b.plan)
		links.push([
			"plan.md",
			`* [Plan](plan.md) - ${b.plan.fm.description || "The plan concept."}`,
		]);
	if (existsSync(join(b.memDir, "format.md"))) {
		links.push([
			"format.md",
			"* [Format](format.md) - Metadata schema for this bundle.",
		]);
	}
	if (b.design) {
		links.push([
			"design.md",
			`* [Design](design.md) - ${b.design.fm.description || "Project design parameters."}`,
		]);
	}
	if (existsSync(join(b.memDir, "settings.md"))) {
		links.push([
			"settings.md",
			"* [Settings](settings.md) - Project settings (auto mode, models, git flow).",
		]);
	}
	if (existsSync(join(b.memDir, "features"))) {
		links.push([
			"features/",
			"* [Features](features/) - One document per implementation feature.",
		]);
	}
	if (existsSync(join(b.memDir, "backlog", "index.md"))) {
		links.push([
			"backlog/index.md",
			"* [Backlog](backlog/index.md) - Saved ideas and bugs outside active plan features.",
		]);
	}
	links.push([
		"log.md",
		"* [Log](log.md) - Chronological history of plan/feature/implement/review events.",
	]);
	return links;
}

/** Rebuild every generated file from the bundle's current on-disk state. */
export function regenerate(root) {
	const b = loadBundle(root);
	const { order } = topoSort(
		b.features.map((c) => ({
			slug: c.slug,
			dependsOn: listy(c.fm.depends_on),
		})),
	);
	const ordered = [
		...order,
		...b.features.map((c) => c.slug).filter((s) => !order.includes(s)),
	].map((s) => b.features.find((c) => c.slug === s));

	if (existsSync(join(b.memDir, "features")) && ordered.length) {
		writeFileSync(
			join(b.memDir, "features", "index.md"),
			`# Features\n\n${ordered.map(featureIndexLine).join("\n")}\n`,
		);
	}

	if (b.plan && ordered.length) {
		const links = ordered
			.map(
				(c) =>
					`* [${c.fm.title || c.slug}](/features/${c.slug}.md) - ${c.fm.description || ""}`,
			)
			.join("\n");
		writeFileSync(
			join(b.memDir, "plan.md"),
			replaceSection(b.plan.raw, "Features", links),
		);
	}

	const indexFile = join(b.memDir, "index.md");
	const existing = existsSync(indexFile)
		? readFileSync(indexFile, "utf8")
		: null;
	writeFileSync(indexFile, mergeRootIndex(existing, iteratorIndexLinks(b)));
}

/** Prepend log entries, creating the file with iterator's header. */
export function prependLog(memDir, entries) {
	prependLogShared(memDir, entries, { header: "# iterator update log" });
}

// ---------------------------------------------------------------------------
// op: plan

function writePlan(payload, root) {
	const b = loadBundle(root);
	const title = payload.title || fail("plan op needs a title");
	const s = payload.sections || {};
	if (!s.goal) fail("plan op needs sections.goal");
	mkdirSync(join(b.memDir, "features"), { recursive: true });

	// format.md: the self-describing schema, copied verbatim once.
	const formatDest = join(b.memDir, "format.md");
	if (!existsSync(formatDest)) {
		const src =
			resolveTemplate("format.md") ||
			fail(
				"cannot find templates/format.md — is the full iterator plugin installed?",
			);
		copyFileSync(src, formatDest);
	}

	const description = (payload.description || s.goal.split("\n")[0])
		.replace(/\s+/g, " ")
		.trim();
	// The Dependencies section is for EXTERNAL packages/libraries/services
	// only. Deterministic lint: entries shaped like work items ("add X",
	// "implement Y") or missing the 'name — why' form get a warning in the
	// result — semantics stay with the model, but todo abuse is surfaced.
	const warnings = [];
	const TODO_DEP_RE =
		/^(add|implement|fix|create|update|write|refactor|make|build|set\s?up|ensure|move|change|remove|test)\b/i;
	for (const d of listy(payload.dependencies)) {
		const str = String(d);
		if (TODO_DEP_RE.test(str) || !/\s+—\s+/.test(str)) {
			warnings.push(
				`dependency "${str}" doesn't look like an external package — this list is for new packages/libraries/services as '<name> — <why>' (e.g. 'axum 0.7 — HTTP server'), never todos`,
			);
		}
	}
	const deps = listy(payload.dependencies).map((d) => {
		const m = String(d).match(/^(.+?)\s+—\s+(.*)$/);
		return m ? `* \`${m[1].trim().replaceAll("`", "")}\` — ${m[2]}` : `* ${d}`;
	});
	const featuresSection =
		b.plan?.sections["Features"] ||
		"<!-- regenerated by /iterator-feature; empty until features exist -->";
	const approved = (payload.status || "approved") === "approved";

	// Branch/worktree per plan (settings): approving a plan on main/master
	// moves the work onto iterator/<plan-slug> — in a separate git worktree by
	// default (the main checkout stays untouched), or via a plain checkout -b
	// when worktree_per_plan is off. Names are decided here so the plan
	// frontmatter records where the work happens; the git side runs after the
	// bundle is written (the worktree copy must include this very plan.md).
	let planBranch = null;
	let worktreePath = null;
	const curBranch = gitSoft(["rev-parse", "--abbrev-ref", "HEAD"], b.root);
	const hasHead = gitSoft(["rev-parse", "--verify", "HEAD"], b.root) !== "";
	if (
		approved &&
		b.settings.branch_per_plan === "on" &&
		hasHead &&
		(curBranch === "main" || curBranch === "master")
	) {
		const slug = normalizeSlug(title) || "plan";
		planBranch = `iterator/${slug}`;
		if (b.settings.worktree_per_plan === "on") {
			worktreePath = join(
				dirname(b.root),
				`${basename(b.root)}-iterator-${slug}`,
			);
		}
	}

	const fm = [
		"type: Plan",
		`title: ${fmScalar(title)}`,
		`description: ${fmScalar(description)}`,
		`status: ${payload.status || "approved"}`,
		`branch: ${fmScalar(payload.branch || planBranch || b.branch)}`,
		...(worktreePath ? [`worktree: ${fmScalar(worktreePath)}`] : []),
		`created: ${b.plan?.fm.created || today()}`,
		`timestamp: ${nowIso()}`,
	].join("\n");
	const bodyText = `
# Goal

${s.goal}

# Architecture

${s.architecture || ""}

# Dependencies

${deps.join("\n") || "(none)"}

# Key decisions

${s.keyDecisions || ""}

# Features

${featuresSection}
`.replace(/\n{3,}/g, "\n\n");

	writeFileSync(join(b.memDir, "plan.md"), joinDoc(fm, bodyText));
	// Plan approval begins a fresh workflow. Never let auto-mode bookkeeping,
	// an escalation, or feature strikes from a retired/replaced plan dispatch
	// work into this new plan; drafts intentionally leave runtime state alone.
	if (approved) {
		writeState(
			{
				set: {
					mode: "manual",
					paused: false,
					phase: "idle",
					active_feature: null,
					strikes: {},
					escalation: null,
				},
			},
			root,
		);
	}
	// A selected candidate is explicitly being handed to plan creation. Consume
	// it only after the approved plan has been written; drafts, feedback, and
	// cancelled review rounds never invoke this deterministic operation.
	const backlog = loadBacklogForWrite(b);
	const consumedBacklog = approved
		? backlog.filter((item) => item.selected === true)
		: [];
	if (consumedBacklog.length) {
		writeFileSync(
			backlogPath(b),
			backlogIndex(backlog.filter((item) => item.selected !== true)),
		);
	}
	regenerate(root);
	prependLog(
		b.memDir,
		payload.log ||
			`**${b.plan ? "Update" : "Creation"}**: Plan "${title}" approved on branch ${payload.branch || b.branch}.${consumedBacklog.length ? ` Consumed ${consumedBacklog.length} selected backlog candidate(s).` : ""}`,
	);
	// Soft memory-init gate: planning without the knowledge side means features
	// get no relevant memories — surface it, never block.
	if (!Object.keys(OKF_AREAS).some((a) => existsSync(join(b.memDir, a)))) {
		warnings.push(
			"knowledge memory is not initialized — run /iterator-init so features and implementers get relevant memories",
		);
	}

	// Create the plan branch/worktree now that the bundle is fully written. A
	// git failure here degrades to a warning — the plan itself already landed.
	let branchResult = null;
	if (planBranch) {
		try {
			// The plan branch/worktree must start from the LATEST base branch:
			// prefetch and fast-forward (pull) the local main/master to its remote
			// counterpart before branching. Soft on purpose — offline or
			// remote-less repos branch from the local tip, with a warning. If the
			// local base cannot fast-forward (diverged local commits), the new
			// branch is based on origin/<base> directly so the worktree is still
			// current.
			let base = curBranch;
			if (gitSoft(["remote", "get-url", "origin"], b.root) !== "") {
				try {
					gitW(["fetch", "--quiet", "origin", curBranch], b.root);
					const remoteTip = gitSoft(
						["rev-parse", "--verify", `origin/${curBranch}`],
						b.root,
					);
					if (remoteTip) {
						try {
							gitW(["merge", "--ff-only", `origin/${curBranch}`], b.root);
						} catch {
							base = `origin/${curBranch}`;
							warnings.push(
								`local ${curBranch} could not fast-forward to origin/${curBranch} — the plan branch starts from origin/${curBranch} directly`,
							);
						}
					}
				} catch (e) {
					warnings.push(
						`could not fetch origin before branching (offline?): ${e.message} — the plan branch starts from the local ${curBranch}`,
					);
				}
			}
			const branchExists =
				gitSoft(["rev-parse", "--verify", planBranch], b.root) !== "";
			if (worktreePath) {
				if (existsSync(worktreePath)) {
					branchResult = { branch: planBranch, worktree: worktreePath };
				} else {
					gitW(
						branchExists
							? ["worktree", "add", worktreePath, planBranch]
							: ["worktree", "add", "-b", planBranch, worktreePath, base],
						b.root,
					);
					// The uncommitted bundle exists only in this checkout — copy it
					// so the worktree starts with the same plan/settings/knowledge.
					if (!isAbsolute(b.memName)) {
						const dest = join(worktreePath, b.memName);
						if (!existsSync(dest)) cpSync(b.memDir, dest, { recursive: true });
					}
					branchResult = { branch: planBranch, worktree: worktreePath };
				}
			} else {
				gitW(
					branchExists
						? ["checkout", planBranch]
						: ["checkout", "-b", planBranch, base],
					b.root,
				);
				branchResult = { branch: planBranch };
			}
		} catch (e) {
			warnings.push(`could not create the plan branch: ${e.message}`);
		}
	}

	return {
		op: "plan",
		written: [
			"plan.md",
			"index.md",
			"log.md",
			...(approved ? ["state.md"] : []),
			...(consumedBacklog.length ? ["backlog/index.md"] : []),
		],
		consumedBacklog: consumedBacklog.map((item) => item.id),
		memoryDir: b.memDir,
		...(branchResult ? branchResult : {}),
		...(branchResult?.worktree
			? {
					note: `plan branch ${branchResult.branch} checked out in a separate worktree at ${branchResult.worktree} — ALL iterator work (gathers, writes, edits, commits) happens there from now on; gather/write re-root themselves automatically, and your file edits must target that path (the current checkout stays on ${curBranch})`,
				}
			: {}),
		...(warnings.length ? { warnings } : {}),
	};
}

// ---------------------------------------------------------------------------
// op: features

function featureDoc(c, titles, existingReview) {
	const conflicts = listy(c.conflicts).filter((x) => x && x.decision);
	const fm = [
		"type: Feature",
		`title: ${fmScalar(c.title || c.name)}`,
		`description: ${fmScalar(c.description || "")}`,
		`status: ${c.status || "pending"}`,
		`size: ${c.size || "small"}`,
		`depends_on: [${listy(c.dependsOn).join(", ")}]`,
		`files: [${listy(c.files)
			.map((f) => JSON.stringify(String(f)))
			.join(", ")}]`,
		// Writer-computed relevant memories (anchor match at feature time) — the
		// implementer's reading list, stored so it survives without a re-gather.
		...(listy(c.memories).length
			? [`memories: [${listy(c.memories).join(", ")}]`]
			: []),
		// Decision conflicts flagged by the slicing model (JSON scalar — the
		// readable rendering lives in the body's Decision conflicts section).
		...(conflicts.length
			? [
					`conflicts: ${fmScalar(
						JSON.stringify(
							conflicts.map((x) => ({
								decision: String(x.decision),
								note: String(x.note || ""),
							})),
						),
					)}`,
				]
			: []),
		`timestamp: ${nowIso()}`,
		`tags: [${listy(c.tags).join(", ")}]`,
	].join("\n");

	const parts = [
		"",
		"# Implementation notes",
		"",
		c.implementationNotes || c.description || "",
		"",
	];
	const snips = listy(c.snippets);
	if (snips.length) {
		parts.push("# Snippets", "");
		for (const sn of snips)
			parts.push("```" + (sn.lang || ""), sn.code || "", "```", "");
	}
	if (listy(c.dependsOn).length) {
		parts.push("# Depends on", "");
		for (const d of c.dependsOn)
			parts.push(`* [${titles.get(d) || d}](/features/${d}.md)`);
		parts.push("");
	}
	if (c.blastRadius) parts.push("# Blast radius", "", c.blastRadius, "");
	if (conflicts.length) {
		parts.push("# Decision conflicts", "");
		for (const x of conflicts)
			parts.push(`* [${x.decision}](/${x.decision}.md) — ${x.note || ""}`);
		parts.push("");
	}
	if (existingReview) parts.push("# Review", "", existingReview, "");
	return joinDoc(
		fm,
		parts
			.join("\n")
			.replace(/\n{3,}/g, "\n\n")
			.replace(/\s*$/, "\n"),
	);
}

// Soft ceiling on a feature's declared `files` before the writer warns: a
// vertical slice rarely changes more than this many files, tests included.
const MAX_FEATURE_FILES = 8;

function writeFeatures(payload, root) {
	const b = loadBundle(root);
	if (!b.plan) fail("no memory/plan.md — run the plan op first");
	const incoming = listy(payload.features);
	if (!incoming.length) fail("features op needs a non-empty features list");
	const deletes = listy(payload.deletes);
	const existing = new Map(b.features.map((c) => [c.slug, c]));

	// Auto-repair fixable slugs instead of bouncing the whole breakdown back:
	// the normalization is deterministic and reported in the result.
	const normalized = [];
	const slugMap = new Map();
	for (const c of incoming) {
		const norm = normalizeSlug(c.name);
		if (norm && norm !== c.name) {
			normalized.push({ from: c.name, to: norm });
			slugMap.set(c.name, norm);
			c.name = norm;
		}
	}
	if (slugMap.size) {
		for (const c of incoming)
			c.dependsOn = listy(c.dependsOn).map((d) => slugMap.get(d) || d);
	}
	{
		const seen = new Set();
		for (const c of incoming) {
			if (seen.has(c.name))
				fail(`duplicate feature slug '${c.name}' after normalization`);
			seen.add(c.name);
		}
	}

	for (const c of incoming) {
		if (!c.name || !/^[a-z0-9][a-z0-9-]*$/.test(c.name))
			fail(`invalid feature slug '${c.name || ""}' (kebab-case required)`);
		if (c.status && !CREATABLE_STATUSES.includes(c.status)) {
			fail(
				`invalid feature status '${c.status}' (features op writes draft|pending; done is owned by update-feature)`,
			);
		}
		if (c.size && !["small", "medium", "large"].includes(c.size)) {
			fail(`invalid feature size '${c.size}' (small|medium|large)`);
		}
		for (const x of listy(c.conflicts)) {
			if (!x || typeof x.decision !== "string" || !x.decision.trim())
				fail(
					`feature '${c.name}': conflicts entries need { decision: '<area>/<slug>', note? }`,
				);
		}
	}
	for (const d of deletes) {
		if (existing.get(d)?.fm.status === "done")
			fail(`refusing to delete done feature '${d}'`);
	}

	// Final set = existing − deletes ∪ incoming; validate deps + cycles first.
	const doneProtected = incoming
		.filter((c) => existing.get(c.name)?.fm.status === "done")
		.map((c) => c.name);
	const finalSlugs = new Set([
		...b.features.map((c) => c.slug).filter((s) => !deletes.includes(s)),
		...incoming.map((c) => c.name),
	]);
	const metas = [...finalSlugs].map((slug) => {
		const inc = incoming.find((c) => c.name === slug);
		const dependsOn =
			inc && !doneProtected.includes(slug)
				? listy(inc.dependsOn)
				: listy(existing.get(slug)?.fm.depends_on);
		return { slug, dependsOn };
	});
	const { cycle, missing } = topoSort(metas);
	if (missing.length)
		fail(`depends_on references missing features: ${missing.join(", ")}`);
	if (cycle.length) fail(`dependency cycle between: ${cycle.join(", ")}`);

	const featuresDir = join(b.memDir, "features");
	mkdirSync(featuresDir, { recursive: true });
	const titles = new Map(
		metas.map((m) => {
			const inc = incoming.find((c) => c.name === m.slug);
			return [
				m.slug,
				inc?.title || inc?.name || existing.get(m.slug)?.fm.title || m.slug,
			];
		}),
	);

	// Anchor-match each feature's files against the knowledge concepts ONCE at
	// write time: the stored `memories:` list is the implementer's reading
	// list (issue: start directly, no re-derivation). Conflicts arrive from
	// the slicing model; both render in the feature/hub views.
	const concepts = loadConcepts(b.memDir);
	const written = [];
	for (const c of incoming) {
		if (doneProtected.includes(c.name)) continue; // never rewrite a done feature
		const prev = existing.get(c.name);
		c.memories = relevantMemories(concepts, listy(c.files)).map((m) => m.id);
		writeFileSync(
			join(featuresDir, `${c.name}.md`),
			featureDoc(c, titles, prev?.sections["Review"]),
		);
		written.push(c.name);
	}
	for (const d of deletes) {
		if (existing.has(d)) rmSync(join(featuresDir, `${d}.md`));
	}

	regenerate(root);
	prependLog(
		b.memDir,
		payload.log ||
			`**${b.features.length ? "Update" : "Creation"}**: ${written.length} feature(s) written${deletes.length ? `, ${deletes.length} removed` : ""}.`,
	);

	// Surface globs that match nothing NOW (warn, never fail — files may be
	// written later): a typo'd glob would otherwise silently never map diffs
	// to this feature, discovered three steps downstream.
	const known = [
		...gitSoft(["ls-files"], b.root).split("\n"),
		...gitSoft(["ls-files", "--others", "--exclude-standard"], b.root).split(
			"\n",
		),
	].filter(Boolean);
	const unmatchedGlobs = known.length
		? incoming
				.filter((c) => !doneProtected.includes(c.name))
				.map((c) => ({
					feature: c.name,
					globs: listy(c.files)
						.map(String)
						.filter((g) => !known.some((p) => globToRegExp(g).test(p))),
				}))
				.filter((w) => w.globs.length)
		: [];

	// An over-broad `files` list (warn, never fail): it inflates review
	// ownership and saturates the memories anchor-match — usually the slice is
	// too big, or the list is padded with reference-only/generated files.
	const broadFiles = incoming
		.filter((c) => !doneProtected.includes(c.name))
		.map((c) => ({ feature: c.name, count: listy(c.files).length }))
		.filter((w) => w.count > MAX_FEATURE_FILES);

	const warnings = {
		...(unmatchedGlobs.length ? { unmatchedGlobs } : {}),
		...(broadFiles.length ? { broadFiles } : {}),
	};
	return {
		op: "features",
		written,
		skipped: doneProtected,
		deleted: deletes,
		...(normalized.length ? { normalized } : {}),
		...(Object.keys(warnings).length ? { warnings } : {}),
		memoryDir: b.memDir,
	};
}

// ---------------------------------------------------------------------------
// op: backlog

const BACKLOG_TITLE_MAX = 160;
const BACKLOG_DETAILS_MAX = 4_000;

function backlogPath(b) {
	return join(b.memDir, "backlog", "index.md");
}

function loadBacklogForWrite(b) {
	const file = backlogPath(b);
	return existsSync(file) ? backlogItems(readFileSync(file, "utf8")) : [];
}

function backlogInput(payload, { requireId = false } = {}) {
	const id = String(payload.id || "").trim();
	const title = String(payload.title || "").trim();
	const details = String(payload.details || "").trim();
	const kind = String(payload.kind || "idea").trim();
	if (requireId && !/^[a-z0-9][a-z0-9-]*$/.test(id))
		fail("backlog id must be a kebab-case slug");
	if (!title) fail("backlog title is required");
	if (title.length > BACKLOG_TITLE_MAX)
		fail(`backlog title must be at most ${BACKLOG_TITLE_MAX} characters`);
	if (details.length > BACKLOG_DETAILS_MAX)
		fail(`backlog details must be at most ${BACKLOG_DETAILS_MAX} characters`);
	if (!BACKLOG_KINDS.includes(kind))
		fail(`backlog kind must be one of: ${BACKLOG_KINDS.join(", ")}`);
	return { id, title, details, kind };
}

/** Deterministic CRUD + selection state for memory/backlog/index.md. */
function writeBacklog(payload, root) {
	const b = loadBundle(root);
	const action = String(payload.action || "");
	const items = loadBacklogForWrite(b);
	let changed;

	if (action === "create") {
		const input = backlogInput(payload);
		const base = normalizeSlug(input.title) || "backlog-item";
		let id = base;
		let n = 2;
		while (items.some((item) => item.id === id)) id = `${base}-${n++}`;
		changed = {
			...input,
			id,
			selected: false,
			created: nowIso(),
			updated: nowIso(),
		};
		items.push(changed);
	} else if (action === "edit") {
		const input = backlogInput(payload, { requireId: true });
		const i = items.findIndex((item) => item.id === input.id);
		if (i === -1) fail(`no backlog item '${input.id}'`);
		changed = {
			...items[i],
			...input,
			selected: items[i].selected === true,
			updated: nowIso(),
		};
		items[i] = changed;
	} else if (action === "select") {
		const id = String(payload.id || "").trim();
		if (!/^[a-z0-9][a-z0-9-]*$/.test(id))
			fail("backlog id must be a kebab-case slug");
		if (typeof payload.selected !== "boolean")
			fail("backlog selected must be a boolean");
		const i = items.findIndex((item) => item.id === id);
		if (i === -1) fail(`no backlog item '${id}'`);
		changed = { ...items[i], selected: payload.selected, updated: nowIso() };
		items[i] = changed;
	} else if (action === "delete") {
		const id = String(payload.id || "").trim();
		if (!/^[a-z0-9][a-z0-9-]*$/.test(id))
			fail("backlog id must be a kebab-case slug");
		const i = items.findIndex((item) => item.id === id);
		if (i === -1) fail(`no backlog item '${id}'`);
		changed = items[i];
		items.splice(i, 1);
	} else {
		fail("backlog action must be create, edit, select, or delete");
	}

	const dir = join(b.memDir, "backlog");
	mkdirSync(dir, { recursive: true });
	writeFileSync(backlogPath(b), backlogIndex(items));
	regenerate(root);
	prependLog(
		b.memDir,
		payload.log ||
			`**Backlog**: ${action} ${changed.id}${action === "select" ? (changed.selected ? " (selected)" : " (deselected)") : ""}.`,
	);
	return { op: "backlog", action, item: changed, items, memoryDir: b.memDir };
}

// ---------------------------------------------------------------------------
// op: design

const DESIGN_SECTIONS = [
	["direction", "Direction", true],
	["typography", "Typography", true],
	["color", "Color", true],
	["spacing", "Spacing", true],
	["elements", "Elements", true],
	["responsive", "Responsive", false],
	["signature", "Signature", false],
];

function writeDesign(payload, root) {
	const b = loadBundle(root);
	if (!b.plan) fail("no memory/plan.md — run the plan op first");
	const s = payload.sections || {};
	for (const [key, , required] of DESIGN_SECTIONS) {
		if (required && !s[key]) fail(`design op needs sections.${key}`);
	}
	const register = payload.register || "product";
	if (!["brand", "product"].includes(register))
		fail(`invalid register '${register}' (brand|product)`);

	// Deterministic lint: the file only serves its purpose ("reproduce the look
	// from this file alone") when the sections hold concrete values. Warn in
	// the result — semantics stay with the model.
	const warnings = [];
	if (!/#[0-9a-f]{3,8}\b|oklch\(|rgb\(/i.test(s.color || ""))
		warnings.push(
			"sections.color has no concrete color value (hex/oklch/rgb) — name the actual palette values",
		);
	const spacingNamed =
		/\b(small|sm)\b[\s\S]*\b(med(ium)?|md)\b[\s\S]*\b(large|lg)\b/i.test(
			s.spacing || "",
		) ||
		(
			(s.spacing || "").match(/\b[\w-]+\s*[:=]\s*\d+(\.\d+)?(px|rem|em)\b/g) ||
			[]
		).length >= 3;
	if (!spacingNamed)
		warnings.push(
			"sections.spacing must name small/medium/large margin and padding constants (e.g. space-sm: 8px · space-md: 16px · space-lg: 32px)",
		);

	const fm = [
		"type: Design",
		`title: ${fmScalar(payload.title || "Design parameters")}`,
		`description: ${fmScalar((payload.description || s.direction.split("\n")[0]).replace(/\s+/g, " ").trim())}`,
		`register: ${register}`,
		`created: ${b.design?.fm.created || today()}`,
		`timestamp: ${nowIso()}`,
	].join("\n");
	const bodyText = `\n${DESIGN_SECTIONS.filter(([key]) => s[key])
		.map(([key, heading]) => `# ${heading}\n\n${s[key]}\n`)
		.join("\n")}`.replace(/\n{3,}/g, "\n\n");

	writeFileSync(join(b.memDir, "design.md"), joinDoc(fm, bodyText));
	regenerate(root);
	prependLog(
		b.memDir,
		payload.log ||
			`**Design**: ${b.design ? "Updated" : "Captured"} project design parameters.`,
	);
	return {
		op: "design",
		written: ["design.md", "index.md", "log.md"],
		...(warnings.length ? { warnings } : {}),
		memoryDir: b.memDir,
	};
}

// ---------------------------------------------------------------------------
// op: settings — memory/settings.md, partial merge over the current values.

function writeSettings(payload, root) {
	const b = loadBundle(root);
	const incoming = payload.values || {};
	if (!Object.keys(incoming).length) fail("settings op needs values");
	const { ok, errors, values } = validateSettings(incoming);
	if (!ok) fail(errors.join("; "));

	const file = join(b.memDir, "settings.md");
	const current = existsSync(file)
		? frontmatter(readFileSync(file, "utf8"))
		: {};
	const merged = {};
	for (const k of SETTINGS_KEYS) {
		if (k in values) merged[k] = values[k];
		else if (current[k] != null) {
			// Keep only still-valid stored entries; drop mangled ones silently.
			const v = validateSettings({ [k]: current[k] });
			if (v.ok) merged[k] = v.values[k];
		}
	}

	mkdirSync(b.memDir, { recursive: true });
	const fm = [
		"type: Settings",
		"title: Project settings",
		"description: Iterator behavior for this project — edited via the settings UI, applied by the writer.",
		...SETTINGS_KEYS.filter((k) => k in merged).map(
			(k) => `${k}: ${fmScalar(String(merged[k]))}`,
		),
		`timestamp: ${nowIso()}`,
	].join("\n");
	const bodyText = `\n# Settings\n\n${SETTINGS_KEYS.filter((k) => k in merged)
		.map((k) => `* \`${k}\`: ${merged[k]} — ${SETTINGS_DEFS[k].help}`)
		.join("\n")}\n`;
	writeFileSync(file, joinDoc(fm, bodyText));
	regenerate(root);
	prependLog(
		b.memDir,
		payload.log || `**Settings**: Updated ${Object.keys(values).join(", ")}.`,
	);
	return {
		op: "settings",
		written: ["settings.md", "index.md", "log.md"],
		changed: values,
		memoryDir: b.memDir,
	};
}

// ---------------------------------------------------------------------------
// op: state — memory/state.md, the machine's runtime flow state. No log
// entries (this changes on every auto-mode step; the log is for history).

function writeState(payload, root) {
	const b = loadBundle(root);
	const set = payload.set || {};
	if (!Object.keys(set).length && !payload.strike && !payload.clearStrike) {
		fail("state op needs set (and/or strike/clearStrike)");
	}
	if (set.mode && !["manual", "auto"].includes(set.mode))
		fail(`invalid mode '${set.mode}' (manual|auto)`);
	if (set.phase && !STATE_PHASES.includes(set.phase))
		fail(`invalid phase '${set.phase}' (${STATE_PHASES.join("|")})`);
	if ("paused" in set && typeof set.paused !== "boolean")
		fail("paused must be a boolean");

	const file = join(b.memDir, "state.md");
	const current = parseState(
		existsSync(file) ? frontmatter(readFileSync(file, "utf8")) : null,
	);
	const next = { ...current };
	if (set.mode) next.mode = set.mode;
	if ("paused" in set) next.paused = set.paused;
	if (set.phase) next.phase = set.phase;
	if ("active_feature" in set) next.active_feature = set.active_feature || null;
	if (set.strikes && typeof set.strikes === "object") {
		next.strikes = { ...set.strikes };
	}
	// Convenience bookkeeping: `strike` increments one feature's counter,
	// `clearStrike` resets it — saves the caller a read-modify-write.
	if (payload.strike) {
		next.strikes = {
			...next.strikes,
			[payload.strike]: (next.strikes[payload.strike] || 0) + 1,
		};
	}
	if (payload.clearStrike) {
		next.strikes = { ...next.strikes };
		delete next.strikes[payload.clearStrike];
	}
	// Escalation detail (why auto mode stopped): an object to set, null to clear.
	if ("escalation" in set) {
		if (set.escalation === null) next.escalation = null;
		else if (
			set.escalation &&
			typeof set.escalation === "object" &&
			set.escalation.reason
		) {
			next.escalation = {
				feature: set.escalation.feature || null,
				reason: String(set.escalation.reason),
				at: set.escalation.at || nowIso(),
			};
		} else fail("escalation must be null or { feature?, reason, at? }");
	}

	mkdirSync(b.memDir, { recursive: true });
	const fm = [
		"type: State",
		"title: Runtime state",
		"description: Machine-owned iterator flow state — never hand-edited.",
		`mode: ${next.mode}`,
		`paused: ${next.paused}`,
		`phase: ${next.phase}`,
		`active_feature: ${next.active_feature || "null"}`,
		`strikes: ${fmScalar(JSON.stringify(next.strikes))}`,
		`escalation: ${fmScalar(JSON.stringify(next.escalation || null))}`,
		`timestamp: ${nowIso()}`,
	].join("\n");
	writeFileSync(
		file,
		joinDoc(
			fm,
			"\nRuntime flow state; read via gather, written only by the state op.\n",
		),
	);
	return {
		op: "state",
		written: ["state.md"],
		state: next,
		memoryDir: b.memDir,
	};
}

// ---------------------------------------------------------------------------
// op: usage — memory/usage.md, the per-plan token ledger. Aggregates live in
// frontmatter as a JSON scalar; the body is a REGENERATED human-readable
// table (no unbounded append). Prices are computed later by the user — the
// ledger stores tokens + cached tokens per step × model, per issue.

const USAGE_FIELDS = ["input", "output", "cacheRead", "cacheWrite"];

function parseUsageTotals(fm) {
	try {
		const v = JSON.parse(String(fm?.totals || "{}"));
		return {
			steps: v.steps && typeof v.steps === "object" ? v.steps : {},
			features: v.features && typeof v.features === "object" ? v.features : {},
		};
	} catch {
		return { steps: {}, features: {} };
	}
}

function addUsage(bucket, row) {
	for (const f of USAGE_FIELDS) bucket[f] = (bucket[f] || 0) + (row[f] || 0);
	bucket.turns = (bucket.turns || 0) + 1;
	return bucket;
}

export function usageGrandTotal(totals) {
	const grand = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, turns: 0 };
	for (const models of Object.values(totals.steps || {})) {
		for (const u of Object.values(models)) {
			for (const f of USAGE_FIELDS) grand[f] += u[f] || 0;
			grand.turns += u.turns || 0;
		}
	}
	return grand;
}

function usageBody(totals) {
	const lines = ["", "# Usage", ""];
	const steps = Object.keys(totals.steps);
	if (!steps.length) lines.push("No usage recorded yet.", "");
	for (const step of steps) {
		lines.push(`## ${step}`, "");
		lines.push("| model | input | output | cache read | cache write | turns |");
		lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
		for (const [model, u] of Object.entries(totals.steps[step])) {
			lines.push(
				`| ${model} | ${u.input || 0} | ${u.output || 0} | ${u.cacheRead || 0} | ${u.cacheWrite || 0} | ${u.turns || 0} |`,
			);
		}
		lines.push("");
	}
	const features = Object.keys(totals.features);
	if (features.length) {
		lines.push("## Per feature", "");
		lines.push(
			"| feature | input | output | cache read | cache write | turns |",
		);
		lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
		for (const [slug, u] of Object.entries(totals.features)) {
			lines.push(
				`| ${slug} | ${u.input || 0} | ${u.output || 0} | ${u.cacheRead || 0} | ${u.cacheWrite || 0} | ${u.turns || 0} |`,
			);
		}
		lines.push("");
	}
	const g = usageGrandTotal(totals);
	lines.push(
		`Total: ${g.input} in / ${g.output} out / ${g.cacheRead} cache-read / ${g.cacheWrite} cache-write over ${g.turns} turns.`,
		"",
	);
	return lines.join("\n");
}

function writeUsage(payload, root) {
	const b = loadBundle(root);
	const rows = listy(payload.rows);
	if (!rows.length) fail("usage op needs a non-empty rows list");
	for (const r of rows) {
		if (!r || typeof r.step !== "string" || !r.step.trim())
			fail(
				"usage rows need { step, model?, provider?, input?, output?, cacheRead?, cacheWrite? }",
			);
		for (const f of USAGE_FIELDS) {
			if (r[f] != null && !(Number.isFinite(Number(r[f])) && Number(r[f]) >= 0))
				fail(`usage row ${r.step}: ${f} must be a non-negative number`);
		}
	}

	const file = join(b.memDir, "usage.md");
	const totals = parseUsageTotals(
		existsSync(file) ? frontmatter(readFileSync(file, "utf8")) : null,
	);
	for (const r of rows) {
		const model = `${r.provider || "unknown"}/${r.model || "unknown"}`;
		const step = r.step.trim();
		const norm = Object.fromEntries(
			USAGE_FIELDS.map((f) => [f, Number(r[f] || 0)]),
		);
		totals.steps[step] = totals.steps[step] || {};
		totals.steps[step][model] = addUsage(totals.steps[step][model] || {}, norm);
		if (r.feature) {
			totals.features[r.feature] = addUsage(
				totals.features[r.feature] || {},
				norm,
			);
		}
	}

	mkdirSync(b.memDir, { recursive: true });
	const fm = [
		"type: Usage",
		"title: Token usage",
		"description: Per-step model/token ledger for the active plan — written only by the usage op.",
		`totals: ${fmScalar(JSON.stringify(totals))}`,
		`timestamp: ${nowIso()}`,
	].join("\n");
	writeFileSync(file, joinDoc(fm, usageBody(totals)));
	return {
		op: "usage",
		written: ["usage.md"],
		rows: rows.length,
		grand: usageGrandTotal(totals),
		memoryDir: b.memDir,
	};
}

// ---------------------------------------------------------------------------
// op: update-feature

function updateFeature(payload, root, { regen = true } = {}) {
	const b = loadBundle(root);
	const c =
		b.features.find((x) => x.slug === payload.feature) ||
		fail(`no feature '${payload.feature || ""}'`);
	let { fm, body: bodyText } = splitDoc(c.raw);
	if (fm === null) fail(`feature '${c.slug}' has no frontmatter`);

	const allowed = [
		"status",
		"done",
		"reviewed",
		"tests",
		"tests_status",
		"size",
		"description",
		"title",
	];
	const set = payload.set || {};
	const bad = Object.keys(set).filter((k) => !allowed.includes(k));
	if (bad.length)
		fail(
			`update-feature cannot set: ${bad.join(", ")} (allowed: ${allowed.join(", ")})`,
		);
	if (set.status && !FEATURE_STATUSES.includes(set.status))
		fail(`invalid status '${set.status}'`);
	// The transition table (status.mjs) is the single rule: `implemented`
	// marks code-complete-awaiting-review and is only reachable from pending
	// (or as an idempotent re-flip during rework); done never reopens, and a
	// draft can never jump straight to done — accept-commit owns done.
	if (set.status && !canTransition(c.fm.status || "pending", set.status)) {
		if (set.status === "implemented")
			fail(
				`feature '${c.slug}' is ${c.fm.status} — implemented is only reachable from pending`,
			);
		fail(
			`feature '${c.slug}' cannot move ${c.fm.status || "pending"} → ${set.status}`,
		);
	}
	if (set.status === "done" && !set.done) set.done = today();

	fm = setFmKeys(fm, { ...set, timestamp: nowIso() });
	if (payload.appendCommit) fm = appendCommitFm(fm, payload.appendCommit);
	if (payload.appendReview) {
		bodyText = appendReviewBody(
			bodyText,
			payload.appendReview,
			payload.reviewDate,
		);
		if (!set.reviewed)
			fm = setFmKeys(fm, { reviewed: payload.reviewDate || today() });
	}

	writeFileSync(
		join(b.memDir, "features", `${c.slug}.md`),
		joinDoc(fm, bodyText),
	);
	// acceptCommit batches many updates and regenerates once at the end —
	// regenerate() reloads every feature and rewrites three files per call.
	if (regen) regenerate(root);
	if (payload.log) prependLog(b.memDir, payload.log);
	return { op: "update-feature", feature: c.slug, memoryDir: b.memDir };
}

// ---------------------------------------------------------------------------
// op: adjustments (the feature UI's plan-adjustments output, piped verbatim)

function applyAdjustments(payload, root) {
	const b = loadBundle(root);
	const featuresDir = join(b.memDir, "features");
	const applied = [];
	const reload = () => loadBundle(root);

	// Validate the WHOLE batch against a snapshot before the first write —
	// a bad third item must not leave the first two applied with no
	// regenerate/log (writeFeatures has the same all-or-nothing contract).
	{
		const slugs = new Set(b.features.map((c) => c.slug));
		const status = new Map(b.features.map((c) => [c.slug, c.fm.status]));
		for (const mv of listy(payload.moves)) {
			if (!slugs.has(mv.from)) fail(`move: no feature '${mv.from}'`);
			if (!slugs.has(mv.to)) fail(`move: no feature '${mv.to}'`);
		}
		for (const rn of listy(payload.renames)) {
			if (!slugs.has(rn.from)) fail(`rename: no feature '${rn.from}'`);
			if (!/^[a-z0-9][a-z0-9-]*$/.test(rn.to || ""))
				fail(`rename: invalid slug '${rn.to || ""}'`);
			if (slugs.has(rn.to)) fail(`rename: '${rn.to}' already exists`);
			if (status.get(rn.from) === "done")
				fail(`refusing to rename done feature '${rn.from}'`);
			slugs.delete(rn.from);
			slugs.add(rn.to);
		}
		for (const du of listy(payload.descUpdates)) {
			if (!slugs.has(du.feature))
				fail(`descUpdate: no feature '${du.feature}'`);
		}
	}

	for (const mv of listy(payload.moves)) {
		const cur = reload();
		const from =
			cur.features.find((c) => c.slug === mv.from) ||
			fail(`move: no feature '${mv.from}'`);
		const to =
			cur.features.find((c) => c.slug === mv.to) ||
			fail(`move: no feature '${mv.to}'`);
		const fromDoc = splitDoc(from.raw);
		const toDoc = splitDoc(to.raw);
		writeFileSync(
			join(featuresDir, `${from.slug}.md`),
			joinDoc(
				setFmKeys(fromDoc.fm, {
					files: listy(from.fm.files).filter((f) => f !== mv.file),
				}),
				fromDoc.body,
			),
		);
		writeFileSync(
			join(featuresDir, `${to.slug}.md`),
			joinDoc(
				setFmKeys(toDoc.fm, { files: [...listy(to.fm.files), mv.file] }),
				toDoc.body,
			),
		);
		applied.push(`move ${mv.file}: ${mv.from} → ${mv.to}`);
	}

	for (const rn of listy(payload.renames)) {
		const cur = reload();
		const c =
			cur.features.find((x) => x.slug === rn.from) ||
			fail(`rename: no feature '${rn.from}'`);
		if (!/^[a-z0-9][a-z0-9-]*$/.test(rn.to || ""))
			fail(`rename: invalid slug '${rn.to || ""}'`);
		if (cur.features.some((x) => x.slug === rn.to))
			fail(`rename: '${rn.to}' already exists`);
		if (c.fm.status === "done")
			fail(`refusing to rename done feature '${rn.from}'`);
		renameSync(
			join(featuresDir, `${rn.from}.md`),
			join(featuresDir, `${rn.to}.md`),
		);
		// Rewire every reference: depends_on entries and bundle-absolute links.
		for (const other of reload().features) {
			const deps = listy(other.fm.depends_on);
			let raw = other.raw.replaceAll(
				`/features/${rn.from}.md`,
				`/features/${rn.to}.md`,
			);
			if (deps.includes(rn.from)) {
				const doc = splitDoc(raw);
				raw = joinDoc(
					setFmKeys(doc.fm, {
						depends_on: deps.map((d) => (d === rn.from ? rn.to : d)),
					}),
					doc.body,
				);
			}
			if (raw !== other.raw)
				writeFileSync(join(featuresDir, `${other.slug}.md`), raw);
		}
		applied.push(`rename ${rn.from} → ${rn.to}`);
	}

	for (const du of listy(payload.descUpdates)) {
		const cur = reload();
		const c =
			cur.features.find((x) => x.slug === du.feature) ||
			fail(`descUpdate: no feature '${du.feature}'`);
		const doc = splitDoc(c.raw);
		writeFileSync(
			join(featuresDir, `${c.slug}.md`),
			joinDoc(
				setFmKeys(doc.fm, { description: du.description, timestamp: nowIso() }),
				doc.body,
			),
		);
		applied.push(`describe ${du.feature}`);
	}

	// accept: the user approved the feature set — promote every draft to pending
	// (the mechanical half of the feature UI's Accept; comments stay semantic).
	// The feature UI's { type:"plan-approved" } line pipes in verbatim as accept.
	if (payload.accept || payload.type === "plan-approved") {
		for (const c of reload().features) {
			if (c.fm.status !== "draft") continue;
			const doc = splitDoc(c.raw);
			writeFileSync(
				join(featuresDir, `${c.slug}.md`),
				joinDoc(
					setFmKeys(doc.fm, { status: "pending", timestamp: nowIso() }),
					doc.body,
				),
			);
			applied.push(`accept ${c.slug}`);
		}
	}

	if (applied.length) {
		regenerate(root);
		prependLog(
			b.memDir,
			payload.log ||
				`**Update**: Applied ${applied.length} feature adjustment(s).`,
		);
	}
	return { op: "adjustments", applied, memoryDir: b.memDir };
}

// ---------------------------------------------------------------------------
// op: accept-commit / record-review (deterministic result processing — the
// UI's output pipes in and every mechanical consequence happens in code)

/**
 * Dirty (changed or untracked) non-bundle paths. Not parsed from porcelain:
 * the git wrapper trims its output, which eats the first line's leading
 * status column and corrupts column-based parsing.
 */
function dirtyPaths(root, memName) {
	const hasHead = gitSoft(["rev-parse", "--verify", "HEAD"], root) !== "";
	const tracked = hasHead
		? gitW(["diff", "--name-only", "HEAD"], root)
		: gitW(["diff", "--name-only"], root);
	const untracked = gitW(["ls-files", "--others", "--exclude-standard"], root);
	return [...new Set([...tracked.split("\n"), ...untracked.split("\n")])]
		.filter(Boolean)
		.filter((p) => !p.startsWith(`${memName}/`));
}

/**
 * Process the review UI's `accept-commit` result end to end. Features whose
 * work is already committed (implement commits with the `Feature:` trailer —
 * the commit-feature flow) take the slim path: `status: done` flip and
 * verdict log only, no staging and no new commit. Features without commits
 * keep the interactive accept-and-commit path: branch safety, per-feature
 * staging (the same diff→feature mapping the review showed), one
 * `feature(<slug>)` commit per feature with a `Feature:` trailer, `status: done`
 * flips, commit-sha recording, okf-memory verdict application, and an
 * optional `last_memorized_commit` advance — then one bookkeeping commit.
 * Resumable: features already done are skipped, so a rerun after a mid-way
 * failure completes the remainder.
 */
function acceptCommit(payload, root) {
	const b = loadBundle(root);
	const entries = listy(payload.features || payload.feature).map((c) =>
		typeof c === "string" ? { slug: c } : c,
	);
	if (!entries.length) fail("accept-commit needs a non-empty features list");

	const bySlug = new Map(b.features.map((c) => [c.slug, c]));
	const satisfied = satisfiedSet(b.features, b.settings);
	for (const e of entries) {
		const c = bySlug.get(e.slug) || fail(`no feature '${e.slug || ""}'`);
		if (c.fm.status === "done") continue; // already landed — resumable rerun
		if (!canTransition(c.fm.status || "pending", "done"))
			fail(`feature '${e.slug}' is ${c.fm.status}, not pending/implemented`);
		const waiting = listy(c.fm.depends_on).filter((d) => !satisfied.has(d));
		if (waiting.length)
			fail(`feature '${e.slug}' is waiting on: ${waiting.join(", ")}`);
	}

	// Features that already committed their work take the slim path — no
	// staging, no new commit; anything else still needs the full
	// accept-and-commit machinery below.
	const commitsOf = new Map(
		entries.map((e) => [
			e.slug,
			resolveFeatureCommits(b.root, bySlug.get(e.slug)),
		]),
	);
	const needsStaging = entries.some(
		(e) =>
			bySlug.get(e.slug).fm.status !== "done" && !commitsOf.get(e.slug).length,
	);

	// Dispositions: changed files outside the accepted features' surface carry
	// a default from gather (the accepted feature for incidental changes, a
	// bootstrap commit for pre-staged baseline content); the reviewer can
	// re-dispose any of them explicitly (`payload.uncategorized: [{path,
	// feature|'skip'|'bootstrap'}]`). Nothing can dead-end the commit.
	const review = needsStaging
		? gatherReview(root, { defaultOwner: entries[0].slug })
		: { features: [], uncategorized: [] };
	const assignedTo = new Map(); // slug -> [paths staged with that feature]
	const skips = [];
	const bootstrapPaths = [];
	for (const d of listy(payload.uncategorized)) {
		if (!d || !d.path)
			fail("uncategorized entries need { path, feature|'skip'|'bootstrap' }");
		if (d.feature === "skip") skips.push(d.path);
		else if (d.feature === "bootstrap") bootstrapPaths.push(d.path);
		else if (bySlug.has(d.feature)) {
			assignedTo.set(d.feature, [...(assignedTo.get(d.feature) || []), d.path]);
		} else
			fail(
				`uncategorized '${d.path}': unknown feature '${d.feature || ""}' (use a slug, 'skip' or 'bootstrap')`,
			);
	}
	const explicitFeatureOf = new Map(
		[...assignedTo.entries()].flatMap(([slug, paths]) =>
			paths.map((p) => [p, slug]),
		),
	);
	const disposed = new Set([
		...skips,
		...bootstrapPaths,
		...explicitFeatureOf.keys(),
	]);
	// Apply gather's defaults to everything the reviewer left alone. With
	// block_commit_on_leftovers on, incidental files are absorbed into the
	// accepted feature's commit; off leaves them uncommitted.
	const absorb = b.settings.block_commit_on_leftovers === "on";
	const defaulted = [];
	const applyDefault = (path, disposition) => {
		if (disposed.has(path)) return;
		disposed.add(path);
		if (disposition === "bootstrap") bootstrapPaths.push(path);
		else if (absorb) {
			assignedTo.set(entries[0].slug, [
				...(assignedTo.get(entries[0].slug) || []),
				path,
			]);
			defaulted.push(path);
		} else skips.push(path);
	};
	for (const rc of review.features) {
		for (const f of rc.files) {
			if (f.defaulted) applyDefault(f.path, f.disposition);
		}
	}
	for (const f of review.uncategorized || []) {
		applyDefault(f.path, f.group === "bootstrap" ? "bootstrap" : null);
	}
	const skipSet = new Set(skips);
	const bootstrapSet = new Set(bootstrapPaths);
	// A path is excluded from a feature's staging when it was skipped, routed
	// to the bootstrap commit, or explicitly assigned to a different feature.
	const excluded = (slug, p) =>
		skipSet.has(p) ||
		bootstrapSet.has(p) ||
		(explicitFeatureOf.has(p) && explicitFeatureOf.get(p) !== slug);

	// Branch safety: never commit to the default branch.
	let branch = gitW(["rev-parse", "--abbrev-ref", "HEAD"], b.root);
	if (branch === "main" || branch === "master") {
		branch = `iterator/${entries[0].slug}`;
		gitW(["checkout", "-b", branch], b.root);
	}

	// git commit commits the WHOLE index, so anything pre-staged (another
	// feature's files, unrelated work) would silently ride into the first feature
	// commit. Unstage everything first: each feature commit then contains
	// exactly its own staged paths. The working tree is untouched. Slim-only
	// accepts commit nothing here, so the index is left alone.
	if (
		needsStaging &&
		gitSoft(["rev-parse", "--verify", "HEAD"], b.root) !== ""
	) {
		gitSoft(["reset", "-q"], b.root);
	}

	// Pre-existing baseline content (staged before this round, owned by no
	// feature) lands as its own chore commit FIRST — it can never ride into,
	// or dead-end, a feature commit.
	let bootstrapCommit = null;
	if (bootstrapPaths.length) {
		gitW(["add", "-A", "--", ...new Set(bootstrapPaths)], b.root);
		if (hasStaged(b.root)) {
			gitW(
				["commit", "-m", "chore(bootstrap): pre-existing staged baseline"],
				b.root,
			);
			bootstrapCommit = gitW(["rev-parse", "HEAD"], b.root);
		}
	}

	// Stage what the review showed (the diff mapped feature-by-feature — gather
	// intent-to-adds untracked files, so new files are included), unioned with
	// any changed/untracked file matching the feature's `files:` globs — the
	// feature's declared surface wins over diff-mapping gaps.
	const filesFor = new Map(
		review.features.map((rc) => [rc.name, rc.files.map((f) => f.path)]),
	);
	const changed = dirtyPaths(b.root, b.memName);
	const globsFor = (slug) => listy(bySlug.get(slug).fm.files).map(globToRegExp);
	const memStageable = !isAbsolute(b.memName);

	const committed = [];
	const accepted = [];
	const skipped = [];
	for (const e of entries) {
		if (bySlug.get(e.slug).fm.status === "done") {
			skipped.push(e.slug);
			continue;
		}
		const priorShas = commitsOf.get(e.slug);
		if (priorShas.length) {
			// Slim accept: the work already landed as feature(<slug>) commits
			// (commit-feature), the review read those commits — flipping to done
			// and recording the verdict is all that is left.
			const c = bySlug.get(e.slug);
			const set = { status: "done" };
			if (e.testsStatus && e.testsStatus !== "none")
				set.tests_status = e.testsStatus;
			updateFeature(
				{
					feature: e.slug,
					set,
					log: `**Review**: Accepted [${c.fm.title || e.slug}](/features/${e.slug}.md) (committed as feature(${e.slug})).`,
				},
				root,
				{ regen: false },
			);
			accepted.push({
				feature: e.slug,
				sha: priorShas[priorShas.length - 1],
			});
			continue;
		}
		const set = { status: "done" };
		if (e.testsStatus && e.testsStatus !== "none")
			set.tests_status = e.testsStatus;
		updateFeature(
			{
				feature: e.slug,
				set,
				log: `**Implementation**: Committed feature(${e.slug}) on branch ${branch}.`,
			},
			root,
			{ regen: false },
		);
		const globs = globsFor(e.slug);
		const paths = [
			...new Set([
				...(filesFor.get(e.slug) || []),
				...changed.filter((p) => globs.some((re) => re.test(p))),
				// Incidental files defaulted or explicitly assigned here.
				...(assignedTo.get(e.slug) || []),
			]),
		].filter((p) => !excluded(e.slug, p));
		// NEVER run `git add -A --` with an empty pathspec: git reads that as
		// "stage everything" and unrelated work would land in this commit.
		const pathspecs = [...paths, ...(memStageable ? [b.memName] : [])];
		if (pathspecs.length) gitW(["add", "-A", "--", ...pathspecs], b.root);
		if (!hasStaged(b.root)) {
			fail(
				`feature '${e.slug}': nothing to stage (no changed files matched its diff or globs)`,
			);
		}
		const c = bySlug.get(e.slug);
		const summary = e.summary || c.fm.title || c.fm.description || e.slug;
		gitW(
			["commit", "-m", `feature(${e.slug}): ${summary}\n\nFeature: ${e.slug}`],
			b.root,
		);
		committed.push({
			feature: e.slug,
			sha: gitW(["rev-parse", "HEAD"], b.root),
		});
	}

	// A commit cannot contain its own sha — record them all afterwards.
	for (const { feature, sha } of committed) {
		updateFeature({ feature, appendCommit: { sha, kind: "implement" } }, root, {
			regen: false,
		});
	}
	if (entries.length) regenerate(root);

	// okf-memory: apply the user's card decisions and advance the pointer to
	// the last feature commit (`advance: true` — the skill asserts the pointer
	// rules). The writes land in the bookkeeping commit, which touches only
	// the bundle and is therefore excluded from the memorize pending range.
	let memorize = null;
	const lastSha = committed.length
		? committed[committed.length - 1].sha
		: accepted.length
			? accepted[accepted.length - 1].sha
			: null;
	const mem = payload.memory || {};
	const acceptedIds = mem.accepted ? new Set(listy(mem.accepted)) : null;
	const memories = listy(mem.proposals).filter(
		(p) => !acceptedIds || acceptedIds.has(`${p.area}/${p.slug}`),
	);
	const advanceTo = payload.advance && lastSha ? lastSha : undefined;
	if (memories.length || advanceTo) {
		memorize = writeMemorize({ memories, advanceTo }, root);
	}

	if ((committed.length || accepted.length) && memStageable) {
		gitW(["add", "-A", "--", b.memName], b.root);
		if (hasStaged(b.root)) {
			gitW(
				[
					"commit",
					"-m",
					"chore(iterator): record feature commits and memory updates",
				],
				b.root,
			);
		}
	}

	// Post-condition: what ACTUALLY remains dirty after all commits — the
	// truthful leftovers list (explicit skips end up here too).
	const leftovers = dirtyPaths(b.root, b.memName);

	return {
		op: "accept-commit",
		branch,
		committed,
		// Features flipped to done whose work was already committed (slim path).
		accepted,
		skipped,
		// Incidental files absorbed into the accepted feature's commit by default.
		defaulted,
		bootstrapCommit,
		uncommitted: [...new Set(skips)],
		leftovers,
		memorize,
	};
}

/**
 * Commit a feature's implementation end to end — the implement step's twin of
 * commit-tests: dependency gate, branch safety, staging (the implementer's
 * explicit files ∪ changed files matching the feature's `files:` globs and
 * exact `tests` entries + bundle), one `feature(<slug>)` commit with the
 * `Feature:` trailer, the `implemented` status flip, sha recording, and the
 * bookkeeping commit. Review reads the diff from these commits, so unrelated
 * working-tree churn stays out of both the commit and the review; rework
 * rounds simply commit again under the same trailer. `done` remains owned by
 * accept-commit.
 */
function commitFeature(payload, root) {
	const b = loadBundle(root);
	const c =
		b.features.find((x) => x.slug === payload.feature) ||
		fail(`no feature '${payload.feature || ""}'`);
	const status = c.fm.status || "pending";
	if (!["pending", "implemented"].includes(status))
		fail(`feature '${c.slug}' is ${status}, not pending/implemented`);
	const satisfied = satisfiedSet(b.features, b.settings);
	const waiting = listy(c.fm.depends_on).filter((d) => !satisfied.has(d));
	if (waiting.length)
		fail(`feature '${c.slug}' is waiting on: ${waiting.join(", ")}`);
	if (payload.testsStatus && !["red", "green"].includes(payload.testsStatus))
		fail(`invalid testsStatus '${payload.testsStatus}' (red|green)`);

	// The staged set: the implementer's explicit files are primary, the
	// feature's declared surface (files: globs, exact tests entries) is the
	// safety net. Everything else in the tree stays uncommitted — unrelated
	// churn must never ride into a feature commit.
	const changed = dirtyPaths(b.root, b.memName);
	const changedSet = new Set(changed);
	const globs = listy(c.fm.files).map(globToRegExp);
	const tests = new Set(listy(c.fm.tests).map(String));
	const paths = [
		...new Set([
			...listy(payload.files)
				.map(String)
				.filter((p) => changedSet.has(p)),
			...changed.filter((p) => tests.has(p) || globs.some((re) => re.test(p))),
		]),
	];
	if (!paths.length)
		fail(
			`commit-feature: nothing to stage for '${c.slug}' (no changed files in payload.files or matching its files:/tests: entries)`,
		);

	// Branch safety: never commit to the default branch.
	let branch = gitW(["rev-parse", "--abbrev-ref", "HEAD"], b.root);
	if (branch === "main" || branch === "master") {
		branch = `iterator/${c.slug}`;
		gitW(["checkout", "-b", branch], b.root);
	}

	// git commit commits the WHOLE index — unstage everything first so the
	// feature commit contains exactly its own paths. Working tree untouched.
	if (gitSoft(["rev-parse", "--verify", "HEAD"], b.root) !== "") {
		gitSoft(["reset", "-q"], b.root);
	}

	// Record the status flip first so the bundle update rides the commit.
	const set = { status: "implemented" };
	if (payload.testsStatus) set.tests_status = payload.testsStatus;
	updateFeature(
		{
			feature: c.slug,
			set,
			log: `**Implementation**: Committed feature(${c.slug}) on branch ${branch}; awaiting review.`,
		},
		root,
	);

	const memStageable = !isAbsolute(b.memName);
	const pathspecs = [...paths, ...(memStageable ? [b.memName] : [])];
	gitW(["add", "-A", "--", ...pathspecs], b.root);
	if (!hasStaged(b.root))
		fail(`commit-feature: nothing to stage for feature '${c.slug}'`);
	const summary = payload.summary || c.fm.title || c.fm.description || c.slug;
	gitW(
		["commit", "-m", `feature(${c.slug}): ${summary}\n\nFeature: ${c.slug}`],
		b.root,
	);
	const sha = gitW(["rev-parse", "HEAD"], b.root);

	// A commit cannot contain its own sha — record it and bookkeeping-commit.
	updateFeature(
		{ feature: c.slug, appendCommit: { sha, kind: "implement" } },
		root,
	);
	if (memStageable) {
		gitW(["add", "-A", "--", b.memName], b.root);
		if (hasStaged(b.root)) {
			gitW(["commit", "-m", "chore(iterator): record feature commit"], b.root);
		}
	}
	return {
		op: "commit-feature",
		feature: c.slug,
		branch,
		sha,
		staged: paths,
		// Still-dirty non-bundle paths — churn the commit deliberately left out.
		leftovers: dirtyPaths(b.root, b.memName),
	};
}

/**
 * Commit a feature's test files end to end — the deterministic twin of
 * accept-commit for /iterator-test: branch safety, staging (test files +
 * bundle), one `test(<slug>)` commit with the `Feature:` trailer, tests/
 * tests_status recording, and the sha bookkeeping commit. Replaces the
 * two-phase choreography the skill used to drive by prose.
 */
function commitTests(payload, root) {
	const b = loadBundle(root);
	const c =
		b.features.find((x) => x.slug === payload.feature) ||
		fail(`no feature '${payload.feature || ""}'`);
	const files = listy(payload.files).map(String);
	if (!files.length) fail("commit-tests needs files (the test files written)");
	const status =
		payload.testsStatus ||
		(["done", "implemented"].includes(c.fm.status) ? "green" : "red");
	if (!["red", "green"].includes(status))
		fail(`invalid testsStatus '${status}' (red|green)`);

	// Branch safety: never commit to the default branch.
	let branch = gitW(["rev-parse", "--abbrev-ref", "HEAD"], b.root);
	if (branch === "main" || branch === "master") {
		branch = `iterator/${c.slug}`;
		gitW(["checkout", "-b", branch], b.root);
	}

	// Record tests/tests_status first so the bundle update rides the commit.
	updateFeature(
		{
			feature: c.slug,
			set: { tests: files, tests_status: status },
			log: `**Tests**: ${status} tests committed for [${c.fm.title || c.slug}](/features/${c.slug}.md).`,
		},
		root,
	);

	const memStageable = !isAbsolute(b.memName);
	const pathspecs = [...files, ...(memStageable ? [b.memName] : [])];
	gitW(["add", "-A", "--", ...pathspecs], b.root);
	if (!hasStaged(b.root))
		fail(`commit-tests: nothing to stage for feature '${c.slug}'`);
	const summary = payload.summary || `${status} tests for ${c.slug}`;
	gitW(
		["commit", "-m", `test(${c.slug}): ${summary}\n\nFeature: ${c.slug}`],
		b.root,
	);
	const sha = gitW(["rev-parse", "HEAD"], b.root);

	// A commit cannot contain its own sha — record it and bookkeeping-commit.
	updateFeature({ feature: c.slug, appendCommit: { sha, kind: "test" } }, root);
	if (memStageable) {
		gitW(["add", "-A", "--", b.memName], b.root);
		if (hasStaged(b.root)) {
			gitW(["commit", "-m", "chore(iterator): record test commit"], b.root);
		}
	}
	return {
		op: "commit-tests",
		feature: c.slug,
		branch,
		sha,
		testsStatus: status,
	};
}

/**
 * Record a standalone review's outcome — accepts the review UI's
 * `review-feedback` payload verbatim. Line comments stay with the model
 * (they are semantic); everything recordable is written here.
 */
function recordReview(payload, root) {
	const b = loadBundle(root);
	const feats = listy(payload.features).filter(
		(f) => f.name && f.name !== "uncategorized",
	);
	if (!feats.length)
		fail("record-review needs features (pipe the review-feedback payload in)");
	const LEAD = {
		approved: "Approved",
		changes: "Needs changes",
		question: "Question",
	};
	// Reviewer attribution: auto-mode agent reviews record who judged them
	// (`by: 'agent'` + the model), so the human can audit them later — the
	// review history rides into the archive on retirement.
	if (payload.by && !["agent", "human"].includes(payload.by))
		fail(`invalid by '${payload.by}' (agent|human)`);
	const byTag =
		payload.by === "agent"
			? ` _(agent review${payload.model ? `: ${payload.model}` : ""})_`
			: "";
	const recorded = [];
	for (const f of feats) {
		const c =
			b.features.find((x) => x.slug === f.name) ||
			fail(`no feature '${f.name}'`);
		const lead = LEAD[f.status] || "Note";
		updateFeature(
			{
				feature: f.name,
				appendReview: `* **${lead}**${byTag} — ${f.note || "no changes requested"}`,
				log: `**Review**: Reviewed [${c.fm.title || f.name}](/features/${f.name}.md); ${f.status || "note"}${payload.by === "agent" ? " (agent)" : ""}.`,
			},
			root,
		);
		recorded.push(f.name);
	}
	return {
		op: "record-review",
		recorded,
		lineComments: listy(payload.lineComments).length,
	};
}

// ---------------------------------------------------------------------------
// op: memorize (okf-memory knowledge areas — shared-bundle integration)

/** Build a fresh OKF memory concept document. */
function memoryDoc(m) {
	const fm = [
		`type: ${fmScalar(m.type)}`,
		`title: ${fmScalar(m.title)}`,
		`description: ${fmScalar(m.description)}`,
	];
	if (m.status) fm.push(`status: ${fmScalar(m.status)}`);
	if (m.date) fm.push(`date: ${fmScalar(m.date)}`);
	if (listy(m.tags).length)
		fm.push(`tags: [${listy(m.tags).map(fmScalar).join(", ")}]`);
	if (listy(m.files).length)
		fm.push(
			`files: [${listy(m.files)
				.map((f) => JSON.stringify(String(f)))
				.join(", ")}]`,
		);
	fm.push(`timestamp: ${nowIso()}`);
	const bodyText = `\n${String(m.body || "").trim()}\n`;
	return joinDoc(fm.join("\n"), bodyText);
}

/**
 * Apply okf-memory concept writes (create/update/delete) and/or advance
 * `last_memorized_commit` in the root index. Never touches features/plan —
 * this op is the shared-bundle bridge to okf-memory's knowledge areas.
 */
function writeMemorize(payload, root) {
	const b = loadBundle(root);
	const mems = listy(payload.memories);
	let advanceTo =
		payload.advanceTo || (payload.advance === true ? "HEAD" : null);
	if (!mems.length && !advanceTo)
		fail("memorize op needs memories and/or advanceTo");
	if (advanceTo) advanceTo = resolveAdvance(advanceTo, b.root);
	if (advanceTo && !/^[0-9a-f]{7,40}$/i.test(String(advanceTo))) {
		fail(`memorize: advanceTo '${advanceTo}' is not a commit sha`);
	}
	const normalized = [];
	for (const m of mems) {
		const norm = normalizeSlug(m.slug);
		if (norm && norm !== m.slug) {
			normalized.push({ from: m.slug, to: norm });
			m.slug = norm;
		}
	}

	// Validate everything before writing anything.
	for (const m of mems) {
		const action = m.action || "create";
		if (!["create", "update", "delete"].includes(action))
			fail(`memorize: invalid action '${m.action}'`);
		if (["features", "plans"].includes(m.area))
			fail(`memorize: area '${m.area}' is owned by the plan/feature ops`);
		if (
			!OKF_AREAS[m.area] &&
			!existsSync(join(b.memDir, String(m.area || ""), "index.md"))
		) {
			fail(
				`memorize: unknown area '${m.area || ""}' (${Object.keys(OKF_AREAS).join("|")})`,
			);
		}
		if (!/^[a-z0-9][a-z0-9-]*$/.test(m.slug || ""))
			fail(`memorize: invalid slug '${m.slug || ""}' (kebab-case required)`);
		const file = join(b.memDir, m.area, `${m.slug}.md`);
		if (action === "create" && existsSync(file))
			fail(`memorize: '${m.area}/${m.slug}' exists — use action update`);
		if (action !== "create" && !existsSync(file))
			fail(`memorize: no concept '${m.area}/${m.slug}' to ${action}`);
		if (
			action === "create" &&
			!(m.type && m.title && m.description && m.body)
		) {
			fail(
				`memorize: create '${m.area}/${m.slug}' needs type, title, description, body`,
			);
		}
	}

	const applied = [];
	const logLines = [];
	const touched = new Set();
	for (const m of mems) {
		const action = m.action || "create";
		const dir = join(b.memDir, m.area);
		const file = join(dir, `${m.slug}.md`);
		const ref = `[${m.title || `${m.area}/${m.slug}`}](/${m.area}/${m.slug}.md)`;
		if (action === "delete") {
			rmSync(file);
			logLines.push(`**Deletion**: Removed memory /${m.area}/${m.slug}.md.`);
		} else if (action === "update") {
			const { fm, body: bodyText } = splitDoc(readFileSync(file, "utf8"));
			if (fm === null)
				fail(`memorize: '${m.area}/${m.slug}' has no frontmatter`);
			const next = setFmKeys(fm, {
				type: m.type,
				title: m.title,
				description: m.description,
				status: m.status,
				date: m.date,
				tags: listy(m.tags).length ? listy(m.tags) : undefined,
				files: listy(m.files).length ? listy(m.files) : undefined,
				timestamp: nowIso(),
			});
			writeFileSync(
				file,
				joinDoc(next, m.body ? `\n${String(m.body).trim()}\n` : bodyText),
			);
			logLines.push(`**Update**: Memorized ${ref}.`);
		} else {
			mkdirSync(dir, { recursive: true });
			writeFileSync(file, memoryDoc(m));
			logLines.push(`**Creation**: Memorized ${ref}.`);
		}
		applied.push(`${action} ${m.area}/${m.slug}`);
		touched.add(m.area);
	}
	for (const area of touched) {
		if (existsSync(join(b.memDir, area))) regenerateAreaIndex(b.memDir, area);
	}

	// Root index: add missing area links (never replace foreign lines) and
	// advance the memorize pointer; everything else in the file is preserved.
	updateRootIndex(b.memDir, [...touched], { advanceTo });

	if (advanceTo)
		logLines.push(
			`**Memorize**: Advanced last_memorized_commit to ${String(advanceTo).slice(0, 7)}.`,
		);
	if (payload.log) prependLog(b.memDir, payload.log);
	else for (const line of logLines.reverse()) prependLog(b.memDir, line);
	return {
		op: "memorize",
		applied,
		advancedTo: advanceTo,
		...(normalized.length ? { normalized } : {}),
		memoryDir: b.memDir,
	};
}

// ---------------------------------------------------------------------------
// op: refresh-format

/**
 * Copy the current templates/format.md over the bundle's format.md. The
 * writer copies the template only on the first plan write, so the bundle's
 * copy drifts as the schema evolves; the knowledge view's `formatStale` flag
 * surfaces that and this op is the fix.
 */
function refreshFormat(payload, root) {
	const b = loadBundle(root);
	if (!existsSync(b.memDir)) fail("no memory/ bundle to refresh");
	const src =
		resolveTemplate("format.md") ||
		fail(
			"cannot find templates/format.md — is the full iterator plugin installed?",
		);
	copyFileSync(src, join(b.memDir, "format.md"));
	prependLog(
		b.memDir,
		payload.log ||
			"**Update**: Refreshed format.md from the current schema template.",
	);
	return {
		op: "refresh-format",
		written: ["format.md", "log.md"],
		memoryDir: b.memDir,
	};
}

// ---------------------------------------------------------------------------
// op: apply-review (the knowledge skills' verdict-based writer — iterator-init,
// iterator-consolidate, and iterator-memorize pipe the review server's output plus the
// original draft cards in verbatim)

function conceptFmValue(key, value) {
	if (Array.isArray(value)) {
		if (!value.length) return null;
		return `${key}:\n${value.map((v) => `  - ${v}`).join("\n")}`;
	}
	const s = String(value).replace(/\s+/g, " ").trim();
	// ISO timestamps/dates stay bare (house style); everything else follows
	// the one shared quoting rule (fmScalar) so concept and feature frontmatter
	// cannot drift apart.
	if (/^[0-9][0-9T:.Z+-]*$/.test(s)) return `${key}: ${s}`;
	return `${key}: ${fmScalar(s)}`;
}

/** Build a concept document from a draft card, carrying over unknown keys. */
function conceptDoc(card, existingRaw) {
	const prev = existingRaw ? frontmatter(existingRaw) : {};
	const ORDER = [
		"type",
		"title",
		"description",
		"status",
		"date",
		"tags",
		"files",
	];
	const merged = { ...prev };
	for (const k of ORDER)
		if (card[k] != null && card[k] !== "") merged[k] = card[k];
	merged.timestamp = nowIso();
	const keys = [
		...ORDER.filter((k) => merged[k] != null && merged[k] !== ""),
		"timestamp",
		...Object.keys(merged).filter(
			(k) => !ORDER.includes(k) && k !== "timestamp" && merged[k] != null,
		),
	];
	const fm = keys
		.map((k) => conceptFmValue(k, merged[k]))
		.filter(Boolean)
		.join("\n");
	const bodyText =
		card.body != null && card.body !== ""
			? String(card.body).trim()
			: existingRaw
				? splitDoc(existingRaw).body.trim()
				: "";
	return `---\n${fm}\n---\n\n${bodyText}\n`;
}

/**
 * Apply a memory review's verdicts: accept → write/delete the concept,
 * keep/reject → leave disk unchanged, delete → remove the existing concept.
 * Afterwards regenerate touched area indexes, update the root index (adding
 * missing area links, advancing `last_memorized_commit` when headCommit is
 * given), log, and validate the bundle.
 */
function applyReview(payload, root) {
	const b = loadBundle(root);
	const mem = payload.bundlePath
		? join(b.root, String(payload.bundlePath).replace(/\/+$/, ""))
		: b.memDir;
	const mode = payload.mode || "memorize";
	let headCommit = payload.headCommit || null;
	if (headCommit && mode !== "consolidate")
		headCommit = resolveAdvance(headCommit, b.root);
	if (!["init", "consolidate", "memorize"].includes(mode)) {
		fail(`apply-review: invalid mode '${mode}' (init|consolidate|memorize)`);
	}
	if (mode === "consolidate" && headCommit) {
		fail(
			"apply-review: consolidate reviews must not include headCommit (the memorize pointer is not advanced by consolidation)",
		);
	}
	if (headCommit && !/^[0-9a-f]{7,40}$/i.test(String(headCommit))) {
		fail(`apply-review: headCommit '${headCommit}' is not a commit sha`);
	}
	const cards = new Map(listy(payload.memories).map((m) => [m.id, m]));
	const decisions = listy(payload.decisions);
	if (!decisions.length)
		fail("apply-review needs decisions (the review-approved output)");

	// Validate before writing anything.
	for (const d of decisions) {
		if (!["accept", "reject", "keep", "delete"].includes(d.verdict)) {
			fail(`invalid verdict '${d.verdict}' for '${d.id}'`);
		}
		if (!/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/i.test(String(d.id || ""))) {
			fail(`invalid concept id '${d.id || ""}' (expected <area>/<slug>)`);
		}
		const area = String(d.id).split("/")[0];
		if (["features", "plans"].includes(area)) {
			fail(`apply-review: area '${area}' is owned by the plan/feature ops`);
		}
		if (!OKF_AREAS[area]) {
			fail(
				`apply-review: unknown area '${area}' (${Object.keys(OKF_AREAS).join("|")})`,
			);
		}
		const card = cards.get(d.id);
		if (card?.area && card.area !== area) {
			fail(
				`card '${d.id}' area '${card.area}' does not match id area '${area}'`,
			);
		}
		if (d.verdict === "accept") {
			if (!card) fail(`decision '${d.id}' has no matching draft card`);
			if (
				card.action !== "delete" &&
				!(card.type && card.title && card.description)
			) {
				fail(`card '${d.id}' needs type, title, description to be written`);
			}
		}
	}

	const written = [];
	const deleted = [];
	let kept = 0;
	let rejected = 0;
	const touched = new Set();
	const log = [];
	for (const d of decisions) {
		const card = cards.get(d.id) || { id: d.id };
		const file = join(mem, `${d.id}.md`);
		const area = d.id.split("/")[0];
		const ref = `[${card.title || d.id}](/${d.id}.md)`;
		if (
			d.verdict === "delete" ||
			(d.verdict === "accept" && card.action === "delete")
		) {
			if (existsSync(file)) {
				rmSync(file);
				deleted.push(d.id);
				touched.add(area);
				log.push(`**Deletion**: Removed memory /${d.id}.md.`);
			}
		} else if (d.verdict === "accept") {
			const existing = existsSync(file) ? readFileSync(file, "utf8") : null;
			mkdirSync(dirname(file), { recursive: true });
			writeFileSync(file, conceptDoc(card, existing));
			written.push(d.id);
			touched.add(area);
			log.push(`**${existing ? "Update" : "Creation"}**: Memorized ${ref}.`);
		} else if (d.verdict === "keep") kept += 1;
		else rejected += 1;
	}

	for (const area of touched) regenerateAreaIndex(mem, area);
	updateRootIndex(mem, [...touched], { advanceTo: headCommit });
	if (headCommit) {
		log.push(
			`**${mode === "init" ? "Initialization" : "Memorize"}**: Set last_memorized_commit to ${String(headCommit).slice(0, 12)}.`,
		);
	}
	prependLogShared(mem, log.reverse());

	return {
		op: "apply-review",
		mode,
		written,
		deleted,
		kept,
		rejected,
		advancedTo: headCommit,
		validation: validateBundle(mem),
	};
}

// ---------------------------------------------------------------------------
// op: extensions

const EXTENSIONS_BODY = `Guidance for agents and extensions reading or updating this bundle.

# Reading

* Start at \`memory/index.md\`, follow the area indexes, then open only the
  relevant concept files (progressive disclosure — never bulk-read the bundle).
* A concept ID is the bundle-relative path without \`.md\`; feature IDs/slugs
  are their filenames without \`.md\` and are the stable identity used by tools.
* Non-reserved concept files require YAML frontmatter with a non-empty
  \`type\`; preserve unknown keys and tolerate unknown concept types.

# Writing

* Safe writes create or update one concept file at a time, keep markdown
  human-readable and diffable, update \`timestamp\`, regenerate affected
  indexes, and append a newest-first \`memory/log.md\` entry for meaningful
  changes.
* Knowledge writes should go through the iterator writer (\`write.mjs\` ops
  \`memorize\` / \`apply-review\`); plan/feature writes through its plan/feature ops.
`;

/**
 * Write memory/EXTENSIONS.md (the extension-facing memory contract) and link
 * it from the root index. The universal rules are boilerplate owned here;
 * the model contributes only the optional project-specific preamble.
 */
function writeExtensions(payload, root) {
	const b = loadBundle(root);
	if (!existsSync(join(b.memDir, "index.md")))
		fail("extensions op needs an initialized bundle (memory/index.md)");
	const preamble = String(payload.preamble || "").trim();
	const fm = [
		"type: Reference",
		"title: memory extension contract",
		`description: ${fmScalar("How agents and extensions should read and safely update this memory bundle.")}`,
		"tags:\n  - extensions\n  - memory-contract",
		`timestamp: ${nowIso()}`,
	].join("\n");
	const bodyText = `\n${preamble ? `${preamble}\n\n` : ""}${EXTENSIONS_BODY}`;
	writeFileSync(join(b.memDir, "EXTENSIONS.md"), joinDoc(fm, bodyText));
	updateRootIndex(b.memDir, []);
	const indexFile = join(b.memDir, "index.md");
	const raw = readFileSync(indexFile, "utf8");
	if (!/\]\(\/?EXTENSIONS\.md\)/.test(raw)) {
		const doc = splitDoc(raw);
		const lines = doc.body.split("\n");
		let last = -1;
		for (let i = lines.length - 1; i >= 0; i--) {
			if (/^\s*[*-]\s+\[/.test(lines[i])) {
				last = i;
				break;
			}
		}
		const link =
			"* [Extension contract](EXTENSIONS.md) - How extensions should read and update this memory bundle.";
		if (last === -1) lines.push("", link);
		else lines.splice(last + 1, 0, link);
		writeFileSync(
			indexFile,
			doc.fm === null
				? lines.join("\n")
				: joinDoc(doc.fm, lines.join("\n").replace(/\s*$/, "\n")),
		);
	}
	prependLog(
		b.memDir,
		payload.log ||
			"**Creation**: Wrote the extension contract (EXTENSIONS.md).",
	);
	return {
		op: "extensions",
		written: ["EXTENSIONS.md", "index.md", "log.md"],
		memoryDir: b.memDir,
	};
}

// ---------------------------------------------------------------------------
// op: retire-plan

// ---------------------------------------------------------------------------
// op: restart-feature

/**
 * Escalation recovery: throw away the feature's working-tree changes and
 * reset it to pending so a fresh implementation round can start. Destructive
 * by design — the dashboard's two-step confirm is the authorization. Clears
 * the feature's strike counter and the escalation state.
 */
function restartFeature(payload, root) {
	const b = loadBundle(root);
	const c =
		b.features.find((x) => x.slug === payload.feature) ||
		fail(`no feature '${payload.feature || ""}'`);
	if (!RESTARTABLE_STATUSES.includes(c.fm.status || "pending"))
		fail(
			`feature '${c.slug}' is ${c.fm.status} — only pending/implemented features can be restarted`,
		);
	// The feature's whole working-tree footprint: every file the review maps
	// to it (declared + tests + defaulted incidentals).
	const review = gatherReview(b.root, { feature: c.slug });
	const mine = review.features.find((rc) => rc.name === c.slug)?.files || [];
	const discarded = [];
	for (const f of mine) {
		gitSoft(["reset", "-q", "--", f.path], b.root);
		// Files HEAD knows are restored; anything newer (untracked or staged-new)
		// is deleted — either way the feature's footprint is gone.
		const inHead = gitSoft(["ls-tree", "HEAD", "--", f.path], b.root) !== "";
		if (inHead) gitSoft(["checkout", "--", f.path], b.root);
		else rmSync(join(b.root, f.path), { force: true });
		discarded.push(f.path);
	}
	// Back to pending; tests stay red when their files still exist on disk
	// (committed earlier by /iterator-test), else none.
	const testsLeft = listy(c.fm.tests).filter((t) =>
		existsSync(join(b.root, String(t))),
	);
	updateFeature(
		{
			feature: c.slug,
			set: {
				status: "pending",
				tests_status: testsLeft.length ? "red" : "none",
			},
			log: `**Restart**: Discarded working-tree changes for [${c.fm.title || c.slug}](/features/${c.slug}.md) and reset it to pending.`,
		},
		root,
	);
	writeState(
		{
			op: "state",
			set: {
				phase: "implementing",
				paused: false,
				escalation: null,
				active_feature: null,
			},
			clearStrike: c.slug,
		},
		root,
	);
	return { op: "restart-feature", feature: c.slug, discarded };
}

// ---------------------------------------------------------------------------
// op: record-plan-review

/**
 * Record the whole-plan review's outcome (/iterator-review-plan): append the
 * report under a `# Plan review` section in plan.md (newest first) and set
 * the `plan_reviewed` frontmatter date — the once-marker the auto driver and
 * the hub's Review-plan button read.
 */
function recordPlanReview(payload, root) {
	const b = loadBundle(root);
	if (!b.plan) fail("record-plan-review: no memory/plan.md");
	const report = String(payload.report || "").trim();
	if (!report)
		fail("record-plan-review needs a report (the review's findings)");
	if (payload.by && !["agent", "human"].includes(payload.by))
		fail(`invalid by '${payload.by}' (agent|human)`);
	const d = payload.date || today();
	const byTag =
		payload.by === "agent"
			? ` _(agent review${payload.model ? `: ${payload.model}` : ""})_`
			: "";
	let { fm, body: bodyText } = splitDoc(b.plan.raw);
	if (fm === null) fail("plan.md has no frontmatter");
	const lines = bodyText.split("\n");
	const h = lines.findIndex((l) => /^# Plan review\s*$/.test(l));
	const entry = `## ${d}${byTag}\n\n${report}`;
	if (h === -1) {
		bodyText = `${bodyText.replace(/\s*$/, "")}\n\n# Plan review\n\n${entry}\n`;
	} else {
		lines.splice(h + 1, 0, "", ...entry.split("\n"));
		bodyText = lines.join("\n");
	}
	fm = setFmKeys(fm, { plan_reviewed: d, timestamp: nowIso() });
	writeFileSync(join(b.memDir, "plan.md"), joinDoc(fm, bodyText));
	prependLog(
		b.memDir,
		payload.log ||
			`**Plan review**: Whole-plan review recorded${payload.by === "agent" ? " (agent)" : ""}.`,
	);
	return {
		op: "record-plan-review",
		planReviewed: d,
		written: ["plan.md", "log.md"],
		memoryDir: b.memDir,
	};
}

/**
 * All plan work happens in the plan's worktree (loadBundle re-roots there),
 * which leaves the MAIN checkout holding the uncommitted plan.md pointer that
 * did the redirecting. After a retire/cancel that pointer would keep
 * resurrecting the finished plan — remove it, but only when it is untracked
 * (a tracked pointer belongs to the merge) and records exactly this worktree.
 */
function scrubMainPlanPointer(b, notes) {
	const wt = b.plan?.fm.worktree ? String(b.plan.fm.worktree) : null;
	if (!wt || resolve(b.root) !== resolve(wt)) return;
	const commonDir = gitSoft(
		["rev-parse", "--path-format=absolute", "--git-common-dir"],
		b.root,
	);
	if (!commonDir) return;
	const mainRoot = dirname(commonDir);
	if (resolve(mainRoot) === resolve(b.root)) return;
	const memName = process.env.ITERATOR_MEMORY_DIR || "memory";
	if (isAbsolute(memName)) return; // shared external bundle — nothing stale
	const pointer = join(mainRoot, memName, "plan.md");
	if (!existsSync(pointer)) return;
	const fm = frontmatter(readFileSync(pointer, "utf8"));
	if (!fm.worktree || resolve(mainRoot, String(fm.worktree)) !== resolve(wt))
		return;
	const tracked =
		gitSoft(
			["ls-files", "--error-unmatch", relative(mainRoot, pointer)],
			mainRoot,
		) !== "";
	if (tracked) {
		notes.push(
			`the main checkout still tracks ${pointer} — merge the plan branch to update it`,
		);
		return;
	}
	rmSync(pointer);
	notes.push(
		`removed the stale plan pointer ${pointer} from the main checkout`,
	);
}

/**
 * A finished plan is knowledge: condense it into a decisions/ concept (the
 * semantic text comes from the model) and archive the plan + feature files to
 * memory/features/archive/<created>-<slug>/ — loadBundle reads features/
 * non-recursively, so archived work is invisible to every gather step while
 * staying browsable in git. The bundle is left plan-less, ready for the next
 * /iterator-plan.
 */
function retirePlan(payload, root) {
	const b = loadBundle(root);
	if (!b.plan) fail("retire-plan: no memory/plan.md to retire");
	const c = payload.concept || {};
	if (!/^[a-z0-9][a-z0-9-]*$/.test(c.slug || "")) {
		fail(
			`retire-plan: invalid concept slug '${c.slug || ""}' (kebab-case required)`,
		);
	}
	if (!(c.title && c.description && c.body)) {
		fail(
			"retire-plan: concept needs title, description, body (what was built, why, key trade-offs)",
		);
	}
	const notDone = unfinished(b.features);
	if (notDone.length && !payload.force) {
		fail(
			`retire-plan: features not done: ${notDone.join(", ")} (pass force:true to retire anyway)`,
		);
	}
	if (b.settings.memorize_on_retire === "on") {
		const range = gatherRange(b.root);
		if (!range.initialized || !range.effectiveBase) {
			fail(
				`retire-plan: memorize_on_retire is on but the memory pointer is not ready — ${range.advice}`,
			);
		}
		if (range.commitCount > 0) {
			fail(
				`retire-plan: memorize_on_retire requires reviewing ${range.commitCount} unmemorized commit(s) through /iterator-memorize before retirement`,
			);
		}
	}

	// 1. The condensed decision concept, through the memorize machinery
	//    (area index + root area link + log all handled there).
	const files = listy(c.files).length
		? listy(c.files)
		: [...new Set(b.features.flatMap((ch) => listy(ch.fm.files)))];
	const archiveName = `${b.plan.fm.created || today()}-${c.slug}`;
	// The plan's token ledger rides into the archive; its totals line survives
	// in the decision concept so retired-plan costs stay visible (issue 12).
	const usageFile = join(b.memDir, "usage.md");
	const usageTotals = existsSync(usageFile)
		? usageGrandTotal(
				parseUsageTotals(frontmatter(readFileSync(usageFile, "utf8"))),
			)
		: null;
	const usageLine = usageTotals
		? `\n\nToken usage: ${usageTotals.input} in / ${usageTotals.output} out / ${usageTotals.cacheRead} cache-read / ${usageTotals.cacheWrite} cache-write over ${usageTotals.turns} turns (per-step breakdown in the archived usage.md).`
		: "";
	writeMemorize(
		{
			memories: [
				{
					action: "create",
					area: "decisions",
					slug: c.slug,
					type: "Decision",
					title: c.title,
					description: c.description,
					status: "accepted",
					date: today(),
					tags: listy(c.tags),
					files,
					body: `${String(c.body).trim()}\n\n# Retired plan\n\nCondensed from plan "${b.plan.fm.title || ""}" (${b.features.length} features, archived under /features/archive/${archiveName}/).${usageLine}`,
				},
			],
			log: `**Retirement**: Plan "${b.plan.fm.title || ""}" condensed into [${c.title}](/decisions/${c.slug}.md).`,
		},
		root,
	);

	// 2. Archive plan.md + features (incl. their index) out of the readers' view.
	const featuresDir = join(b.memDir, "features");
	const archiveDir = join(featuresDir, "archive", archiveName);
	mkdirSync(archiveDir, { recursive: true });
	renameSync(join(b.memDir, "plan.md"), join(archiveDir, "plan.md"));
	const archived = ["plan.md"];
	if (existsSync(usageFile)) {
		// Move the ledger with its plan; the next plan starts a fresh one.
		renameSync(usageFile, join(archiveDir, "usage.md"));
		archived.push("usage.md");
	}
	if (existsSync(featuresDir)) {
		for (const f of readdirSync(featuresDir)) {
			if (!f.endsWith(".md")) continue;
			renameSync(join(featuresDir, f), join(archiveDir, f));
			archived.push(f);
		}
	}

	// 3. Root index: drop the plan/features bullets (regenerate() only merges,
	//    never removes); the knowledge side of the file stays untouched.
	const indexFile = join(b.memDir, "index.md");
	if (existsSync(indexFile)) {
		const doc = splitDoc(readFileSync(indexFile, "utf8"));
		const kept = doc.body
			.split("\n")
			.filter(
				(l) =>
					!(
						/^\s*[*-]\s+\[/.test(l) && /\]\(\/?(plan\.md|features\/)\)/.test(l)
					),
			);
		writeFileSync(
			indexFile,
			doc.fm === null
				? kept.join("\n")
				: joinDoc(
						doc.fm,
						kept
							.join("\n")
							.replace(/\n{3,}/g, "\n\n")
							.replace(/\s*$/, "\n"),
					),
		);
	}

	// 4. Worktree/branch teardown, gently (never --force on retire: finished
	//    work may still hold uncommitted experiments). Failures become notes.
	const notes = [];
	const removed = {};
	const planBranch = b.plan.fm.branch || null;
	const worktreePath = b.plan.fm.worktree || null;
	scrubMainPlanPointer(b, notes);
	if (worktreePath && existsSync(worktreePath)) {
		if (b.root === worktreePath || b.root.startsWith(`${worktreePath}/`)) {
			notes.push(
				`you are inside the plan worktree — remove it from the main checkout when done: git worktree remove ${worktreePath}`,
			);
		} else {
			try {
				gitW(["worktree", "remove", worktreePath], b.root);
				removed.worktree = worktreePath;
			} catch (e) {
				notes.push(
					`worktree ${worktreePath} left in place (dirty?): ${e.message}`,
				);
			}
		}
	}
	if (planBranch && removed.worktree) {
		// Only -d (merged-only): retiring must never destroy unmerged commits.
		const cur = gitSoft(["rev-parse", "--abbrev-ref", "HEAD"], b.root);
		if (cur !== planBranch) {
			if (gitSoft(["branch", "-d", planBranch], b.root) !== "") {
				removed.branch = planBranch;
			} else {
				notes.push(
					`branch ${planBranch} kept (not merged yet) — delete it after merging: git branch -d ${planBranch}`,
				);
			}
		}
	}

	return {
		op: "retire-plan",
		concept: `decisions/${c.slug}`,
		archived: `features/archive/${archiveName}`,
		archivedFiles: archived,
		...(Object.keys(removed).length ? removed : {}),
		...(notes.length ? { notes } : {}),
		validation: validateBundle(b.memDir),
	};
}

// ---------------------------------------------------------------------------
// ops: cancel-feature / cancel-plan — remove work without the retire ceremony.
// Cancelled work is not knowledge: nothing is condensed, files are archived
// under features/archive/cancelled-… so they stay browsable in git while
// invisible to every gather (loadBundle reads features/ non-recursively).

/**
 * Cancel one feature regardless of status (the dashboard confirms first):
 * archive its file and scrub it from the remaining features' depends_on lists.
 */
function cancelFeature(payload, root) {
	const b = loadBundle(root);
	const slug = payload.feature || fail("cancel-feature needs a feature slug");
	const c =
		b.features.find((ch) => ch.slug === slug) ||
		fail(`cancel-feature: no feature '${slug}'`);
	const featuresDir = join(b.memDir, "features");
	const archiveName = `cancelled-${today()}-${slug}`;
	const archiveDir = join(featuresDir, "archive", archiveName);
	mkdirSync(archiveDir, { recursive: true });
	renameSync(join(featuresDir, `${slug}.md`), join(archiveDir, `${slug}.md`));

	const scrubbed = [];
	for (const other of b.features) {
		if (other.slug === slug) continue;
		const deps = listy(other.fm.depends_on);
		if (!deps.includes(slug)) continue;
		const doc = splitDoc(other.raw);
		writeFileSync(
			join(featuresDir, `${other.slug}.md`),
			joinDoc(
				setFmKeys(doc.fm, { depends_on: deps.filter((d) => d !== slug) }),
				doc.body,
			),
		);
		scrubbed.push(other.slug);
	}
	regenerate(root); // rebuilds features/index.md and the plan's Features section
	prependLog(
		b.memDir,
		payload.log ||
			`**Cancellation**: Feature "${c.fm.title || slug}" cancelled and archived under /features/archive/${archiveName}/.`,
	);
	return {
		op: "cancel-feature",
		feature: slug,
		archived: `features/archive/${archiveName}`,
		...(scrubbed.length ? { dependentsScrubbed: scrubbed } : {}),
		memoryDir: b.memDir,
	};
}

/**
 * Cancel the whole plan: archive plan.md + usage.md + every feature file (no
 * all-done gate, no decision condensation), reset state.md to idle, and tear
 * down the plan's recorded branch/worktree. Destructive by design — the
 * dashboard warns about uncommitted/unmerged work before calling; the result
 * reports what was discarded.
 */
function cancelPlan(payload, root) {
	const b = loadBundle(root);
	if (!b.plan) fail("cancel-plan: no memory/plan.md to cancel");
	const slug = normalizeSlug(b.plan.fm.title || "") || "plan";
	const archiveName = `cancelled-${b.plan.fm.created || today()}-${slug}`;
	const planBranch = b.plan.fm.branch || null;
	const worktreePath = b.plan.fm.worktree || null;
	const notes = [];

	// What the teardown will discard — reported so the caller can show it.
	const gitRoot =
		worktreePath && existsSync(worktreePath) ? worktreePath : b.root;
	const uncommittedFiles = gitSoft(["status", "--porcelain"], gitRoot)
		.split("\n")
		.filter(Boolean).length;
	const baseBranch = ["main", "master"].find(
		(x) => gitSoft(["rev-parse", "--verify", x], b.root) !== "",
	);
	const unmergedCommits =
		planBranch && baseBranch
			? gitSoft(["rev-list", "--count", `${baseBranch}..${planBranch}`], b.root)
			: "";

	// All plan work happens in the worktree, so loadBundle re-rooted us there —
	// but the worktree is about to be DELETED. The archive (and the idle state)
	// must survive in the MAIN checkout, and the git teardown must run from it.
	const commonDir = gitSoft(
		["rev-parse", "--path-format=absolute", "--git-common-dir"],
		b.root,
	);
	const mainRoot = commonDir ? dirname(commonDir) : b.root;
	const inWorktree =
		!!worktreePath &&
		resolve(b.root) === resolve(worktreePath) &&
		resolve(mainRoot) !== resolve(b.root);
	const destMemDir =
		inWorktree && !isAbsolute(b.memName) ? join(mainRoot, b.memName) : b.memDir;
	const gitOpRoot = inWorktree ? mainRoot : b.root;

	// 1. Archive plan.md + usage.md + features out of the readers' view (into
	//    the surviving checkout's bundle).
	const archiveDir = join(destMemDir, "features", "archive", archiveName);
	mkdirSync(archiveDir, { recursive: true });
	renameSync(join(b.memDir, "plan.md"), join(archiveDir, "plan.md"));
	const archived = ["plan.md"];
	const usageFile = join(b.memDir, "usage.md");
	if (existsSync(usageFile)) {
		renameSync(usageFile, join(archiveDir, "usage.md"));
		archived.push("usage.md");
	}
	const featuresDir = join(b.memDir, "features");
	if (existsSync(featuresDir)) {
		for (const f of readdirSync(featuresDir)) {
			if (!f.endsWith(".md")) continue;
			renameSync(join(featuresDir, f), join(archiveDir, f));
			archived.push(f);
		}
	}
	// The main checkout's own live plan/feature files are the stale pointer
	// copies that redirected every gather into the worktree — without removing
	// them the cancelled plan would resurrect on the next gather.
	if (inWorktree) {
		const mainPlan = join(destMemDir, "plan.md");
		if (existsSync(mainPlan)) rmSync(mainPlan);
		const mainFeatures = join(destMemDir, "features");
		if (existsSync(mainFeatures)) {
			for (const f of readdirSync(mainFeatures)) {
				if (f.endsWith(".md")) rmSync(join(mainFeatures, f));
			}
		}
	}

	// 2. Root index: drop the plan/features bullets (same scrub as retire-plan).
	const indexFile = join(destMemDir, "index.md");
	if (existsSync(indexFile)) {
		const doc = splitDoc(readFileSync(indexFile, "utf8"));
		const kept = doc.body
			.split("\n")
			.filter(
				(l) =>
					!(
						/^\s*[*-]\s+\[/.test(l) && /\]\(\/?(plan\.md|features\/)\)/.test(l)
					),
			);
		writeFileSync(
			indexFile,
			doc.fm === null
				? kept.join("\n")
				: joinDoc(
						doc.fm,
						kept
							.join("\n")
							.replace(/\n{3,}/g, "\n\n")
							.replace(/\s*$/, "\n"),
					),
		);
	}

	// 3. Reset the runtime flow state — a cancelled plan leaves nothing running.
	//    Written to the SURVIVING checkout (the main plan pointer is gone, so
	//    loadBundle no longer re-roots into the doomed worktree).
	writeState(
		{
			op: "state",
			set: {
				mode: "manual",
				paused: false,
				phase: "idle",
				active_feature: null,
				strikes: {},
				escalation: null,
			},
		},
		inWorktree ? mainRoot : root,
	);

	// 4. Branch/worktree teardown, run from the surviving checkout. Each git
	//    failure degrades to a note — the bundle side of the cancel already
	//    landed.
	const removed = {};
	if (worktreePath && existsSync(worktreePath)) {
		try {
			gitW(["worktree", "remove", "--force", worktreePath], gitOpRoot);
			removed.worktree = worktreePath;
		} catch (e) {
			notes.push(`could not remove worktree ${worktreePath}: ${e.message}`);
		}
	}
	if (planBranch) {
		let cur = gitSoft(["rev-parse", "--abbrev-ref", "HEAD"], gitOpRoot);
		if (cur === planBranch && baseBranch) {
			try {
				gitW(["checkout", baseBranch], gitOpRoot);
				cur = baseBranch;
			} catch (e) {
				notes.push(
					`could not switch to ${baseBranch} (uncommitted changes?): ${e.message}`,
				);
			}
		}
		if (cur !== planBranch) {
			try {
				gitW(["branch", "-D", planBranch], gitOpRoot);
				removed.branch = planBranch;
			} catch (e) {
				notes.push(`could not delete branch ${planBranch}: ${e.message}`);
			}
		}
	}

	prependLog(
		destMemDir,
		payload.log ||
			`**Cancellation**: Plan "${b.plan.fm.title || ""}" cancelled — archived under /features/archive/${archiveName}/${removed.branch ? `, branch ${removed.branch} deleted` : ""}.`,
	);
	return {
		op: "cancel-plan",
		archived: `features/archive/${archiveName}`,
		archivedFiles: archived,
		discarded: {
			uncommittedFiles,
			unmergedCommits: parseInt(unmergedCommits, 10) || 0,
		},
		...(Object.keys(removed).length ? removed : {}),
		...(notes.length ? { notes } : {}),
		validation: validateBundle(destMemDir),
	};
}

// ---------------------------------------------------------------------------
// dispatch + CLI

export function applyOp(payload, root) {
	const op =
		payload.op ||
		(["plan-adjustments", "plan-approved"].includes(payload.type)
			? "adjustments"
			: payload.type === "accept-commit"
				? "accept-commit"
				: payload.type === "review-feedback"
					? "record-review"
					: null);
	const ops = {
		plan: writePlan,
		features: writeFeatures,
		design: writeDesign,
		settings: writeSettings,
		state: writeState,
		usage: writeUsage,
		backlog: writeBacklog,
		"update-feature": updateFeature,
		adjustments: applyAdjustments,
		memorize: writeMemorize,
		"apply-review": applyReview,
		"refresh-format": refreshFormat,
		"retire-plan": retirePlan,
		"cancel-feature": cancelFeature,
		"cancel-plan": cancelPlan,
		"accept-commit": acceptCommit,
		"commit-feature": commitFeature,
		"commit-tests": commitTests,
		"record-review": recordReview,
		"record-plan-review": recordPlanReview,
		"restart-feature": restartFeature,
		extensions: writeExtensions,
	};
	if (!ops[op])
		fail(
			`unknown op '${payload.op || payload.type || ""}' (${Object.keys(ops).join("|")})`,
		);
	const result = ops[op](payload, root);
	// Deterministic post-condition on EVERY op: the bundle must still parse
	// strictly after a write — corruption surfaces here, not three ops later.
	if (result.validation === undefined) {
		const mem = result.memoryDir || loadBundle(root).memDir;
		if (existsSync(mem)) result.validation = validateBundle(mem);
	}
	return result;
}

function readStdin() {
	return new Promise((resolve) => {
		let raw = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (c) => (raw += c));
		process.stdin.on("end", () => resolve(raw));
		if (process.stdin.isTTY) resolve("");
	});
}

/**
 * Compact payload shapes per op, printed by `--schema <op>` — progressive
 * disclosure: the model pays for schema tokens only right before a write.
 * `?` marks optional fields; `a|b` marks enums.
 */
const SCHEMAS = {
	plan: {
		op: "plan",
		title: "string",
		"description?": "string (defaults to first goal line)",
		"status?": "draft|approved (default approved)",
		"branch?": "string",
		sections: {
			goal: "string (required)",
			"architecture?":
				"string (markdown bullet list, built on architecture memories)",
			"keyDecisions?": "string (markdown bullet list, one decision per bullet)",
		},
		"dependencies?": [
			"'name — why' — EXTERNAL packages/libraries/services this plan newly requires (e.g. 'axum 0.7 — HTTP server'); NEVER todos or work items; omit when none",
		],
		"log?": "string",
	},
	features: {
		op: "features",
		features: [
			{
				name: "kebab-slug (auto-normalized, reported in result.normalized)",
				"title?": "string",
				description: "string",
				"status?": "draft|pending (done is owned by accept-commit)",
				"size?": "small|medium|large",
				"dependsOn?": ["slug"],
				files: [
					"path or glob the feature will change (warnings.unmatchedGlobs flags typos; warnings.broadFiles flags >8 entries)",
				],
				"implementationNotes?": "string",
				"snippets?": [{ "lang?": "string", code: "string" }],
				"blastRadius?": "string",
				"conflicts?": [
					"{ decision: '<area>/<slug>', note } — set when this feature contradicts a project decision concept; renders as a red flag",
				],
				"tags?": ["string"],
			},
		],
		"deletes?": ["slug"],
		"log?": "string",
	},
	settings: {
		op: "settings",
		values: Object.fromEntries(
			Object.entries(SETTINGS_DEFS).map(([k, d]) => [
				`${k}?`,
				d.kind === "enum"
					? `${d.values.join("|")} (default ${d.default})`
					: d.kind === "int"
						? `int ${d.min}-${d.max} (default ${d.default})`
						: "'active' | '<provider>/<model-id>' (default active)",
			]),
		),
		"log?": "string",
	},
	backlog: {
		op: "backlog",
		action: "create|edit|select|delete",
		"id?": "kebab-case item id (required except create)",
		"title?": "1-160 characters (required for create/edit)",
		"details?": "up to 4000 characters (required for create/edit)",
		"kind?": "idea|bug (required for create/edit)",
		"selected?": "boolean (required for select)",
	},
	usage: {
		op: "usage",
		rows: [
			{
				step: "plan|feature|test|implement|review|memory|hub|other",
				"feature?": "slug (adds to the per-feature rollup)",
				"provider?": "string",
				"model?": "string",
				"input?": "tokens",
				"output?": "tokens",
				"cacheRead?": "tokens",
				"cacheWrite?": "tokens",
			},
		],
	},
	state: {
		op: "state",
		"set?": {
			"mode?": "manual|auto",
			"paused?": "boolean",
			"phase?": STATE_PHASES.join("|"),
			"active_feature?": "slug | null",
			"strikes?": "{ <slug>: int } (replaces the whole map)",
			"escalation?":
				"{ feature?, reason, at? } | null — why auto mode stopped (dashboard banner)",
		},
		"strike?": "slug (increment that feature's needs-work counter)",
		"clearStrike?": "slug (reset that feature's counter)",
	},
	design: {
		op: "design",
		"title?": "string",
		"register?": "brand|product",
		sections: {
			direction: "string",
			typography: "string",
			color: "string (concrete palette values — hex/oklch/rgb)",
			spacing:
				"string (incl. named small/medium/large margin and padding constants)",
			elements:
				"string (per-component styles: buttons, inputs, cards — concrete CSS values)",
			"responsive?": "string",
			"signature?": "string",
		},
	},
	"update-feature": {
		op: "update-feature",
		feature: "slug",
		"set?": {
			"status?":
				"draft|pending|implemented|done (implemented only from pending — the implement flow's code-complete marker)",
			"tests?": ["path"],
			"tests_status?": "red|green",
			"size?|description?|title?|reviewed?|done?": "string",
		},
		"appendCommit?": { sha: "string", kind: "implement|test" },
		"appendReview?": "markdown bullet line",
		"log?": "string",
	},
	adjustments: {
		op: "adjustments (or pipe the feature UI's plan-adjustments verbatim)",
		"moves?": [{ file: "path", from: "slug", to: "slug" }],
		"renames?": [{ from: "slug", to: "slug" }],
		"descUpdates?": [{ feature: "slug", description: "string" }],
		"accept?": "true → promote drafts to pending",
	},
	memorize: {
		op: "memorize",
		"memories?": [
			{
				"action?": "create|update|delete",
				area: "architecture|decisions|patterns|pitfalls|setup",
				slug: "kebab-slug",
				type: "Architecture|Decision|Pattern|Pitfall|Setup",
				title: "string",
				description: "string",
				"status?|date?": "string (Decision cards)",
				"tags?|files?": ["string"],
				body: "markdown",
			},
		],
		"advanceTo?": "sha or 'HEAD'",
		"advance?": "true (same as advanceTo: 'HEAD')",
	},
	"apply-review": {
		op: "apply-review",
		mode: "init|consolidate|memorize",
		"headCommit?": "sha or 'HEAD' (forbidden in consolidate)",
		memories: ["the draft cards shown in the review, verbatim"],
		decisions: [{ id: "<area>/<slug>", verdict: "accept|reject|keep|delete" }],
	},
	"refresh-format": { op: "refresh-format" },
	"retire-plan": {
		op: "retire-plan",
		concept: {
			slug: "kebab-slug",
			title: "string",
			description: "string",
			body: "what was built, why, key trade-offs",
			"tags?|files?": ["string"],
		},
		"force?": "true → retire with unfinished features",
	},
	"cancel-feature": {
		op: "cancel-feature",
		feature:
			"slug — archived regardless of status; depends_on references are scrubbed",
		"log?": "string",
	},
	"cancel-plan": {
		op: "cancel-plan",
		"log?": "string",
		"//": "archives plan+features+usage, resets state.md to idle, removes the plan worktree (--force) and deletes its branch; result.discarded reports uncommitted/unmerged work",
	},
	"accept-commit": {
		op: "accept-commit (or pipe the review UI's accept-commit result verbatim)",
		features: [
			"slug or { slug, testsStatus?, summary? } — features already committed via commit-feature just flip to done (result.accepted); the rest get staged and committed here (result.committed)",
		],
		"uncategorized?": [
			"{ path, feature: '<slug>'|'skip'|'bootstrap' } — explicit re-dispositions; anything omitted follows its gather default (absorbed into the accepted feature, or a chore(bootstrap) commit for pre-staged baseline content) — the op never fails on undisposed files",
		],
		"memory?": {
			"proposals?": ["memorize cards"],
			"accepted?": ["<area>/<slug>"],
		},
		"advance?":
			"true → advance last_memorized_commit to the last feature commit",
	},
	"commit-feature": {
		op: "commit-feature",
		feature: "slug",
		files: [
			"changed paths the implementer touched for this feature (unioned with its files:/tests: matches; everything else stays uncommitted)",
		],
		"summary?": "string (commit subject; default: the feature title)",
		"testsStatus?": "red|green",
		"//": "commits feature(<slug>) with the Feature: trailer, flips status to implemented, records the sha; review then reads the commit diff. Rework rounds re-run it. done stays owned by accept-commit",
	},
	"commit-tests": {
		op: "commit-tests",
		feature: "slug",
		files: ["test file paths"],
		"testsStatus?": "red|green (default: red for pending, green for done)",
		"summary?": "string",
	},
	"record-review": {
		op: "record-review (or pipe the review UI's review-feedback verbatim)",
		features: [
			{ name: "slug", status: "approved|changes|question", "note?": "string" },
		],
		"lineComments?": ["stay with the model — semantic"],
		"by?":
			"agent|human (default human) — agent reviews are tagged in the history",
		"model?": "string (recorded with agent reviews)",
	},
	"record-plan-review": {
		op: "record-plan-review",
		report:
			"markdown — the whole-plan review's findings (mismatches against the plan's goal/decisions, scope drift, or a clean bill)",
		"by?": "agent|human (default human)",
		"model?": "string (recorded with agent reviews)",
		"log?": "string",
	},
	"restart-feature": {
		op: "restart-feature",
		feature:
			"slug — discards the feature's working-tree changes, resets it to pending, clears its strike counter, and clears the escalation state (dashboard recovery action)",
		"log?": "string",
	},
	extensions: { op: "extensions", "preamble?": "project-specific prose" },
};

// CLI (invoked through the skills/iterator/write.mjs shim)
export async function runCli(args) {
	const si = args.indexOf("--schema");
	if (si !== -1) {
		const op = args[si + 1];
		if (op && SCHEMAS[op]) {
			process.stdout.write(JSON.stringify(SCHEMAS[op], null, 1) + "\n");
		} else {
			process.stdout.write(
				JSON.stringify({ ops: Object.keys(SCHEMAS) }, null, 1) + "\n",
			);
			if (op) process.exit(1);
		}
		return;
	}
	const raw = await readStdin();
	let result;
	try {
		result = { ok: true, ...applyOp(JSON.parse(raw || "{}"), args[0]) };
	} catch (e) {
		process.stdout.write(
			JSON.stringify({
				ok: false,
				error: e.message,
				hint: "nothing was written — fix the payload and re-pipe (write.mjs --schema <op> prints the expected shape); never edit bundle files by hand",
			}) + "\n",
		);
		process.exit(1);
	}
	process.stdout.write(JSON.stringify(result) + "\n");
}
