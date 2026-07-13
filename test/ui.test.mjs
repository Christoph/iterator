import { test } from 'node:test';
import assert from 'node:assert/strict';
import { embed, escHtml, renderPage, BASE_CSS, DIFF_CSS } from '../lib/ui.mjs';

test('embed escapes </script> so payload data cannot break the page', () => {
  const out = embed({ diff: 'x</script><script>alert(1)</script>' });
  assert.ok(!out.includes('</script>'));
  assert.ok(out.includes('\\u003c/script>'));
  assert.deepEqual(JSON.parse(out), { diff: 'x</script><script>alert(1)</script>' });
});

test('embed escapes U+2028/U+2029 and handles null', () => {
  assert.equal(embed('a b c'), '"a\\u2028b\\u2029c"');
  assert.equal(embed(null), 'null');
  assert.equal(embed(undefined), 'null');
});

test('escHtml escapes markup characters', () => {
  assert.equal(escHtml('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;');
  assert.equal(escHtml(null), '');
});

test('renderPage embeds hostile payload data inertly', () => {
  const html = renderPage({
    step: 'plan',
    title: 'x</script><script>alert(1)</script>',
    data: { evil: '</script><script>alert(2)</script>' },
    body: '<div id="x"></div>',
    clientJs: '',
  });
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(!html.includes('<script>alert(2)'));
  assert.ok(html.includes('const D = '));
});

test('renderPage includes header controls and custom labels', () => {
  const html = renderPage({ step: 't', data: {}, body: '', clientJs: '', primaryIdle: 'Accept and commit' });
  assert.ok(html.includes('Accept and commit'));
  assert.ok(html.includes('cancelFlow()'));
  assert.ok(html.includes('toggleTheme()'));
});

test('shared client JS posts to the server endpoints with the run id', () => {
  const html = renderPage({ step: 't', data: {}, body: '', clientJs: '' });
  assert.ok(html.includes('const __RUN = '));
  assert.ok(html.includes("fetch(__q('/submit')"));
  assert.ok(html.includes("sendBeacon(__q('/cancel')"));
  assert.ok(html.includes("fetch(__q('/cancel?now=1')"));
});

test('mdToHtml refuses javascript: links', () => {
  const html = renderPage({ step: 't', data: {}, body: '', clientJs: '' });
  // The linkify branch must be guarded by a protocol whitelist.
  assert.ok(html.includes('https?:|mailto:'));
});

test('CSS exports are non-empty and themed', () => {
  assert.ok(BASE_CSS.includes('[data-theme="dark"]'));
  assert.ok(BASE_CSS.includes('[data-theme="light"]'));
  assert.ok(DIFF_CSS.includes('table.dt'));
});

/* ------------------------------------------------------------------ *
 * ink & ember design tokens
 * ------------------------------------------------------------------ */

/** Extract the { --name: value } map of one [data-theme="…"] block. */
function themeTokens(theme) {
  const m = BASE_CSS.match(new RegExp(`\\[data-theme="${theme}"\\]\\{([^}]*)\\}`));
  assert.ok(m, `theme block ${theme} present`);
  const tokens = {};
  for (const decl of m[1].split(';')) {
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
  m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
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

test('view files contain no raw hex colors — every color comes from a token', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const viewsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'views');
  const offenders = [];
  for (const f of readdirSync(viewsDir)) {
    if (!f.endsWith('.mjs')) continue;
    const text = readFileSync(join(viewsDir, f), 'utf8');
    for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) offenders.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual(offenders, [], `raw hex outside lib/ui.mjs:\n${offenders.join('\n')}`);
});

test('both theme blocks define the identical token set', () => {
  const dark = Object.keys(themeTokens('dark')).sort();
  const light = Object.keys(themeTokens('light')).sort();
  assert.deepEqual(dark, light);
  // The pre-redesign contract: every variable name the views rely on exists.
  for (const name of [
    '--bg', '--surface', '--border', '--text', '--text-muted', '--text-code',
    '--add-bg', '--add-fg', '--del-bg', '--del-fg', '--hunk-bg', '--hunk-fg',
    '--dot-green', '--dot-yellow', '--dot-red', '--accent', '--fb-bg',
    '--green', '--green-hover', '--code-bg', '--bg-green', '--bg-yellow',
    '--bg-red', '--bar-green', '--bar-yellow', '--bar-red', '--drag-over',
  ]) assert.ok(dark.includes(name), `legacy token ${name} kept`);
});

test('semantic fg/bg pairs meet AA contrast (4.5:1) in both themes', () => {
  for (const theme of ['dark', 'light']) {
    const t = themeTokens(theme);
    const bg = parseColor(t['--bg']);
    for (const [fgName, bgName] of [
      ['--add-fg', '--add-bg'],
      ['--del-fg', '--del-bg'],
      ['--hunk-fg', '--hunk-bg'],
    ]) {
      const composited = over(parseColor(t[bgName]), bg);
      const ratio = contrast(parseColor(t[fgName]), composited);
      assert.ok(ratio >= 4.5,
        `${theme} ${fgName} on ${bgName}: ${ratio.toFixed(2)}:1 < 4.5:1`);
    }
    // The ember primary button label must also read.
    const btn = contrast(parseColor(t['--accent-fg']), parseColor(t['--accent']));
    assert.ok(btn >= 4.5, `${theme} --accent-fg on --accent: ${btn.toFixed(2)}:1`);
  }
});
