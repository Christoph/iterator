import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { embed, escHtml, renderPage, BASE_CSS, DIFF_CSS } from "../lib/ui.mjs";

test("dependency graph renders full labels — no ellipsis, auto-width nodes", async () => {
	const { GRAPH_JS } = await import("../lib/views/graph.mjs");
	const ctx = vm.createContext({ esc: (s) => String(s) });
	vm.runInContext(GRAPH_JS, ctx);
	ctx.g = { innerHTML: "" };
	ctx.cw = { innerHTML: "" };
	// The exact truncation case from the bug report: long kebab slugs.
	ctx.features = [
		{ name: "score-breakdown-tooltip-rework", status: "done", dependsOn: [] },
		{
			name: "dependent-risk-signal-badges",
			status: "pending",
			dependsOn: ["score-breakdown-tooltip-rework"],
		},
	];
	vm.runInContext("renderGraphInto(g, cw, features, 'fix depends-on.')", ctx);
	assert.match(ctx.g.innerHTML, /score-breakdown-tooltip-rework/);
	assert.match(ctx.g.innerHTML, /dependent-risk-signal-badges/);
	assert.doesNotMatch(ctx.g.innerHTML, /…/, "labels must never be clipped");
	assert.match(ctx.g.innerHTML, /✓ score-breakdown-tooltip-rework/, "done marker rides the full label");
	// Nodes size to their label — the two different slugs get different widths.
	const widths = [...ctx.g.innerHTML.matchAll(/rect [^>]*width="(\d+)"/g)].map((m) => Number(m[1]));
	assert.equal(widths.length, 2);
	assert.ok(widths[0] > 150 && widths[1] > 150, "long labels outgrow the old fixed 150px node");
	assert.equal(ctx.cw.innerHTML, "", "no cycle warning for an acyclic graph");
	// And a cycle still warns.
	ctx.features = [
		{ name: "a", status: "pending", dependsOn: ["b"] },
		{ name: "b", status: "pending", dependsOn: ["a"] },
	];
	vm.runInContext("renderGraphInto(g, cw, features, 'fix depends-on.')", ctx);
	assert.match(ctx.cw.innerHTML, /Dependency cycle detected/);
});

test("embed escapes </script> so payload data cannot break the page", () => {
	const out = embed({ diff: "x</script><script>alert(1)</script>" });
	assert.ok(!out.includes("</script>"));
	assert.ok(out.includes("\\u003c/script>"));
	assert.deepEqual(JSON.parse(out), {
		diff: "x</script><script>alert(1)</script>",
	});
});

test("embed escapes U+2028/U+2029 and handles null", () => {
	assert.equal(embed("a b c"), '"a\\u2028b\\u2029c"');
	assert.equal(embed(null), "null");
	assert.equal(embed(undefined), "null");
});

test("escHtml escapes markup characters", () => {
	assert.equal(escHtml('<a href="x">&'), "&lt;a href=&quot;x&quot;&gt;&amp;");
	assert.equal(escHtml(null), "");
});

test("renderPage embeds hostile payload data inertly", () => {
	const html = renderPage({
		step: "plan",
		title: "x</script><script>alert(1)</script>",
		data: { evil: "</script><script>alert(2)</script>" },
		body: '<div id="x"></div>',
		clientJs: "",
	});
	assert.ok(!html.includes("<script>alert(1)"));
	assert.ok(!html.includes("<script>alert(2)"));
	assert.ok(html.includes("const D = "));
});

test("renderPage includes header controls and custom labels", () => {
	const html = renderPage({
		step: "t",
		data: {},
		body: "",
		clientJs: "",
		primaryIdle: "Accept and commit",
	});
	assert.ok(html.includes("Accept and commit"));
	assert.ok(html.includes("cancelFlow()"));
	assert.ok(html.includes("toggleTheme()"));
});

test("shared client JS posts to the server endpoints with the run id", () => {
	const html = renderPage({ step: "t", data: {}, body: "", clientJs: "" });
	assert.ok(html.includes("const __RUN = "));
	assert.ok(html.includes("fetch(__q('/submit')"));
	assert.ok(html.includes("sendBeacon(__q('/cancel')"));
	assert.ok(html.includes("fetch(__q('/cancel?now=1')"));
});

test("shared client JS wires read-only mode while the agent works", () => {
	const html = renderPage({ step: "t", data: {}, body: "", clientJs: "" });
	assert.ok(
		html.includes("e.data.iterator !== 'working'"),
		"listens for the shell working message",
	);
	assert.ok(
		html.includes("classList.toggle('iterator-ro'"),
		"toggles the read-only class",
	);
	assert.ok(
		html.includes("classList.contains('iterator-ro')"),
		"post() refuses actions while read-only",
	);
	assert.ok(
		BASE_CSS.includes("body.iterator-ro"),
		"read-only CSS rules present",
	);
});

test("mdToHtml refuses javascript: links", () => {
	const html = renderPage({ step: "t", data: {}, body: "", clientJs: "" });
	// The linkify branch must be guarded by a protocol whitelist.
	assert.ok(html.includes("https?:|mailto:"));
});

test("CSS exports are non-empty and themed", () => {
	assert.ok(BASE_CSS.includes('[data-theme="dark"]'));
	assert.ok(BASE_CSS.includes('[data-theme="light"]'));
	assert.ok(DIFF_CSS.includes("table.dt"));
});

/* ------------------------------------------------------------------ *
 * ink & ember design tokens
 * ------------------------------------------------------------------ */

/** Extract the { --name: value } map of one [data-theme="…"] block. */
function themeTokens(theme) {
	const m = BASE_CSS.match(
		new RegExp(`\\[data-theme="${theme}"\\]\\{([^}]*)\\}`),
	);
	assert.ok(m, `theme block ${theme} present`);
	const tokens = {};
	for (const decl of m[1].split(";")) {
		const kv = decl.match(/(--[a-z-]+)\s*:\s*(.+)/s);
		if (kv) tokens[kv[1]] = kv[2].trim();
	}
	return tokens;
}

/** Parse #rgb/#rrggbb/rgba(r,g,b,a) into { r, g, b, a }. */
function parseColor(s) {
	let m = s.match(/^#([0-9a-f]{3})$/i);
	if (m) {
		return {
			r: parseInt(m[1][0] + m[1][0], 16),
			g: parseInt(m[1][1] + m[1][1], 16),
			b: parseInt(m[1][2] + m[1][2], 16),
			a: 1,
		};
	}
	m = s.match(/^#([0-9a-f]{6})$/i);
	if (m) {
		return {
			r: parseInt(m[1].slice(0, 2), 16),
			g: parseInt(m[1].slice(2, 4), 16),
			b: parseInt(m[1].slice(4, 6), 16),
			a: 1,
		};
	}
	m = s.match(
		/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/,
	);
	if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] };
	throw new Error(`unparseable color: ${s}`);
}

/** Composite a possibly-translucent color over an opaque base. */
const over = (fg, base) => ({
	r: fg.r * fg.a + base.r * (1 - fg.a),
	g: fg.g * fg.a + base.g * (1 - fg.a),
	b: fg.b * fg.a + base.b * (1 - fg.a),
	a: 1,
});

/** WCAG relative luminance + contrast ratio. */
function luminance({ r, g, b }) {
	const lin = (c) => {
		c /= 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a, b) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

test("view files contain no raw hex colors — every color comes from a token", async () => {
	const { readdirSync, readFileSync } = await import("node:fs");
	const { fileURLToPath } = await import("node:url");
	const { dirname, join } = await import("node:path");
	const viewsDir = join(
		dirname(fileURLToPath(import.meta.url)),
		"..",
		"lib",
		"views",
	);
	const offenders = [];
	for (const f of readdirSync(viewsDir)) {
		if (!f.endsWith(".mjs")) continue;
		const text = readFileSync(join(viewsDir, f), "utf8");
		for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g))
			offenders.push(`${f}: ${m[0]}`);
	}
	assert.deepEqual(
		offenders,
		[],
		`raw hex outside lib/ui.mjs:\n${offenders.join("\n")}`,
	);
});

test("both theme blocks define the identical token set", () => {
	const dark = Object.keys(themeTokens("dark")).sort();
	const light = Object.keys(themeTokens("light")).sort();
	assert.deepEqual(dark, light);
	// The pre-redesign contract: every variable name the views rely on exists.
	for (const name of [
		"--bg",
		"--surface",
		"--border",
		"--text",
		"--text-muted",
		"--text-code",
		"--add-bg",
		"--add-fg",
		"--del-bg",
		"--del-fg",
		"--hunk-bg",
		"--hunk-fg",
		"--dot-green",
		"--dot-yellow",
		"--dot-red",
		"--accent",
		"--fb-bg",
		"--green",
		"--green-hover",
		"--code-bg",
		"--bg-green",
		"--bg-yellow",
		"--bg-red",
		"--bar-green",
		"--bar-yellow",
		"--bar-red",
		"--drag-over",
	])
		assert.ok(dark.includes(name), `legacy token ${name} kept`);
});

test("semantic fg/bg pairs meet AA contrast (4.5:1) in both themes", () => {
	for (const theme of ["dark", "light"]) {
		const t = themeTokens(theme);
		const bg = parseColor(t["--bg"]);
		for (const [fgName, bgName] of [
			["--add-fg", "--add-bg"],
			["--del-fg", "--del-bg"],
			["--hunk-fg", "--hunk-bg"],
		]) {
			const composited = over(parseColor(t[bgName]), bg);
			const ratio = contrast(parseColor(t[fgName]), composited);
			assert.ok(
				ratio >= 4.5,
				`${theme} ${fgName} on ${bgName}: ${ratio.toFixed(2)}:1 < 4.5:1`,
			);
		}
		// The ember primary button label must also read.
		const btn = contrast(
			parseColor(t["--accent-fg"]),
			parseColor(t["--accent"]),
		);
		assert.ok(
			btn >= 4.5,
			`${theme} --accent-fg on --accent: ${btn.toFixed(2)}:1`,
		);
	}
});

test("planning backlog submits scoped CRUD actions and hands selected candidates to planning", async () => {
	const { render: planning } = await import("../lib/views/planning.mjs");
	const html = planning({
		step: "planning",
		branch: "main",
		plan: null,
		progress: { done: 0, total: 0 },
		knowledgeInitialized: true,
		dirty: { count: 0, files: [] },
		features: [],
		retired: [],
		backlog: [
			{
				id: "fix-shell",
				title: "Fix shell",
				details: "Session error",
				kind: "bug",
				selected: true,
			},
		],
	});
	assert.match(html, /Idea backlog/);
	assert.match(
		html,
		/type:'backlog'/,
		"backlog requests have their own payload type",
	);
	assert.match(
		html,
		/action:'select'/,
		"selection is persisted through the writer",
	);
	assert.match(html, /Plan selected candidates/);
	assert.match(html, /selectedBacklogGoal/);
});

test("hub gates Implement/Review on status and renders escalation + review-plan controls", async () => {
	const { render: hub } = await import("../lib/views/hub.mjs");
	const html = hub({
		step: "hub",
		branch: "iterator/p",
		plan: { title: "P", status: "approved", planReviewed: null, worktree: null },
		stage: "awaiting-plan-review",
		progress: { done: 0, total: 1 },
		features: [
			{
				name: "a",
				title: "A",
				status: "implemented",
				size: "small",
				testsStatus: "none",
				dependsOn: [],
				ready: true,
				waitingOn: [],
				hasDiff: true,
				hasCommits: false,
				conflicts: 0,
			},
		],
		state: {
			mode: "auto",
			paused: true,
			phase: "escalated",
			strikes: {},
			escalation: { feature: "a", reason: "failed agent review 3 time(s)", at: "2026-07-15" },
		},
		settings: { review_required: "on" },
		dirty: { count: 0, files: [] },
		retired: [],
		backlog: [],
	});
	// Implement disabled once implemented; Review unlocks exactly then.
	assert.match(html, /Implemented — review it/);
	assert.match(html, /review unlocks once the feature is implemented/);
	// Dependency gating renders the server-computed readiness — the client
	// must not re-derive it from statuses/settings.
	assert.match(html, /c\.ready !== false/);
	assert.match(html, /c\.waitingOn/);
	assert.doesNotMatch(html, /review_required==='off'/);
	// Escalation banner with both recovery actions.
	assert.match(html, /Needs your attention/);
	assert.match(html, /escalation-restart/);
	assert.match(html, /escalation-guide/);
	assert.match(html, /Guide the agent/);
	// Plan-lifecycle controls live on the Planning surface, not Work.
	assert.doesNotMatch(html, /action\('review-plan'/);
	assert.doesNotMatch(html, /Retires the plan/);
});

test("planning drives plan-lifecycle controls from the server-derived stage", async () => {
	const { render: planning } = await import("../lib/views/planning.mjs");
	const html = planning({
		step: "planning",
		branch: "iterator/p",
		plan: { title: "P", status: "approved", planReviewed: null, worktree: null },
		stage: "retirable",
		progress: { done: 1, total: 1 },
		features: [
			{
				name: "a", title: "A", status: "done", size: "small",
				testsStatus: "green", dependsOn: [], ready: true, waitingOn: [],
				hasDiff: false, hasCommits: true, conflicts: 0,
			},
		],
		state: { mode: "manual", paused: false, phase: "idle", strikes: {}, escalation: null },
		settings: { review_required: "on" },
		dirty: { count: 0, files: [] },
		retired: [{ name: "2026-01-01-old", title: "Old plan", created: "2026-01-01" }],
		backlog: [],
	});
	// Lifecycle buttons key off the server-derived stage.
	assert.match(html, /D\.stage==='retirable'/);
	assert.match(html, /action\('review-plan'/);
	assert.match(html, /Retires the plan/);
	assert.match(html, /action\('cancel-plan'/);
	assert.match(html, /action\('cancel-feature'/);
	// The execution controls live on Work, not here.
	assert.doesNotMatch(html, /action\('implement'/);
	assert.doesNotMatch(html, /auto-implement/);
	// Dependency graph + retired-plan browser render here.
	assert.match(html, /renderGraphInto/);
	assert.match(html, /view-archive/);
});

test("review view groups files by Declared/Tests/Incidental with pre-seeded dispositions", async () => {
	const { render } = await import("../lib/views/review.mjs");
	const html = render({
		step: "review",
		branch: "b",
		mode: "commit",
		hasFeaturesFile: true,
		hasChanges: true,
		activeFeature: "a",
		defaulted: ["notes.txt"],
		features: [
			{
				name: "a",
				description: "",
				dependsOn: [],
				stats: { added: 1, removed: 0, files: 2, complexity: "green" },
				files: [
					{ path: "src/a.ts", group: "declared", hunks: [] },
					{
						path: "notes.txt",
						group: "incidental",
						defaulted: true,
						disposition: "a",
						hunks: [],
					},
				],
				pitfalls: [],
			},
		],
		uncategorized: [],
	});
	// The three sub-groups exist and incidental/bootstrap carry dispositions.
	assert.match(html, /Declared \\u2014 the feature/);
	assert.match(html, /Incidental \\u2014 changed outside the declared surface/);
	assert.match(html, /chore\(bootstrap\) commit/);
	assert.match(html, /leave uncommitted \(skip\)/);
	// Dispositions are pre-seeded from the gather defaults — never undisposed.
	assert.match(html, /file\.defaulted && file\.disposition/);
});

test("planning hero goal box persists an unsent draft and clears it on plan start", async () => {
	const { render: planning } = await import("../lib/views/planning.mjs");
	const html = planning({
		step: "planning",
		branch: "main",
		plan: null,
		progress: { done: 0, total: 0 },
		knowledgeInitialized: true,
		dirty: { count: 0, files: [] },
		features: [],
		retired: [],
	});
	// Draft restore + save wiring lives in the view (the Work iframe is
	// recreated on every tab switch, so the value must survive in storage).
	assert.match(html, /iterator:plan-goal-draft/);
	assert.match(html, /localStorage\.getItem\(DRAFT_KEY\)/);
	assert.match(html, /goal\.addEventListener\('input', saveDraft\)/);
	// Clearing happens only once the plan/init action was actually accepted.
	assert.match(html, /if\(__submitted\) clearDraft\(\)/);
	// The larger input within the saved design parameters.
	assert.match(html, /textarea\.goal\{[^}]*min-height:132px/);
});

test("idle dashboard tabs omit the header Cancel button; round views keep it with a tooltip", async () => {
	const CANCEL_BTN = 'onclick="cancelFlow()"';
	const { render: hub } = await import("../lib/views/hub.mjs");
	const { render: knowledge } = await import("../lib/views/knowledge.mjs");
	const { render: usage } = await import("../lib/views/usage.mjs");
	const { render: plan } = await import("../lib/views/plan.mjs");
	const hubHtml = hub({
		step: "hub",
		branch: "main",
		plan: { title: "P", status: "approved" },
		progress: { done: 0, total: 0 },
		features: [],
		retired: [],
	});
	// On these tabs no round is pending — /cancel is a no-op, the button lies.
	assert.ok(!hubHtml.includes(CANCEL_BTN), "hub has no header Cancel");
	assert.ok(
		!knowledge({ branch: "main", memory: {}, areas: [], memories: [], design: null }).includes(CANCEL_BTN),
		"knowledge has no header Cancel",
	);
	assert.ok(
		!usage({ branch: "main", plan: "P", usage: { steps: [] } }).includes(CANCEL_BTN),
		"usage has no header Cancel",
	);
	const planHtml = plan({ branch: "main", title: "P", plan: {}, knowledge: {} });
	assert.ok(planHtml.includes(CANCEL_BTN), "round views keep Cancel");
	assert.match(planHtml, /it-btn cancel" onclick="cancelFlow\(\)" title="/, "Cancel explains itself");
});

test("hub flags an implemented feature whose changes are nowhere to be found", async () => {
	const { render: hub } = await import("../lib/views/hub.mjs");
	const html = hub({
		step: "hub",
		branch: "iterator/p",
		plan: { title: "P", status: "approved", planReviewed: null, worktree: null },
		stage: "awaiting-plan-review",
		progress: { done: 0, total: 1 },
		features: [
			{
				name: "a", title: "A", status: "implemented", size: "small",
				testsStatus: "none", dependsOn: [], ready: true, waitingOn: [],
				hasDiff: false, hasCommits: false, conflicts: 0,
			},
		],
		state: { mode: "manual", paused: false, phase: "idle", strikes: {}, escalation: null },
		settings: { review_required: "on" },
		dirty: { count: 0, files: [] },
		retired: [],
		backlog: [],
	});
	assert.match(html, /no recorded changes/);
	assert.match(html, /committed outside the accept flow/);
});
