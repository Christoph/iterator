# Iterator overhaul — implementation state (2026-07-13)

**ALL 13 PHASES COMPLETE — suite green 208/208.**

Plan: `~/.claude/plans/zany-riding-squirrel.md` (13 phases, approved).
Branch: `iterator/okf-gather-staleness-range` — **everything below is uncommitted
working-tree state** (user handles git; branch creation and commits were
deliberately not done by the agent). `ISSUES.md` is the user's own untracked
file — do not touch.

## Done (code + tests landed, suite was green through P8: 198/198)

- **P1 sync-repair-and-hook** — copies re-synced (sync test green again);
  `scripts/githooks/pre-commit` added; `npm run hooks:install` added to
  package.json; `core.hooksPath` already set locally; CONTRIBUTING.md updated.
- **P2 lib-ownership-inversion** — `skills/iterator/{gather,write}.mjs` moved
  to `lib/gather.mjs` / `lib/write.mjs` (imports now `./bundle.mjs`; template
  candidates updated for both layouts); new `lib/app.mjs` (control plane
  extracted from the server); `skills/iterator/{gather,write,server}.mjs` are
  now thin shims (re-export + `runCli`); `scripts/sync.mjs` COPIES gained
  gather/write/app (and later git.mjs); test imports moved to `../lib/*`;
  new `test/shims.test.mjs` (CLI contract).
- **P3 bundle-roundtrip-fixes** (`lib/bundle.mjs`) — `unquote` JSON-parses
  double-quoted scalars (S3); `setFmKeys` uses a replacer fn (S4 `$&`
  injection); quote-aware `splitInlineList` (S5); continuation folding only
  into mapping-shaped list items (S14); round-trip property tests added.
- **P4 gather-hardening** — new `lib/git.mjs` (git/gitOrFail/hasStaged, one
  copy); gather CLI error envelope `{ok:false,error}` (S2); `parseDiff` keeps
  binary files, decodes git C-quoted paths, tracks renames (S9);
  `chunkCommitMap()` single trailer scan memoized per (root, HEAD) replaces
  per-chunk `git log --grep` (O2); shared `commitsSince` helper.
- **P5 review-untracked-files** — `gatherReview` intent-to-adds (`git add -N`)
  untracked files so they diff + marks `untracked:true` (S6); hub `hasDiff`
  includes untracked; `acceptCommit` stages review-mapped paths ∪ chunk-glob
  matches, guards the empty pathspec (never bare `git add -A --`), fails with
  "nothing to stage" (S7). Tests cover both.
- **P6 write-hardening** — `applyAdjustments` validates the whole batch before
  writing (S8); `advanceTo:"HEAD"`/`advance:true` resolved via `git rev-parse`
  in memorize + apply-review (O1, consolidate still rejects headCommit);
  `normalizeSlug` auto-repair with `normalized:[{from,to}]` reported in
  chunks + memorize ops (O3 — note: one old test updated, "Bad Slug" now
  normalizes, `!!!` still fails); `updateChunk` gained `{regen:false}` opt and
  `acceptCommit` regenerates once (batching).
- **P7 guardrail-server-extension** — `bundleSubpath`/is*File/checkWrite/
  checkEdit accept a resolved project `root` and anchor exactly (S10;
  substring match kept as fallback; extension passes `projectRoot(ctx.cwd)` +
  absolute path); `/submit` parse-validates body → `{type:"error"}` on garbage
  (S11); new gather `--step session` returns `{hub, implement, memorize}` and
  the extension memoizes one snapshot per turn (`invalidateSession()` on
  agent_end + both write tools) (S12).
- **P8 write-ops-expansion** — `resolveTemplate()` in bundle.mjs (3 probe
  sites deduped); `conceptFmValue` reuses `fmScalar`; `commit-tests` op
  (branch safety, staging, `test(<slug>)` commit + trailer, tests/tests_status
  + sha recording, bookkeeping commit) (O8); `extensions` op writes
  EXTENSIONS.md boilerplate + root-index link, idempotent (okf-init's
  ~350-token contract moved to JS); `warnings.unmatchedGlobs` on chunks op
  (O4); `validateBundle` runs after EVERY op via the `applyOp` wrapper,
  results carry `{validation}` (O7); `write.mjs --schema <op>` prints compact
  payload shapes (SCHEMAS table above `runCli`).

## Done: P9 diet-support-surfaces (suite green: 202/202)

- `lib/server.mjs`: `serve()` accepts `reports: {cancel, timeout}`; cancel and
  timeout results carry `report` strings.
- `lib/app.mjs`: one-command request form `{gather:true, step, chunk?,
  project?, extra?}` gathers in-process via a `GATHERS` map (mirrors
  iterator_ui); `CANCEL_REPORTS` per step; `actionSkill()` adds
  `result.skill` to hub/knowledge action results; `appliedSummary()` adds
  `applied.summary` after apply-review; onSubmit is now always passed to
  serve().
- `lib/write.mjs`: CLI error envelope gained a `hint` ("--schema <op>…").
- `lib/gather.mjs`: `gatherTest` gained `suggestedTestPath` (+
  `suggestTestPath()` helper); `gatherRange` and `gatherImplement` gained
  pre-composed `advice` strings.
- Hang resolved: it was NOT the one-command test (which passes) — five older
  server tests failed against the intended P9 result shapes (cancel lines now
  carry `report`; `update-memory` action results gain `skill:"okf"`), and a
  failing test leaked its spawned server child (2h idle timeout) which kept
  the runner alive. Fixes in `test/server.test.mjs`: assertions updated
  (`PLAN_CANCEL_LINE`, knowledge-view `skill` field); `startServer` children
  tracked in a `CHILDREN` set killed by a global `after()` hook; one-command
  test cleanup rewritten (kills child, removes temp dir). Plus a real P9 bug:
  `gatherImplement` advice joined chunk OBJECTS (`[object Object]`) — now
  `ready.map((c) => c.slug).join(", ")` (lib/gather.mjs:424).
- Note for grep: `lib/gather.mjs` contains a literal NUL in the
  `chunkCommitMap` cache key, so grep treats it as binary — use `grep -a`.

## Done: P10a/b skill-diet (suite green: 205/205)

- All 11 SKILL.mds rewritten (82.6k → 57.6k chars incl. the two new shared
  docs, ~30% cut): new `skills/iterator/PI.md` (single pi-mode doc, one
  reference line per skill) and `skills/okf/PROTOCOL.md` (shared okf
  preconditions / review round / React-Finish / card schema).
- Core skills lean on P8/P9: one-command `{gather:true,step,...,extra}`
  serve for hub/plan/chunk/test/review/knowledge; `result.skill` replaced the
  hub dispatch table; cancel prose → "relay the result's `report`";
  commit-tests op replaced iterator-test's record/commit choreography;
  extensions op replaced okf-init's EXTENSIONS.md boilerplate; range
  pointer-state table → gather `advice`; implement wave/stuck branches →
  gather `advice`; `suggestedTestPath` referenced in iterator-test.
- Exception kept deliberately: iterator-implement's commit-review still uses
  the two-step gather→augment→serve pipe, because per-chunk `tests` badges
  live inside `chunks[]` entries and the one-command `extra` merge is shallow.
- iterator-design: only the pi block (→ PI.md line) and Relationship section
  removed.
- New `test/skills.test.mjs`: every `<skill-dir>` path in the skill docs
  resolves to an existing file; every SKILL.md points at PI.md (directly or
  via PROTOCOL.md); ops named in the docs exist in write.mjs.
- Manually verified: one-command hub gather+serve+cancel (report string OK)
  and plan-step `extra` merge (title renders, plan cancel report OK).

## Done: P11 ui-design-system (suite green: 207/207)

- `lib/ui.mjs` BASE_CSS rewritten as "ink & ember": `:root` tokens
  (`--font-display` Iowan/Palatino serif, `--font-ui` Avenir/system,
  `--font-mono`; type scale `--fs-xs..--fs-2xl` 11/13/15.5/19/23/27.5 +
  `--fs-mono` 12.5; `--sp-1..6` 4px grid; `--radius-sm/card`); warm charcoal
  dark (`--bg:#16151a`, accent `#e08a4e`) and warm paper light (`#f7f5f1`,
  accent `#b35a1f`); every legacy variable NAME kept, new tokens additive
  (`--accent-soft`, `--accent-fg`, `--focus-ring`, `--shadow-card/raise`).
  Global `:focus-visible` ring; serif italic logotype; ember primary button
  (`--accent`/`--accent-fg`) with hover/pressed states; DIFF_CSS on tokens.
- Tests appended to `test/ui.test.mjs`: theme token-set parity (+ legacy-name
  contract), WCAG AA (4.5:1) on add/del/hunk fg-over-composited-bg pairs and
  the primary-button pair, both themes. Embed-safety tests unchanged.
- Verified live: served hub page carries the new tokens.

## Done: P12a/b ui-view-passes (suite green: 208/208)

- All 7 views restyled on the P11 tokens (declarations only; class names and
  hasChanges/onPrimary contracts untouched): hub (serif plan title + hero
  with inline empty-state SVG, ember primary-act, left-rail status accents on
  cards, segmented progress ticks via `.pbar::after`), plan (two-column
  `#sections` grid ≥720px, serif h1, card-shadowed sections), chunk
  (serif summary values, card shadows/hover), test (serif h1, mono kind
  badges), review (sticky mono file headers — `.fc{overflow:visible}`
  override, pitfalls as ember `--accent-soft` asides, status buttons as a
  segmented control with `:focus-visible` inset outline), memory-review
  (mono uppercase badges, verdict segmented control focus states,
  `--accent-fg` on solid verdict fills), knowledge (serif metrics, outlined
  stale badge, mono micro-labels).
- Emoji badges → CSS dots (`.sdot`/`.st`): hub test/status chips, chunk
  draft chip, test-view mode banner, review tests badge. Decorative ⚠/💬
  glyphs kept (icons, not badges).
- Zero raw hex left in lib/views/*; enforced by a new regex test in
  test/ui.test.mjs (`mask-image` now uses `black`, button text uses
  `--accent-fg`).

## Done: P13 docs-and-closeout (suite green: 208/208)

- `docs/ARCHITECTURE.md`: repo tree reflects the lib inversion (all cores +
  7 views under lib/, hub skill = shims + copy, okf skills, githooks);
  hub-skill paragraph rewritten (shims, hooks:install); ui.mjs bullet covers
  the ink & ember tokens + AA/no-raw-hex tests; round-trip step 1 documents
  the one-command form.
- `CONTRIBUTING.md`: tree updated the same way; app.mjs is the control plane;
  invocation flow uses the one-command form + `--schema`; new-skill steps
  point at lib/app.mjs VIEWS; preview list gains knowledge/memory-review.
- `README.md`: "How it works" step 1 covers the one-command form.
- `IDEAS.md`: §7 and §8 marked 🟡 partial with what shipped (server-side
  apply + one-command + result.skill; validateBundle after every op).
- Final `npm run sync && npm test`: 208/208.

## Invariants to keep

- `npm run sync` before running tests/committing (pre-commit hook does it).
- Suite must stay green each phase; commit style `chunk(<slug>): …` with
  `Chunk: <slug>` trailer (user does the committing).
- Result-shape changes must stay additive (pi tools pass results through).
