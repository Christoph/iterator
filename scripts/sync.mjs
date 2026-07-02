#!/usr/bin/env node
/**
 * Bundle the shared lib/ (and templates/ where needed) into each skill folder
 * so every skills/<name>/ directory is standalone — droppable into any
 * Agent-Skills harness (.agents/skills, .opencode/skills, .pi/skills, …)
 * without the rest of the repo.
 *
 * The repo-root lib/ and templates/ are the source of truth: edit those, then
 * run `npm run sync`. test/sync.test.mjs fails if the copies drift.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Skills with a server.mjs; each gets a private copy of the shared shell. */
const SERVER_SKILLS = ['iterator-chunk', 'iterator-plan', 'iterator-review', 'iterator-test'];

/** [source, destination] pairs, relative to the repo root. */
export const COPIES = [
  ...SERVER_SKILLS.flatMap((skill) => [
    ['lib/server.mjs', `skills/${skill}/lib/server.mjs`],
    ['lib/ui.mjs', `skills/${skill}/lib/ui.mjs`],
  ]),
  ['templates/format.md', 'skills/iterator-plan/templates/format.md'],
];

export function sync() {
  for (const [src, dest] of COPIES) {
    mkdirSync(join(root, dirname(dest)), { recursive: true });
    copyFileSync(join(root, src), join(root, dest));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  sync();
  console.log(`synced ${COPIES.length} files into skill folders`);
}
