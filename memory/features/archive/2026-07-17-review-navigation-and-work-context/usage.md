---
type: Usage
title: Token usage
description: Per-step model/token ledger for the active plan — written only by the usage op.
totals: "{\"steps\":{\"hub\":{\"openai-codex/gpt-5.6-terra\":{\"input\":16969,\"output\":1048,\"cacheRead\":53248,\"cacheWrite\":0,\"turns\":5}},\"plan\":{\"openai-codex/gpt-5.6-terra\":{\"input\":61028,\"output\":5028,\"cacheRead\":668672,\"cacheWrite\":0,\"turns\":17}},\"implement\":{\"openai-codex/gpt-5.6-terra\":{\"input\":119901,\"output\":3970,\"cacheRead\":1700864,\"cacheWrite\":0,\"turns\":19},\"openai-codex/gpt-5.6-sol\":{\"input\":239553,\"output\":12098,\"cacheRead\":8177664,\"cacheWrite\":0,\"turns\":51}},\"review\":{\"openai-codex/gpt-5.6-sol\":{\"input\":380213,\"output\":3545,\"cacheRead\":3351040,\"cacheWrite\":0,\"turns\":21}}},\"features\":{\"retire-plan\":{\"input\":16969,\"output\":1048,\"cacheRead\":53248,\"cacheWrite\":0,\"turns\":5},\"preserve-review-across-planning\":{\"input\":549855,\"output\":9490,\"cacheRead\":4442112,\"cacheWrite\":0,\"turns\":44},\"show-active-work-in-work\":{\"input\":93148,\"output\":4839,\"cacheRead\":2952192,\"cacheWrite\":0,\"turns\":18},\"streamline-review-interface\":{\"input\":75009,\"output\":4165,\"cacheRead\":4723712,\"cacheWrite\":0,\"turns\":24}}}"
timestamp: 2026-07-17T16:30:23.274Z
---

# Usage

## hub

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 16969 | 1048 | 53248 | 0 | 5 |

## plan

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 61028 | 5028 | 668672 | 0 | 17 |

## implement

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-terra | 119901 | 3970 | 1700864 | 0 | 19 |
| openai-codex/gpt-5.6-sol | 239553 | 12098 | 8177664 | 0 | 51 |

## review

| model | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| openai-codex/gpt-5.6-sol | 380213 | 3545 | 3351040 | 0 | 21 |

## Per feature

| feature | input | output | cache read | cache write | turns |
| --- | ---: | ---: | ---: | ---: | ---: |
| retire-plan | 16969 | 1048 | 53248 | 0 | 5 |
| preserve-review-across-planning | 549855 | 9490 | 4442112 | 0 | 44 |
| show-active-work-in-work | 93148 | 4839 | 2952192 | 0 | 18 |
| streamline-review-interface | 75009 | 4165 | 4723712 | 0 | 24 |

Total: 817664 in / 25689 out / 13951488 cache-read / 0 cache-write over 113 turns.
