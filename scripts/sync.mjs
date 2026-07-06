#!/usr/bin/env node
/**
 * Bundle the shared lib/ (and templates/ where needed) into the skill folders
 * that ship them, so those folders are droppable into any Agent-Skills
 * harness (.agents/skills, .opencode/skills, .pi/skills, …) without the rest
 * of the repo.
 *
 * Only the `iterator` hub skill carries the UI now — it is the browser
 * control plane for every step (the step skills are logic-only and call the
 * hub's server.mjs). `iterator-plan` still carries templates/format.md, the
 * self-describing bundle schema it copies into new bundles.
 *
 * The repo-root lib/ and templates/ are the source of truth: edit those, then
 * run `npm run sync`. test/sync.test.mjs fails if the copies drift.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const VIEWS = ['hub', 'plan', 'chunk', 'test', 'review'];

/** [source, destination] pairs, relative to the repo root. */
export const COPIES = [
  ['lib/server.mjs', 'skills/iterator/lib/server.mjs'],
  ['lib/ui.mjs', 'skills/iterator/lib/ui.mjs'],
  ...VIEWS.map((v) => [`lib/views/${v}.mjs`, `skills/iterator/lib/views/${v}.mjs`]),
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
