import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  frontmatter, listy, sections, snippets, globToRegExp,
  splitDoc, joinDoc, setFmKeys, fmScalar,
  OKF_AREAS, OKF_AREA_NAMES,
  regenerateAreaIndex, updateRootIndex, mergeRootIndex, prependLog,
  validateBundle,
} from '../lib/bundle.mjs';

process.env.ITERATOR_NOW = '2026-07-06T12:00:00Z';

const here = fileURLToPath(new URL('.', import.meta.url));

function makeBundle(files) {
  const root = mkdtempSync(join(tmpdir(), 'iterator-bundle-'));
  const memory = join(root, 'memory');
  mkdirSync(memory, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = join(memory, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return memory;
}

// ---------------------------------------------------------------------------
// frontmatter

test('frontmatter parses scalars, quoted values, and inline lists', () => {
  const fm = frontmatter([
    '---',
    'type: Chunk',
    'title: "Auth: middleware"',
    "size: 'small'",
    'files: ["src/auth.ts", "src/config.ts"]',
    'tags: [auth, jwt]',
    'empty: []',
    '---',
    '# Body',
  ].join('\n'));
  assert.equal(fm.type, 'Chunk');
  assert.equal(fm.title, 'Auth: middleware');
  assert.equal(fm.size, 'small');
  assert.deepEqual(fm.files, ['src/auth.ts', 'src/config.ts']);
  assert.deepEqual(fm.tags, ['auth', 'jwt']);
  assert.deepEqual(fm.empty, []);
});

test('frontmatter parses block lists and folds commits continuations', () => {
  const fm = frontmatter([
    '---',
    'type: Chunk',
    'tags:',
    '  - auth',
    '  - jwt',
    'commits:',
    '  - sha: 7bfc791b2f33c3661ce1e69e02198bd156af1f2d',
    '    kind: implement',
    '    date: 2026-07-06',
    '  - sha: a13c9a9deadbeef',
    '    kind: fix',
    '    date: 2026-07-07',
    '---',
    'body',
  ].join('\n'));
  assert.deepEqual(fm.tags, ['auth', 'jwt']);
  assert.equal(fm.commits.length, 2);
  assert.equal(fm.commits[0],
    'sha: 7bfc791b2f33c3661ce1e69e02198bd156af1f2d, kind: implement, date: 2026-07-06');
  assert.equal(fm.commits[1], 'sha: a13c9a9deadbeef, kind: fix, date: 2026-07-07');
});

test('frontmatter tolerates CRLF line endings', () => {
  const fm = frontmatter('---\r\ntype: Pattern\r\ntitle: Windows\r\n---\r\nbody\r\n');
  assert.equal(fm.type, 'Pattern');
  assert.equal(fm.title, 'Windows');
});

test('frontmatter default mode never throws', () => {
  assert.deepEqual(frontmatter('no frontmatter'), {});
  assert.deepEqual(frontmatter('---\nunclosed: yes\n'), {});
  const fm = frontmatter('---\ntype: X\n???garbage\n---\nbody');
  assert.equal(fm.type, 'X'); // garbage line skipped
});

test('frontmatter strict mode: null when absent, throws when broken', () => {
  assert.equal(frontmatter('# Just a doc\n', { strict: true }), null);
  assert.throws(() => frontmatter('---\nunclosed: yes\n', { strict: true }),
    /not closed/);
  assert.throws(() => frontmatter('---\ntype: X\n???garbage\n---\n', { strict: true }),
    /cannot parse frontmatter line/);
  // blank + comment lines are fine in strict mode
  const fm = frontmatter('---\ntype: X\n\n# a comment\ntitle: T\n---\n', { strict: true });
  assert.equal(fm.title, 'T');
});

test('frontmatter strict mode folds commits continuations too', () => {
  const fm = frontmatter([
    '---', 'type: Chunk', 'commits:',
    '  - sha: abc1234', '    kind: implement', '    date: 2026-07-06',
    '---', '',
  ].join('\n'), { strict: true });
  assert.deepEqual(fm.commits, ['sha: abc1234, kind: implement, date: 2026-07-06']);
});

// ---------------------------------------------------------------------------
// helpers

test('listy, sections, snippets, globToRegExp behave as before', () => {
  assert.deepEqual(listy(undefined), []);
  assert.deepEqual(listy('x'), ['x']);
  const s = sections('---\ntype: X\n---\n# One\n\ntext\n\n```js\n# not a heading\n```\n\n# Two\n\nmore');
  assert.equal(s['One'].includes('# not a heading'), true);
  assert.equal(s['Two'], 'more');
  assert.deepEqual(snippets('```ts\ncode\n```'), [{ lang: 'ts', code: 'code' }]);
  assert.ok(globToRegExp('src/**/*.ts').test('src/a/b.ts'));
  assert.ok(!globToRegExp('src/*.ts').test('src/a/b.ts'));
});

test('splitDoc/joinDoc/setFmKeys round-trip without touching the body', () => {
  const raw = '---\ntype: Chunk\nstatus: pending\n---\n# Notes\n\ntext\n';
  const doc = splitDoc(raw);
  const next = setFmKeys(doc.fm, { status: 'done', done: '2026-07-06' });
  const out = joinDoc(next, doc.body);
  assert.match(out, /status: done/);
  assert.match(out, /done: 2026-07-06/);
  assert.match(out, /# Notes\n\ntext\n/);
});

test('fmScalar quotes only when YAML would misread', () => {
  assert.equal(fmScalar('plain words'), 'plain words');
  assert.equal(fmScalar('with: colon'), '"with: colon"');
});

// ---------------------------------------------------------------------------
// areas + indexes + log

test('OKF_AREA_NAMES matches the areas map', () => {
  assert.deepEqual(OKF_AREA_NAMES,
    ['architecture', 'decisions', 'patterns', 'pitfalls', 'setup']);
  for (const a of OKF_AREA_NAMES) assert.equal(OKF_AREAS[a].length, 2);
});

test('regenerateAreaIndex rebuilds bullets, preserving heading and prose', () => {
  const mem = makeBundle({
    'pitfalls/index.md': '# Pitfalls\n\nCustom prose kept intact.\n\n* [Old](/pitfalls/old.md) - stale\n',
    'pitfalls/grace-timer.md': '---\ntype: Pitfall\ntitle: Grace timer\ndescription: Cancel-now races.\n---\nbody\n',
    'pitfalls/a-first.md': '---\ntype: Pitfall\ntitle: "A: first"\ndescription: Sorts first.\n---\nbody\n',
  });
  regenerateAreaIndex(mem, 'pitfalls');
  const out = readFileSync(join(mem, 'pitfalls', 'index.md'), 'utf8');
  assert.match(out, /Custom prose kept intact\./);
  assert.match(out, /\* \[A: first\]\(\/pitfalls\/a-first\.md\) - Sorts first\./);
  assert.match(out, /\* \[Grace timer\]\(\/pitfalls\/grace-timer\.md\) - Cancel-now races\./);
  assert.doesNotMatch(out, /\[Old\]/);
  assert.ok(out.indexOf('A: first') < out.indexOf('Grace timer'), 'sorted by title');
});

test('regenerateAreaIndex is a no-op for a missing area dir', () => {
  const mem = makeBundle({ 'index.md': '---\nokf_version: "0.1"\n---\n# M\n' });
  regenerateAreaIndex(mem, 'patterns'); // must not throw
});

test('updateRootIndex sets and replaces the pointer, preserves foreign content', () => {
  const mem = makeBundle({
    'index.md': '---\nokf_version: "0.1"\ncustom_key: kept\n---\n# My heading\n\nProse stays.\n\n* [Plan](plan.md) - The plan concept.\n',
    'pitfalls/index.md': '# Pitfalls\n',
  });
  updateRootIndex(mem, ['pitfalls'], { advanceTo: 'abc1234' });
  let out = readFileSync(join(mem, 'index.md'), 'utf8');
  assert.match(out, /custom_key: kept/);
  assert.match(out, /last_memorized_commit: abc1234/);
  assert.match(out, /# My heading/);
  assert.match(out, /Prose stays\./);
  assert.match(out, /\* \[Plan\]\(plan\.md\)/);
  assert.match(out, /\* \[Pitfalls\]\(\/pitfalls\/\) - Known bugs/);

  updateRootIndex(mem, [], { advanceTo: 'def5678' });
  out = readFileSync(join(mem, 'index.md'), 'utf8');
  assert.match(out, /last_memorized_commit: def5678/);
  assert.doesNotMatch(out, /abc1234/);
  // area link not duplicated on a second run
  updateRootIndex(mem, ['pitfalls'], {});
  out = readFileSync(join(mem, 'index.md'), 'utf8');
  assert.equal(out.match(/\]\(\/pitfalls\/\)/g).length, 1);
});

test('updateRootIndex creates a minimal root index when missing', () => {
  const mem = makeBundle({});
  updateRootIndex(mem, [], { advanceTo: 'abc1234' });
  const out = readFileSync(join(mem, 'index.md'), 'utf8');
  assert.match(out, /okf_version: "0\.1"/);
  assert.match(out, /last_memorized_commit: abc1234/);
});

test('mergeRootIndex replaces its own links in place and appends missing ones', () => {
  const existing = [
    '---', 'okf_version: "0.1"', 'last_memorized_commit: abc1234', '---',
    '', '# Project memory', '',
    '* [Plan](plan.md) - old description',
    '* [Pitfalls](/pitfalls/) - Known bugs.',
    '',
  ].join('\n');
  const out = mergeRootIndex(existing, [
    ['plan.md', '* [Plan](plan.md) - new description'],
    ['log.md', '* [Log](log.md) - History.'],
  ]);
  assert.match(out, /last_memorized_commit: abc1234/);
  assert.match(out, /\* \[Plan\]\(plan\.md\) - new description/);
  assert.doesNotMatch(out, /old description/);
  assert.match(out, /\* \[Pitfalls\]\(\/pitfalls\/\)/);
  assert.match(out, /\* \[Log\]\(log\.md\)/);
});

test('prependLog groups by day, accepts arrays, and honors the header option', () => {
  const mem = makeBundle({});
  prependLog(mem, 'first entry', { header: '# iterator update log' });
  prependLog(mem, ['second entry', 'third entry']);
  const out = readFileSync(join(mem, 'log.md'), 'utf8');
  assert.match(out, /^# iterator update log/);
  assert.equal(out.match(/## 2026-07-06/g).length, 1);
  // newest-first within the day
  assert.ok(out.indexOf('second entry') < out.indexOf('first entry'));
  prependLog(mem, []);
  assert.equal(readFileSync(join(mem, 'log.md'), 'utf8'), out, 'empty entries are a no-op');
});

// ---------------------------------------------------------------------------
// validateBundle (ported from okf-memory's validator suite — the contract)

test('validator passes the valid-memory fixture bundle', () => {
  assert.deepEqual(validateBundle(join(here, 'fixtures', 'valid-memory')),
    { ok: true, errors: [] });
});

test('validator passes a conforming OKF memory bundle', () => {
  const bundle = makeBundle({
    'index.md': '---\nokf_version: "0.1"\nlast_memorized_commit: abc123\n---\n# Memory\n',
    'log.md': '# Log\n',
    'patterns/index.md': '# Patterns\n',
    'patterns/error-handling.md':
      '---\ntype: Pattern\ntitle: Error handling\ndescription: One sentence.\ntags:\n  - errors\ntimestamp: 2026-07-02T00:00:00.000Z\nfiles:\n  - src/errors.ts\n---\n# Error handling\n',
  });
  assert.deepEqual(validateBundle(bundle), { ok: true, errors: [] });
});

test('validator accepts an extension contract concept', () => {
  const bundle = makeBundle({
    'index.md': '---\nokf_version: "0.1"\n---\n# Memory\n\n* [Extension contract](EXTENSIONS.md) - How extensions read and update memory.\n',
    'EXTENSIONS.md':
      '---\ntype: Reference\ntitle: extension contract\ndescription: How extensions read and update the bundle.\n---\n# Extension contract\n',
  });
  assert.deepEqual(validateBundle(bundle), { ok: true, errors: [] });
});

test('validator fails missing frontmatter on root index and concepts', () => {
  const noRoot = validateBundle(makeBundle({ 'index.md': '# Memory\n' }));
  assert.equal(noRoot.ok, false);
  assert.match(noRoot.errors.join('\n'), /index\.md: missing frontmatter/);

  const noConcept = validateBundle(makeBundle({
    'index.md': '---\nokf_version: "0.1"\n---\n# Memory\n',
    'patterns/index.md': '# Patterns\n',
    'patterns/no-frontmatter.md': '# Missing\n',
  }));
  assert.equal(noConcept.ok, false);
  assert.match(noConcept.errors.join('\n'), /no-frontmatter\.md: missing frontmatter/);
});

test('validator fails empty type values', () => {
  const result = validateBundle(makeBundle({
    'index.md': '---\nokf_version: "0.1"\n---\n# Memory\n',
    'setup/index.md': '# Setup\n',
    'setup/commands.md': '---\ntype: \ntitle: Commands\n---\n# Commands\n',
  }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /type is required/);
});

test('validator allows log.md files at any bundle level', () => {
  const result = validateBundle(makeBundle({
    'index.md': '---\nokf_version: "0.1"\n---\n# Memory\n',
    'log.md': '# Root log\n',
    'patterns/index.md': '# Patterns\n',
    'patterns/log.md': '# Area log\n',
    'patterns/error-handling.md': '---\ntype: Pattern\n---\n# Good\n',
  }));
  assert.deepEqual(result, { ok: true, errors: [] });
});

test('validator checks nested concept files recursively', () => {
  const result = validateBundle(makeBundle({
    'index.md': '---\nokf_version: "0.1"\n---\n# Memory\n',
    'patterns/index.md': '# Patterns\n',
    'patterns/nested/missing.md': '# Missing\n',
  }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /patterns\/nested\/missing\.md: missing frontmatter/);
});

test('validator tolerates iterator commits block list on chunk files', () => {
  const result = validateBundle(makeBundle({
    'index.md': '---\nokf_version: "0.1"\nlast_memorized_commit: abc123\n---\n# Memory\n',
    'chunks/index.md': '# Chunks\n',
    'chunks/auth-middleware.md':
      '---\ntype: Chunk\ntitle: Auth middleware\ndescription: JWT middleware.\nstatus: done\ndepends_on: []\nfiles: ["src/auth.ts"]\ntimestamp: 2026-07-06T00:00:00.000Z\ndone: 2026-07-06\ncommits:\n  - sha: 7bfc791b2f33c3661ce1e69e02198bd156af1f2d\n    kind: implement\n    date: 2026-07-06\n---\n# Implementation notes\n',
  }));
  assert.deepEqual(result, { ok: true, errors: [] });
});

test('validator reports a missing bundle directory', () => {
  const result = validateBundle(join(tmpdir(), 'iterator-definitely-missing'));
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /does not exist/);
});

// ---------------------------------------------------------------------------
// round-trip: parse(serialize(v)) must be a fixed point for adversarial values

const ADVERSARIAL = [
  'he said: "hello"',
  "it's got 'single' quotes",
  'money $& and $\' and $1 markers',
  'back`ticks` and *stars* and #hash',
  'colons: in: many: places',
  'brackets [a, b] {c: d}',
  'unicode — em dash · middle dot ✓',
  'trailing backslash \\',
];

test('fmScalar → unquote round-trips adversarial scalars (1 and 3 cycles)', () => {
  for (const value of ADVERSARIAL) {
    let fm = `type: Chunk\ntitle: ${fmScalar(value)}`;
    for (let cycle = 1; cycle <= 3; cycle++) {
      const parsed = frontmatter(`---\n${fm}\n---\n`);
      // fmScalar collapses whitespace by contract; adversarial values above
      // are single-spaced, so the parse must return them verbatim.
      assert.equal(parsed.title, value, `cycle ${cycle}: ${value}`);
      fm = setFmKeys(fm, { title: parsed.title });
    }
  }
});

test('setFmKeys is immune to replacement-pattern injection ($&, $`, $1)', () => {
  const fm = 'type: Chunk\ndescription: old text';
  const out = setFmKeys(fm, { description: 'costs $& and $` and $1 dollars' });
  const parsed = frontmatter(`---\n${out}\n---\n`);
  assert.equal(parsed.description, 'costs $& and $` and $1 dollars');
  assert.ok(!out.includes('old text'), 'old line must be fully replaced');
});

test('inline lists keep commas inside quoted entries', () => {
  const files = ['src/{a,b}.ts', 'plain.ts', 'with, comma.md'];
  const fm = setFmKeys('type: Chunk', { files });
  const parsed = frontmatter(`---\n${fm}\n---\n`);
  assert.deepEqual(parsed.files, files);
});

test('continuation keys do not fold into plain string list items', () => {
  const fm = frontmatter([
    '---',
    'type: Chunk',
    'tags:',
    '  - auth',
    '  bogus: nested-mapping',
    '---',
  ].join('\n'));
  assert.deepEqual(fm.tags, ['auth']);
});

test('commits continuation folding still works for mapping items', () => {
  const fm = frontmatter([
    '---',
    'type: Chunk',
    'commits:',
    '  - sha: abc123',
    '    kind: implement',
    '    date: 2026-07-06',
    '---',
  ].join('\n'));
  assert.deepEqual(fm.commits, ['sha: abc123, kind: implement, date: 2026-07-06']);
});
