import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { COPIES, root } from '../scripts/sync.mjs';

test('bundled lib/ and templates/ copies match the repo-root sources', () => {
  for (const [src, dest] of COPIES) {
    assert.equal(
      readFileSync(join(root, dest), 'utf8'),
      readFileSync(join(root, src), 'utf8'),
      `${dest} is out of sync with ${src} — run \`npm run sync\``,
    );
  }
});
