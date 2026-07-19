import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

// Every view builds its body client-side from one inline <script>; a single
// syntax error (e.g. a real newline leaking into a quoted string because a
// template literal used \n instead of \\n) kills the whole block and leaves
// the tab blank. Parse-check the assembled script of every view.

const MIN_DATA = {
	archive: { branch: "main", title: "Old plan", plan: {}, features: [] },
	feature: { branch: "main", plan: "P", features: [] },
	hub: {
		branch: "main",
		plan: null,
		progress: { done: 0, total: 0 },
		knowledgeInitialized: true,
		dirty: { count: 0, files: [] },
		features: [],
		retired: [],
		backlog: [],
	},
	knowledge: {
		branch: "main",
		memory: {
			initialized: true,
			okfVersion: 1,
			lastMemorizedCommit: null,
			conceptCount: 0,
			staleCount: 0,
			unmemorizedCommitCount: 0,
		},
		areas: [],
		memories: [],
		design: null,
		formatStale: false,
	},
	"memory-review": {
		branch: "main",
		mode: "consolidate",
		memories: [],
		round: 1,
	},
	planning: {
		branch: "main",
		plan: null,
		progress: { done: 0, total: 0 },
		knowledgeInitialized: true,
		dirty: { count: 0, files: [] },
		features: [],
		retired: [
			{ name: "2026-01-01-old", title: "Old plan", created: "2026-01-01" },
		],
		backlog: [
			{
				id: "idea",
				title: "A saved idea",
				details: "Line one\nLine two",
				kind: "idea",
				selected: false,
			},
		],
	},
	plan: { branch: "main", title: "P", plan: {}, knowledge: {} },
	question: { branch: "main", title: "Q", question: { text: "?" } },
	review: {
		branch: "main",
		plan: "P",
		mode: "review",
		features: [
			{
				name: "a-feature-name-that-must-remain-fully-readable-in-the-sidebar",
				description: "Long labels wrap without changing review behavior.",
				dependsOn: [],
				stats: { added: 0, removed: 0, files: 0, complexity: "green" },
				files: [],
			},
		],
	},
	settings: { branch: "main", plan: "P", settings: {}, schema: [] },
	test: { branch: "main", feature: { name: "f" }, tests: [] },
	usage: { branch: "main", plan: "P", usage: { steps: [] } },
};

function inlineScript(html) {
	const m = html.match(/<script>([\s\S]*?)<\/script>/);
	assert.ok(m, "page has one inline <script>");
	return m[1];
}

for (const [name, data] of Object.entries(MIN_DATA)) {
	test(`view ${name}: assembled inline script parses`, async () => {
		const { render } = await import(`../lib/views/${name}.mjs`);
		const src = inlineScript(render(data));
		// vm.Script parses without executing — a stray real newline inside a
		// quoted string (or any other injected token) throws here.
		assert.doesNotThrow(
			() => new vm.Script(src, { filename: `${name}-client.js` }),
			`inline script of ${name} view must parse`,
		);
	});
}

test("plan-less Planning client renders initialization controls without a DOM insertion error", async () => {
	const { render } = await import("../lib/views/planning.mjs");
	class Element {
		constructor(tag = "div") {
			this.tagName = tag.toUpperCase();
			this.children = [];
			this.parentNode = null;
			this.dataset = {};
			this.style = {};
			this.classList = { contains: () => false, toggle: () => {} };
			this.value = "";
			this.textContent = "";
			this.hidden = false;
		}
		set innerHTML(value) {
			this.html = String(value);
			this.children = [];
		}
		get innerHTML() {
			return this.html || "";
		}
		appendChild(child) {
			child.parentNode = this;
			this.children.push(child);
			return child;
		}
		append(...children) {
			for (const child of children) this.appendChild(child);
		}
		insertBefore(child, reference) {
			const index = this.children.indexOf(reference);
			if (index < 0) throw new Error("reference node is not a child");
			child.parentNode = this;
			this.children.splice(index, 0, child);
			return child;
		}
		addEventListener() {}
		querySelectorAll(selector) {
			if (selector === "select,input,textarea")
				return [
					new Element("select"),
					new Element("input"),
					new Element("textarea"),
				];
			if (selector === "button")
				return [new Element("button"), new Element("button")];
			return [];
		}
		querySelector(selector) {
			return this.querySelectorAll(selector)[0] || new Element();
		}
		reset() {}
		focus() {}
		setSelectionRange() {}
	}
	const wrap = new Element("div");
	const branch = new Element("span");
	const body = new Element("body");
	const document = {
		body,
		documentElement: new Element("html"),
		createElement: (tag) => new Element(tag),
		getElementById: (id) => ({ wrap, branch })[id] || null,
	};
	const window = { addEventListener() {}, close() {} };
	window.parent = window;
	const context = vm.createContext({
		document,
		window,
		navigator: { sendBeacon() {} },
		localStorage: { getItem: () => "", setItem() {}, removeItem() {} },
		fetch: async () => ({ status: 200 }),
		alert() {},
		setTimeout,
		clearTimeout,
		console,
	});
	const html = render({
		step: "planning",
		branch: "main",
		plan: null,
		progress: { done: 0, total: 0 },
		knowledgeInitialized: false,
		features: [],
		backlog: [],
		retired: [],
		files: [],
	});
	assert.doesNotThrow(() => vm.runInContext(inlineScript(html), context));
	const hero = wrap.children[0];
	assert.ok(hero, "the plan-less hero rendered");
	assert.ok(
		hero.children.some((child) =>
			child.textContent.includes("not initialized"),
		),
		"the initialization guidance is visible",
	);
	const buttons = hero.children.find(
		(child) => child.className === "btns-center",
	);
	assert.deepEqual(
		buttons.children.map((button) => button.textContent),
		["Initialize memory", "Create plan"],
	);
});

test("knowledge view declares DESIGN_SECS before the render bootstrap runs", async () => {
	const { render } = await import("../lib/views/knowledge.mjs");
	const src = inlineScript(render(MIN_DATA.knowledge));
	const decl = src.indexOf("const DESIGN_SECS");
	const boot = src.indexOf("renderBrowser();");
	assert.ok(decl >= 0 && boot >= 0, "both markers present");
	assert.ok(
		decl < boot,
		"DESIGN_SECS const must precede renderBrowser() or the TDZ kills the tab when a design.md exists",
	);
});
