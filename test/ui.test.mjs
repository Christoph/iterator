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
