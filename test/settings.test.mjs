import { test } from "node:test";
import assert from "node:assert/strict";
import {
	effectiveSettings,
	parseState,
	settingsDefaults,
	SETTINGS_KEYS,
	validateSettings,
} from "../lib/settings.mjs";
import { render as settingsView } from "../lib/views/settings.mjs";

test("settingsDefaults covers every defined key", () => {
	const d = settingsDefaults();
	assert.deepEqual(Object.keys(d).sort(), [...SETTINGS_KEYS].sort());
	assert.equal(d.auto_mode, "off");
	assert.equal(d.testing_default, "on");
	assert.equal(d.branch_per_plan, "on");
	assert.equal(d.max_review_iterations, 3);
	assert.equal(d.reviewer_model, "active");
});

test("validateSettings accepts valid entries and rejects unknown/invalid ones", () => {
	const ok = validateSettings({
		auto_mode: "on",
		max_review_iterations: "5",
		reviewer_model: "anthropic/claude-opus-4-8",
	});
	assert.equal(ok.ok, true);
	assert.deepEqual(ok.values, {
		auto_mode: "on",
		max_review_iterations: 5,
		reviewer_model: "anthropic/claude-opus-4-8",
	});

	const bad = validateSettings({
		nonsense_key: "x",
		auto_mode: "maybe",
		max_review_iterations: 99,
		reviewer_model: "two words",
	});
	assert.equal(bad.ok, false);
	assert.equal(bad.errors.length, 4);
	assert.match(bad.errors[0], /unknown setting 'nonsense_key'/);
});

test("effectiveSettings overlays valid stored values and ignores mangled ones", () => {
	const eff = effectiveSettings({
		auto_mode: "on",
		max_review_iterations: "not-a-number",
		type: "Settings", // non-setting frontmatter keys are ignored
	});
	assert.equal(eff.auto_mode, "on");
	assert.equal(eff.max_review_iterations, 3, "mangled int falls back to default");
	assert.equal(eff.testing_default, "on");
});

test("parseState normalizes state.md frontmatter with JSON strikes", () => {
	const s = parseState({
		mode: "auto",
		paused: "true",
		phase: "implementing",
		active_feature: "auth-middleware",
		strikes: '{"auth-middleware":2,"bad":-1}',
	});
	assert.equal(s.mode, "auto");
	assert.equal(s.paused, true);
	assert.equal(s.phase, "implementing");
	assert.equal(s.active_feature, "auth-middleware");
	assert.deepEqual(s.strikes, { "auth-middleware": 2 }, "negative counters dropped");

	const empty = parseState(null);
	assert.deepEqual(empty, {
		mode: "manual",
		paused: false,
		phase: "idle",
		active_feature: null,
		strikes: {},
	});
	assert.deepEqual(parseState({ strikes: "not json" }).strikes, {});
});

test("settings view renders a form over the defs (models free-text without a registry)", () => {
	const html = settingsView({
		step: "settings",
		branch: "main",
		plan: "Add JWT auth",
		settings: settingsDefaults(),
		defined: false,
	});
	assert.ok(html.includes("Project settings"));
	assert.ok(html.includes("auto_mode"), "key names are shown");
	assert.ok(html.includes("Reviewer model"));
	assert.ok(html.includes("type:'settings'"), "submits a settings result");
	assert.ok(html.includes("memory/settings.md"));
});

test("question view renders options + free text and posts an answer", async () => {
	const { render } = await import("../lib/views/question.mjs");
	const html = render({
		step: "question",
		branch: "main",
		title: "Feature",
		question: "Which feature should be reviewed?",
		options: [
			{ label: "auth-middleware", description: "pending" },
			{ label: "All pending" },
		],
		allowFreeText: true,
	});
	assert.ok(html.includes("Which feature should be reviewed?"));
	assert.ok(html.includes("auth-middleware"));
	assert.ok(html.includes("type:'answer'"));
	assert.ok(html.includes("free-text"));
});

test("usage and archive views render their payloads", async () => {
	const { render: usageView } = await import("../lib/views/usage.mjs");
	const { render: archiveView } = await import("../lib/views/archive.mjs");
	const uhtml = usageView({
		step: "usage", branch: "main", plan: "P", exists: true,
		totals: { steps: { implement: { "openai/gpt-5.5": { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, turns: 1 } } }, features: {} },
		grand: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, turns: 1 },
	});
	assert.ok(uhtml.includes("token usage"));
	const ahtml = archiveView({
		step: "archive", branch: "main", name: "2026-07-01-p", title: "P", created: "2026-07-01",
		sections: { Goal: "g" }, features: [{ name: "c", title: "C", description: "d", status: "done", commits: [] }],
		usage: { totals: { steps: {}, features: {} }, grand: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, turns: 0 } },
	});
	assert.ok(ahtml.includes("retired plan"));
	assert.ok(ahtml.includes("view-archive") || ahtml.includes("Back to dashboard"));
});
