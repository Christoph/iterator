/**
 * Shared OKF bundle library — the single implementation of the bundle's
 * frontmatter parsing, document editing, index/log regeneration, knowledge
 * areas, and validation. Everything that reads or writes memory/ (gather.mjs,
 * write.mjs, guardrails, the validator) converges here so the format cannot
 * drift between consumers (it did, when iterator and okf-memory each carried
 * their own copy).
 *
 * Absorbed from okf-memory: the strict parser mode + commits-continuation
 * fold (scripts/validate.mjs), regenerateAreaIndex/updateRootIndex/prependLog
 * (skills/iterator-init/write.mjs), and validateBundle.
 */
import {
  existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const nowIso = () => process.env.ITERATOR_NOW || new Date().toISOString();
export const today = () => nowIso().slice(0, 10);

/**
 * Locate a shipped template, working from both layouts this file lives in:
 * repo-root lib/ (template at ../templates/) and the synced
 * skills/iterator/lib/ copy (sibling skill at ../../iterator-plan/templates/,
 * full checkout at ../../../templates/). Returns null when not found.
 */
export function resolveTemplate(name = 'format.md') {
  const here = dirname(fileURLToPath(import.meta.url));
  return [
    join(here, '..', 'templates', name),
    join(here, '..', '..', 'iterator-plan', 'templates', name),
    join(here, '..', '..', '..', 'templates', name),
  ].find(existsSync) || null;
}

/** Coerce a frontmatter value to a list (absent → [], scalar → [scalar]). */
export const listy = (v) => (Array.isArray(v) ? v : v ? [v] : []);

export const BACKLOG_KINDS = ["idea", "bug"];

/** Read the compact, writer-owned backlog index without trusting its JSON. */
export function backlogItems(text) {
  const raw = frontmatter(text).items;
  if (typeof raw !== "string") return [];
  try {
    const items = JSON.parse(raw);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

/** Render the one-file backlog index. Individual candidates stay out of the
 * knowledge concept areas and are deliberately not active plan features. */
export function backlogIndex(items = []) {
  const normalized = items.map((item) => ({
    id: String(item.id || ""),
    title: String(item.title || ""),
    details: String(item.details || ""),
    kind: BACKLOG_KINDS.includes(item.kind) ? item.kind : "idea",
    selected: item.selected === true,
    created: String(item.created || ""),
    updated: String(item.updated || ""),
  }));
  const summary = normalized.length
    ? normalized
        .map((item) => `* [${item.kind}] ${item.title}${item.selected ? " — selected" : ""}`)
        .join("\n")
    : "(empty)";
  return `---\ntype: Backlog\ntitle: Iterator backlog\ndescription: Saved ideas and bugs kept separate from active plan features.\nitems: ${fmScalar(JSON.stringify(normalized))}\ntimestamp: ${nowIso()}\n---\n\n# Backlog\n\n${summary}\n`;
}

// Inverse of fmScalar's quoting: double-quoted values are JSON (so escapes
// like \" round-trip instead of compounding), single-quoted values use
// YAML's '' escape. Unparseable quoting falls back to a bare strip.
const unquote = (s) => {
  if (/^".*"$/.test(s)) {
    try { return JSON.parse(s); } catch { return s.slice(1, -1); }
  }
  if (/^'.*'$/.test(s)) return s.slice(1, -1).replaceAll("''", "'");
  return s;
};

/** Split an inline list body on top-level commas only (quote-aware). */
function splitInlineList(s) {
  const items = [];
  let cur = '', q = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      cur += ch;
      if (q === '"' && ch === '\\') { cur += s[++i] ?? ''; continue; }
      if (ch === q) q = null;
    } else if (ch === '"' || ch === "'") { q = ch; cur += ch; }
    else if (ch === ',') { items.push(cur); cur = ''; }
    else cur += ch;
  }
  items.push(cur);
  return items.map(x => unquote(x.trim())).filter(Boolean);
}

/**
 * Minimal YAML frontmatter parser for the bundle's schema (see format.md):
 * scalars (optionally quoted), inline lists `[a, b]`, block lists (`- item`),
 * and block-list item mappings — iterator's `commits:` entries (`- sha: …`
 * followed by indented `kind:`/`date:` lines) fold into one string per item,
 * e.g. `"sha: abc, kind: implement, date: 2026-07-06"`.
 *
 * Default mode never throws: no/unclosed frontmatter → {}, unparseable lines
 * are skipped. `strict: true` is validator mode: no frontmatter → null,
 * unclosed or unparseable → throw.
 */
export function frontmatter(text, { strict = false } = {}) {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) {
    return strict ? null : {};
  }
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!m) {
    if (strict) throw new Error('frontmatter is not closed with ---');
    return {};
  }
  const fm = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      const val = kv[2].trim();
      if (val === '') fm[key] = null; // may be followed by a block list
      else if (val.startsWith('[') && val.endsWith(']')) {
        fm[key] = splitInlineList(val.slice(1, -1));
      } else fm[key] = unquote(val);
      continue;
    }
    if (key) {
      const item = line.match(/^\s+-\s+(.*)$/);
      if (item) {
        if (!Array.isArray(fm[key])) fm[key] = [];
        fm[key].push(unquote(item[1].trim()));
        continue;
      }
      // Continuation keys fold ONLY into a list item that is itself a
      // mapping start (`- sha: …` + `kind:`/`date:` lines — the commits
      // shape); folding into a plain string item would corrupt it silently.
      const cont = line.match(/^\s+([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (cont && Array.isArray(fm[key]) && fm[key].length &&
          /^[A-Za-z0-9_-]+:\s/.test(String(fm[key][fm[key].length - 1]))) {
        fm[key][fm[key].length - 1] += `, ${cont[1]}: ${cont[2]}`;
        continue;
      }
    }
    if (strict) throw new Error(`cannot parse frontmatter line: ${line}`);
  }
  return fm;
}

/** The markdown body after the frontmatter block (or the whole text). */
export function body(text) {
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---', 4);
    if (end !== -1) {
      const nl = text.indexOf('\n', end + 4);
      return nl === -1 ? '' : text.slice(nl + 1);
    }
  }
  return text;
}

/**
 * Split a document body into its `# Heading` sections (fence-aware, so a
 * `# comment` line inside a snippet's code block is not a heading).
 */
export function sections(text) {
  const out = {};
  let name = null, buf = [], fence = false;
  for (const line of body(text).split('\n')) {
    if (/^```/.test(line)) fence = !fence;
    if (!fence && /^# /.test(line)) {
      if (name) out[name] = buf.join('\n').trim();
      name = line.slice(2).trim();
      buf = [];
    } else if (name) buf.push(line);
  }
  if (name) out[name] = buf.join('\n').trim();
  return out;
}

/** Parse fenced code blocks out of a `# Snippets` section. */
export function snippets(text) {
  const out = [];
  const re = /```(\w*)\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text || ''))) {
    out.push({ lang: m[1] || '', code: m[2].replace(/\n$/, '') });
  }
  return out;
}

/** `files` entries are exact paths or simple globs (`*`, `**`). */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else re += '[^/]*';
    } else if ('.+^$()|{}[]\\?'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp('^' + re + '$');
}

/**
 * Concepts whose `files:` anchors intersect a feature's `files` globs (or a
 * plain path list). Both sides may be globs, so the match is bidirectional:
 * an anchor `lib/server.mjs` matches a feature glob `lib/*.mjs`, and an anchor
 * `lib/views/*` matches a feature path `lib/views/hub.mjs`.
 */
export function matchConcepts(concepts, fileGlobs) {
  const globs = listy(fileGlobs).map(String);
  const res = globs.map(globToRegExp);
  return concepts.filter(c => listy(c.files).some(anchor => {
    const a = String(anchor);
    if (res.some(re => re.test(a))) return true;
    const anchorRe = globToRegExp(a);
    return globs.some(g => anchorRe.test(g));
  }));
}

// ---------------------------------------------------------------------------
// Textual frontmatter/body editing (preserves everything not being changed —
// the frontmatter parser is lossy for block lists, so never round-trip
// through it when updating an existing file).

export function splitDoc(raw) {
  if (raw.startsWith('---\n')) {
    const end = raw.indexOf('\n---', 4);
    if (end !== -1) {
      const nl = raw.indexOf('\n', end + 4);
      return { fm: raw.slice(4, end), body: nl === -1 ? '' : raw.slice(nl + 1) };
    }
  }
  return { fm: null, body: raw };
}

export const joinDoc = (fm, body) => `---\n${fm}\n---\n${body}`;

/** Quote a frontmatter scalar only when YAML would misread it bare. */
export function fmScalar(v) {
  const s = String(v).replace(/\s+/g, ' ').trim();
  return /[:#[\]{}"'`|>&*!%@\n]/.test(s) ? JSON.stringify(s) : s;
}

export function formatFmValue(key, value) {
  if (Array.isArray(value)) {
    const quoted = ['files', 'tests'].includes(key);
    return `[${value.map(v => quoted ? JSON.stringify(String(v)) : fmScalar(v)).join(', ')}]`;
  }
  return fmScalar(value);
}

/** Set/replace top-level scalar or inline-list keys in a frontmatter block. */
export function setFmKeys(fm, obj) {
  let out = fm;
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    const line = `${k}: ${formatFmValue(k, v)}`;
    const re = new RegExp(`^${k}:.*$`, 'm');
    // Replacer function: a value containing `$&`/`$'` must never be treated
    // as a replacement pattern (it would splice the old line into itself).
    out = re.test(out) ? out.replace(re, () => line) : `${out.replace(/\s*$/, '')}\n${line}`;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Knowledge areas (shared with the knowledge skills — one copy, not three)

/** The OKF knowledge areas: dir → [index title, default description]. */
export const OKF_AREAS = {
  architecture: ['Architecture', 'How the system is structured.'],
  decisions: ['Decisions', 'Durable product and implementation choices agents should preserve.'],
  patterns: ['Patterns & Conventions', 'How code and workflows are written in this repo.'],
  pitfalls: ['Pitfalls', 'Known bugs, portability hazards, and sharp edges.'],
  setup: ['Setup', 'Commands, install flows, and the development loop.'],
};

export const OKF_AREA_NAMES = Object.keys(OKF_AREAS);

/** Rebuild an area index's bullet list, preserving its heading and prose. */
export function regenerateAreaIndex(memDir, area) {
  const dir = join(memDir, area);
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'index.md')
    .map(f => {
      const fm = frontmatter(readFileSync(join(dir, f), 'utf8'));
      return {
        slug: f.slice(0, -3),
        title: String(fm.title || f.slice(0, -3)),
        description: String(fm.description || ''),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
  const indexFile = join(dir, 'index.md');
  const [title, desc] = OKF_AREAS[area] || [area, ''];
  let head = `# ${title}\n\n${desc}\n`;
  if (existsSync(indexFile)) {
    const lines = readFileSync(indexFile, 'utf8').split('\n');
    const i = lines.findIndex(l => /^\s*[*-]\s+\[/.test(l));
    head = (i === -1 ? lines.join('\n') : lines.slice(0, i).join('\n')).replace(/\s*$/, '\n');
  }
  const bullets = entries.map(e => `* [${e.title}](/${area}/${e.slug}.md) - ${e.description}`);
  writeFileSync(indexFile, `${head}\n${bullets.join('\n')}\n`.replace(/\n{3,}/g, '\n\n'));
}

/**
 * Preserve the root index while adding missing area links and (optionally)
 * advancing `last_memorized_commit`. Never removes foreign keys or links —
 * the root index is jointly owned (see also mergeRootIndex for the
 * plan/features link side).
 */
export function updateRootIndex(memDir, touchedAreas = [], { advanceTo = null } = {}) {
  mkdirSync(memDir, { recursive: true });
  const indexFile = join(memDir, 'index.md');
  const raw = existsSync(indexFile)
    ? readFileSync(indexFile, 'utf8')
    : '---\nokf_version: "0.1"\n---\n\n# Project memory\n';
  const doc = splitDoc(raw);
  let fm = doc.fm ?? 'okf_version: "0.1"';
  if (advanceTo) {
    fm = /^last_memorized_commit:/m.test(fm)
      ? fm.replace(/^last_memorized_commit:.*$/m, `last_memorized_commit: ${advanceTo}`)
      : `${fm.replace(/\s*$/, '')}\nlast_memorized_commit: ${advanceTo}`;
  }
  const lines = doc.body.split('\n');
  const missing = [];
  for (const area of touchedAreas) {
    if (!existsSync(join(memDir, area))) continue;
    const re = new RegExp(`\\]\\(/?${area}/\\)`);
    if (!lines.some(l => /^\s*[*-]\s+\[/.test(l) && re.test(l))) {
      const [title, desc] = OKF_AREAS[area] || [area, ''];
      missing.push(`* [${title}](/${area}/) - ${desc}`);
    }
  }
  if (missing.length) {
    let last = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/^\s*[*-]\s+\[/.test(lines[i])) { last = i; break; }
    }
    if (last === -1) lines.push('', ...missing);
    else lines.splice(last + 1, 0, ...missing);
  }
  const newBody = lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n');
  writeFileSync(indexFile, joinDoc(fm, newBody));
}

/**
 * Merge iterator's links into the bundle root index WITHOUT owning the file:
 * the knowledge side keeps its frontmatter (`last_memorized_commit`, unknown
 * keys), heading, prose, and area links. Iterator's own link lines are
 * replaced in place when present, appended once when missing.
 */
export function mergeRootIndex(existing, links) {
  if (!existing) {
    return `---\nokf_version: "0.1"\n---\n\n# Project memory\n\n${links.map(([, l]) => l).join('\n')}\n`;
  }
  const doc = splitDoc(existing);
  let fm = doc.fm;
  if (fm === null) fm = 'okf_version: "0.1"';
  else if (!/^okf_version:/m.test(fm)) fm = `okf_version: "0.1"\n${fm.replace(/\s*$/, '')}`;
  const lines = doc.body.split('\n');
  const missing = [];
  let lastBullet = -1;
  for (const [target, line] of links) {
    const esc = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\]\\(/?${esc}\\)`);
    const i = lines.findIndex(l => /^\s*[*-]\s+\[/.test(l) && re.test(l));
    if (i !== -1) { lines[i] = line; lastBullet = Math.max(lastBullet, i); }
    else missing.push(line);
  }
  if (missing.length) {
    if (lastBullet === -1) {
      for (let i = lines.length - 1; i >= 0; i--) {
        if (/^\s*[*-]\s+\[/.test(lines[i])) { lastBullet = i; break; }
      }
    }
    if (lastBullet === -1) lines.push('', ...missing);
    else lines.splice(lastBullet + 1, 0, ...missing);
  }
  const newBody = lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n');
  return joinDoc(fm, newBody);
}

/**
 * Prepend log entries under today's `## date` heading (newest first).
 * `entries` is a string or an array; `header` names the file on creation only.
 */
export function prependLog(memDir, entries, { header = '# Memory Update Log' } = {}) {
  const list = listy(entries);
  if (!list.length) return;
  const file = join(memDir, 'log.md');
  const day = `## ${today()}`;
  let text = existsSync(file) ? readFileSync(file, 'utf8') : `${header}\n`;
  const bullets = list.map(e => `* ${e}`).join('\n');
  if (text.includes(`${day}\n`)) {
    text = text.replace(`${day}\n`, `${day}\n${bullets}\n`);
  } else {
    const lines = text.split('\n');
    const i = lines.findIndex(l => l.startsWith('# '));
    lines.splice(i + 1, 0, '', day, bullets);
    text = lines.join('\n');
  }
  writeFileSync(file, text.replace(/\n{3,}/g, '\n\n'));
}

// ---------------------------------------------------------------------------
// Validation (absorbed from okf-memory's scripts/validate.mjs)

const RESERVED = new Set(['index', 'log']);

/**
 * Validate a bundle directory: root index.md with parseable frontmatter, and
 * every non-reserved .md (any depth) carries frontmatter with a non-empty
 * `type`. Returns { ok, errors } and never throws.
 */
export function validateBundle(bundlePath = 'memory') {
  const errors = [];
  const root = bundlePath;
  const fail = (file, msg) => errors.push(`${file}: ${msg}`);

  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return { ok: false, errors: [`${root}: bundle directory does not exist`] };
  }
  const rootIndex = join(root, 'index.md');
  if (!existsSync(rootIndex)) fail('index.md', 'missing root index.md');
  else {
    try {
      const fm = frontmatter(readFileSync(rootIndex, 'utf8'), { strict: true });
      if (!fm) fail('index.md', 'missing frontmatter');
    } catch (err) {
      fail('index.md', err.message);
    }
  }

  function visit(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) { visit(full); continue; }
      if (!stat.isFile() || extname(entry).toLowerCase() !== '.md') continue;

      const rel = relative(root, full);
      if (RESERVED.has(basename(entry, '.md'))) continue;

      let fm;
      try {
        fm = frontmatter(readFileSync(full, 'utf8'), { strict: true });
      } catch (err) {
        fail(rel, err.message);
        continue;
      }
      if (!fm) { fail(rel, 'missing frontmatter'); continue; }
      if (typeof fm.type !== 'string' || !fm.type.trim()) {
        fail(rel, 'frontmatter type is required and must be non-empty');
      }
    }
  }
  visit(root);
  return { ok: errors.length === 0, errors };
}
