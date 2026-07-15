import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const files = execFileSync(
  'find',
  ['.', '-type', 'f', '-not', '-path', './.git/*', '-not', '-path', './memory/*', '-not', '-path', './node_modules/*'],
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter(path => path && !path.startsWith('./test/'))
  .map(path => path.slice(2));

const retiredTerms = /\blr[-_]|\bchunks?\b|local-review|CHUNKS\.md|hasChunksFile/i;

test('feature terminology owns the persisted workflow paths', () => {
  assert.ok(existsSync('FEATURES.md'));
  assert.equal(existsSync('CHUNKS.md'), false);
  for (const dir of [
    'skills/iterator-plan-features',
    'skills/iterator-implementer',
    'skills/iterator-review',
    'skills/iterator-test-features',
  ]) assert.ok(existsSync(dir), `${dir} exists`);
});

test('tracked runtime and documentation files contain no retired terminology', () => {
  for (const path of files) {
    const text = readFileSync(path, 'utf8');
    assert.equal(retiredTerms.test(text), false, `${path} contains retired terminology`);
  }
});

test('package smoke commands target the renamed skill folders', () => {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  } catch (error) {
    assert.fail(`package.json must remain valid JSON: ${error.message}`);
  }
  for (const [name, command] of Object.entries(pkg.scripts)) {
    if (name === 'test') continue;
    assert.match(command, /skills\/iterator-/);
  }
});
