---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":62823,\"output\":825,\"cacheRead\":466432,\"cacheWrite\":0,\"turns\":8}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":66034,\"output\":4504,\"cacheRead\":1607680,\"cacheWrite\":0,\"turns\":19}},\"test\":{\"openai-codex/gpt-5.6-terra\":{\"input\":201308,\"output\":7012,\"cacheRead\":13754880,\"cacheWrite\":0,\"turns\":92}}},\"features\":{\"retire-plan\":{\"input\":62823,\"output\":825,\"cacheRead\":466432,\"cacheWrite\":0,\"turns\":8},\"knowledge-controls\":{\"input\":139257,\"output\":3784,\"cacheRead\":2186240,\"cacheWrite\":0,\"turns\":20},\"nonblocking-working-overlay\":{\"input\":62051,\"output\":3228,\"cacheRead\":11568640,\"cacheWrite\":0,\"turns\":72}}}"
timestamp: 2026-07-14T11:37:28.853Z
---

# Usage

## hub

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 62823 | 825 | 466432 | 0 | 8 |

## plan

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 66034 | 4504 | 1607680 | 0 | 19 |

## test

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 201308 | 7012 | 13754880 | 0 | 92 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 62823 | 825 | 466432 | 0 | 8 |
| knowledge-controls | 139257 | 3784 | 2186240 | 0 | 20 |
| nonblocking-working-overlay | 62051 | 3228 | 11568640 | 0 | 72 |

Total: 330165 in / 12341 out / 15828992 cache-read / 0 cache-write over 119 turns.
