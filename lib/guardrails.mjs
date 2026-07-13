/**
 * iterator: guardrail checks for direct edits to the bundle (pi extension).
 *
 * write.mjs enforces the bundle's invariants; these checks protect them
 * against the agent editing chunk files, knowledge concepts, or bundle
 * indexes — or committing — *around* the writer. Pure functions — the
 * extension feeds them the tool-call input plus the current file/bundle
 * state and turns the verdicts into pi block/warn responses. Philosophy:
 * block only what can be judged exactly (whole-file chunk writes where old
 * and new frontmatter diff cleanly, an explicit `status: done`); warn on
 * everything fuzzy, and only ever WARN on the knowledge side (concept
 * frontmatter, area/root indexes). Body text stays untouched —
 * hand-editability is an OKF feature.
 *
 * Verdict shape: null = allow; { warn: true, reason } = notify but run;
 * { block: true, reason } = refuse the tool call.
 */
import { isAbsolute } from 'node:path';
import { frontmatter, listy, OKF_AREA_NAMES } from './bundle.mjs';

/** Frontmatter keys owned by write.mjs — never hand-edited. */
export const OWNED_KEYS = ['status', 'tests_status', 'commits', 'timestamp', 'done', 'reviewed'];

const UPDATE_HINT = 'use the update-chunk op (iterator_write / write.mjs) instead';
const MEMORIZE_HINT = 'use the memorize/apply-review ops (iterator_write / okf_write) or the /okf skills so indexes, timestamps, and the log stay consistent';

/**
 * The path inside the bundle (e.g. 'pitfalls/x.md'), or null when outside.
 * With a resolved project `root` the bundle dir is anchored exactly (`path`
 * must be absolute), so a project's own `src/memory/chunks/x.md` is never
 * misclassified; without a root the substring match remains as a fallback
 * for callers that only have a loose path.
 */
function bundleSubpath(path, env = process.env, root = null) {
  const p = String(path || '').replaceAll('\\', '/');
  const memName = (env.ITERATOR_MEMORY_DIR || 'memory').replace(/\/+$/, '');
  if (isAbsolute(memName)) {
    const dir = `${memName.replaceAll('\\', '/')}/`;
    return p.startsWith(dir) ? p.slice(dir.length) : null;
  }
  if (root) {
    const dir = `${String(root).replaceAll('\\', '/').replace(/\/+$/, '')}/${memName}/`;
    return p.startsWith(dir) ? p.slice(dir.length) : null;
  }
  const esc = memName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = p.match(new RegExp(`(?:^|/)${esc}/(.+)$`));
  return m ? m[1] : null;
}

/** Is this path a chunk document (memory/chunks/*.md, index.md excluded)? */
export function isChunkFile(path, env = process.env, root = null) {
  const sub = bundleSubpath(path, env, root);
  if (!sub || !sub.endsWith('.md') || sub.endsWith('/index.md')) return false;
  const parts = sub.split('/');
  return parts.length === 2 && parts[0] === 'chunks';
}

/** Is this path a knowledge concept (memory/<area>/<slug>.md)? */
export function isConceptFile(path, env = process.env, root = null) {
  const sub = bundleSubpath(path, env, root);
  if (!sub || !sub.endsWith('.md')) return false;
  const parts = sub.split('/');
  return parts.length === 2 && OKF_AREA_NAMES.includes(parts[0])
    && parts[1] !== 'index.md' && parts[1] !== 'log.md';
}

/** Is this the bundle root index or a knowledge-area index? */
export function isBundleIndexFile(path, env = process.env, root = null) {
  const sub = bundleSubpath(path, env, root);
  if (!sub) return false;
  if (sub === 'index.md') return true;
  const parts = sub.split('/');
  return parts.length === 2 && parts[1] === 'index.md'
    && (OKF_AREA_NAMES.includes(parts[0]) || parts[0] === 'chunks');
}

/** The raw frontmatter block text of a document ('' when absent). */
function fmBlock(text) {
  if (!text || !text.startsWith('---\n')) return '';
  const end = text.indexOf('\n---', 4);
  return end === -1 ? '' : text.slice(4, end);
}

const norm = v => JSON.stringify(Array.isArray(v) ? v : v == null ? null : String(v));

/** Owned keys whose parsed values differ between two documents. */
function ownedDiff(oldContent, newContent) {
  const a = frontmatter(oldContent || '');
  const b = frontmatter(newContent || '');
  return OWNED_KEYS.filter(k => norm(a[k]) !== norm(b[k]));
}

const SETS_DONE_RE = /^\s*status\s*:\s*done\b/m;
const OWNED_LINE_RE = new RegExp(`^\\s*(${OWNED_KEYS.join('|')})\\s*:`, 'm');

/**
 * A whole-file Write to a bundle document (chunk, knowledge concept, index).
 * @param {{path: string, content: string}} input  the tool-call input
 * @param {string|null} oldContent  current file content (null = new file)
 */
export function checkWrite(input, oldContent, { env = process.env, root = null } = {}) {
  if (isBundleIndexFile(input.path, env, root)) {
    return { warn: true, reason: `${input.path} is a generated/jointly-owned index — the writer regenerates it (and owns last_memorized_commit); hand edits may be overwritten. ${MEMORIZE_HINT}` }; // W6
  }
  if (isConceptFile(input.path, env, root)) {
    if (oldContent == null) {
      return { warn: true, reason: `creating ${input.path} by hand — ${MEMORIZE_HINT}` }; // W7
    }
    // Body prose stays hand-editable (an OKF feature); frontmatter changes
    // should go through the writer so timestamps/indexes stay consistent.
    if (fmBlock(oldContent) !== fmBlock(input.content || '')) {
      return { warn: true, reason: `this write changes concept frontmatter — ${MEMORIZE_HINT}` }; // W8
    }
    return null;                                                               // W9
  }
  if (!isChunkFile(input.path, env, root)) return null;                        // W1
  if (oldContent == null) {
    return { warn: true, reason: `creating ${input.path} by hand — chunk files are normally written by the chunks op (iterator_write / write.mjs)` }; // W5
  }
  const oldFm = frontmatter(oldContent);
  const newFm = frontmatter(input.content || '');
  if (newFm.status === 'done' && oldFm.status !== 'done') {
    return { block: true, reason: `status: done is set only by the /iterator-implement accept flow — ${UPDATE_HINT}` }; // W2
  }
  const diff = ownedDiff(oldContent, input.content);
  if (diff.length) {
    return { block: true, reason: `this write changes writer-owned frontmatter (${diff.join(', ')}) — ${UPDATE_HINT}` }; // W3
  }
  return null;                                                                 // W4
}

/**
 * A targeted Edit to a bundle document (chunk, knowledge concept, index).
 * @param {{path: string, edits?: Array<{oldText,newText}>, oldText?, newText?}} input
 * @param {string|null} oldContent  current file content
 */
export function checkEdit(input, oldContent, { env = process.env, root = null } = {}) {
  if (isBundleIndexFile(input.path, env, root)) {
    return { warn: true, reason: `${input.path} is a generated/jointly-owned index — the writer regenerates it (and owns last_memorized_commit); hand edits may be overwritten. ${MEMORIZE_HINT}` }; // E5
  }
  if (isConceptFile(input.path, env, root)) {
    const cEdits = Array.isArray(input.edits) ? input.edits
      : (input.oldText != null || input.newText != null) ? [input] : [];
    const cFm = fmBlock(oldContent || '');
    // Fuzzy like chunks: only edits that touch the frontmatter block warn;
    // body prose stays silently editable.
    const touchesFm = cEdits.some(e => cFm && e.oldText && cFm.includes(String(e.oldText)));
    if (touchesFm) {
      return { warn: true, reason: `this edit touches concept frontmatter — ${MEMORIZE_HINT}` }; // E6
    }
    return null;                                                               // E7
  }
  if (!isChunkFile(input.path, env, root)) return null;                        // E1
  const edits = Array.isArray(input.edits) ? input.edits
    : (input.oldText != null || input.newText != null) ? [input] : [];
  const fm = fmBlock(oldContent || '');
  const status = frontmatter(oldContent || '').status;
  const touched = new Set();
  for (const e of edits) {
    const oldText = String(e.oldText ?? '');
    const newText = String(e.newText ?? '');
    if (SETS_DONE_RE.test(newText) && status !== 'done') {
      return { block: true, reason: `status: done is set only by the /iterator-implement accept flow — ${UPDATE_HINT}` }; // E2
    }
    // Edit semantics are fuzzy (a snippet could coincide with body text), so
    // frontmatter touches that aren't an explicit `status: done` only warn.
    if (fm && oldText && fm.includes(oldText)
      && (OWNED_LINE_RE.test(oldText) || OWNED_LINE_RE.test(newText))) {
      for (const k of OWNED_KEYS) {
        if (new RegExp(`^\\s*${k}\\s*:`, 'm').test(oldText + '\n' + newText)) touched.add(k);
      }
    }
  }
  if (touched.size) {
    return { warn: true, reason: `this edit touches writer-owned frontmatter (${[...touched].join(', ')}) — ${UPDATE_HINT}` }; // E3
  }
  return null;                                                                 // E4
}

/**
 * Is a chunk mid-flight (red/green loop between test and accept)?
 * @param {Array<{slug: string, fm: object}>} chunks
 */
export function chunkInFlight(chunks) {
  for (const c of listy(chunks)) {
    if ((c.fm?.status || 'pending') !== 'pending') continue; // drafts/done never in flight
    if (c.fm?.tests_status === 'red' || listy(c.fm?.tests).length) {
      return { inFlight: true, slug: c.slug };
    }
  }
  return { inFlight: false };
}

const GIT_COMMIT_RE = /\bgit\b[^|;&]*\bcommit\b/;
const TRAILER_RE = /Chunk:\s*[A-Za-z0-9._-]+/;
const CHUNK_MSG_RE = /\b(chunk|test)\([A-Za-z0-9._-]+\)/;
const MESSAGE_FLAG_RE = /(^|\s)(-m|-F|--message|--file)\b/;

/**
 * A bash `git commit` while chunk work may be in flight. Warn-only by
 * design — never block a commit.
 * @param {{command: string}} input
 * @param {{chunks?: Array<{slug, fm}>}} [state]
 */
export function checkBashCommit(input, state = {}) {
  const cmd = String(input.command || '');
  if (!GIT_COMMIT_RE.test(cmd)) return null;                                   // B1
  if (/--amend\b/.test(cmd) && !MESSAGE_FLAG_RE.test(cmd)) return null;        // B2 (message reused)
  if (TRAILER_RE.test(cmd)) return null;                                       // B3 (covers -m heredocs)
  if (CHUNK_MSG_RE.test(cmd)) {
    return { warn: true, reason: 'this looks like a chunk commit but has no `Chunk: <slug>` trailer — the trailer is the resilient chunk↔commit link' }; // B4
  }
  const flight = chunkInFlight(state.chunks);
  if (flight.inFlight) {
    return { warn: true, reason: `chunk '${flight.slug}' is in flight — if this commit belongs to it, add a \`Chunk: ${flight.slug}\` trailer` }; // B5
  }
  return null;                                                                 // B6
}
